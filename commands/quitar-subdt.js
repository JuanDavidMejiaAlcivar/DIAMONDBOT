const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db, card, dm, technicalRoleId } = require('../utils/rosterCommands');
const { replyError, replyWarn } = require('../utils/errorEmbeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quitar-subdt')
    .setDescription('Quita al Subdirector Técnico de tu equipo')
    .addUserOption(o => o.setName('usuario').setDescription('Subdirector Técnico que será retirado del cargo').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('usuario');

    // ── Validaciones básicas del objetivo ──────────────────────────────────
    if (target.bot) {
      return replyError(interaction, 'Usuario no válido', 'Un bot no puede ocupar ni ser retirado de cargos técnicos.');
    }

    if (target.id === interaction.user.id) {
      return replyWarn(interaction,
        'Acción no permitida',
        `No puedes retirarte el cargo a ti mismo con este comando.\n\n` +
        `> Si deseas abandonar tu puesto o salir del equipo, utiliza los canales administrativos adecuados.`
      );
    }

    // ── Validaciones del operador (quien ejecuta) ──────────────────────────
    const senderRecord = db.obtenerMiembro(interaction.user.id);
    if (!senderRecord || senderRecord.inconsistent) {
      return replyError(interaction,
        'Sin registro en el sistema',
        `No tienes ningún equipo registrado en el sistema.\n\n` +
        `> Solo el **Director Técnico** puede remover a su Sub-DT.`
      );
    }

    const myTeam = db.obtenerEquipoPorId(senderRecord.team_id);
    if (!myTeam) {
      return replyError(interaction, 'Error interno', 'No se pudo localizar tu equipo en la base de datos.');
    }

    if (myTeam.director_tecnico_id !== interaction.user.id) {
      return replyError(interaction,
        'Permisos insuficientes',
        `Solo el **Director Técnico** del equipo puede remover al Subdirector Técnico.\n\n` +
        `> Actualmente ocupas el cargo de **${senderRecord.role === 'SUB_DT' ? 'Subdirector Técnico' : 'Jugador'}** en ${myTeam.nombre}.`,
        [{ name: '🛡️ Tu equipo', value: myTeam.nombre, inline: true }, { name: '👔 Tu cargo', value: senderRecord.role || 'Jugador', inline: true }]
      );
    }

    // ── Validaciones del cargo y el equipo ─────────────────────────────────
    const targetRecord = db.obtenerMiembro(target.id);

    if (targetRecord?.inconsistent) {
      return replyError(interaction,
        'Registro inconsistente',
        `El registro de <@${target.id}> presenta inconsistencias.\n\n` +
        `> Contacta a un administrador para que lo solucione.`
      );
    }

    if (!targetRecord) {
      return replyWarn(interaction,
        'Jugador no registrado',
        `<@${target.id}> no pertenece a ningún equipo en el sistema.`
      );
    }

    if (targetRecord.team_id !== myTeam.id) {
      const otroEquipo = db.obtenerEquipoPorId(targetRecord.team_id);
      return replyError(interaction,
        'Jugador de otro equipo',
        `<@${target.id}> pertenece a **${otroEquipo?.nombre || 'otro equipo'}**.\n\n` +
        `> Solo puedes gestionar a miembros de tu propia plantilla.`
      );
    }

    if (myTeam.sub_director_tecnico_id !== target.id || targetRecord.role !== 'SUB_DT') {
      return replyWarn(interaction,
        'Cargo incorrecto',
        `<@${target.id}> no figura como el **Subdirector Técnico** de tu equipo.\n\n` +
        `> Este comando solo se utiliza para destituir a un Sub-DT.`
      );
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return replyError(interaction,
        'Usuario no encontrado',
        `<@${target.id}> ya no se encuentra en el servidor de Discord.\n\n` +
        `> No se pueden realizar cambios. Contacta a un administrador.`
      );
    }

    // ── Ejecutar remoción ──────────────────────────────────────────────────
    const roleId = technicalRoleId('SUB_DT');
    if (roleId && !member.roles.cache.has(roleId)) {
      console.warn(`Inconsistencia: ${target.id} es Sub-DT en BD pero no tiene el rol de Discord correspondiente.`);
    }

    try {
      if (roleId && member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId, `Retiro de Sub-DT por ${interaction.user.id}`);
      }
      
      db.quitarSubDt(myTeam.id, target.id, interaction.user.id);
    } catch (error) {
      console.error('Error quitando Sub-DT:', error);
      if (roleId && !member.roles.cache.has(roleId)) {
        await member.roles.add(roleId).catch(e => console.error('Error reponiendo rol tras fallo:', e));
      }
      return replyError(interaction, 'Error al procesar la destitución', 'No se pudo retirar el cargo por un problema interno. Contacta a un administrador.');
    }

    const colorInt = myTeam.color_primario?.startsWith('#') ? parseInt(myTeam.color_primario.slice(1), 16) : 0x00bfa6;
    
    await dm(target, 
      `Has sido retirado del cargo de **Subdirector Técnico** de:\n\n**${myTeam.nombre}**\n\n` +
      `> Conservas tu rol de equipo y sigues formando parte de la plantilla como jugador regular.`, 
      'retiro de Sub-DT'
    );

    const embed = new EmbedBuilder()
      .setColor(colorInt)
      .setTitle('📉 Cargo técnico retirado')
      .setDescription(`<@${target.id}> ha sido removido de su cargo como **Sub-Director Técnico**.\n\n> *A partir de ahora, vuelve a ser un jugador regular de **${myTeam.nombre}**.*`)
      .setTimestamp();
    
    if (myTeam.escudo) embed.setThumbnail(myTeam.escudo);

    return interaction.editReply({ embeds: [embed] });
  },
};
