const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cls')
    .setDescription('Elimina mensajes del canal actual')
    .addIntegerOption(option =>
      option
        .setName('cantidad')
        .setDescription('Cantidad de mensajes a eliminar (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    const cantidad = interaction.options.getInteger('cantidad');
    const channel = interaction.channel;

    // Verificar permisos del bot
    if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Permisos Insuficientes')
            .setDescription('El bot no tiene permisos para gestionar mensajes en este canal.')
        ],
        ephemeral: true
      });
    }

    // Responder inmediatamente para evitar timeout
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x40E0D0)
          .setDescription('🧹 Eliminando mensajes...')
      ],
      ephemeral: true
    });

    let deleted = 0;
    let tooOld = 0;

    try {
      // Intentar eliminar mensajes
      const messages = await channel.messages.fetch({ limit: cantidad });
      
      if (messages.size === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xEF5350)
              .setTitle('❌ Sin Mensajes')
              .setDescription('No hay mensajes que eliminar en este canal.')
          ]
        });
      }

      // Discord no permite eliminar mensajes de más de 14 días
      const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
      const recentMessages = messages.filter(msg => msg.createdTimestamp > twoWeeksAgo);
      const oldMessages = messages.size - recentMessages.size;

      if (recentMessages.size === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xEF5350)
              .setTitle('❌ Mensajes Muy Antiguos')
              .setDescription(
                'Los mensajes en este canal tienen más de 14 días y no pueden ser eliminados mediante este comando.\n\n' +
                '**Solución:** Elimina el canal y crea uno nuevo, o elimina los mensajes manualmente.'
              )
          ]
        });
      }

      // Eliminar mensajes recientes
      const deletedMessages = await channel.bulkDelete(recentMessages, true);
      deleted = deletedMessages.size;
      tooOld = oldMessages;

    } catch (error) {
      console.error('Error al eliminar mensajes:', error);
      
      let errorMsg = 'Ocurrió un error al intentar eliminar los mensajes.';
      
      if (error.code === 50013) {
        errorMsg = 'No tengo permisos suficientes para eliminar estos mensajes.';
      } else if (error.code === 50034) {
        errorMsg = 'Solo puedo eliminar mensajes de menos de 14 días de antigüedad.';
      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription(errorMsg)
        ]
      });
    }

    // Confirmar eliminación
    const successEmbed = new EmbedBuilder()
      .setColor(0x40E0D0)
      .setTitle('🧹 Mensajes Eliminados')
      .setDescription(`Se eliminaron **${deleted} mensaje(s)** correctamente.`)
      .addFields(
        { name: '🛡️ Moderador', value: `${interaction.user.tag}`, inline: true },
        { name: '📊 Solicitados', value: `${cantidad}`, inline: true },
        { name: '✅ Eliminados', value: `${deleted}`, inline: true }
      )
      .setTimestamp();

    if (tooOld > 0) {
      successEmbed.addFields({
        name: '⚠️ Advertencia',
        value: `${tooOld} mensaje(s) no pudieron ser eliminados por tener más de 14 días de antigüedad.`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [successEmbed] });

    // Log de moderación (en segundo plano, no bloquea)
    logger.logModeration(
      interaction.client,
      interaction.user,
      'clear',
      null,
      { channel: interaction.channel.id, cantidad: deletedSize }
    ).catch(err => console.error('[LOGGER] Error en log de cls:', err));
  }
};
