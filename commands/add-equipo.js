const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const db = require('../utils/db');
const { crearEquipoCompleto, hexAInt } = require('../utils/teamService');
const { isAdmin, noPermissionEmbed } = require('../utils/permissions');
const logger = require('../utils/logger');

const DT_ROLE_ID    = process.env.DT_ROLE_ID    ? process.env.DT_ROLE_ID.trim()    : null;
const SUBDT_ROLE_ID = process.env.SUBDT_ROLE_ID ? process.env.SUBDT_ROLE_ID.trim() : null;

function validarHex(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-equipo')
    .setDescription('[ADMIN] Registra un nuevo equipo directamente en Diamonds League')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt.setName('nombreequipo').setDescription('Nombre completo del equipo').setRequired(true).setMaxLength(100)
    )
    .addStringOption((opt) =>
      opt.setName('abreviacion').setDescription('Abreviación del equipo (ej: BSC)').setRequired(true).setMaxLength(10)
    )
    .addStringOption((opt) =>
      opt.setName('color_primario').setDescription('Color primario en hexadecimal (ej: #00BFA6)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('color_secundario').setDescription('Color secundario en hexadecimal (ej: #000000)').setRequired(true)
    )
    .addAttachmentOption((opt) =>
      opt.setName('escudo').setDescription('Imagen del escudo del equipo (PNG, JPG o WebP)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('categoria').setDescription('Categoría donde se registrará el equipo').setRequired(true).setAutocomplete(true)
    )
    .addUserOption((opt) =>
      opt.setName('director_tecnico').setDescription('Director Técnico del equipo').setRequired(true)
    )
    .addUserOption((opt) =>
      opt.setName('sub_director_tecnico').setDescription('Sub-Director Técnico del equipo (opcional)').setRequired(false)
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
      filtered.slice(0, 25).map((c) => {
        const equipos = db.obtenerEquiposPorCategoria(c.id);
        const disponibles = c.max_equipos - equipos.length;
        return {
          name: `${c.nombre} — ${c.descripcion} (${disponibles <= 0 ? 'Sin cupos' : `${disponibles} cupos`})`,
          value: c.id,
        };
      })
    );
  },

  async execute(interaction) {
    // Verificar permisos administrativos
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [noPermissionEmbed()], ephemeral: true });
    }

    await interaction.deferReply({ flags: 64 });

    const nombre          = interaction.options.getString('nombreequipo').trim();
    const abreviacion     = interaction.options.getString('abreviacion').trim().toUpperCase();
    const colorPrimario   = interaction.options.getString('color_primario').trim();
    const colorSecundario = interaction.options.getString('color_secundario').trim();
    const escudo          = interaction.options.getAttachment('escudo');
    const categoriaId     = interaction.options.getString('categoria');
    const dt              = interaction.options.getUser('director_tecnico');
    const subdt           = interaction.options.getUser('sub_director_tecnico') || null;

    if (!validarHex(colorPrimario)) {
      return interaction.editReply({ content: 'El color primario no es un código hexadecimal válido. Usa el formato `#RRGGBB`.' });
    }
    if (!validarHex(colorSecundario)) {
      return interaction.editReply({ content: 'El color secundario no es un código hexadecimal válido. Usa el formato `#RRGGBB`.' });
    }

    const tiposPermitidos = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!escudo || !tiposPermitidos.includes(escudo.contentType)) {
      return interaction.editReply({ content: 'El escudo debe ser una imagen válida (PNG, JPG, WebP o GIF).' });
    }

    if (dt.bot) return interaction.editReply({ content: 'El Director Técnico no puede ser un bot.' });
    if (subdt?.bot) return interaction.editReply({ content: 'El Sub-Director Técnico no puede ser un bot.' });
    if (subdt && subdt.id === dt.id) {
      return interaction.editReply({ content: 'El Director Técnico y el Sub-Director Técnico no pueden ser el mismo usuario.' });
    }

    const categoria = db.obtenerCategoriaPorId(categoriaId);
    if (!categoria) {
      return interaction.editReply({ content: 'La categoría seleccionada no existe.' });
    }
    if (db.categoriaLlena(categoria)) {
      return interaction.editReply({ content: `La categoría **${categoria.nombre}** no tiene cupos disponibles.` });
    }
    if (db.obtenerEquipoPorNombre(nombre)) {
      return interaction.editReply({ content: `Ya existe un equipo con el nombre **${nombre}**.` });
    }
    if (db.obtenerEquipoPorAbreviacion(abreviacion)) {
      return interaction.editReply({ content: `Ya existe un equipo con la abreviación **${abreviacion}**.` });
    }

    let result;
    try {
      result = await crearEquipoCompleto(
        interaction.guild,
        {
          nombre,
          abreviacion,
          color_primario:          colorPrimario,
          color_secundario:        colorSecundario,
          escudo_url:              escudo.url,
          categoria_id:            categoriaId,
          jugadores:               [],
          director_tecnico_id:     dt.id,
          sub_director_tecnico_id: subdt?.id || null,
        },
        interaction.client.user.id
      );
    } catch (err) {
      return interaction.editReply({ content: err.message });
    }

    const { equipo, rol, canal } = result;

    try { await canal.send(`*Canal de ${nombre}*\n\n<@&${rol.id}>`); } catch (_) {}

    const dtMember = await interaction.guild.members.fetch(dt.id).catch(() => null);
    if (dtMember) {
      try { await dtMember.roles.add(rol.id); }   catch (e) { console.error(e); }
      if (DT_ROLE_ID) try { await dtMember.roles.add(DT_ROLE_ID); } catch (e) { console.error(e); }
    }

    if (subdt) {
      const subdtMember = await interaction.guild.members.fetch(subdt.id).catch(() => null);
      if (subdtMember) {
        try { await subdtMember.roles.add(rol.id); }       catch (e) { console.error(e); }
        if (SUBDT_ROLE_ID) try { await subdtMember.roles.add(SUBDT_ROLE_ID); } catch (e) { console.error(e); }
      }
    }

    const equiposCategoria = db.obtenerEquiposPorCategoria(categoriaId);
    const categoriaActual  = db.obtenerCategoriaPorId(categoriaId);

    const embed = new EmbedBuilder()
      .setColor(hexAInt(colorPrimario))
      .setTitle('Equipo registrado')
      .setThumbnail(escudo.url)
      .addFields(
        { name: 'Equipo',      value: nombre,      inline: true },
        { name: 'Abreviación', value: abreviacion,  inline: true },
        { name: '\u200b',      value: '\u200b',    inline: true },
        { name: 'Categoría',   value: `${categoriaActual.nombre} — ${categoriaActual.descripcion}`, inline: true },
        { name: 'Cupos',       value: `${equiposCategoria.length}/${categoriaActual.max_equipos}`,  inline: true },
        { name: '\u200b',      value: '\u200b',    inline: true },
        { name: 'Director Técnico',    value: `<@${dt.id}>`,                     inline: true },
        { name: 'Sub-Director Técnico', value: subdt ? `<@${subdt.id}>` : '—', inline: true },
        { name: '\u200b',              value: '\u200b',                          inline: true },
        { name: 'Color principal',  value: `\`${colorPrimario}\``,   inline: true },
        { name: 'Color secundario', value: `\`${colorSecundario}\``, inline: true },
        { name: '\u200b',           value: '\u200b',                 inline: true },
        { name: 'Rol del equipo', value: `<@&${rol.id}>`,                                    inline: true },
        { name: 'Canal',         value: `<#${canal.id}>`,                                    inline: true },
      )
      .setFooter({ text: `Registrado por ${interaction.user.username}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Log de equipo creado (en segundo plano, no bloquea)
    logger.logTeam(
      interaction.client,
      interaction.user,
      'create',
      nombre,
      {
        categoria: categoriaActual.nombre,
        dt: dt.id,
        subdt: subdt?.id || null,
        abreviacion,
        color: colorPrimario,
        escudo: escudo.url
      }
    ).catch(err => console.error('[LOGGER] Error en log de add-equipo:', err));

    return;
  },
};
