const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../utils/db');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-categorias')
    .setDescription('[ADMIN] Gestiona las categorías de Diamonds League')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('crear')
        .setDescription('Crea una nueva categoría')
        .addStringOption((opt) =>
          opt
            .setName('nombre')
            .setDescription('Nombre de la categoría (ej: D3)')
            .setRequired(true)
            .setMaxLength(32)
        )
        .addStringOption((opt) =>
          opt
            .setName('descripcion')
            .setDescription('Descripción (ej: Tercera División)')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('cupos')
            .setDescription('Cantidad máxima de equipos')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('editar')
        .setDescription('Edita una categoría existente')
        .addStringOption((opt) =>
          opt
            .setName('categoria')
            .setDescription('Categoría a editar')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt.setName('nombre').setDescription('Nuevo nombre').setRequired(false).setMaxLength(32)
        )
        .addStringOption((opt) =>
          opt
            .setName('descripcion')
            .setDescription('Nueva descripción')
            .setRequired(false)
            .setMaxLength(100)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('max_equipos')
            .setDescription('Nuevo límite máximo de equipos')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('eliminar')
        .setDescription('Elimina una categoría')
        .addStringOption((opt) =>
          opt
            .setName('categoria')
            .setDescription('Categoría a eliminar')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const categorias = db.obtenerCategorias();
    const filtered = categorias.filter(
      (c) =>
        c.nombre.toLowerCase().includes(focused.toLowerCase()) ||
        c.descripcion.toLowerCase().includes(focused.toLowerCase())
    );
    await interaction.respond(
      filtered.slice(0, 25).map((c) => ({
        name: `${c.nombre} — ${c.descripcion}`,
        value: c.id,
      }))
    );
  },

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'crear') {
      const nombre = interaction.options.getString('nombre').trim();
      const descripcion = interaction.options.getString('descripcion').trim();
      const cupos = interaction.options.getInteger('cupos');

      const result = db.crearCategoria(nombre, descripcion, cupos);

      if (!result.ok) {
        return interaction.reply({ content: result.error, flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00bfa6)
        .setTitle('Categoría creada')
        .addFields(
          { name: 'Nombre', value: nombre, inline: true },
          { name: 'Descripción', value: descripcion, inline: true },
          { name: 'Cupos máximos', value: `${cupos}`, inline: true },
          { name: 'Estado inicial', value: `0/${cupos} equipos · ${cupos} disponibles` }
        )
        .setTimestamp()
        .setFooter({ text: `Creado por ${interaction.user.username}` });

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (sub === 'editar') {
      const catId = interaction.options.getString('categoria');
      const cat = db.obtenerCategoriaPorId(catId);

      if (!cat) {
        return interaction.reply({ content: 'Categoría no encontrada.', flags: 64 });
      }

      const nuevoNombre = interaction.options.getString('nombre');
      const nuevaDesc = interaction.options.getString('descripcion');
      const nuevoMax = interaction.options.getInteger('max_equipos');

      if (!nuevoNombre && !nuevaDesc && !nuevoMax) {
        return interaction.reply({
          content: 'Debes indicar al menos un campo para modificar.',
          flags: 64,
        });
      }

      const campos = {};
      if (nuevoNombre) campos.nombre = nuevoNombre.trim();
      if (nuevaDesc) campos.descripcion = nuevaDesc.trim();

      if (nuevoMax) {
        const equiposActuales = db.obtenerEquiposPorCategoria(catId);
        if (nuevoMax < equiposActuales.length) {
          return interaction.reply({
            content: `No puedes reducir los cupos a **${nuevoMax}** porque hay **${equiposActuales.length}** equipo(s) registrado(s) en esta categoría.`,
            flags: 64,
          });
        }
        campos.max_equipos = nuevoMax;
      }

      const result = db.editarCategoria(catId, campos);

      if (!result.ok) {
        return interaction.reply({ content: result.error, flags: 64 });
      }

      const catActualizada = result.categoria;
      const equipos = db.obtenerEquiposPorCategoria(catId);
      const disponibles = db.cuposDisponibles(catActualizada);
      const llena = db.categoriaLlena(catActualizada);

      const embed = new EmbedBuilder()
        .setColor(0x00bfa6)
        .setTitle('Categoría actualizada')
        .addFields(
          { name: 'Nombre', value: catActualizada.nombre, inline: true },
          { name: 'Descripción', value: catActualizada.descripcion, inline: true },
          { name: 'Cupos máximos', value: `${catActualizada.max_equipos}`, inline: true },
          {
            name: 'Estado',
            value: `${equipos.length}/${catActualizada.max_equipos} equipos · ${llena ? 'Sin cupos' : `${disponibles} disponibles`}`,
          }
        )
        .setTimestamp()
        .setFooter({ text: `Editado por ${interaction.user.username}` });

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (sub === 'eliminar') {
      const catId = interaction.options.getString('categoria');
      const cat = db.obtenerCategoriaPorId(catId);

      if (!cat) {
        return interaction.reply({ content: 'Categoría no encontrada.', flags: 64 });
      }

      const equipos = db.obtenerEquiposPorCategoria(catId);

      if (equipos.length > 0) {
        const embed = new EmbedBuilder()
          .setColor(0xef5350)
          .setTitle('No se puede eliminar la categoría')
          .setDescription(
            `**${cat.nombre}** contiene **${equipos.length}** equipo(s) registrado(s).\n\n` +
              `Gestiona esos equipos antes de eliminar la categoría.\n\n` +
              `**Equipos:**\n` +
              equipos.map((e) => `· ${e.nombre}`).join('\n')
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: 64 });
      }

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`del_cat_cancel_${catId}`)
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`del_cat_confirm_${catId}`)
          .setLabel('Eliminar categoría')
          .setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setColor(0xffb300)
        .setTitle('Confirmar eliminación')
        .setDescription(
          `¿Eliminar la categoría **${cat.nombre}** — ${cat.descripcion}?\n\nEsta acción no se puede deshacer.`
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], components: [confirmRow], flags: 64 });
    }
  },
};
