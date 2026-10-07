const { EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = '1551777782076543098';

// Cache del canal de logs para evitar fetchs repetidos
let logChannelCache = null;
let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Colores para diferentes tipos de logs
const COLORS = {
  COMMAND: 0x3498DB,        // Azul - Comandos generales
  MODERATION: 0xE74C3C,     // Rojo - Moderación
  TEAM: 0x2ECC71,           // Verde - Equipos
  MEMBER: 0xF39C12,         // Naranja - Miembros
  ROLE: 0x9B59B6,           // Morado - Roles
  ANTIRAID: 0xE67E22,       // Naranja oscuro - Antiraid
  WARN: 0xF1C40F,           // Amarillo - Advertencias
  SYSTEM: 0x95A5A6,         // Gris - Sistema
  ERROR: 0xC0392B,          // Rojo oscuro - Errores
  TICKET: 0x5865F2          // Azul Discord - Tickets
};

// Emojis para diferentes acciones
const EMOJIS = {
  ADD: '➕',
  REMOVE: '➖',
  EDIT: '✏️',
  DELETE: '🗑️',
  KICK: '👢',
  BAN: '🔨',
  UNBAN: '🔓',
  MUTE: '🔇',
  UNMUTE: '🔊',
  WARN: '⚠️',
  LOCK: '🔒',
  UNLOCK: '🔓',
  CLEAR: '🧹',
  FICHAJE: '📝',
  BAJA: '📤',
  RENUNCIA: '🚪',
  ROLE: '🎭',
  NICK: '✨',
  ANTIRAID: '🛡️',
  TICKET: '🎫',
  CATEGORIA: '📁',
  EQUIPO: '⚽',
  SOLICITUD: '📋',
  RESET: '🔄',
  SUCCESS: '✅',
  ERROR: '❌',
  INFO: 'ℹ️'
};

/**
 * Obtiene el canal de logs con caché
 */
async function getLogChannel(client) {
  const now = Date.now();
  
  // Si el cache es válido, devolverlo
  if (logChannelCache && (now - lastCacheTime) < CACHE_DURATION) {
    return logChannelCache;
  }
  
  // Fetch el canal y actualizar cache
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (channel && channel.isTextBased()) {
      logChannelCache = channel;
      lastCacheTime = now;
      return channel;
    }
  } catch (error) {
    console.error('[LOGGER] Error fetching canal de logs:', error.message);
  }
  
  return null;
}

/**
 * Envía un log al canal de logs (optimizado)
 * @param {Client} client - Cliente de Discord
 * @param {Object} logData - Datos del log
 */
