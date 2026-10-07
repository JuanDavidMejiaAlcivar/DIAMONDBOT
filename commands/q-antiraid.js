const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');
const { desactivarAntiraid, estaActivo, leerEstadoAntiraid } = require('../utils/antiraid');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('q-antiraid')
    .setDescription('[ADMIN] Desactiva el modo antiraid y restaura la normalidad del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    // Verificar si está activo
    if (!estaActivo()) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x607D8B)
            .setTitle('ℹ️ Antiraid No Activo')
            .setDescription('El modo antiraid no está activado actualmente.')
        ],
        ephemeral: true
      });
    }

    const guild = interaction.guild;
    const estado = leerEstadoAntiraid();

    await interaction.deferReply();

    try {
      // Restaurar nivel de verificación original
      if (estado.original_verification_level !== null) {
        await guild.setVerificationLevel(estado.original_verification_level, 'Antiraid desactivado');
      }

      // Reactivar invitaciones
      await guild.disableInvites(false).catch(() => {
        console.log('No se pudieron reactivar invitaciones');
      });

      // Quitar slowmode de todos los canales de texto
      const textChannels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread());
      let channelsRestored = 0;

      for (const [, channel] of textChannels) {
        try {
          if (channel.rateLimitPerUser > 0) {
            await channel.setRateLimitPerUser(0, 'Antiraid desactivado');
            channelsRestored++;
          }
        } catch (error) {
          console.log(`No se pudo quitar slowmode de ${channel.name}:`, error.message);
        }
      }

      // Desactivar antiraid en el estado
      desactivarAntiraid();

      // Calcular duración del antiraid
      const activatedAt = new Date(estado.activated_at);
      const duration = Math.floor((Date.now() - activatedAt.getTime()) / 1000);
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      // Confirmar desactivación
      const embed = new EmbedBuilder()
        .setColor(0x40E0D0)
        .setTitle('✅ Modo Antiraid Desactivado')
        .setDescription(
          '**El servidor ha vuelto a la normalidad.**\n\n' +
          'Se restauraron las siguientes configuraciones:'
        )
        .addFields(
          {
            name: '🔓 Nivel de Verificación',
            value: 'Restaurado a su nivel original',
            inline: false
          },
          {
            name: '🐌 Modo Lento',
            value: `Removido de **${channelsRestored}** canal(es)`,
            inline: false
          },
          {
            name: '✅ Acceso',
            value: 'Nuevos miembros pueden unirse nuevamente',
            inline: false
          },
          {
            name: '⏱️ Duración Total',
            value: `El antiraid estuvo activo durante **${durationText}**`,
            inline: false
          }
        )
        .setFooter({ 
          text: `Activado por ${estado.activated_by ? `ID ${estado.activated_by}` : 'Desconocido'} | Desactivado por ${interaction.user.tag}` 
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Anuncio en el canal
      const announcementEmbed = new EmbedBuilder()
        .setColor(0x40E0D0)
        .setTitle('✅ Modo Antiraid Desactivado')
        .setDescription(
          '**El servidor ha vuelto a la normalidad.**\n\n' +
          '✅ Modo lento removido\n' +
          '✅ Nuevos miembros pueden unirse\n' +
          '✅ Nivel de verificación restaurado\n\n' +
          '> Gracias por su paciencia durante la protección del servidor.'
        )
        .setTimestamp();

      await interaction.followUp({ embeds: [announcementEmbed] });

    } catch (error) {
      console.error('Error desactivando antiraid:', error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription(
              'Ocurrió un error al desactivar el modo antiraid.\n\n' +
              'Puede que necesites restaurar algunas configuraciones manualmente.'
            )
        ]
      });
    }
  }
};
