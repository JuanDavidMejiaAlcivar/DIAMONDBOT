/**
 * Handler centralizado para todas las interacciones de botones.
 * Extraído de index.js para mantener el archivo principal limpio.
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const db = require('../utils/db');
const { isAdmin } = require('../utils/permissions');
const { hexAInt } = require('../utils/teamService');
const { deleteTeamEmoji, getTeamEmoji } = require('../utils/emojiService');
const { crearEquipoCompleto } = require('../utils/teamService');
const { crearTicket, reclamarTicket } = require('../utils/ticketSystem');
const { pendingEdits } = require('../utils/state');
const { safeReply } = require('./safeReply');
const logger = require('../utils/logger');

const DT_ROLE_ID    = process.env.DT_ROLE_ID?.trim() || null;
const SUBDT_ROLE_ID = process.env.SUBDT_ROLE_ID?.trim() || null;

/**
 * Maneja todas las interacciones de botón.
 * @param {ButtonInteraction} interaction
 * @param {Client} client
 */
async function handleButton(interaction, client) {
  const id = interaction.customId;
  console.log('[BUTTON] Botón detectado:', id);

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // SISTEMA DE TICKETS
    // ═══════════════════════════════════════════════════════════════════════

    // Crear ticket
    if (id.startsWith('ticket_') && !id.includes('claim') && !id.includes('close') && !id.includes('confirm') && !id.includes('cancel')) {
      return await handleTicketCreate(interaction);
    }

    // Reclamar ticket
    if (id.startsWith('ticket_claim_')) {
      return await handleTicketClaim(interaction);
    }

    // Cerrar ticket (mostrar modal para la razón)
    if (id.startsWith('ticket_close_') && !id.includes('confirm') && !id.includes('cancel')) {
      return await handleTicketClose(interaction);
    }


    // ═══════════════════════════════════════════════════════════════════════
    // SISTEMA DE FICHAJES
    // ═══════════════════════════════════════════════════════════════════════

    if (id.startsWith('sign_accept_') || id.startsWith('sign_reject_')) {
      return await handleSigningResponse(interaction, client);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RENUNCIA
    // ═══════════════════════════════════════════════════════════════════════

    if (id.startsWith('resign_cancel_')) {
      const userId = id.slice('resign_cancel_'.length);
      if (interaction.user.id !== userId) {
        return safeReply(interaction, { content: 'Esta confirmación pertenece a otro usuario.', flags: 64 });
      }
      return interaction.update({ content: 'Renuncia cancelada. No se realizaron cambios.', embeds: [], components: [] });
    }

    if (id.startsWith('resign_confirm_')) {
      return await handleResignConfirm(interaction, client);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORÍAS
    // ═══════════════════════════════════════════════════════════════════════

    if (id.startsWith('del_cat_confirm_')) {
      const catId  = id.replace('del_cat_confirm_', '');
      const cat    = db.obtenerCategoriaPorId(catId);
      const result = db.eliminarCategoria(catId);
      const embed  = result.ok
        ? new EmbedBuilder().setColor(0x00bfa6).setTitle('Categoría eliminada').setDescription(`**${cat?.nombre}** fue eliminada correctamente.`).setTimestamp()
        : new EmbedBuilder().setColor(0xef5350).setTitle('No se pudo eliminar').setDescription(result.error).setTimestamp();
      return interaction.update({ embeds: [embed], components: [] });
    }

    if (id.startsWith('del_cat_cancel_')) {
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x455a64).setTitle('Eliminación cancelada').setDescription('La categoría no fue modificada.')],
        components: [],
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ELIMINAR EQUIPO
    // ═══════════════════════════════════════════════════════════════════════

    if (id.startsWith('elim_confirm_')) {
      return await handleEliminarEquipo(interaction, client);
    }

    if (id.startsWith('elim_cancel_')) {
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x455a64).setTitle('Eliminación cancelada').setDescription('No se realizaron cambios.')],
        components: [],
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EDITAR EQUIPO
    // ═══════════════════════════════════════════════════════════════════════

    if (id.startsWith('edit_confirm|')) {
      const [, userId, equipoId] = id.split('|');
      if (interaction.user.id !== userId) {
        return safeReply(interaction, { content: 'Solo el administrador que inició esta acción puede confirmarla.', flags: 64 });
      }
      return client.commands.get('edit-equipo').applyConfirm(interaction, userId, equipoId);
    }

    if (id.startsWith('edit_cancel|')) {
      const [, userId, equipoId] = id.split('|');
      pendingEdits.delete(`${userId}|${equipoId}`);
      return client.commands.get('edit-equipo').applyCancel(interaction);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SOLICITUDES DE INSCRIPCIÓN
    // ═══════════════════════════════════════════════════════════════════════

    if (id.startsWith('appacc|')) {
      return await handleSolicitudAceptar(interaction, client);
    }

    if (id.startsWith('apprej|')) {
      return await handleSolicitudRechazar(interaction);
    }

  } catch (error) {
    // Interacción expirada/desconocida (bot reiniciado, token caducado, etc.)
    // Discord invalida tokens de interacción después de 3 segundos o si el bot se reinicia.
    if (error?.code === 10062) {
      console.warn('[BUTTON] Interacción expirada (10062), ignorando:', id);
      return;
    }
    console.error('[BUTTON] Error no capturado en handler de botón:', error);
    await safeReply(interaction, {
      content: '❌ Ocurrió un error inesperado al procesar esta acción.',
      flags: 64,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Handlers individuales
// ═══════════════════════════════════════════════════════════════════════════

async function handleTicketCreate(interaction) {
  const ticketType = interaction.customId.replace('ticket_', '');

  // Verificar si ya tiene un ticket abierto
  const existingTicket = interaction.guild.channels.cache.find(
    ch => ch.name.startsWith('ticket-') &&
    ch.permissionOverwrites.cache.has(interaction.user.id)
  );

  if (existingTicket) {
    return safeReply(interaction, {
      content: `❌ Ya tienes un ticket abierto: <#${existingTicket.id}>\n> Por favor, ciérralo antes de abrir otro.`,
      flags: 64,
    });
  }

  // Defer primero (ventana de 3 segundos de Discord)
  const deferred = await interaction.deferReply({ flags: 64 }).catch(err => {
    if (err?.code === 10062) {
      console.warn('[TICKET] Interacción de creación expirada (10062), ignorando.');
      return null;
    }
    throw err;
  });
  if (deferred === null) return;

  try {
    const { channel, ticketNumber } = await crearTicket(
      interaction.guild,
      interaction.member,
      ticketType
    );

    await interaction.editReply({
      content: `✅ Ticket creado exitosamente: <#${channel.id}>\n> Ticket #${ticketNumber}`,
    });
  } catch (error) {
    console.error('[TICKET] Error creando ticket:', error);
    await interaction.editReply({
      content: `❌ Error al crear el ticket: ${error.message}\n> Por favor, contacta con un administrador.`,
    });
  }
}

async function handleTicketClaim(interaction) {
  const ticketNumber = interaction.customId.replace('ticket_claim_', '');

  // Defer primero (ventana de 3 segundos de Discord)
  try {
    await interaction.deferUpdate();
  } catch (err) {
    if (err?.code === 10062) {
      console.warn('[TICKET] Interacción de claim expirada, ignorando.');
      return;
    }
    throw err;
  }

  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, {
      content: '❌ Solo los administradores pueden reclamar tickets.',
      flags: 64,
    });
  }

  try {
    await reclamarTicket(interaction, ticketNumber);

    // Extraer el creatorId del botón de cerrar original
    const originalCloseButton = interaction.message.components[0]?.components?.find(
      btn => btn.customId?.startsWith('ticket_close_')
    );
    const originalCreatorId = originalCloseButton?.customId?.split('_')[3];

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_claim_${ticketNumber}`)
        .setLabel('Ticket Reclamado')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`ticket_close_${ticketNumber}_${originalCreatorId}`)
        .setLabel('Cerrar Ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.message.edit({ components: [disabledRow] });
  } catch (error) {
    console.error('[TICKET] Error reclamando ticket:', error);
    await safeReply(interaction, {
      content: '❌ Error al reclamar el ticket.',
      flags: 64,
    });
  }
}

async function handleTicketClose(interaction) {
  const parts = interaction.customId.split('_');
  const ticketNumber = parts[2];
  const creatorId = parts[3];

  const isCreator = interaction.user.id === creatorId;

  if (!isAdmin(interaction.member) && !isCreator) {
    return safeReply(interaction, {
      content: '❌ Solo el creador del ticket o un administrador pueden cerrarlo.',
      flags: 64,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`ticket_close_modal_${ticketNumber}_${creatorId}`)
    .setTitle('Cerrar Ticket');

  const reasonInput = new TextInputBuilder()
    .setCustomId('close_reason')
    .setLabel('Razón del cierre')
    .setPlaceholder('Describe brevemente por qué se cierra este ticket...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

  try {
    await interaction.showModal(modal);
  } catch (error) {
    if (error?.code === 10062) {
      console.warn('[TICKET] Interacción de close expirada, ignorando.');
      return;
    }
    console.error('[TICKET] Error mostrando modal:', error);
    await safeReply(interaction, {
      content: '❌ Error al procesar la solicitud de cierre.',
      flags: 64,
    });
  }
}

async function handleSigningResponse(interaction, client) {
  const id = interaction.customId;
  const accepting = id.startsWith('sign_accept_');
  const requestId = id.slice(accepting ? 'sign_accept_'.length : 'sign_reject_'.length);

  const request = db.obtenerPropuesta(requestId);
  if (!request || request.status !== 'PENDING') {
    return safeReply(interaction, { content: 'Esta propuesta ya no está disponible o expiró.', flags: 64 });
  }
  if (interaction.user.id !== request.target_id) {
    return safeReply(interaction, { content: 'Solo el jugador invitado puede responder a esta propuesta.', flags: 64 });
  }

  // ── Rechazo ──
  if (!accepting) {
    db.actualizarPropuesta(requestId, { status: 'REJECTED', resolved_at: new Date().toISOString() });
    const team = db.obtenerEquipoPorId(request.team_id);
    const rejected = new EmbedBuilder().setColor(0x607d8b).setTitle('🚫 Propuesta rechazada')
      .setDescription(`Has rechazado la propuesta de **${team?.nombre || 'equipo'}**.`);
    await interaction.update({ embeds: [rejected], components: [] });

    logger.logMember(client, interaction.user, 'reject_fichaje', request.target_id, team?.nombre || 'Equipo desconocido', {})
      .catch(err => console.error('[LOGGER] Error en log de fichaje rechazado:', err));

    _notificarRechazoFichaje(client, request, team).catch(err =>
      console.error(`No se pudo notificar el rechazo del fichaje ${requestId}:`, err)
    );
    return;
  }

  // ── Aceptación ──
  await interaction.deferUpdate();
  const team = db.obtenerEquipoPorId(request.team_id);
  const currentRequester = db.obtenerMiembro(request.requested_by);

  // Validar que el DT/Sub-DT que envió la propuesta sigue siendo válido
  if (!team || !currentRequester || currentRequester.inconsistent ||
      currentRequester.team_id !== request.team_id ||
      !['DT', 'SUB_DT'].includes(currentRequester.role)) {
    db.actualizarPropuesta(requestId, { status: 'CANCELLED', resolved_at: new Date().toISOString() });
    return interaction.editReply({
      content: 'La propuesta ya no es válida porque cambió el cargo o el equipo de quien la envió.',
      embeds: [], components: [],
    });
  }

  // Validar que el jugador objetivo está libre
  // FIX: antes la condición era `targetRecord?.inconsistent || targetRecord` que SIEMPRE cancelaba
  const targetRecord = db.obtenerMiembro(request.target_id);
  if (targetRecord) {
    db.actualizarPropuesta(requestId, { status: 'CANCELLED', resolved_at: new Date().toISOString() });
    const currentTeam = targetRecord.team_id ? db.obtenerEquipoPorId(targetRecord.team_id) : null;
    const reason = (targetRecord.role === 'DT' || targetRecord.role === 'SUB_DT')
      ? 'No se puede completar el fichaje porque ahora ocupas un cargo técnico.'
      : `No se puede completar el fichaje porque ya perteneces a ${currentTeam?.nombre || 'otro equipo'}.`;
    return interaction.editReply({ content: reason, embeds: [], components: [] });
  }

  // Verificar Discord
  const guild = await client.guilds.fetch(request.guild_id).catch(() => null);
  const member = guild ? await guild.members.fetch(request.target_id).catch(() => null) : null;
  const teamRole = guild && team.role_id ? await guild.roles.fetch(team.role_id).catch(() => null) : null;

  if (!guild || !member || !teamRole) {
    db.actualizarPropuesta(requestId, { status: 'CANCELLED', resolved_at: new Date().toISOString() });
    return interaction.editReply({
      content: 'No se pudo verificar el servidor, el jugador o el rol del equipo. Contacta a un administrador.',
      embeds: [], components: [],
    });
  }

  // Ejecutar fichaje
  try {
    await member.roles.add(teamRole, `Fichaje aceptado; propuesta por ${request.requested_by}`);
    try {
      db.registrarMiembro(team.id, request.target_id, 'PLAYER', request.haxball_nick, request.requested_by);
    } catch (error) {
      await member.roles.remove(teamRole).catch(e => console.error('Error al revertir rol tras fallo de fichaje:', e));
      throw error;
    }
  } catch (error) {
    console.error(`Error completando propuesta de fichaje ${requestId}:`, error);
    db.actualizarPropuesta(requestId, { status: 'FAILED', resolved_at: new Date().toISOString() });
    return interaction.editReply({
      content: 'No se pudo completar el fichaje. Revisa los permisos del bot e inténtalo más tarde.',
      embeds: [], components: [],
    });
  }

  // Apodo: fuera del bloque crítico
  try {
    const prefix = (team.abreviacion || team.nombre).substring(0, 10).trim();
    const nick = `${prefix} | ${request.haxball_nick}`.substring(0, 32);
    await member.setNickname(nick, 'Fichaje confirmado');
  } catch (e) {
    console.warn(`No se pudo cambiar apodo de ${request.target_id}:`, e.message);
  }

  db.actualizarPropuesta(requestId, { status: 'ACCEPTED', resolved_at: new Date().toISOString() });

  logger.logMember(client, interaction.user, 'accept_fichaje', request.target_id, team.nombre, {
    role: 'PLAYER', haxball_nick: request.haxball_nick,
  }).catch(err => console.error('[LOGGER] Error en log de fichaje aceptado:', err));

  const teamColor = team.color_primario?.startsWith('#') ? hexAInt(team.color_primario) : 0x00bfa6;
  const accepted = new EmbedBuilder().setColor(teamColor).setTitle('🤝 Fichaje confirmado')
    .setDescription(`¡Felicidades! Ahora formas parte oficialmente de **${team.nombre}**.`)
    .addFields(
      { name: '🎮 Nick', value: request.haxball_nick, inline: true },
      { name: '🛡️ Rol', value: 'Asignado correctamente', inline: true }
    );
  if (team.escudo) accepted.setThumbnail(team.escudo);
  await interaction.editReply({ embeds: [accepted], components: [] });

  _notificarAceptacionFichaje(client, request, team, teamColor).catch(err =>
    console.error(`No se pudo notificar el fichaje aceptado ${requestId}:`, err)
  );
}

async function handleResignConfirm(interaction, client) {
  const payload = interaction.customId.slice('resign_confirm_'.length);
  const separator = payload.indexOf('_');
  const userId = payload.slice(0, separator);
  const teamId = payload.slice(separator + 1);

  if (interaction.user.id !== userId) {
    return safeReply(interaction, { content: 'Esta confirmación pertenece a otro usuario.', flags: 64 });
  }

  await interaction.deferUpdate();

  const record = db.obtenerMiembro(userId);
  if (!record || record.inconsistent || record.role !== 'PLAYER' || record.team_id !== teamId) {
    return interaction.editReply({
      content: 'Tu pertenencia al equipo cambió y no se pudo completar la renuncia. No se realizaron cambios.',
      embeds: [], components: [],
    });
  }

  const team = db.obtenerEquipoPorId(teamId);
  const role = team?.role_id ? await interaction.guild.roles.fetch(team.role_id).catch(() => null) : null;
  const member = await interaction.guild.members.fetch(userId).catch(() => null);

  if (!team || !role || !member || !member.roles.cache.has(role.id)) {
    return interaction.editReply({
      content: 'No se pudo verificar el rol de equipo. No se realizaron cambios; contacta a un administrador.',
      embeds: [], components: [],
    });
  }

  try {
    await member.roles.remove(role, 'Renuncia voluntaria');
    db.quitarMiembro(teamId, userId, 'RESIGNED', userId);
  } catch (error) {
    console.error('Error procesando renuncia:', error);
    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role).catch(e => console.error('Error reponiendo rol tras fallo de renuncia:', e));
    }
    return interaction.editReply({
      content: 'No se pudo completar la renuncia. No se realizaron cambios.',
      embeds: [], components: [],
    });
  }

  // Apodo
  try {
    await member.setNickname(null, 'Renuncia del equipo');
  } catch (e) {
    console.warn(`No se pudo resetear apodo de ${userId}:`, e.message);
  }

  const teamColor = team.color_primario?.startsWith('#') ? hexAInt(team.color_primario) : 0x00bfa6;

  try {
    const embedRenuncia = new EmbedBuilder()
      .setColor(teamColor)
      .setTitle('👋 Renuncia confirmada')
      .setDescription(`Has renunciado oficialmente a **${team.nombre}**.\n\nYa no formas parte de su plantilla y has quedado como jugador libre.`);
    if (team.escudo) embedRenuncia.setThumbnail(team.escudo);
    await interaction.user.send({ embeds: [embedRenuncia] });
  } catch (error) {
    console.error(`No se pudo enviar DM (renuncia) a ${userId}:`, error.message);
  }

  await require('../utils/rosterCommands').notifyDirector(
    interaction.guild,
    team,
    `<@${userId}> renunció oficialmente al equipo.\n\n**Equipo:** ${team.nombre}\nEl jugador ha sido dado de baja y quedó como agente libre.`,
    'aviso de renuncia al DT'
  );

  const renunciaEmbed = new EmbedBuilder()
    .setColor(teamColor)
    .setTitle('👋 Renuncia completada')
    .setDescription(
      `Tu renuncia ha sido procesada exitosamente.\n\n` +
      `🛡️ **Equipo:** \`${team.nombre}\`\n` +
      `📋 **Estado:** \`Agente Libre\`\n` +
      `🎮 **Apodo:** \`Restablecido al nombre de Discord\`\n\n` +
      `> *Ya no formas parte de la plantilla. Puedes recibir propuestas de otros equipos.*`
    )
    .setTimestamp();
  if (team.escudo) renunciaEmbed.setThumbnail(team.escudo);
  return interaction.editReply({ content: '', embeds: [renunciaEmbed], components: [] });
}

async function handleEliminarEquipo(interaction, client) {
  const equipoId = interaction.customId.replace('elim_confirm_', '');
  const equipo   = db.obtenerEquipoPorId(equipoId);
  if (!equipo) return interaction.update({ content: 'El equipo ya no existe.', embeds: [], components: [] });

  const guild        = interaction.guild;
  const nombreEquipo = equipo.nombre;
  const cat          = db.obtenerCategoriaPorId(equipo.categoria_id);
  const plantilla    = db.obtenerPlantilla(equipoId);
  const miembrosIds  = plantilla?.miembros?.map(m => m.discord_user_id) || [];

  // Resetear apodos
  for (const memberId of miembrosIds) {
    try {
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (member) {
        await member.setNickname(null, `Equipo ${nombreEquipo} eliminado`).catch(err => {
          console.log(`No se pudo resetear apodo de ${memberId}:`, err.message);
        });
      }
    } catch (e) {
      console.log(`Error reseteando apodo de ${memberId}:`, e.message);
    }
  }

  // Eliminar canal
  if (equipo.channel_id) {
    try {
      const c = await guild.channels.fetch(equipo.channel_id).catch(() => null);
      if (c) await c.delete();
    } catch (e) {
      console.error('Error eliminando canal:', e.message);
    }
  }

  // Eliminar rol
  if (equipo.role_id) {
    try {
      const r = await guild.roles.fetch(equipo.role_id).catch(() => null);
      if (r) await r.delete();
    } catch (e) {
      console.error('Error eliminando rol:', e.message);
    }
  }

  // Quitar roles técnicos
  if (equipo.director_tecnico_id && DT_ROLE_ID) {
    try {
      const member = await guild.members.fetch(equipo.director_tecnico_id).catch(() => null);
      if (member) await member.roles.remove(DT_ROLE_ID);
    } catch (e) {
      console.error('Error quitando rol DT:', e.message);
    }
  }

  if (equipo.sub_director_tecnico_id && SUBDT_ROLE_ID) {
    try {
      const member = await guild.members.fetch(equipo.sub_director_tecnico_id).catch(() => null);
      if (member) await member.roles.remove(SUBDT_ROLE_ID);
    } catch (e) {
      console.error('Error quitando rol Sub-DT:', e.message);
    }
  }

  await deleteTeamEmoji(guild, equipo.discord_emoji_id);
  db.eliminarEquipoPorId(equipoId);

  logger.logTeam(client, interaction.user, 'delete', nombreEquipo, {
    categoria: cat?.nombre || 'Sin categoría',
    changes: `Rol eliminado, canal eliminado, ${miembrosIds.length} apodo(s) reseteados`,
  }).catch(err => console.error('[LOGGER] Error en log de eliminate-equipo:', err));

  return interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00bfa6)
        .setTitle('Equipo eliminado')
        .setDescription(
          `**${nombreEquipo}** ha sido eliminado permanentemente de Diamonds League.\n\n` +
          `Categoría\n${cat ? cat.nombre : '—'}\n\n` +
          `El rol del equipo, canal privado y apodos de ${miembrosIds.length} miembro(s) fueron eliminados.`
        )
        .setTimestamp(),
    ],
    components: [],
  });
}

