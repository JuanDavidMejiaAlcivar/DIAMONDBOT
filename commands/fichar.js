const { randomUUID } = require('node:crypto');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { db, card } = require('../utils/rosterCommands');
const { replyError, replyWarn } = require('../utils/errorEmbeds');
const { COMMAND_CHANNELS, checkChannel } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fichar')
    .setDescription('Envía una propuesta de fichaje a un jugador libre')
    .addUserOption(o => o.setName('usuario').setDescription('Jugador al que se enviará la propuesta').setRequired(true))
    .addStringOption(o => o.setName('nick_haxball').setDescription('Nick del jugador en HaxBall').setRequired(true).setMaxLength(50)),

  async execute(interaction) {
    // ── Verificar canal correcto ────────────────────────────────────────────
    const channelCheck = checkChannel(interaction, COMMAND_CHANNELS.fichar, 'fichar');
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
        `> Solo los **Directores Técnicos** y **Subdirectores Técnicos** registrados pueden enviar propuestas de fichaje.`
      );
    }

    if (senderRecord.role === 'PLAYER') {
      const myTeam = db.obtenerEquipoPorId(senderRecord.team_id);
      return replyError(interaction,
        'Sin permisos de gestión',
        `Eres un **jugador** de ${myTeam ? `**${myTeam.nombre}**` : 'un equipo'}, no un cargo técnico.\n\n` +
        `> Solo el **Director Técnico** o el **Subdirector Técnico** pueden realizar fichajes.`,
        myTeam ? [{ name: '🛡️ Tu equipo', value: myTeam.nombre, inline: true }, { name: '👔 Tu cargo', value: 'Jugador', inline: true }] : []
      );
    }

    if (senderRecord.role !== 'DT' && senderRecord.role !== 'SUB_DT') {
      return replyError(interaction,
        'Sin permisos de gestión',
        `No tienes el cargo necesario para realizar fichajes.\n\n` +
        `> Solo el **Director Técnico** o el **Subdirector Técnico** pueden enviar propuestas.`
      );
    }

    const myTeam = db.obtenerEquipoPorId(senderRecord.team_id);
    if (!myTeam) {
      return replyError(interaction,
        'Error en el registro',
        `Tu equipo no pudo ser localizado en el sistema. Contacta a un administrador.\n\n` +
        `> Es posible que tu equipo haya sido eliminado o que haya un error en la base de datos.`
      );
    }

    // ── Verificar jugador objetivo ──────────────────────────────────────────
    const target = interaction.options.getUser('usuario');
    const nick   = interaction.options.getString('nick_haxball').trim();

    if (target.bot) {
      return replyError(interaction, 'Usuario no válido', 'No puedes enviar una propuesta de fichaje a un bot.');
    }

    if (target.id === interaction.user.id) {
      return replyWarn(interaction, 'Acción no permitida', 'No puedes ficharte a ti mismo.');
    }

    if (!nick) {
      return replyError(interaction, 'Nick obligatorio', 'Debes proporcionar el nick de HaxBall del jugador que deseas fichar.');
    }

    const existing = db.obtenerMiembro(target.id);

    if (existing?.inconsistent) {
      return replyError(interaction,
        'Registro inconsistente',
        `El registro de <@${target.id}> presenta inconsistencias en el sistema.\n\n` +
        `> Contacta a un administrador para resolver el problema antes de intentar ficharlo.`
      );
    }

    if (existing?.role === 'DT') {
      const theirTeam = db.obtenerEquipoPorId(existing.team_id);
      return replyWarn(interaction,
        'Jugador no disponible',
        `<@${target.id}> actualmente ocupa el cargo de **Director Técnico** y no puede ser fichado.\n\n` +
        `> Para poder ficharlo, primero debe renunciar o ser removido de su cargo técnico.`,
        theirTeam ? [{ name: '🛡️ Equipo actual', value: theirTeam.nombre, inline: true }, { name: '👔 Cargo', value: 'Director Técnico', inline: true }] : []
      );
    }

    if (existing?.role === 'SUB_DT') {
      const theirTeam = db.obtenerEquipoPorId(existing.team_id);
      return replyWarn(interaction,
        'Jugador no disponible',
        `<@${target.id}> actualmente ocupa el cargo de **Subdirector Técnico** y no puede ser fichado.\n\n` +
        `> Para poder ficharlo, primero debe renunciar o ser removido de su cargo técnico.`,
        theirTeam ? [{ name: '🛡️ Equipo actual', value: theirTeam.nombre, inline: true }, { name: '👔 Cargo', value: 'Subdirector Técnico', inline: true }] : []
      );
    }

    if (existing) {
      const theirTeam = db.obtenerEquipoPorId(existing.team_id);
      return replyWarn(interaction,
        'Jugador no disponible',
        `<@${target.id}> ya forma parte de un equipo y no está disponible en el mercado.\n\n` +
        `> Solo los jugadores **libres** pueden recibir propuestas de fichaje.`,
        theirTeam ? [{ name: '🛡️ Equipo actual', value: theirTeam.nombre, inline: true }, { name: '📋 Estado', value: 'Contratado', inline: true }] : []
      );
    }

    // ── Verificar rol del equipo ────────────────────────────────────────────
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return replyError(interaction,
        'Jugador no encontrado',
        `<@${target.id}> no se encuentra en este servidor de Discord.\n\n` +
        `> No se puede enviar una propuesta a alguien que no está en el servidor.`
      );
    }

    if (!myTeam.role_id) {
      return replyError(interaction,
        'Error de configuración',
        `Tu equipo **${myTeam.nombre}** no tiene un rol de Discord configurado.\n\n` +
        `> Contacta a un administrador para que corrija la configuración del equipo.`
      );
    }

    const teamRole = await interaction.guild.roles.fetch(myTeam.role_id).catch(() => null);
    if (!teamRole) {
      return replyError(interaction,
        'Rol no encontrado',
        `El rol de Discord de **${myTeam.nombre}** ya no existe en el servidor.\n\n` +
        `> Contacta a un administrador para que recree el rol del equipo.`
      );
    }

    // ── Crear y enviar propuesta ────────────────────────────────────────────
    const id = randomUUID().replaceAll('-', '').slice(0, 20);
    const request = {
      id, guild_id: interaction.guildId, team_id: myTeam.id, target_id: target.id,
      requested_by: interaction.user.id, requester_role: senderRecord.role,
      haxball_nick: nick, created_at: new Date().toISOString(), status: 'PENDING',
    };

    const requesterRoleName = senderRecord.role === 'DT' ? 'Director Técnico' : 'Subdirector Técnico';
    const colorInt = myTeam.color_primario?.startsWith('#') ? parseInt(myTeam.color_primario.slice(1), 16) : 0x00bfa6;

    const proposal = new EmbedBuilder()
      .setColor(colorInt)
      .setTitle('📝 Propuesta oficial de fichaje')
      .setDescription(`El equipo **${myTeam.nombre}** te invita a formar parte de su plantilla oficial en **DIAMONDS LEAGUE**.`)
      .addFields(
        { name: '🛡️ Equipo', value: myTeam.nombre, inline: true },
        { name: '👤 Enviada por', value: `<@${interaction.user.id}>`, inline: true },
        { name: '👔 Cargo', value: requesterRoleName, inline: true },
        { name: '🎮 Nick propuesto', value: nick, inline: true },
        { name: '📅 Fecha y hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      )
      .setFooter({ text: 'Responde con los botones de este mensaje. La propuesta queda registrada en el sistema.' });
    if (myTeam.escudo) proposal.setThumbnail(myTeam.escudo);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`sign_accept_${id}`).setLabel('✅ Aceptar fichaje').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`sign_reject_${id}`).setLabel('🚫 Rechazar').setStyle(ButtonStyle.Secondary),
    );

    db.crearPropuesta(request);

    try {
      await target.send({ embeds: [proposal], components: [row] });
    } catch (error) {
      db.actualizarPropuesta(id, { status: 'FAILED', resolved_at: new Date().toISOString() });
      console.error(`No se pudo enviar propuesta de fichaje a ${target.id}:`, error);
      return replyError(interaction,
        'No se pudo enviar la propuesta',
        `<@${target.id}> tiene los mensajes directos desactivados o bloqueados.\n\n` +
        `> Pídele que habilite los DMs desde miembros del servidor e inténtalo de nuevo.\n> No se realizó ningún cambio.`
      );
    }

    const publicMsg = await interaction.editReply({
      embeds: [card(
        '📩 Propuesta de fichaje enviada',
        `Se envió a <@${target.id}> una propuesta de fichaje para **${myTeam.nombre}**.\n\n` +
        `🎮 **Nick propuesto:** \`${nick}\`\n` +
        `⏳ **Estado:** \`En espera de respuesta\`\n\n` +
        `> *El jugador deberá responder por mensaje directo. Este mensaje se actualizará cuando responda.*`,
        [], colorInt, myTeam.escudo
      )],
    });

    db.actualizarPropuesta(id, {
      public_message_id: publicMsg.id,
      public_channel_id: interaction.channelId,
    });

    // Log de fichaje propuesto (en segundo plano, no bloquea)
    logger.logMember(
      interaction.client,
      interaction.user,
      'fichaje',
      target.id,
      myTeam.nombre,
      {
        role: 'PLAYER',
        haxball_nick: nick
      }
    ).catch(err => console.error('[LOGGER] Error en log de fichar:', err));

    return publicMsg;
  },
};
