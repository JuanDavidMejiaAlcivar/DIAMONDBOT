const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, canModerate, botCanModerate, noPermissionEmbed } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa a un usuario del servidor')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuario a expulsar')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('razon')
        .setDescription('Razón de la expulsión')
        .setRequired(false)
        .setMaxLength(500)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    const targetUser = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('razon') || 'No especificada';

    // Obtener el miembro del servidor
    let targetMember;
    try {
      targetMember = await interaction.guild.members.fetch(targetUser.id);
    } catch (error) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription('No se pudo encontrar al usuario en el servidor.')
        ],
        ephemeral: true
      });
    }

    // Verificar jerarquía del moderador
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

    // Verificar jerarquía del bot
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

    // Verificar permisos del bot
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Permisos Insuficientes')
            .setDescription('El bot no tiene permisos para expulsar miembros.')
        ],
        ephemeral: true
      });
    }

    // Intentar notificar al usuario antes de expulsarlo
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xEF5350)
        .setTitle('👢 Has sido expulsado')
        .setDescription(
          `Has sido expulsado de **${interaction.guild.name}**.\n\n` +
          `**Razón:** ${reason}\n` +
          `**Moderador:** ${interaction.user.tag}`
        )
        .setTimestamp();
      
      await targetUser.send({ embeds: [dmEmbed] });
    } catch (error) {
      // Si no se puede enviar DM, continuar de todos modos
      console.log(`No se pudo enviar DM a ${targetUser.tag}`);
    }

    // Expulsar al usuario
    try {
      await targetMember.kick(reason);
    } catch (error) {
      console.error('Error al expulsar usuario:', error);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription('Ocurrió un error al intentar expulsar al usuario. Verifica los permisos del bot.')
        ],
        ephemeral: true
      });
    }

    // Confirmar expulsión
    const successEmbed = new EmbedBuilder()
      .setColor(0x40E0D0)
      .setTitle('👢 Usuario Expulsado')
      .setDescription(`**${targetUser.tag}** ha sido expulsado del servidor correctamente.`)
      .addFields(
        { name: '👤 Usuario', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: '🛡️ Moderador', value: `${interaction.user.tag}`, inline: true },
        { name: '📋 Razón', value: reason, inline: false }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed] });

    // Log de moderación (en segundo plano, no bloquea)
    logger.logModeration(
      interaction.client,
      interaction.user,
      'kick',
      targetUser,
      { reason }
    ).catch(err => console.error('[LOGGER] Error en log de kick:', err));
  }
};
