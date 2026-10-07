const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../utils/db');
const { pendingEdits } = require('../utils/state');
const { getTeamEmoji, syncTeamEmoji } = require('../utils/emojiService');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');

function validarHex(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function hexAInt(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

function nombreACanal(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 100);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-equipo')
    .setDescription('[ADMIN] Edita la información de un equipo registrado')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName('equipo')
        .setDescription('Equipo a editar')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('nombre').setDescription('Nuevo nombre del equipo').setRequired(false).setMaxLength(100)
    )
    .addStringOption((opt) =>
      opt.setName('abreviacion').setDescription('Nueva abreviación').setRequired(false).setMaxLength(10)
    )
    .addStringOption((opt) =>
      opt.setName('color_primario').setDescription('Nuevo color primario (#RRGGBB)').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('color_secundario').setDescription('Nuevo color secundario (#RRGGBB)').setRequired(false)
    )
    .addAttachmentOption((opt) =>
      opt.setName('escudo').setDescription('Nuevo escudo del equipo').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('categoria').setDescription('Nueva categoría').setRequired(false).setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'equipo') {
      const equipos = db.obtenerEquipos();
      const categorias = db.obtenerCategorias();
      const filtered = equipos.filter(
        (e) =>
          e.nombre.toLowerCase().includes(focused.value.toLowerCase()) ||
          e.abreviacion?.toLowerCase().includes(focused.value.toLowerCase())
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
    } else if (focused.name === 'categoria') {
      const categorias = db.obtenerCategorias();
      const filtered = categorias.filter(
        (c) =>
          c.nombre.toLowerCase().includes(focused.value.toLowerCase()) ||
          c.descripcion.toLowerCase().includes(focused.value.toLowerCase())
      );
      await interaction.respond(
        filtered.slice(0, 25).map((c) => {
          const equipos = db.obtenerEquiposPorCategoria(c.id);
          const disponibles = c.max_equipos - equipos.length;
          return {
            name: `${c.nombre} — ${c.descripcion} (${disponibles <= 0 ? 'Sin cupos' : `${disponibles} cupos`})`,
            value: c.id,
          };
        })
      );
    }
  },

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    await interaction.deferReply({ flags: 64 });

    const equipoId = interaction.options.getString('equipo');
    const equipo = db.obtenerEquipoPorId(equipoId);

    if (!equipo) {
      return interaction.editReply({ content: 'El equipo seleccionado no existe.' });
    }

    const nuevoNombre = interaction.options.getString('nombre')?.trim() || null;
    const nuevaAbreviacion =
      interaction.options.getString('abreviacion')?.trim().toUpperCase() || null;
    const nuevoColorPrimario = interaction.options.getString('color_primario')?.trim() || null;
    const nuevoColorSecundario = interaction.options.getString('color_secundario')?.trim() || null;
    const nuevoEscudo = interaction.options.getAttachment('escudo') || null;
    const nuevaCategoriaId = interaction.options.getString('categoria') || null;

    if (
      !nuevoNombre &&
      !nuevaAbreviacion &&
      !nuevoColorPrimario &&
      !nuevoColorSecundario &&
      !nuevoEscudo &&
      !nuevaCategoriaId
    ) {
      return interaction.editReply({
        content: 'Debes especificar al menos un campo para modificar.',
      });
    }

    if (nuevoColorPrimario && !validarHex(nuevoColorPrimario)) {
      return interaction.editReply({
        content: 'El color primario no es un código hexadecimal válido. Usa el formato `#RRGGBB`.',
      });
    }

    if (nuevoColorSecundario && !validarHex(nuevoColorSecundario)) {
      return interaction.editReply({
        content: 'El color secundario no es un código hexadecimal válido. Usa el formato `#RRGGBB`.',
      });
    }

    const tiposPermitidos = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (nuevoEscudo && !tiposPermitidos.includes(nuevoEscudo.contentType)) {
      return interaction.editReply({
        content: 'El escudo debe ser una imagen válida (PNG, JPG, WebP o GIF).',
      });
    }

    let nuevaCategoria = null;
    if (nuevaCategoriaId) {
      if (nuevaCategoriaId === equipo.categoria_id) {
        return interaction.editReply({ content: 'El equipo ya se encuentra en esa categoría.' });
      }
      nuevaCategoria = db.obtenerCategoriaPorId(nuevaCategoriaId);
      if (!nuevaCategoria) {
        return interaction.editReply({ content: 'La categoría seleccionada no existe.' });
      }
      const equiposEnDestino = db.obtenerEquiposPorCategoria(nuevaCategoriaId);
      if (equiposEnDestino.length >= nuevaCategoria.max_equipos) {
        return interaction.editReply({
          content: `No es posible mover el equipo a **${nuevaCategoria.nombre}** porque no hay cupos disponibles.`,
        });
      }
    }

    if (nuevoNombre && nuevoNombre.toLowerCase() !== equipo.nombre.toLowerCase()) {
      const existente = db.obtenerEquipoPorNombre(nuevoNombre);
      if (existente && existente.id !== equipoId) {
        return interaction.editReply({
          content: `Ya existe un equipo con el nombre **${nuevoNombre}**.`,
        });
      }
    }

    if (
      nuevaAbreviacion &&
      nuevaAbreviacion.toLowerCase() !== equipo.abreviacion?.toLowerCase()
    ) {
      const existente = db.obtenerEquipoPorAbreviacion(nuevaAbreviacion);
      if (existente && existente.id !== equipoId) {
        return interaction.editReply({
          content: `Ya existe un equipo con la abreviación **${nuevaAbreviacion}**.`,
        });
      }
    }

    const changes = {};
    if (nuevoNombre) changes.nombre = nuevoNombre;
    if (nuevaAbreviacion) changes.abreviacion = nuevaAbreviacion;
    if (nuevoColorPrimario) changes.color_primario = nuevoColorPrimario;
    if (nuevoColorSecundario) changes.color_secundario = nuevoColorSecundario;
    if (nuevoEscudo) changes.escudo = nuevoEscudo.url;
    if (nuevaCategoriaId) changes.categoria_id = nuevaCategoriaId;

    const stateKey = `${interaction.user.id}|${equipoId}`;
    pendingEdits.set(stateKey, { changes, equipoId, userId: interaction.user.id });

    const catActual = db.obtenerCategoriaPorId(equipo.categoria_id);

    const previewLines = [];
    if (changes.nombre)
      previewLines.push(`**Nombre**\n${equipo.nombre} → ${changes.nombre}`);
    if (changes.abreviacion)
      previewLines.push(`**Abreviación**\n${equipo.abreviacion || '—'} → ${changes.abreviacion}`);
    if (changes.color_primario)
      previewLines.push(`**Color principal**\n${equipo.color_primario} → ${changes.color_primario}`);
    if (changes.color_secundario)
      previewLines.push(`**Color secundario**\n${equipo.color_secundario} → ${changes.color_secundario}`);
    if (changes.escudo)
      previewLines.push(`**Escudo**\nImagen actual → nueva imagen adjunta`);
    if (changes.categoria_id)
      previewLines.push(
        `**Categoría**\n${catActual ? catActual.nombre : equipo.categoria_id} → ${nuevaCategoria.nombre}`
      );

    const syncLines = [];
    if (changes.nombre) {
      syncLines.push('Nombre del rol de Discord');
      syncLines.push('Nombre del canal privado');
      syncLines.push('Nombre del emoji personalizado');
    }
    if (changes.escudo) syncLines.push('Imagen del emoji personalizado');
    if (changes.color_primario) syncLines.push('Color del rol de Discord');

    const embedColor = changes.color_primario ? hexAInt(changes.color_primario) : 0x00bfa6;
    const emojiStr = getTeamEmoji(interaction.guild, equipoId);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('Vista previa de cambios')
      .setDescription(
        `${emojiStr}**${equipo.nombre}**\n\n` +
          previewLines.join('\n\n') +
          (syncLines.length > 0
            ? `\n\n**Se sincronizará en Discord**\n${syncLines.map((l) => `· ${l}`).join('\n')}`
            : '')
      )
      .setFooter({ text: 'Revisa los cambios antes de confirmar.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`edit_cancel|${interaction.user.id}|${equipoId}`)
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`edit_confirm|${interaction.user.id}|${equipoId}`)
        .setLabel('Guardar cambios')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  },

  async applyConfirm(interaction, userId, equipoId) {
    const stateKey = `${userId}|${equipoId}`;
    const pending = pendingEdits.get(stateKey);

    if (!pending) {
      return interaction.update({
        content: 'La sesión de edición expiró. Ejecuta el comando nuevamente.',
        embeds: [],
        components: [],
      });
    }

    pendingEdits.delete(stateKey);

    const equipo = db.obtenerEquipoPorId(equipoId);
    if (!equipo) {
      return interaction.update({ content: 'El equipo ya no existe.', embeds: [], components: [] });
    }

    const { changes } = pending;
    const guild = interaction.guild;

    if ((changes.nombre || changes.color_primario) && equipo.role_id) {
      try {
        const rol = await guild.roles.fetch(equipo.role_id).catch(() => null);
        if (rol) {
          const rolChanges = {};
          if (changes.nombre) rolChanges.name = changes.nombre;
          if (changes.color_primario) rolChanges.color = hexAInt(changes.color_primario);
          await rol.edit(rolChanges);
        }
      } catch (err) {
        console.error('Error actualizando rol:', err);
      }
    }

    if (changes.nombre && equipo.channel_id) {
      try {
        const canal = await guild.channels.fetch(equipo.channel_id).catch(() => null);
        if (canal) await canal.setName(nombreACanal(changes.nombre));
      } catch (err) {
        console.error('Error actualizando canal:', err);
      }
    }

    if (changes.nombre || changes.escudo) {
      await syncTeamEmoji(guild, equipo, changes.escudo || null);
    }

    db.actualizarEquipo(equipoId, changes);
    const equipoActualizado = db.obtenerEquipoPorId(equipoId);
    const catActualizada = db.obtenerCategoriaPorId(equipoActualizado.categoria_id);

    const embed = new EmbedBuilder()
      .setColor(0x00bfa6)
      .setTitle('Cambios guardados')
      .setDescription(
        `**${equipoActualizado.nombre}** ha sido actualizado correctamente.\n\n` +
          `Categoría\n${catActualizada ? `${catActualizada.nombre} — ${catActualizada.descripcion}` : '—'}`
      )
      .setTimestamp();

    return interaction.update({ embeds: [embed], components: [] });
  },

  applyCancel(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x455a64)
      .setTitle('Edición cancelada')
      .setDescription('No se realizaron cambios en el equipo.');
    return interaction.update({ embeds: [embed], components: [] });
  },
};