async function handleSolicitudAceptar(interaction, client) {
  const solicitudId = interaction.customId.replace('appacc|', '');

  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, {
      content: '🔒 **Acceso denegado**\n\nSolo los administradores autorizados pueden gestionar las solicitudes de equipos.',
      flags: 64,
    });
  }

  const solicitud = db.obtenerSolicitudPorId(solicitudId);
  if (!solicitud)                     return safeReply(interaction, { content: 'Solicitud no encontrada.', flags: 64 });
  if (solicitud.status !== 'PENDING') return safeReply(interaction, { content: 'Esta solicitud ya fue procesada.', flags: 64 });

  const categoria = db.obtenerCategoriaPorId(solicitud.category_id);
  if (!categoria || db.categoriaLlena(categoria)) {
    return safeReply(interaction, {
      content: `La categoría **${categoria?.nombre || solicitud.category_id}** ya no tiene cupos disponibles.`,
      flags: 64,
    });
  }

  // Verificar conflictos
  const conflictos = [];
  for (const pid of solicitud.players) {
    const eq = db.obtenerEquipoPorJugador(pid);
    if (eq) conflictos.push(`<@${pid}> ya pertenece a **${eq.nombre}**`);
  }
  if (solicitud.director_tecnico_id) {
    const eq = db.obtenerEquipoPorJugador(solicitud.director_tecnico_id);
    if (eq) conflictos.push(`DT <@${solicitud.director_tecnico_id}> ya pertenece a **${eq.nombre}**`);
  }
  if (solicitud.sub_director_tecnico_id) {
    const eq = db.obtenerEquipoPorJugador(solicitud.sub_director_tecnico_id);
    if (eq) conflictos.push(`Sub-DT <@${solicitud.sub_director_tecnico_id}> ya pertenece a **${eq.nombre}**`);
  }
  if (conflictos.length > 0) {
    return safeReply(interaction, {
      content: `No se puede aprobar. Los siguientes miembros ya tienen equipo:\n\n${conflictos.join('\n')}`,
      flags: 64,
    });
  }

  db.actualizarSolicitud(solicitudId, {
    status:      'APPROVED',
    reviewed_at: new Date().toISOString(),
    reviewed_by: interaction.user.id,
  });

  await interaction.deferUpdate();

  let result;
  try {
    result = await crearEquipoCompleto(
      interaction.guild,
      {
        nombre:                  solicitud.team_name,
        abreviacion:             solicitud.abbreviation,
        color_primario:          solicitud.primary_color,
        color_secundario:        solicitud.secondary_color,
        escudo_url:              solicitud.shield_url,
        categoria_id:            solicitud.category_id,
        jugadores:               solicitud.players,
        director_tecnico_id:     solicitud.director_tecnico_id     || null,
        sub_director_tecnico_id: solicitud.sub_director_tecnico_id || null,
      },
      client.user.id
    );
  } catch (err) {
    db.actualizarSolicitud(solicitudId, { status: 'PENDING', reviewed_at: null, reviewed_by: null });
    return interaction.followUp({ content: `Error al crear el equipo: ${err.message}`, flags: 64 });
  }

  const { equipo, rol, canal } = result;
  const playerNicks = solicitud.player_nicks || {};

  // Asignar roles y nicks a jugadores
  for (const playerId of solicitud.players) {
    try {
      const member = await interaction.guild.members.fetch(playerId).catch(() => null);
      if (member) {
        await member.roles.add(rol.id);
        const haxballNick = playerNicks[playerId];
        if (haxballNick) {
          const newNickname = `${solicitud.abbreviation} | ${haxballNick}`.substring(0, 32);
          await member.setNickname(newNickname).catch(err => {
            console.error(`Error estableciendo nickname para ${playerId}:`, err.message);
          });
        }
      }
    } catch (err) {
      console.error(`Error asignando rol a jugador ${playerId}:`, err.message);
    }
  }

  // DT
  if (solicitud.director_tecnico_id) {
    try {
      const member = await interaction.guild.members.fetch(solicitud.director_tecnico_id).catch(() => null);
      if (member) {
        await member.roles.add(rol.id).catch(e => console.error('Error rol DT:', e.message));
        if (DT_ROLE_ID) await member.roles.add(DT_ROLE_ID).catch(e => console.error('Error rol DT global:', e.message));
        const haxballNick = playerNicks[solicitud.director_tecnico_id];
        if (haxballNick) {
          await member.setNickname(`${solicitud.abbreviation} | ${haxballNick}`.substring(0, 32))
            .catch(err => console.error('Error nickname DT:', err.message));
        }
      }
    } catch (err) {
      console.error('Error asignando rol a DT:', err.message);
    }
  }

  // Sub-DT
  if (solicitud.sub_director_tecnico_id) {
    try {
      const member = await interaction.guild.members.fetch(solicitud.sub_director_tecnico_id).catch(() => null);
      if (member) {
        await member.roles.add(rol.id).catch(e => console.error('Error rol Sub-DT:', e.message));
        if (SUBDT_ROLE_ID) await member.roles.add(SUBDT_ROLE_ID).catch(e => console.error('Error rol Sub-DT global:', e.message));
        const haxballNick = playerNicks[solicitud.sub_director_tecnico_id];
        if (haxballNick) {
          await member.setNickname(`${solicitud.abbreviation} | ${haxballNick}`.substring(0, 32))
            .catch(err => console.error('Error nickname Sub-DT:', err.message));
        }
      }
    } catch (err) {
      console.error('Error asignando rol a Sub-DT:', err.message);
    }
  }

  try { await canal.send(`*Canal de ${solicitud.team_name}*\n\n<@&${rol.id}>`); } catch (_) {}

  const catInfo     = db.obtenerCategoriaPorId(solicitud.category_id);
  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`appacc|${solicitudId}`).setLabel('Aceptar solicitud').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId(`apprej|${solicitudId}`).setLabel('Rechazar solicitud').setStyle(ButtonStyle.Danger).setDisabled(true)
  );

  const emojiStr = getTeamEmoji(interaction.guild, equipo.id);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00bfa6)
        .setTitle('Solicitud de inscripción — Aprobada')
        .setThumbnail(solicitud.shield_url)
        .setDescription(`${emojiStr}**${solicitud.team_name}**`)
        .addFields(
          { name: 'Categoría',      value: catInfo?.nombre || '—',     inline: true },
          { name: 'Estado',         value: 'Aprobada',                  inline: true },
          { name: 'Revisada por',   value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Rol del equipo', value: `<@&${rol.id}>`,             inline: true },
        )
        .setTimestamp(),
    ],
    components: [disabledRow],
  });

  // DM al solicitante
  try {
    const applicant = await client.users.fetch(solicitud.applicant_id);
    await applicant.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00bfa6)
          .setTitle('Diamonds League — Solicitud aprobada')
          .setDescription(
            `Tu solicitud de inscripción ha sido aprobada.\n\n` +
            `Equipo\n${emojiStr}${solicitud.team_name}\n\n` +
            `Categoría\n${catInfo?.nombre} — ${catInfo?.descripcion}\n\n` +
            `Rol del equipo\n<@&${rol.id}>\n\n` +
            `Canal privado\n<#${canal.id}>\n\n` +
            `Los jugadores y el cuerpo técnico ya recibieron sus roles correspondientes.`
          )
          .setTimestamp(),
      ],
    });
  } catch (err) {
    console.error('Error enviando DM al solicitante:', err.message);
  }
}

