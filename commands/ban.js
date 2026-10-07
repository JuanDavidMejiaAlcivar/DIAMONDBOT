const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, canModerate, botCanModerate, noPermissionEmbed } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banea a un usuario del servidor')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuario a banear')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('razon')
        .setDescription('Razón del ban')
        .setRequired(false)
        .setMaxLength(500)
    )
    .addIntegerOption(option =>
      option
        .setName('eliminar_mensajes')
        .setDescription('Días de mensajes a eliminar (0-7)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    const targetUser = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('razon') || 'No especificada';
    const deleteMessageDays = interaction.options.getInteger('eliminar_mensajes') || 0;

    // Obtener el miembro del servidor (puede no estar si ya fue baneado)
    let targetMember;
    try {
      targetMember = await interaction.guild.members.fetch(targetUser.id);
    } catch (error) {
      // El usuario no está en el servidor, verificar si ya está baneado
      try {
        const ban = await interaction.guild.bans.fetch(targetUser.id);
        if (ban) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xEF5350)
                .setTitle('❌ Error')
                .setDescription('Este usuario ya está baneado del servidor.')
            ],
            ephemeral: true
          });
        }
      } catch {
        // No está baneado, continuar con el ban
      }
    }

    // Si el usuario está en el servidor, verificar jerarquías
    if (targetMember) {
      const modCheck = canModerate(interaction.member, targetMember);
      if (!modCheck.canModerate) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xEF5350)
              .setTitle('❌ Jerarquía Insuficiente')
              .setDescription(modCheck.reason)
          ],
          ephemeral: true
        });
      }

      const botCheck = botCanModerate(interaction.guild, targetMember);
      if (!botCheck.canModerate) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xEF5350)
              .setTitle('❌ Error del Bot')
              .setDescription(botCheck.reason)
          ],
          ephemeral: true
        });
      }
    }

    // Verificar permisos del bot
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Permisos Insuficientes')
            .setDescription('El bot no tiene permisos para banear miembros.')
        ],
        ephemeral: true
      });
    }

    // Intentar notificar al usuario antes de banearlo
    if (targetMember) {
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xEF5350)
          .setTitle('🔨 Has sido baneado')
          .setDescription(
            `Has sido baneado permanentemente de **${interaction.guild.name}**.\n\n` +
            `**Razón:** ${reason}\n` +
            `**Moderador:** ${interaction.user.tag}`
          )
          .setTimestamp();
        
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`No se pudo enviar DM a ${targetUser.tag}`);
      }
    }

    // Banear al usuario
    try {
      await interaction.guild.members.ban(targetUser.id, {
        reason: `${reason} | Moderador: ${interaction.user.tag}`,
        deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60
      });
    } catch (error) {
      console.error('Error al banear usuario:', error);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription('Ocurrió un error al intentar banear al usuario. Verifica los permisos del bot.')
        ],
        ephemeral: true
      });
    }

    // Confirmar ban
    const successEmbed = new EmbedBuilder()
      .setColor(0x13315C)
      .setTitle('🔨 Usuario Baneado')
      .setDescription(`**${targetUser.tag}** ha sido baneado del servidor permanentemente.`)
      .addFields(
        { name: '👤 Usuario', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: '🛡️ Moderador', value: `${interaction.user.tag}`, inline: true },
        { name: '📋 Razón', value: reason, inline: false }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    if (deleteMessageDays > 0) {
      successEmbed.addFields({
        name: '🗑️ Mensajes Eliminados',
        value: `Últimos ${deleteMessageDays} día(s)`,
        inline: true
      });
    }

    await interaction.reply({ embeds: [successEmbed] });

    // Log de moderación (en segundo plano, no bloquea)
    logger.logModeration(
      interaction.client,
      interaction.user,
      'ban',
      targetUser,
      { reason, duration: deleteMessageDays > 0 ? `Mensajes de ${deleteMessageDays} día(s) eliminados` : undefined }
    ).catch(err => console.error('[LOGGER] Error en log de ban:', err));
  }
};
