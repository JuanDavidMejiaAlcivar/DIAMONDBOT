const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');
const { addWarning, THREE_WARN_ACTION } = require('../utils/warnings');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Aplica una advertencia a un usuario')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuario a advertir')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('razon')
        .setDescription('Razón de la advertencia')
        .setRequired(true)
        .setMaxLength(500)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    const targetUser = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('razon');

    // Verificar que no sea el bot
    if (targetUser.bot) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription('No puedes advertir a un bot.')
        ],
        ephemeral: true
      });
    }

    // Verificar que el usuario esté en el servidor
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

    // Añadir advertencia
    let result;
    try {
      result = addWarning(
        targetUser.id,
        interaction.guild.id,
        interaction.user.id,
        reason
      );
    } catch (error) {
      console.error('Error al añadir advertencia:', error);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xEF5350)
            .setTitle('❌ Error')
            .setDescription('Ocurrió un error al registrar la advertencia.')
        ],
        ephemeral: true
      });
    }

    // Intentar notificar al usuario
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('⚠️ Has recibido una advertencia')
        .setDescription(
          `Has recibido una advertencia en **${interaction.guild.name}**.\n\n` +
          `**Advertencia #${result.count}**\n` +
          `**Razón:** ${reason}\n` +
          `**Moderador:** ${interaction.user.tag}`
        )
        .setTimestamp();

      if (result.reachedLimit) {
        dmEmbed.addFields({
          name: '🚨 Límite Alcanzado',
          value: 'Has alcanzado **3 advertencias**. Se aplicarán medidas según el reglamento del servidor.',
          inline: false
        });
      }
      
      await targetUser.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.log(`No se pudo enviar DM a ${targetUser.tag}`);
    }

    // Confirmar advertencia
    const successEmbed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setTitle('⚠️ Advertencia Aplicada')
      .setDescription(`Se ha aplicado una advertencia a **${targetUser.tag}**.`)
      .addFields(
        { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
        { name: '📊 Advertencia', value: `#${result.count}`, inline: true },
        { name: '🛡️ Moderador', value: `${interaction.user.tag}`, inline: true },
        { name: '📋 Razón', value: reason, inline: false }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed] });

    // Verificar si llegó a 3 advertencias
    if (result.reachedLimit) {
      const limitEmbed = new EmbedBuilder()
        .setColor(0xEF5350)
        .setTitle('🚨 Límite de Advertencias Alcanzado')
        .setDescription(
          `${targetUser} ha llegado a **3 advertencias**.\n\n` +
          `Se requiere aplicar una sanción según el reglamento del servidor.`
        )
        .addFields(
          { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
          { name: '📊 Total', value: `${result.count} advertencias`, inline: true },
          { name: '⚙️ Configuración', value: `Acción: \`${THREE_WARN_ACTION}\``, inline: true }
        )
        .setTimestamp();

      // Enviar alerta
      await interaction.followUp({ embeds: [limitEmbed] });

      // TODO: Implementar acciones automáticas según THREE_WARN_ACTION
      // Por ahora solo notifica al staff para acción manual
    }

    // Log de moderación (en segundo plano, no bloquea)
    logger.logModeration(
      interaction.client,
      interaction.user,
      'warn',
      targetUser,
      { reason, warnings: result.count }
    ).catch(err => console.error('[LOGGER] Error en log de warn:', err));
  }
};
