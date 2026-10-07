const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');
const { getUserWarnings, getAllUserWarnings } = require('../utils/warnings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('q-warn')
    .setDescription('Consulta las advertencias de un usuario')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuario a consultar')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('incluir_inactivas')
        .setDescription('Incluir advertencias removidas/inactivas')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    const targetUser = interaction.options.getUser('usuario');
    const includeInactive = interaction.options.getBoolean('incluir_inactivas') || false;

    // Obtener advertencias
    const activeWarnings = getUserWarnings(targetUser.id, interaction.guild.id);
    const allWarnings = includeInactive 
      ? getAllUserWarnings(targetUser.id, interaction.guild.id)
      : activeWarnings;

    // Si no tiene advertencias
    if (allWarnings.length === 0) {
      const noWarnsEmbed = new EmbedBuilder()
        .setColor(0x40E0D0)
        .setTitle('✅ Sin Advertencias')
        .setDescription(`**${targetUser.tag}** no tiene advertencias registradas.`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      return interaction.reply({ embeds: [noWarnsEmbed], ephemeral: true });
    }

    // Construir embed con historial
    const embed = new EmbedBuilder()
      .setColor(activeWarnings.length >= 3 ? 0xEF5350 : 0xF39C12)
      .setTitle(`⚠️ Advertencias de ${targetUser.tag}`)
      .setDescription(
        `**Total de advertencias activas:** ${activeWarnings.length}\n` +
        `**Total en historial:** ${allWarnings.length}`
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    // Ordenar por fecha (más reciente primero)
    const sortedWarnings = allWarnings.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Agregar las últimas 10 advertencias como campos
    const maxToShow = 10;
    for (let i = 0; i < Math.min(sortedWarnings.length, maxToShow); i++) {
      const warn = sortedWarnings[i];
      const timestamp = Math.floor(new Date(warn.timestamp).getTime() / 1000);
      const status = warn.active ? '🟢 Activa' : '⚫ Removida';
      
      let moderator = 'Desconocido';
      try {
        const mod = await interaction.client.users.fetch(warn.moderator_id);
        moderator = mod.tag;
      } catch (error) {
        moderator = `ID: ${warn.moderator_id}`;
      }

      embed.addFields({
        name: `${i + 1}. ${status} | <t:${timestamp}:d>`,
        value: 
          `**Razón:** ${warn.reason}\n` +
          `**Moderador:** ${moderator}\n` +
          `**ID:** \`${warn.id}\``,
        inline: false
      });
    }

    if (sortedWarnings.length > maxToShow) {
      embed.setFooter({ 
        text: `Mostrando las ${maxToShow} advertencias más recientes de ${sortedWarnings.length} totales` 
      });
    }

    // Agregar estado actual
    if (activeWarnings.length >= 3) {
      embed.addFields({
        name: '🚨 Estado',
        value: '**LÍMITE ALCANZADO** — Se requiere acción administrativa',
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
