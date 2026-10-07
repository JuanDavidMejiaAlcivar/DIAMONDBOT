const { SlashCommandBuilder } = require('discord.js');
const { db, getOperator, card, dm, fetchTeamRole } = require('../utils/rosterCommands');
const { replyError, replyWarn } = require('../utils/errorEmbeds');
const { COMMAND_CHANNELS, checkChannel } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dar-de-baja')
    .setDescription('Libera a un jugador de tu equipo')
    .addUserOption(o => o.setName('usuario').setDescription('Jugador que será dado de baja').setRequired(true)),

  async execute(interaction) {
    // ── Verificar canal correcto ────────────────────────────────────────────
    const channelCheck = checkChannel(interaction, COMMAND_CHANNELS.darDeBaja, 'dar-de-baja');
    if (!channelCheck.isCorrect) {
      return interaction.reply(channelCheck.reply);
    }

    await interaction.deferReply();

    // ── Verificar identidad del operador ────────────────────────────────────
    const senderRecord = db.obtenerMiembro(interaction.user.id);

    if (!senderRecord || senderRecord.inconsistent) {
      return replyError(interaction,
        'Sin registro en el sistema',
        `No tienes ningún equipo registrado en el sistema de Diamonds League.\n\n` +
        `> Solo los **Directores Técnicos** y **Subdirectores Técnicos** pueden dar de baja jugadores.`
      );
    }

    if (senderRecord.role === 'PLAYER') {
      const myTeam = db.obtenerEquipoPorId(senderRecord.team_id);
      return replyError(interaction,
        'Sin permisos de gestión',
        `Eres un **jugador** de ${myTeam ? `**${myTeam.nombre}**` : 'un equipo'} y no tienes autoridad para dar de baja a otros jugadores.\n\n` +
        `> Solo el **Director Técnico** o el **Subdirector Técnico** pueden gestionar la plantilla.`,
        myTeam ? [{ name: '🛡️ Tu equipo', value: myTeam.nombre, inline: true }, { name: '👔 Tu cargo', value: 'Jugador', inline: true }] : []
      );
    }

    const myTeam = db.obtenerEquipoPorId(senderRecord.team_id);
    if (!myTeam) {
      return replyError(interaction,
        'Error en el registro',
        `Tu equipo no pudo ser localizado. Contacta a un administrador.`
      );
    }

    // ── Verificar jugador objetivo ──────────────────────────────────────────
    const target = interaction.options.getUser('usuario');

    if (target.bot) {
      return replyError(interaction, 'Usuario no válido', 'No puedes dar de baja a un bot.');
    }

    if (target.id === interaction.user.id) {
      return replyWarn(interaction,
        'Acción no permitida',
        `No puedes darte de baja a ti mismo con este comando.\n\n` +
        `> Si quieres abandonar tu equipo, utiliza el comando **/renunciar**.`
      );
    }

    const record = db.obtenerMiembro(target.id);

    if (record?.inconsistent) {
      return replyError(interaction,
        'Registro inconsistente',
        `El registro de <@${target.id}> presenta inconsistencias.\n\n` +
        `> Contacta a un administrador para resolver el problema.`
      );
    }

    if (!record) {
      return replyWarn(interaction,
        'Jugador no registrado',
        `<@${target.id}> no pertenece a ningún equipo registrado en el sistema.\n\n` +
        `> No hay nada que hacer aquí.`
      );
    }

    if (record.role === 'DT') {
      const theirTeam = db.obtenerEquipoPorId(record.team_id);
      return replyError(interaction,
        'Operación no permitida',
        `<@${target.id}> es el **Director Técnico** de ${theirTeam ? `**${theirTeam.nombre}**` : 'un equipo'} y no puede ser dado de baja con este comando.\n\n` +
        `> Para remover a un DT, utiliza los comandos de gestión administrativa correspondientes.`,
        theirTeam ? [{ name: '🛡️ Equipo', value: theirTeam.nombre, inline: true }, { name: '👔 Cargo', value: 'Director Técnico', inline: true }] : []
      );
    }

    if (record.role === 'SUB_DT') {
      const theirTeam = db.obtenerEquipoPorId(record.team_id);
      return replyError(interaction,
        'Operación no permitida',
        `<@${target.id}> es el **Subdirector Técnico** de ${theirTeam ? `**${theirTeam.nombre}**` : 'un equipo'} y no puede ser dado de baja con este comando.\n\n` +
        `> Para remover al Sub-DT, utiliza **/quitar-subdt**.`,
        theirTeam ? [{ name: '🛡️ Equipo', value: theirTeam.nombre, inline: true }, { name: '👔 Cargo', value: 'Subdirector Técnico', inline: true }] : []
      );
    }

    if (record.team_id !== myTeam.id) {
      const theirTeam = db.obtenerEquipoPorId(record.team_id);
      return replyError(interaction,
        'Jugador de otro equipo',
        `<@${target.id}> pertenece a **${theirTeam?.nombre || 'otro equipo'}** y no a tu equipo.\n\n` +
        `> Solo puedes dar de baja a jugadores de **${myTeam.nombre}**.`,
        [
          { name: '🛡️ Equipo del jugador', value: theirTeam?.nombre || '—', inline: true },
          { name: '🛡️ Tu equipo', value: myTeam.nombre, inline: true },
        ]
      );
    }

    // ── Ejecutar baja ───────────────────────────────────────────────────────
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return replyError(interaction,
        'Jugador no encontrado en el servidor',
        `<@${target.id}> no se encuentra en este servidor de Discord.\n\n` +
        `> No se pueden realizar cambios. Contacta a un administrador.`
      );
    }

    const role = await fetchTeamRole(interaction.guild, myTeam);
    const hadTeamRole = Boolean(role && member.roles.cache.has(role.id));

    if (!hadTeamRole) {
      console.warn(`Inconsistencia de roles: ${target.id} en DB de ${myTeam.id} pero sin rol Discord.`);
    }

    try {
      if (hadTeamRole) await member.roles.remove(role, `Baja por ${interaction.user.id}`);
      db.quitarMiembro(myTeam.id, target.id, 'RELEASED', interaction.user.id);
    } catch (error) {
      console.error('Error dando de baja al jugador:', error);
      if (hadTeamRole && !member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(e => console.error('Error reponiendo rol:', e));
      }
      return replyError(interaction,
        'Error al procesar la baja',
        `No se pudo completar la baja de <@${target.id}>.\n\n` +
        `> Verifica que el bot tenga permisos para gestionar roles e inténtalo de nuevo.`
      );
    }

    // Apodo fuera del bloque crítico
    try {
      await member.setNickname(null, 'Baja del equipo');
    } catch (e) {
      console.warn(`No se pudo resetear apodo de ${target.id}:`, e.message);
    }

    const colorInt = myTeam.color_primario?.startsWith('#') ? parseInt(myTeam.color_primario.slice(1), 16) : 0x00bfa6;
    await dm(target,
      `Has sido dado de baja de:\n\n**${myTeam.nombre}**\n\nYa no formas parte de la plantilla del equipo.\nActualmente estás como **Agente Libre** y puedes recibir propuestas de otros equipos.`,
      'baja'
    );

    return interaction.editReply({
      embeds: [card(
        '📤 Baja de jugador procesada',
        `<@${target.id}> ha sido liberado de su contrato y ahora es **Agente Libre**.\n\n` +
        `> Se le notificó por mensaje directo.`,
        [{ name: '🛡️ Equipo', value: myTeam.nombre, inline: true }, { name: '📋 Nuevo estado', value: 'Agente Libre', inline: true }],
        colorInt, myTeam.escudo
      )],
    });
  },
};