async function handleSolicitudRechazar(interaction) {
  const solicitudId = interaction.customId.replace('apprej|', '');

  if (!isAdmin(interaction.member)) {
    return safeReply(interaction, {
      content: '🔒 **Acceso denegado**\n\nSolo los administradores autorizados pueden gestionar las solicitudes de equipos.',
      flags: 64,
    });
  }

  const solicitud = db.obtenerSolicitudPorId(solicitudId);
  if (!solicitud)                     return safeReply(interaction, { content: 'Solicitud no encontrada.', flags: 64 });
  if (solicitud.status !== 'PENDING') return safeReply(interaction, { content: 'Esta solicitud ya fue procesada.', flags: 64 });

  const modal = new ModalBuilder()
    .setCustomId(`apprejm|${solicitudId}`)
    .setTitle('Rechazar solicitud');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('reject_reason')
        .setLabel('Motivo del rechazo')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500)
    )
  );

  return interaction.showModal(modal);
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers privados de notificación
// ═══════════════════════════════════════════════════════════════════════════

async function _notificarRechazoFichaje(client, request, team) {
  const requester = await client.users.fetch(request.requested_by);
  const embedToRequester = new EmbedBuilder().setColor(0x607d8b).setTitle('🚫 Fichaje rechazado')
    .setDescription(`<@${request.target_id}> rechazó la propuesta de fichaje para **${team?.nombre || 'tu equipo'}**.`);
  if (team?.escudo) embedToRequester.setThumbnail(team.escudo);
  await requester.send({ embeds: [embedToRequester] });

  if (request.public_channel_id && request.public_message_id) {
    const pubChannel = await client.channels.fetch(request.public_channel_id).catch(() => null);
    if (pubChannel) {
      const pubMsg = await pubChannel.messages.fetch(request.public_message_id).catch(() => null);
      if (pubMsg) {
        const rejectEmbed = new EmbedBuilder().setColor(0xef5350).setTitle('🚫 Fichaje rechazado')
          .setDescription(`<@${request.target_id}> rechazó la propuesta de fichaje para **${team?.nombre || 'el equipo'}**.`);
        if (team?.escudo) rejectEmbed.setThumbnail(team.escudo);
        await pubMsg.edit({ embeds: [rejectEmbed] });
      }
    }
  }
}

