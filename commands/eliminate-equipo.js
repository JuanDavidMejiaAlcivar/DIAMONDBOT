const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../utils/db');
const { getTeamEmoji } = require('../utils/emojiService');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eliminate-equipo')
    .setDescription('[ADMIN] Elimina permanentemente un equipo de la liga')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName('equipo')
        .setDescription('Selecciona el equipo a eliminar')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const equipos = db.obtenerEquipos();
    const categorias = db.obtenerCategorias();

    const filtered = equipos.filter(
      (e) =>
        e.nombre.toLowerCase().includes(focused.toLowerCase()) ||
        e.abreviacion?.toLowerCase().includes(focused.toLowerCase())
    );

    await interaction.respond(
      filtered.slice(0, 25).map((e) => {
        const cat = categorias.find((c) => c.id === e.categoria_id);
        return {
          name: `${e.nombre}${e.abreviacion ? ` (${e.abreviacion})` : ''}${cat ? ` — ${cat.nombre}` : ''}`,
          value: e.id,
        };
      })
    );
  },

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    const equipoId = interaction.options.getString('equipo');
    const equipo = db.obtenerEquipoPorId(equipoId);

    if (!equipo) {
      return interaction.reply({
        content: 'El equipo seleccionado no existe en la base de datos.',
      });
    }

    const cat = db.obtenerCategoriaPorId(equipo.categoria_id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`elim_cancel_${equipoId}`)
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`elim_confirm_${equipoId}`)
        .setLabel('Eliminar permanentemente')
        .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setColor(0xef5350)
      .setTitle('Eliminar equipo')
      .setDescription(
        `${getTeamEmoji(interaction.guild, equipo.id)}**${equipo.nombre}**\n\n` +
          `Categoría\n${cat ? `${cat.nombre} — ${cat.descripcion}` : '—'}\n\n` +
          `Esta acción eliminará permanentemente el equipo y sus recursos asociados de Discord.\nEsta acción no se puede deshacer.`
      );

    return interaction.reply({ embeds: [embed], components: [row] });
  },
};
