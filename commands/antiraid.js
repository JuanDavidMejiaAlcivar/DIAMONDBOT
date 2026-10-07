const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');
const { activarAntiraid, estaActivo } = require('../utils/antiraid');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('[ADMIN] Activa el modo de protección antiraid del servidor')
    .addIntegerOption(option =>
      option
        .setName('slowmode')
        .setDescription('Segundos de modo lento en canales de texto (0-21600)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(21600)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    // Verificar si ya está activo
    if (estaActivo()) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('⚠️ Antiraid Ya Activo')
            .setDescription(
              'El modo antiraid ya está activado en el servidor.\n\n' +
              'Usa `/q-antiraid` para desactivarlo.'
            )
        ],
        ephemeral: true
      });
    }

    const slowmode = interaction.options.getInteger('slowmode') || 10;
    const guild = interaction.guild;

    // Verificar permisos del bot
    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Permisos Insuficientes')
            .setDescription('El bot necesita el permiso **Gestionar Servidor** para activar el antiraid.')
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      // Guardar nivel de verificación original
      const originalVerificationLevel = guild.verificationLevel;

      // Activar nivel de verificación más alto
      await guild.setVerificationLevel(4, 'Modo antiraid activado'); // 4 = Highest

      // Deshabilitar invitaciones (pausar uniones)
      await guild.disableInvites(true).catch(() => {
        console.log('No se pudieron deshabilitar invitaciones (puede que no esté disponible en este servidor)');
      });

      // Aplicar slowmode a todos los canales de texto
      const textChannels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread());
      let channelsAffected = 0;

      for (const [, channel] of textChannels) {
        try {
          if (channel.rateLimitPerUser !== slowmode) {
            await channel.setRateLimitPerUser(slowmode, 'Modo antiraid activado');
            channelsAffected++;
          }
        } catch (error) {
          console.log(`No se pudo aplicar slowmode a ${channel.name}:`, error.message);
        }
      }

      // Registrar estado del antiraid
      activarAntiraid(guild.id, interaction.user.id, originalVerificationLevel);

      // Confirmar activación
      const embed = new EmbedBuilder()
        .setColor(0xEF5350)
        .setTitle('🚨 Modo Antiraid Activado')
        .setDescription(
          '**El servidor está ahora en modo de protección antiraid.**\n\n' +
          'Se aplicaron las siguientes medidas de seguridad:'
        )
        .addFields(
          {
            name: '🔒 Nivel de Verificación',
            value: `Elevado a **Máximo** (requiere número de teléfono verificado)`,
            inline: false
          },
          {
            name: '🐌 Modo Lento',
            value: `Aplicado en **${channelsAffected}** canal(es) de texto (${slowmode}s)`,
            inline: false
          },
          {
            name: '🚫 Restricciones Activas',
            value: 
              '• Bots no pueden enviar mensajes ni usar comandos\n' +
              '• Detección automática de spam y links maliciosos\n' +
              '• Auto-expulsión de spammers\n' +
              '• Nuevos miembros no pueden unirse',
            inline: false
          },
          {
            name: '⚙️ Desactivar',
            value: 'Usa `/q-antiraid` para volver a la normalidad',
            inline: false
          }
        )
        .setFooter({ text: `Activado por ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Anuncio en el canal
      const announcementEmbed = new EmbedBuilder()
        .setColor(0xEF5350)
        .setTitle('🚨 MODO ANTIRAID ACTIVADO')
        .setDescription(
          '**El servidor está bajo protección antiraid.**\n\n' +
          `⏱️ Modo lento activo: **${slowmode} segundo(s)**\n` +
          '🔒 Verificación máxima requerida para nuevos miembros\n\n' +
          '> El staff está trabajando para proteger el servidor.\n' +
          '> Esta medida es temporal.'
        )
        .setTimestamp();

      await interaction.followUp({ embeds: [announcementEmbed] });

    } catch (error) {
      console.error('Error activando antiraid:', error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription(
              'Ocurrió un error al activar el modo antiraid.\n\n' +
              'Verifica que el bot tenga todos los permisos necesarios.'
            )
        ]
      });
    }
  }
};
