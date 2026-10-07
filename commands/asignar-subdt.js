const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');
const { replyError, replyWarn } = require('../utils/errorEmbeds');

const SUBDT_ROLE_ID = process.env.SUBDT_ROLE_ID ? process.env.SUBDT_ROLE_ID.trim() : null;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('asignar-subdt')
    .setDescription('Asigna el cargo de Sub-Director Técnico a un jugador de tu equipo.')
    .addUserOption((opt) =>
      opt.setName('jugador').setDescription('Jugador de tu equipo que será el nuevo Sub-DT').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const jugador = interaction.options.getUser('jugador');

    // ── Validaciones básicas del jugador seleccionado ──────────────────────
    if (jugador.bot) {
      return replyError(interaction, 'Usuario no válido', 'El Sub-Director Técnico no puede ser un bot.');
    }

    if (jugador.id === interaction.user.id) {
      return replyWarn(interaction,
        'Acción no permitida',
        `Ya eres el **Director Técnico**, no puedes asignarte como Subdirector Técnico a ti mismo.\n\n` +
        `> El cargo de Sub-DT debe ser asignado a un jugador de tu plantilla.`
      );
    }

    // ── Validaciones del operador (quien ejecuta) ──────────────────────────
    const equipo = db.obtenerEquipoPorJugador(interaction.user.id);
    
    if (!equipo) {
      return replyError(interaction,
        'Sin registro en el sistema',
        `No tienes ningún equipo registrado en el sistema.\n\n` +
        `> Solo los **Directores Técnicos** pueden asignar el cargo de Sub-DT a sus jugadores.`
      );
    }

    if (equipo.director_tecnico_id !== interaction.user.id) {
      const authRecord = db.obtenerMiembro(interaction.user.id);
      return replyError(interaction,
        'Permisos insuficientes',
        `Solo el **Director Técnico** del equipo puede asignar a un Sub-DT.\n\n` +
        `> Actualmente ocupas el cargo de **${authRecord?.role === 'SUB_DT' ? 'Subdirector Técnico' : 'Jugador'}** en ${equipo.nombre}.`,
        [{ name: '🛡️ Tu equipo', value: equipo.nombre, inline: true }, { name: '👔 Tu cargo', value: authRecord?.role || 'Jugador', inline: true }]
      );
    }

    // ── Verificación del estado del equipo ─────────────────────────────────
    if (equipo.sub_director_tecnico_id) {
      return replyError(interaction,
        'Cargo ya ocupado',
        `Tu equipo ya cuenta con un **Subdirector Técnico** asignado (<@${equipo.sub_director_tecnico_id}>).\n\n` +
        `> Si deseas asignar a un nuevo Sub-DT, primero debes utilizar el comando **/quitar-subdt** para remover al actual.`,
        [{ name: '👔 Sub-DT Actual', value: `<@${equipo.sub_director_tecnico_id}>`, inline: true }]
      );
    }

    // ── Validaciones del jugador destino ────────────────────────────────────
    const member = await interaction.guild.members.fetch(jugador.id).catch(() => null);
    if (!member) {
      return replyError(interaction,
        'Jugador no encontrado',
        `<@${jugador.id}> no se encuentra en el servidor de Discord.\n\n` +
        `> El jugador debe estar en el servidor para poder recibir el cargo.`
      );
    }

    const targetRecord = db.obtenerMiembro(jugador.id);
    if (!targetRecord) {
      return replyWarn(interaction,
        'Jugador no registrado',
        `<@${jugador.id}> no pertenece a ningún equipo en el sistema.\n\n` +
        `> Para ser Sub-DT, el jugador debe primero ser fichado por tu equipo.`
      );
    }

    if (targetRecord.team_id !== equipo.id) {
      const otroEquipo = db.obtenerEquipoPorId(targetRecord.team_id);
      return replyError(interaction,
        'Jugador de otro equipo',
        `<@${jugador.id}> pertenece a **${otroEquipo?.nombre || 'otro equipo'}**.\n\n` +
        `> Solo puedes asignar el cargo a jugadores que pertenezcan a **${equipo.nombre}**.`,
        [
          { name: '🛡️ Equipo del jugador', value: otroEquipo?.nombre || '—', inline: true },
          { name: '🛡️ Tu equipo', value: equipo.nombre, inline: true }
        ]
      );
    }

    if (!member.roles.cache.has(equipo.role_id)) {
      return replyWarn(interaction,
        'Inconsistencia de roles',
        `<@${jugador.id}> figura en la base de datos de tu equipo, pero no tiene el rol de Discord asociado a **${equipo.nombre}**.\n\n` +
        `> Contacta a un administrador para que sincronice sus roles antes de continuar.`
      );
    }

    // ── Ejecutar asignación ────────────────────────────────────────────────
    try {
      db.asignarSubDt(equipo.id, jugador.id, interaction.user.id);
    } catch (error) {
      console.error('Error al actualizar la base de datos al asignar Sub-DT:', error);
      return replyError(interaction, 'Error interno', 'Hubo un error al guardar los cambios en la base de datos. Inténtalo de nuevo.');
    }

    // Intentar asignar el rol de Discord si existe
    if (SUBDT_ROLE_ID) {
      try {
        await member.roles.add(SUBDT_ROLE_ID, `Asignado como Sub-DT por ${interaction.user.id}`);
      } catch (err) {
        console.warn(`No se pudo asignar el rol de Sub-DT a ${jugador.id}:`, err.message);
      }
    }

    const colorInt = equipo.color_primario?.startsWith('#') ? parseInt(equipo.color_primario.slice(1), 16) : 0x00bfa6;
    const embed = new EmbedBuilder()
      .setColor(colorInt)
      .setTitle('👔 Nuevo Sub-Director Técnico')
      .setDescription(`Has asignado exitosamente a <@${jugador.id}> como Sub-Director Técnico de **${equipo.nombre}**.\n\n> *A partir de ahora, tiene permisos para enviar propuestas de fichaje a jugadores libres y administrar la plantilla.*`)
      .setTimestamp();
    
    if (equipo.escudo) embed.setThumbnail(equipo.escudo);

    return interaction.editReply({ embeds: [embed] });
  },
};
