const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, canModerate, botCanModerate, noPermissionEmbed } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Silencia temporalmente a un usuario')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuario a silenciar')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('minutos')
        .setDescription('Duración del silencio en minutos (1-40320 = 28 días)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320) // 28 días máximo según Discord
    )
    .addStringOption(option =>
      option
        .setName('razon')
        .setDescription('Razón del silencio')
        .setRequired(false)
        .setMaxLength(500)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    const targetUser = interaction.options.getUser('usuario');
    const minutes = interaction.options.getInteger('minutos');
    const reason = interaction.options.getString('razon') || 'No especificada';

    // Validar duración
    if (minutes <= 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Duración Inválida')
            .setDescription('La duración debe ser mayor a 0 minutos.')
        ],
        ephemeral: true
      });
    }

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

    // Verificar si ya está silenciado
    if (targetMember.isCommunicationDisabled()) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Usuario Ya Silenciado')
            .setDescription(
              `Este usuario ya tiene un timeout activo.\n\n` +
              `Finaliza: <t:${Math.floor(targetMember.communicationDisabledUntilTimestamp / 1000)}:R>`
            )
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
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Permisos Insuficientes')
            .setDescription('El bot no tiene permisos para moderar miembros (timeout).')
        ],
        ephemeral: true
      });
    }

    // Calcular duración en milisegundos
    const duration = minutes * 60 * 1000;
    const untilTimestamp = Date.now() + duration;

    // Intentar notificar al usuario antes de silenciarlo
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xEF5350)
        .setTitle('🔇 Has sido silenciado')
        .setDescription(
          `Has sido silenciado en **${interaction.guild.name}**.\n\n` +
          `**Duración:** ${minutes} minuto(s)\n` +
          `**Razón:** ${reason}\n` +
          `**Moderador:** ${interaction.user.tag}\n\n` +
          `Finaliza: <t:${Math.floor(untilTimestamp / 1000)}:R>`
        )
        .setTimestamp();
      
      await targetUser.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.log(`No se pudo enviar DM a ${targetUser.tag}`);
    }

    // Aplicar timeout
    try {
      await targetMember.timeout(duration, `${reason} | Moderador: ${interaction.user.tag}`);
    } catch (error) {
      console.error('Error al silenciar usuario:', error);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription('Ocurrió un error al intentar silenciar al usuario. Verifica los permisos del bot.')
        ],
        ephemeral: true
      });
    }

    // Formatear duración
    let durationText;
    if (minutes < 60) {
      durationText = `${minutes} minuto(s)`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      durationText = mins > 0 ? `${hours} hora(s) y ${mins} minuto(s)` : `${hours} hora(s)`;
    } else {
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      durationText = hours > 0 ? `${days} día(s) y ${hours} hora(s)` : `${days} día(s)`;
    }

    // Confirmar silencio
    const successEmbed = new EmbedBuilder()
      .setColor(0x0E7C86)
      .setTitle('🔇 Usuario Silenciado')
      .setDescription(`**${targetUser.tag}** ha sido silenciado correctamente.`)
      .addFields(
        { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
        { name: '⏱️ Duración', value: durationText, inline: true },
        { name: '🛡️ Moderador', value: `${interaction.user.tag}`, inline: true },
        { name: '📋 Razón', value: reason, inline: false },
        { name: '⏰ Finaliza', value: `<t:${Math.floor(untilTimestamp / 1000)}:R>`, inline: false }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed] });

    // Log de moderación (en segundo plano, no bloquea)
    logger.logModeration(
      interaction.client,
      interaction.user,
      'mute',
      targetUser,
      { reason, duration: durationText }
    ).catch(err => console.error('[LOGGER] Error en log de mute:', err));
  }
};
