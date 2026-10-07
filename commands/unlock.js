const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Desbloquea el canal actual')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    const channel = interaction.channel;

    // Verificar permisos del bot
    if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Permisos Insuficientes')
            .setDescription('El bot no tiene permisos para gestionar este canal.')
        ],
        ephemeral: true
      });
    }

    // Verificar si el canal está bloqueado
    const everyoneRole = interaction.guild.roles.everyone;
    const currentPermissions = channel.permissionOverwrites.cache.get(everyoneRole.id);
    
    if (!currentPermissions || !currentPermissions.deny.has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Canal No Bloqueado')
            .setDescription('Este canal no está bloqueado.')
        ],
        ephemeral: true
      });
    }

    try {
      // Restaurar permisos de @everyone (null = seguir la configuración del canal/categoría)
      await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: null,
        AddReactions: null,
        CreatePublicThreads: null,
        CreatePrivateThreads: null,
        SendMessagesInThreads: null
      }, {
        reason: `Canal desbloqueado por ${interaction.user.tag}`
      });

    } catch (error) {
      console.error('Error al desbloquear canal:', error);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription('Ocurrió un error al intentar desbloquear el canal.')
        ],
        ephemeral: true
      });
    }

    // Confirmar desbloqueo
    const unlockEmbed = new EmbedBuilder()
      .setColor(0x40E0D0)
      .setTitle('🔓 Canal Desbloqueado')
      .setDescription(
        `El canal ha sido desbloqueado.\n\n` +
        `Todos los usuarios pueden volver a enviar mensajes según los permisos del canal.`
      )
      .addFields(
        { name: '🛡️ Moderador', value: `${interaction.user.tag}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [unlockEmbed] });

    // Log de moderación (en segundo plano, no bloquea)
    logger.logModeration(
      interaction.client,
      interaction.user,
      'unlock',
      null,
      { channel: interaction.channel.id, reason }
    ).catch(err => console.error('[LOGGER] Error en log de unlock:', err));
  }
};
