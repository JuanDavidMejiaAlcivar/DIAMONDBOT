const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, STAFF_ROLE_IDS, noPermissionEmbed } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Cierra el canal actual para usuarios normales')
    .addStringOption(option =>
      option
        .setName('razon')
        .setDescription('Razón del cierre del canal')
        .setRequired(false)
        .setMaxLength(500)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    const reason = interaction.options.getString('razon') || 'No especificada';
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

    // Verificar si el canal ya está bloqueado
    const everyoneRole = interaction.guild.roles.everyone;
    const currentPermissions = channel.permissionOverwrites.cache.get(everyoneRole.id);
    
    if (currentPermissions && currentPermissions.deny.has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Canal Ya Bloqueado')
            .setDescription('Este canal ya está bloqueado para usuarios normales.')
        ],
        ephemeral: true
      });
    }

    try {
      // Bloquear canal para @everyone
      await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        SendMessagesInThreads: false
      }, {
        reason: `Canal bloqueado por ${interaction.user.tag} | ${reason}`
      });

      // Asegurar que el staff pueda seguir escribiendo
      for (const roleId of STAFF_ROLE_IDS) {
        try {
          const role = await interaction.guild.roles.fetch(roleId);
          if (role) {
            await channel.permissionOverwrites.edit(role, {
              SendMessages: true,
              AddReactions: true
            }, {
              reason: `Mantener acceso de staff durante lock`
            });
          }
        } catch (error) {
          console.log(`No se pudo configurar permisos para rol ${roleId}:`, error.message);
        }
      }

    } catch (error) {
      console.error('Error al bloquear canal:', error);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription('Ocurrió un error al intentar bloquear el canal.')
        ],
        ephemeral: true
      });
    }

    // Confirmar bloqueo
    const lockEmbed = new EmbedBuilder()
      .setColor(0x0A2342)
      .setTitle('🔒 Canal Bloqueado')
      .setDescription(
        `Este canal ha sido bloqueado temporalmente.\n\n` +
        `Los usuarios normales no podrán enviar mensajes.\n` +
        `El personal autorizado puede seguir utilizando el canal.`
      )
      .addFields(
        { name: '🛡️ Moderador', value: `${interaction.user.tag}`, inline: true },
        { name: '📋 Razón', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [lockEmbed] });

    // Log de moderación (en segundo plano, no bloquea)
    logger.logModeration(
      interaction.client,
      interaction.user,
      'lock',
      null,
      { channel: interaction.channel.id, reason }
    ).catch(err => console.error('[LOGGER] Error en log de lock:', err));
  }
};
