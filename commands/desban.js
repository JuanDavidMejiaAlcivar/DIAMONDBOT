const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('desban')
    .setDescription('Retira el ban de un usuario utilizando su ID')
    .addStringOption(option =>
      option
        .setName('user_id')
        .setDescription('ID del usuario a desbanear')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('razon')
        .setDescription('Razón del desban')
        .setRequired(false)
        .setMaxLength(500)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('razon') || 'No especificada';

    // Validar que el ID sea un número válido de Discord
    if (!/^\d{17,19}$/.test(userId)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ ID Inválido')
            .setDescription('El ID proporcionado no es válido. Los IDs de Discord deben ser números de 17-19 dígitos.')
        ],
        ephemeral: true
      });
    }

    // Verificar permisos del bot
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Permisos Insuficientes')
            .setDescription('El bot no tiene permisos para gestionar bans.')
        ],
        ephemeral: true
      });
    }

    // Verificar si el usuario está baneado
    let bannedUser;
    try {
      bannedUser = await interaction.guild.bans.fetch(userId);
    } catch (error) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Usuario No Baneado')
            .setDescription(
              'No se encontró ningún ban activo para este ID.\n\n' +
              'Verifica que el ID sea correcto y que el usuario esté efectivamente baneado.'
            )
        ],
        ephemeral: true
      });
    }

    // Desbanear al usuario
    try {
      await interaction.guild.members.unban(userId, `${reason} | Moderador: ${interaction.user.tag}`);
    } catch (error) {
      console.error('Error al desbanear usuario:', error);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription('Ocurrió un error al intentar desbanear al usuario. Verifica los permisos del bot.')
        ],
        ephemeral: true
      });
    }

    // Confirmar desban
    const user = bannedUser.user;
    const successEmbed = new EmbedBuilder()
      .setColor(0x40E0D0)
      .setTitle('✅ Usuario Desbaneado')
      .setDescription(`**${user.tag}** ha sido desbaneado correctamente.`)
      .addFields(
        { name: '👤 Usuario', value: `${user.tag} (${user.id})`, inline: true },
        { name: '🛡️ Moderador', value: `${interaction.user.tag}`, inline: true },
        { name: '📋 Razón', value: reason, inline: false }
      )
      .setThumbnail(user.displayAvatarURL())
      .setFooter({ text: 'El usuario ahora puede volver a unirse al servidor' })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed] });

    // Log de moderación (en segundo plano, no bloquea)
    logger.logModeration(
      interaction.client,
      interaction.user,
      'unban',
      `${targetUser.username}#${targetUser.discriminator} (${targetUser.id})`,
      { reason }
    ).catch(err => console.error('[LOGGER] Error en log de desban:', err));
  }
};
