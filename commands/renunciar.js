const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db, card } = require('../utils/rosterCommands');
const { replyError } = require('../utils/errorEmbeds');
const { COMMAND_CHANNELS, checkChannel } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder().setName('renunciar').setDescription('Abandona voluntariamente tu equipo'),

  async execute(interaction) {
    // ── Verificar canal correcto ────────────────────────────────────────────
    const channelCheck = checkChannel(interaction, COMMAND_CHANNELS.renunciar, 'renunciar');
    if (!channelCheck.isCorrect) {
      return interaction.reply(channelCheck.reply);
    }

    await interaction.deferReply();

    const record = db.obtenerMiembro(interaction.user.id);

    if (record?.inconsistent) {
      return replyError(interaction,
        'Registro inconsistente',
        `Tu registro presenta inconsistencias en el sistema.\n\n` +
        `> Contacta a un administrador para resolverlo antes de continuar.`
      );
    }

    if (!record) {
      return replyError(interaction,
        'Sin equipo registrado',
        `No perteneces a ningún equipo en el sistema de Diamonds League.\n\n` +
        `> No hay nada a lo que renunciar. Si crees que esto es un error, contacta a un administrador.`
      );
    }

    if (record.role === 'DT') {
      const myTeam = db.obtenerEquipoPorId(record.team_id);
      return replyError(interaction,
        'Acción no disponible para Directores Técnicos',
        `Eres el **Director Técnico** de ${myTeam ? `**${myTeam.nombre}**` : 'tu equipo'} y no puedes usar **/renunciar**.\n\n` +
        `> Los Directores Técnicos no pueden abandonar su equipo de esta forma. Utiliza el sistema de gestión administrativa correspondiente.`,
        myTeam ? [{ name: '🛡️ Tu equipo', value: myTeam.nombre, inline: true }, { name: '👔 Tu cargo', value: 'Director Técnico', inline: true }] : []
      );
    }

    if (record.role === 'SUB_DT') {
      const myTeam = db.obtenerEquipoPorId(record.team_id);
      return replyError(interaction,
        'Acción no disponible para Subdirectores Técnicos',
        `Eres el **Subdirector Técnico** de ${myTeam ? `**${myTeam.nombre}**` : 'tu equipo'} y no puedes usar **/renunciar** directamente.\n\n` +
        `> Debes pedirle al **Director Técnico** que use **/quitar-subdt** para removerte del cargo primero.`,
        myTeam ? [{ name: '🛡️ Tu equipo', value: myTeam.nombre, inline: true }, { name: '👔 Tu cargo', value: 'Subdirector Técnico', inline: true }] : []
      );
    }

    const team = db.obtenerEquipoPorId(record.team_id);
    if (!team) {
      return replyError(interaction,
        'Equipo no encontrado',
        `Tu equipo no pudo ser localizado en el sistema.\n\n` +
        `> Contacta a un administrador para resolver este problema.`
      );
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`resign_confirm_${interaction.user.id}_${team.id}`).setLabel('Confirmar renuncia').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`resign_cancel_${interaction.user.id}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
    );

    const colorInt = team.color_primario?.startsWith('#') ? parseInt(team.color_primario.slice(1), 16) : 0x00bfa6;
    const desc =
      `Estás a punto de iniciar un **trámite de renuncia oficial**.\n\n` +
      `🛡️ **Equipo actual:** \`${team.nombre}\`\n` +
      `👔 **Tu cargo:** \`Jugador\`\n` +
      `⚠️ **Consecuencia:** \`Pasarás a ser Agente Libre\`\n` +
      `🎮 **Apodo:** \`Se restablecerá a tu nombre de Discord\`\n\n` +
      `> *Esta acción es irreversible. Si deseas volver al equipo, necesitarás una nueva propuesta de fichaje.*`;

    return interaction.editReply({
      embeds: [card('👋 Trámite de Renuncia', desc, [], colorInt, team.escudo)],
      components: [row],
    });
  },
};