async function enviarLog(client, logData) {
  try {
    const channel = await getLogChannel(client);
    
    if (!channel) {
      console.error('[LOGGER] Canal de logs no disponible');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(logData.color || COLORS.COMMAND)
      .setTitle(logData.title || 'Log de Acción')
      .setTimestamp();

    // Descripción principal
    if (logData.description) {
      embed.setDescription(logData.description);
    }

    // Campos adicionales
    if (logData.fields && Array.isArray(logData.fields)) {
      embed.addFields(logData.fields);
    }

    // Usuario que ejecutó la acción
    if (logData.executor) {
      embed.setFooter({ 
        text: `Ejecutado por ${logData.executor.tag || logData.executor.username}`,
        iconURL: logData.executor.displayAvatarURL?.() || logData.executor.avatarURL?.()
      });
    }

    // Thumbnail si hay
    if (logData.thumbnail) {
      embed.setThumbnail(logData.thumbnail);
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[LOGGER] Error al enviar log:', error);
  }
}

/**
 * Log de comando ejecutado
 */
async function logCommand(client, interaction, commandName, details = {}) {
  const fields = [
    { name: '📌 Comando', value: `\`/${commandName}\``, inline: true },
    { name: '👤 Usuario', value: `<@${interaction.user.id}>`, inline: true },
    { name: '📍 Canal', value: interaction.channel ? `<#${interaction.channel.id}>` : 'DM', inline: true }
  ];

  // Agregar opciones del comando si existen
  if (interaction.options && interaction.options._hoistedOptions?.length > 0) {
    const opciones = interaction.options._hoistedOptions
      .map(opt => `**${opt.name}:** ${opt.value}`)
      .join('\n');
    fields.push({ name: '⚙️ Opciones', value: opciones.length > 1024 ? opciones.substring(0, 1021) + '...' : opciones, inline: false });
  }

  // Agregar detalles adicionales
  if (details.result) {
    fields.push({ name: '📊 Resultado', value: details.result, inline: false });
  }
  if (details.error) {
    fields.push({ name: '❌ Error', value: details.error, inline: false });
  }

  await enviarLog(client, {
    color: details.error ? COLORS.ERROR : COLORS.COMMAND,
    title: `${EMOJIS.INFO} Comando Ejecutado`,
    fields,
    executor: interaction.user
  });
}

/**
 * Log de moderación (kick, ban, mute, warn)
 */
async function logModeration(client, executor, action, target, details = {}) {
  const actionData = {
    kick: { emoji: EMOJIS.KICK, text: 'Expulsión', color: COLORS.MODERATION },
    ban: { emoji: EMOJIS.BAN, text: 'Ban', color: COLORS.MODERATION },
    unban: { emoji: EMOJIS.UNBAN, text: 'Desban', color: COLORS.MODERATION },
    mute: { emoji: EMOJIS.MUTE, text: 'Silencio', color: COLORS.MODERATION },
    unmute: { emoji: EMOJIS.UNMUTE, text: 'Desmute', color: COLORS.MODERATION },
    warn: { emoji: EMOJIS.WARN, text: 'Advertencia', color: COLORS.WARN },
    lock: { emoji: EMOJIS.LOCK, text: 'Canal Bloqueado', color: COLORS.MODERATION },
    unlock: { emoji: EMOJIS.UNLOCK, text: 'Canal Desbloqueado', color: COLORS.MODERATION },
    clear: { emoji: EMOJIS.CLEAR, text: 'Mensajes Eliminados', color: COLORS.MODERATION }
  };

  const data = actionData[action] || { emoji: '⚙️', text: 'Acción', color: COLORS.MODERATION };

  const fields = [
    { name: '👤 Moderador', value: `<@${executor.id}>`, inline: true }
  ];

  if (target) {
    fields.push({ name: '🎯 Objetivo', value: typeof target === 'string' ? target : `<@${target.id}>`, inline: true });
  }

  if (details.reason) {
    fields.push({ name: '📝 Razón', value: details.reason, inline: false });
  }
  if (details.duration) {
    fields.push({ name: '⏱️ Duración', value: details.duration, inline: true });
  }
  if (details.channel) {
    fields.push({ name: '📍 Canal', value: `<#${details.channel}>`, inline: true });
  }
  if (details.cantidad) {
    fields.push({ name: '🔢 Cantidad', value: String(details.cantidad), inline: true });
  }
  if (details.warnings) {
    fields.push({ name: '⚠️ Advertencias Totales', value: String(details.warnings), inline: true });
  }

  await enviarLog(client, {
    color: data.color,
    title: `${data.emoji} ${data.text}`,
    fields,
    executor
  });
}

/**
 * Log de equipos (crear, editar, eliminar)
 */
async function logTeam(client, executor, action, teamName, details = {}) {
  const actionData = {
    create: { emoji: EMOJIS.ADD, text: 'Equipo Creado', color: COLORS.TEAM },
    edit: { emoji: EMOJIS.EDIT, text: 'Equipo Editado', color: COLORS.TEAM },
    delete: { emoji: EMOJIS.DELETE, text: 'Equipo Eliminado', color: COLORS.TEAM },
    inscribe: { emoji: EMOJIS.SOLICITUD, text: 'Solicitud de Inscripción', color: COLORS.TEAM },
    accept: { emoji: EMOJIS.SUCCESS, text: 'Solicitud Aceptada', color: COLORS.TEAM },
    reject: { emoji: EMOJIS.ERROR, text: 'Solicitud Rechazada', color: COLORS.TEAM }
  };

  const data = actionData[action] || { emoji: '⚽', text: 'Acción de Equipo', color: COLORS.TEAM };

  const fields = [
    { name: '⚽ Equipo', value: teamName, inline: true }
  ];

  if (details.categoria) {
    fields.push({ name: '📁 Categoría', value: details.categoria, inline: true });
  }
  if (details.dt) {
    fields.push({ name: '👔 Director Técnico', value: `<@${details.dt}>`, inline: true });
  }
  if (details.subdt) {
    fields.push({ name: '👔 Sub-DT', value: `<@${details.subdt}>`, inline: true });
  }
  if (details.abreviacion) {
    fields.push({ name: '🔤 Abreviación', value: details.abreviacion, inline: true });
  }
  if (details.color) {
    fields.push({ name: '🎨 Color', value: details.color, inline: true });
  }
  if (details.changes) {
    fields.push({ name: '✏️ Cambios', value: details.changes, inline: false });
  }
  if (details.reason) {
    fields.push({ name: '📝 Razón', value: details.reason, inline: false });
  }
  if (details.solicitante) {
    fields.push({ name: '👤 Solicitante', value: `<@${details.solicitante}>`, inline: true });
  }

  await enviarLog(client, {
    color: data.color,
    title: `${data.emoji} ${data.text}`,
    fields,
    executor,
    thumbnail: details.escudo || null
  });
}

/**
 * Log de miembros (fichajes, bajas, renuncias)
 */
async function logMember(client, executor, action, userId, teamName, details = {}) {
  const actionData = {
    fichaje: { emoji: EMOJIS.FICHAJE, text: 'Fichaje', color: COLORS.MEMBER },
    baja: { emoji: EMOJIS.BAJA, text: 'Baja', color: COLORS.MEMBER },
    renuncia: { emoji: EMOJIS.RENUNCIA, text: 'Renuncia', color: COLORS.MEMBER },
    accept_fichaje: { emoji: EMOJIS.SUCCESS, text: 'Fichaje Aceptado', color: COLORS.MEMBER },
    reject_fichaje: { emoji: EMOJIS.ERROR, text: 'Fichaje Rechazado', color: COLORS.MEMBER }
  };

  const data = actionData[action] || { emoji: '📝', text: 'Acción de Miembro', color: COLORS.MEMBER };

  const fields = [
    { name: '👤 Jugador', value: `<@${userId}>`, inline: true },
    { name: '⚽ Equipo', value: teamName, inline: true }
  ];

  if (details.role) {
    fields.push({ name: '🎭 Rol', value: details.role, inline: true });
  }
  if (details.haxball_nick) {
    fields.push({ name: '🎮 Nick HaxBall', value: details.haxball_nick, inline: true });
  }
  if (details.reason) {
    fields.push({ name: '📝 Razón', value: details.reason, inline: false });
  }
  if (details.fromTeam) {
    fields.push({ name: '📤 Equipo Anterior', value: details.fromTeam, inline: true });
  }

  await enviarLog(client, {
    color: data.color,
    title: `${data.emoji} ${data.text}`,
    fields,
    executor
  });
}

/**
 * Log de roles (asignar DT, Sub-DT, etc.)
 */
async function logRole(client, executor, action, userId, details = {}) {
  const fields = [
    { name: '👤 Usuario', value: `<@${userId}>`, inline: true }
  ];

  if (details.role) {
    fields.push({ name: '🎭 Rol', value: details.role, inline: true });
  }
  if (details.team) {
    fields.push({ name: '⚽ Equipo', value: details.team, inline: true });
  }
  if (details.action) {
    fields.push({ name: '⚙️ Acción', value: details.action, inline: true });
  }

  await enviarLog(client, {
    color: COLORS.ROLE,
    title: `${EMOJIS.ROLE} ${action === 'add' ? 'Rol Asignado' : 'Rol Removido'}`,
    fields,
    executor
  });
}

/**
 * Log de apodos
 */
async function logNickname(client, executor, userId, oldNick, newNick, team) {
  await enviarLog(client, {
    color: COLORS.MEMBER,
    title: `${EMOJIS.NICK} Apodo Cambiado`,
    fields: [
      { name: '👤 Usuario', value: `<@${userId}>`, inline: true },
      { name: '⚽ Equipo', value: team, inline: true },
      { name: '📛 Apodo Anterior', value: oldNick || 'Sin apodo', inline: true },
      { name: '✨ Nuevo Apodo', value: newNick || 'Sin apodo', inline: true }
    ],
    executor
  });
}

/**
 * Log de antiraid
 */
async function logAntiraid(client, executor, action, details = {}) {
  const actionData = {
    activate: { emoji: EMOJIS.ANTIRAID, text: 'Antiraid Activado', color: COLORS.ANTIRAID },
    deactivate: { emoji: EMOJIS.ANTIRAID, text: 'Antiraid Desactivado', color: COLORS.ANTIRAID },
    kick_spam: { emoji: EMOJIS.KICK, text: 'Usuario Expulsado por Spam', color: COLORS.ANTIRAID }
  };

  const data = actionData[action] || { emoji: '🛡️', text: 'Acción Antiraid', color: COLORS.ANTIRAID };

  const fields = [];

  if (details.target) {
    fields.push({ name: '🎯 Usuario', value: `<@${details.target}>`, inline: true });
  }
  if (details.reason) {
    fields.push({ name: '📝 Razón', value: details.reason, inline: false });
  }
  if (details.message) {
    fields.push({ name: '💬 Mensaje', value: details.message, inline: false });
  }

  await enviarLog(client, {
    color: data.color,
    title: `${data.emoji} ${data.text}`,
    fields,
    executor
  });
}

/**
 * Log de categorías
 */
async function logCategory(client, executor, action, categoryName, details = {}) {
  const actionData = {
    create: { emoji: EMOJIS.ADD, text: 'Categoría Creada', color: COLORS.SYSTEM },
    edit: { emoji: EMOJIS.EDIT, text: 'Categoría Editada', color: COLORS.SYSTEM },
    delete: { emoji: EMOJIS.DELETE, text: 'Categoría Eliminada', color: COLORS.SYSTEM }
  };

  const data = actionData[action] || { emoji: '📁', text: 'Acción de Categoría', color: COLORS.SYSTEM };

  const fields = [
    { name: '📁 Categoría', value: categoryName, inline: true }
  ];

  if (details.descripcion) {
    fields.push({ name: '📝 Descripción', value: details.descripcion, inline: true });
  }
  if (details.max_equipos) {
    fields.push({ name: '🔢 Máx. Equipos', value: String(details.max_equipos), inline: true });
  }
  if (details.changes) {
    fields.push({ name: '✏️ Cambios', value: details.changes, inline: false });
  }

  await enviarLog(client, {
    color: data.color,
    title: `${data.emoji} ${data.text}`,
    fields,
    executor
  });
}

/**
 * Log de sistema (reset, tickets, etc.)
 */
async function logSystem(client, executor, action, details = {}) {
  const actionData = {
    reset: { emoji: EMOJIS.RESET, text: 'Sistema Reseteado', color: COLORS.ERROR },
    ticket_deploy: { emoji: EMOJIS.TICKET, text: 'Panel de Tickets Desplegado', color: COLORS.TICKET },
    ticket_create: { emoji: EMOJIS.ADD, text: 'Ticket Creado', color: COLORS.TICKET },
    ticket_close: { emoji: EMOJIS.DELETE, text: 'Ticket Cerrado', color: COLORS.TICKET },
    ticket_claim: { emoji: EMOJIS.SUCCESS, text: 'Ticket Reclamado', color: COLORS.TICKET }
  };

  const data = actionData[action] || { emoji: '⚙️', text: 'Acción de Sistema', color: COLORS.SYSTEM };

  const fields = [];

  if (details.description) {
    fields.push({ name: 'ℹ️ Descripción', value: details.description, inline: false });
  }
  if (details.channel) {
    fields.push({ name: '📍 Canal', value: `<#${details.channel}>`, inline: true });
  }
  if (details.stats) {
    fields.push({ name: '📊 Detalles', value: details.stats, inline: false });
  }
  if (details.user) {
    fields.push({ name: '👤 Usuario', value: `<@${details.user}>`, inline: true });
  }

  await enviarLog(client, {
    color: data.color,
    title: `${data.emoji} ${data.text}`,
    fields,
    executor
  });
}

module.exports = {
  enviarLog,
  logCommand,
  logModeration,
  logTeam,
  logMember,
  logRole,
  logNickname,
  logAntiraid,
  logCategory,
  logSystem,
  COLORS,
  EMOJIS
};