async function _notificarAceptacionFichaje(client, request, team, teamColor) {
  const requester = await client.users.fetch(request.requested_by);
  const embedRequester = new EmbedBuilder().setColor(teamColor).setTitle('🤝 Fichaje aceptado')
    .setDescription(`¡Excelentes noticias! <@${request.target_id}> ha aceptado la propuesta y ya forma parte de **${team.nombre}**.`)
    .addFields({ name: '🎮 Nick', value: request.haxball_nick, inline: true });
  if (team.escudo) embedRequester.setThumbnail(team.escudo);
  await requester.send({ embeds: [embedRequester] });

  if (request.public_channel_id && request.public_message_id) {
    const pubChannel = await client.channels.fetch(request.public_channel_id).catch(() => null);
    if (pubChannel) {
      const pubMsg = await pubChannel.messages.fetch(request.public_message_id).catch(() => null);
      if (pubMsg) {
        const accEmbed = new EmbedBuilder().setColor(teamColor).setTitle('🤝 Fichaje confirmado')
          .setDescription(`<@${request.target_id}> ha aceptado la propuesta y ya forma parte de **${team.nombre}**.`)
          .addFields({ name: '🎮 Nick', value: request.haxball_nick, inline: true });
        if (team.escudo) accEmbed.setThumbnail(team.escudo);
        await pubMsg.edit({ embeds: [accEmbed] });
      }
    }
  }
}

module.exports = { handleButton };
