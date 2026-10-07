const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { isAdmin, noPermissionEmbed, COMMAND_CHANNELS, checkChannel } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Despliega el panel de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    // Verificar canal correcto
    const channelCheck = checkChannel(interaction, COMMAND_CHANNELS.tickets, 'tickets');
    if (!channelCheck.isCorrect) {
      return interaction.reply(channelCheck.reply);
    }

    try {
      // Defer inmediatamente para evitar timeout
      await interaction.deferReply({ flags: 64 });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎫 Centro de Soporte')
        .setDescription(
          '**¿Necesitas ayuda?** Selecciona el tipo de ticket que deseas abrir.\n\n' +
          '> ⚠️ Los tickets sin motivo válido serán cerrados y sancionados.'
        )
        .addFields(
          { name: '🤝 Partner', value: 'Propuestas de alianza', inline: true },
          { name: '💭 Duda/Sugerencia', value: 'Preguntas o ideas', inline: true },
          { name: '📋 Postulación', value: 'Únete al staff', inline: true },
          { name: '⚖️ Apelación', value: 'Apelar sanciones', inline: true },
          { name: '📢 Reporte', value: 'Reportar problemas', inline: true },
          { name: '🛒 Compra', value: 'Tienda del servidor', inline: true }
        )
        .setFooter({ text: 'Diamonds League • Sistema de Tickets' })
        .setTimestamp();

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_partner')
          .setLabel('Partner')
          .setEmoji('🤝')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_duda')
          .setLabel('Duda/Sugerencia')
          .setEmoji('💭')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_postulacion')
          .setLabel('Postulación')
          .setEmoji('📋')
          .setStyle(ButtonStyle.Primary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_apelacion')
          .setLabel('Apelación')
          .setEmoji('⚖️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('ticket_reporte')
          .setLabel('Reporte')
          .setEmoji('📢')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('ticket_compra')
          .setLabel('Compra')
          .setEmoji('🛒')
          .setStyle(ButtonStyle.Success)
      );

      // Enviar al canal
      await interaction.channel.send({
        embeds: [embed],
        components: [row1, row2]
      });

      // Eliminar el mensaje de "pensando..."
      await interaction.deleteReply().catch(() => {});

      console.log('[TICKETS] Panel enviado correctamente');

    } catch (error) {
      console.error('[TICKETS] Error:', error);
      const msg = { content: 'Error al desplegar el panel de tickets.', flags: 64 };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
  }
};
