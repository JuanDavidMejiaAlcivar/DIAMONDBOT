/**
 * autorolesManager.js
 *
 * Gestiona la persistencia del sistema de autoroles.
 * Cada entrada en autoroles.json representa un mensaje de autoroles activo:
 *
 *   {
 *     "<message_id>": {
 *       "channel_id": "...",
 *       "guild_id":   "...",
 *       "roles": [
 *         { "emoji": "🎮", "role_id": "123", "descripcion": "Para jugadores" },
 *         ...
 *       ]
 *     }
 *   }
 */

const fs   = require('node:fs');
const path = require('node:path');

const AUTOROLES_PATH = path.join(__dirname, '..', 'data', 'autoroles.json');

// ── I/O ────────────────────────────────────────────────────────────────────

function leerAutoroles() {
  try {
    if (!fs.existsSync(AUTOROLES_PATH)) {
      fs.writeFileSync(AUTOROLES_PATH, JSON.stringify({}, null, 2), 'utf-8');
      return {};
    }
    return JSON.parse(fs.readFileSync(AUTOROLES_PATH, 'utf-8'));
  } catch (err) {
    console.error('[AUTOROLES] Error leyendo autoroles.json:', err.message);
    return {};
  }
}

function guardarTodos(datos) {
  try {
    fs.writeFileSync(AUTOROLES_PATH, JSON.stringify(datos, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AUTOROLES] Error guardando autoroles.json:', err.message);
  }
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * Guarda o actualiza la configuración de un mensaje de autoroles.
 * @param {string} messageId
 * @param {{ channel_id: string, guild_id: string, roles: Array }} config
 */
function guardarAutoroles(messageId, config) {
  const datos = leerAutoroles();
  datos[messageId] = config;
  guardarTodos(datos);
}

/**
 * Obtiene la configuración de autoroles de un mensaje, o null si no existe.
 * @param {string} messageId
 */
function obtenerAutorolesPorMensaje(messageId) {
  return leerAutoroles()[messageId] || null;
}

/**
 * Elimina la configuración de autoroles de un mensaje.
 * @param {string} messageId
 */
function eliminarAutoroles(messageId) {
  const datos = leerAutoroles();
  delete datos[messageId];
  guardarTodos(datos);
}

/**
 * Devuelve todos los mensajes de autoroles registrados.
 */
function obtenerTodosAutoroles() {
  return leerAutoroles();
}

// ── Utilidades de emoji ─────────────────────────────────────────────────────

/**
 * Parsea un string de emoji ingresado por el usuario.
 * Soporta emojis Unicode (🎮) y emojis personalizados de Discord (<:name:id> o <a:name:id>).
 *
 * @param {string} emojiStr - El string tal como lo ingresó el usuario
 * @returns {{ id: string|null, name: string, reactWith: string }}
 *   - `id`:       ID del emoji personalizado, o null si es Unicode
 *   - `name`:     nombre del emoji
 *   - `reactWith`: string a pasar a message.react()
 */
function parseEmoji(emojiStr) {
  const customMatch = emojiStr.trim().match(/^<a?:(\w+):(\d+)>$/);
  if (customMatch) {
    return {
      id:        customMatch[2],
      name:      customMatch[1],
      reactWith: `${customMatch[1]}:${customMatch[2]}`,
    };
  }
  // Emoji Unicode
  return { id: null, name: emojiStr.trim(), reactWith: emojiStr.trim() };
}

/**
 * Comprueba si la reacción de Discord corresponde al emoji almacenado.
 *
 * @param {string} storedEmoji  - El emoji tal como fue guardado (ej: "🎮" o "<:jugador:123>")
 * @param {import('discord.js').GuildEmoji | import('discord.js').ReactionEmoji} reactionEmoji
 */
function emojiCoincide(storedEmoji, reactionEmoji) {
  const parsed = parseEmoji(storedEmoji);
  if (parsed.id) {
    // Emoji personalizado → comparar por ID
    return reactionEmoji.id === parsed.id;
  }
  // Emoji Unicode → comparar por nombre
  return reactionEmoji.name === parsed.name;
}

/**
 * Busca la entrada de rol correspondiente a una reacción.
 *
 * @param {{ roles: Array }} config
 * @param {import('discord.js').MessageReaction} reaction
 * @returns {{ emoji, role_id, descripcion } | undefined}
 */
function encontrarEntradaPorEmoji(config, reaction) {
  return config.roles.find(entry => emojiCoincide(entry.emoji, reaction.emoji));
}

module.exports = {
  guardarAutoroles,
  obtenerAutorolesPorMensaje,
  eliminarAutoroles,
  obtenerTodosAutoroles,
  parseEmoji,
  emojiCoincide,
  encontrarEntradaPorEmoji,
};
