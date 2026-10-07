const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const db = require('../utils/db');

const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID;

function validarHex(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

const builder = new SlashCommandBuilder()
  .setName('inscribir-equipo')
  .setDescription('Solicita la inscripción de un nuevo equipo en Diamonds League')
  .addStringOption((opt) =>
    opt.setName('nombreequipo').setDescription('Nombre oficial del equipo').setRequired(true).setMaxLength(100)
  )
  .addStringOption((opt) =>
    opt.setName('abreviacion').setDescription('Abreviación del equipo (ej: BSC)').setRequired(true).setMaxLength(10)
  )
  .addStringOption((opt) =>
    opt.setName('color_primario').setDescription('Color primario en hexadecimal (ej: #00BFA6)').setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('color_secundario').setDescription('Color secundario en hexadecimal (ej: #007C91)').setRequired(true)
  )
  .addAttachmentOption((opt) =>
    opt.setName('escudo').setDescription('Imagen del escudo (PNG, JPG o WebP)').setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('categoria').setDescription('Categoría donde se inscribirá el equipo').setRequired(true).setAutocomplete(true)
  )
  .addUserOption((opt) =>
    opt.setName('director_tecnico').setDescription('Director Técnico del equipo').setRequired(true)
  );

for (let i = 1; i <= 3; i++) {
  builder.addUserOption((opt) =>
    opt.setName(`jugador${i}`).setDescription(`Jugador ${i}`).setRequired(true)
  );
}

builder.addUserOption((opt) =>
  opt.setName('sub_director_tecnico').setDescription('Sub-Director Técnico del equipo (opcional)').setRequired(false)
);

for (let i = 4; i <= 10; i++) {
  builder.addUserOption((opt) =>
    opt.setName(`jugador${i}`).setDescription(`Jugador ${i} (opcional)`).setRequired(false)
  );
}

// Storage temporal para datos de inscripción pendientes de modal
const pendingInscriptions = new Map();

module.exports = {
  data: builder,

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
    // ── Verificar canal correcto ────────────────────────────────────────────
    const { COMMAND_CHANNELS, checkChannel } = require('../utils/permissions');
    const channelCheck = checkChannel(interaction, COMMAND_CHANNELS.inscribirEquipo, 'inscribir-equipo');
    if (!channelCheck.isCorrect) {
      return interaction.reply(channelCheck.reply);
    }

    const nombre          = interaction.options.getString('nombreequipo').trim();
    const abreviacion     = interaction.options.getString('abreviacion').trim().toUpperCase();
    const colorPrimario   = interaction.options.getString('color_primario').trim();
    const colorSecundario = interaction.options.getString('color_secundario').trim();
    const escudo          = interaction.options.getAttachment('escudo');
    const categoriaId     = interaction.options.getString('categoria');
    const dt              = interaction.options.getUser('director_tecnico');
    const subdt           = interaction.options.getUser('sub_director_tecnico') || null;

    if (!validarHex(colorPrimario)) {
      return interaction.reply({ content: 'El color primario no es un código hexadecimal válido. Usa el formato `#RRGGBB`.', ephemeral: true });
    }
    if (!validarHex(colorSecundario)) {
      return interaction.reply({ content: 'El color secundario no es un código hexadecimal válido. Usa el formato `#RRGGBB`.', ephemeral: true });
    }

    const tiposPermitidos = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!escudo || !tiposPermitidos.includes(escudo.contentType)) {
      return interaction.reply({ content: 'El escudo debe ser una imagen válida (PNG, JPG, WebP o GIF).', ephemeral: true });
    }

    if (dt.bot) {
      return interaction.reply({ content: 'El Director Técnico no puede ser un bot.', ephemeral: true });
    }
    if (subdt?.bot) {
      return interaction.reply({ content: 'El Sub-Director Técnico no puede ser un bot.', ephemeral: true });
    }
    if (subdt && subdt.id === dt.id) {
      return interaction.reply({ content: 'El Director Técnico y el Sub-Director Técnico no pueden ser el mismo usuario.', ephemeral: true });
    }

    const categoria = db.obtenerCategoriaPorId(categoriaId);
    if (!categoria) {
      return interaction.reply({ content: 'La categoría seleccionada no existe.', ephemeral: true });
    }
    if (db.categoriaLlena(categoria)) {
      return interaction.reply({ content: `La categoría **${categoria.nombre}** no tiene cupos disponibles actualmente.`, ephemeral: true });
    }

    if (db.obtenerEquipoPorNombre(nombre)) {
      return interaction.reply({ content: `Ya existe un equipo registrado con el nombre **${nombre}**.`, ephemeral: true });
    }
    if (db.solicitudPendientePorNombre(nombre)) {
      return interaction.reply({ content: `Ya existe una solicitud pendiente para un equipo con el nombre **${nombre}**.`, ephemeral: true });
    }

    const jugadoresMap = new Map();
    for (let i = 1; i <= 10; i++) {
      const user = interaction.options.getUser(`jugador${i}`);
      if (!user) continue;
      if (user.bot) {
        return interaction.reply({ content: `**${user.username}** es un bot y no puede ser jugador.`, ephemeral: true });
      }
      if (jugadoresMap.has(user.id)) {
        return interaction.reply({ content: `El jugador **${user.username}** fue incluido más de una vez.`, ephemeral: true });
      }
      if (user.id === dt.id || (subdt && user.id === subdt.id)) {
        return interaction.reply({ content: `**${user.username}** ya está registrado como miembro del cuerpo técnico. No puede ser jugador a la vez.`, ephemeral: true });
      }
      jugadoresMap.set(user.id, user);
    }

    if (jugadoresMap.size < 3) {
      return interaction.reply({ content: 'La solicitud requiere un mínimo de **3 jugadores**.', ephemeral: true });
    }

    const conflictos = [];

    const dtExistente = db.obtenerEquipoPorJugador(dt.id);
    if (dtExistente) conflictos.push(`· **${dt.username}** (DT) ya pertenece a **${dtExistente.nombre}**`);

    if (subdt) {
      const subdtExistente = db.obtenerEquipoPorJugador(subdt.id);
      if (subdtExistente) conflictos.push(`· **${subdt.username}** (Sub-DT) ya pertenece a **${subdtExistente.nombre}**`);
    }

    for (const [userId, user] of jugadoresMap) {
      const eq = db.obtenerEquipoPorJugador(userId);
      if (eq) conflictos.push(`· **${user.username}** ya pertenece a **${eq.nombre}**`);
    }

    if (conflictos.length > 0) {
      return interaction.reply({
        content: 'No se puede enviar la solicitud porque los siguientes miembros ya pertenecen a un equipo:\n\n' + conflictos.join('\n'),
        ephemeral: true
      });
    }

    // Construir array de TODOS los miembros (DT, Sub-DT, Jugadores) para el modal
    const todosLosMiembros = [];
    
    // Agregar DT
    todosLosMiembros.push({
      id: dt.id,
      username: dt.username,
      globalName: dt.globalName || dt.username,
      role: 'DT'
    });
    
    // Agregar Sub-DT si existe
    if (subdt) {
      todosLosMiembros.push({
        id: subdt.id,
        username: subdt.username,
        globalName: subdt.globalName || subdt.username,
        role: 'SUB_DT'
      });
    }
    
    // Agregar jugadores
    for (const [id, user] of jugadoresMap.entries()) {
      todosLosMiembros.push({
        id,
        username: user.username,
        globalName: user.globalName || user.username,
        role: 'PLAYER'
      });
    }

    // Generar ID único para este modal
    const modalId = `inscripcion_nicks_${Date.now()}_${interaction.user.id}`;

    // Guardar datos temporalmente
    pendingInscriptions.set(modalId, {
      applicantId: interaction.user.id,
      teamName: nombre,
      abbreviation: abreviacion,
      primaryColor: colorPrimario,
      secondaryColor: colorSecundario,
      shieldUrl: escudo.url,
      categoryId: categoriaId,
      categoria: categoria,
      dt: dt,
      subdt: subdt,
      miembros: todosLosMiembros,
    });

    // Crear modal
    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle(`Nicks de HaxBall - ${nombre}`);

    // Agregar campos para cada miembro (máximo 5 campos por modal)
    const numMiembros = todosLosMiembros.length;
    
    if (numMiembros <= 5) {
      // Si son 5 o menos miembros, un campo por miembro
      for (let i = 0; i < numMiembros; i++) {
        const miembro = todosLosMiembros[i];
        const roleLabel = miembro.role === 'DT' ? ' (DT)' : miembro.role === 'SUB_DT' ? ' (Sub-DT)' : '';
        const input = new TextInputBuilder()
          .setCustomId(`nick_${i}`)
          .setLabel(`Nick de ${miembro.globalName}${roleLabel}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ejemplo: Juda67')
          .setRequired(true)
          .setMaxLength(25);
        
        modal.addComponents(new ActionRowBuilder().addComponents(input));
      }
    } else {
      // Si son más de 5, mostrar los primeros 4 en campos individuales
      for (let i = 0; i < 4; i++) {
        const miembro = todosLosMiembros[i];
        const roleLabel = miembro.role === 'DT' ? ' (DT)' : miembro.role === 'SUB_DT' ? ' (Sub-DT)' : '';
        const input = new TextInputBuilder()
          .setCustomId(`nick_${i}`)
          .setLabel(`Nick de ${miembro.globalName}${roleLabel}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ejemplo: Juda67')
          .setRequired(true)
          .setMaxLength(25);
        
        modal.addComponents(new ActionRowBuilder().addComponents(input));
      }

      // Los restantes en un TextArea
      const restantes = todosLosMiembros.slice(4);
      const labels = restantes.map((m, idx) => {
        const roleLabel = m.role === 'DT' ? ' (DT)' : m.role === 'SUB_DT' ? ' (Sub-DT)' : '';
        return `${idx + 5}. ${m.globalName}${roleLabel}`;
      }).join('\n');
      const placeholder = restantes.map((_, idx) => `${idx + 5}. Nick${idx + 5}`).join('\n');
      
      const textArea = new TextInputBuilder()
        .setCustomId('nicks_restantes')
        .setLabel(`Nicks restantes (uno por línea):\n${labels}`)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(placeholder)
        .setRequired(true)
        .setMaxLength(250);
      
      modal.addComponents(new ActionRowBuilder().addComponents(textArea));
    }

    // Mostrar modal
    await interaction.showModal(modal);

    // Limpiar datos después de 15 minutos si no se completa
    setTimeout(() => {
      pendingInscriptions.delete(modalId);
    }, 15 * 60 * 1000);
  },

  async handleModalSubmit(interaction) {
    const modalId = interaction.customId;
    const data = pendingInscriptions.get(modalId);

    if (!data) {
      return interaction.reply({
        content: 'Esta solicitud expiró o ya fue procesada. Por favor, inicia la inscripción nuevamente con /inscribir-equipo.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // Extraer nicks ingresados
    const playerNicks = {};
    const numMiembros = data.miembros.length;

    try {
      if (numMiembros <= 5) {
        // Un campo por miembro
        for (let i = 0; i < numMiembros; i++) {
          const nick = interaction.fields.getTextInputValue(`nick_${i}`).trim();
          if (!nick) {
            return interaction.editReply({
              content: `El nick del miembro **${data.miembros[i].globalName}** no puede estar vacío.`
            });
          }
          playerNicks[data.miembros[i].id] = nick;
        }
      } else {
        // Primeros 4 en campos individuales
        for (let i = 0; i < 4; i++) {
          const nick = interaction.fields.getTextInputValue(`nick_${i}`).trim();
          if (!nick) {
            return interaction.editReply({
              content: `El nick del miembro **${data.miembros[i].globalName}** no puede estar vacío.`
            });
          }
          playerNicks[data.miembros[i].id] = nick;
        }

        // Restantes del textarea
        const nicksRestantes = interaction.fields.getTextInputValue('nicks_restantes').trim();
        const lineas = nicksRestantes.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        const miembrosRestantes = data.miembros.slice(4);
        if (lineas.length !== miembrosRestantes.length) {
          return interaction.editReply({
            content: `Se esperaban ${miembrosRestantes.length} nicks en el campo de texto, pero se recibieron ${lineas.length}. Por favor, proporciona un nick por línea.`
          });
        }

        for (let i = 0; i < miembrosRestantes.length; i++) {
          const nick = lineas[i].trim();
          if (!nick) {
            return interaction.editReply({
              content: `El nick del miembro **${miembrosRestantes[i].globalName}** no puede estar vacío.`
            });
          }
          playerNicks[miembrosRestantes[i].id] = nick;
        }
      }

      // Crear solicitud
      const solicitud = db.crearSolicitud({
        applicant_id:            data.applicantId,
        team_name:               data.teamName,
        abbreviation:            data.abbreviation,
        primary_color:           data.primaryColor,
        secondary_color:         data.secondaryColor,
        shield_url:              data.shieldUrl,
        category_id:             data.categoryId,
        director_tecnico_id:     data.dt.id,
        sub_director_tecnico_id: data.subdt?.id || null,
        players:                 data.miembros.filter(m => m.role === 'PLAYER').map(m => m.id),
        player_nicks:            playerNicks,
      });

      // Construir embed con nicks incluidos (todos los miembros)
      const miembrosConNicks = data.miembros
        .map(m => {
          const roleLabel = m.role === 'DT' ? ' (DT)' : m.role === 'SUB_DT' ? ' (Sub-DT)' : '';
          return `<@${m.id}>${roleLabel} → ${playerNicks[m.id]}`;
        })
        .join('\n');

      const reviewEmbed = new EmbedBuilder()
        .setColor(0x00bfa6)
        .setTitle('Solicitud de inscripción')
        .setThumbnail(data.shieldUrl)
        .setDescription(`**${data.teamName}**`)
        .addFields(
          { name: 'Abreviación', value: data.abbreviation,                                              inline: true },
          { name: 'Categoría',   value: `${data.categoria.nombre} — ${data.categoria.descripcion}`, inline: true },
          { name: '\u200b',      value: '\u200b',                                                      inline: true },
          { name: 'Color principal',  value: `\`${data.primaryColor}\``,   inline: true },
          { name: 'Color secundario', value: `\`${data.secondaryColor}\``, inline: true },
          { name: '\u200b',           value: '\u200b',                     inline: true },
          { name: 'Solicitante',         value: `<@${data.applicantId}>`,          inline: false },
          { name: 'Director Técnico',    value: `<@${data.dt.id}>`,                inline: true },
          { name: 'Sub-Director Técnico', value: data.subdt ? `<@${data.subdt.id}>` : '—', inline: true },
          { name: `Miembros (${data.miembros.length})`, value: miembrosConNicks, inline: false },
          { name: 'Estado', value: 'Pendiente de revisión', inline: false },
        )
        .setTimestamp()
        .setFooter({ text: `ID: ${solicitud.id}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`appacc|${solicitud.id}`)
          .setLabel('Aceptar solicitud')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`apprej|${solicitud.id}`)
          .setLabel('Rechazar solicitud')
          .setStyle(ButtonStyle.Danger)
      );

      try {
        const reviewChannel = await interaction.client.channels.fetch(REVIEW_CHANNEL_ID);
        const msg = await reviewChannel.send({ embeds: [reviewEmbed], components: [row] });
        db.actualizarSolicitud(solicitud.id, {
          message_id:        msg.id,
          review_channel_id: REVIEW_CHANNEL_ID,
        });
      } catch (err) {
        console.error('Error enviando al canal de revisión:', err);
        pendingInscriptions.delete(modalId);
        return interaction.editReply({
          content: 'No se pudo enviar la solicitud al canal de revisión. Contacta a un administrador.'
        });
      }

      // Limpiar datos temporales
      pendingInscriptions.delete(modalId);

      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00bfa6)
        .setTitle('Solicitud enviada')
        .setDescription(
          `Tu solicitud para **${data.teamName}** fue enviada correctamente y está pendiente de revisión.\n\nRecibirás un mensaje privado cuando sea procesada.`
        )
        .addFields(
          { name: 'Equipo',    value: data.teamName,            inline: true },
          { name: 'Categoría', value: data.categoria.nombre,    inline: true }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [confirmEmbed] });

    } catch (error) {
      console.error('Error procesando modal de inscripción:', error);
      pendingInscriptions.delete(modalId);
      return interaction.editReply({
        content: 'Ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente.'
      });
    }
  },
};
