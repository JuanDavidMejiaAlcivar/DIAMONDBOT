const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const WARNINGS_PATH = path.join(__dirname, '..', 'data', 'warnings.json');

// Configuración: qué hacer al llegar a 3 advertencias
// Valores posibles: 'manual', 'mute', 'kick', 'ban'
const THREE_WARN_ACTION = 'manual';

function leerWarnings() {
  if (!fs.existsSync(WARNINGS_PATH)) {
    const inicial = { warnings: [] };
    fs.writeFileSync(WARNINGS_PATH, JSON.stringify(inicial, null, 2), 'utf-8');
    return inicial;
  }
  return JSON.parse(fs.readFileSync(WARNINGS_PATH, 'utf-8'));
}

function guardarWarnings(datos) {
  fs.writeFileSync(WARNINGS_PATH, JSON.stringify(datos, null, 2), 'utf-8');
}

/**
 * Añade una advertencia a un usuario
 * @param {string} userId - ID del usuario
 * @param {string} guildId - ID del servidor
 * @param {string} moderatorId - ID del moderador
 * @param {string} reason - Razón de la advertencia
 * @returns {Object} Información de la advertencia creada
 */
function addWarning(userId, guildId, moderatorId, reason) {
  const datos = leerWarnings();
  const id = `warn_${randomUUID().slice(0, 8)}`;
  
  const warning = {
    id,
    user_id: userId,
    guild_id: guildId,
    moderator_id: moderatorId,
    reason,
    timestamp: new Date().toISOString(),
    active: true
  };
  
  datos.warnings.push(warning);
  guardarWarnings(datos);
  
  // Contar advertencias activas del usuario
  const userWarnings = getUserWarnings(userId, guildId);
  
  return {
    warning,
    count: userWarnings.length,
    reachedLimit: userWarnings.length >= 3
  };
}

/**
 * Obtiene todas las advertencias activas de un usuario
 * @param {string} userId - ID del usuario
 * @param {string} guildId - ID del servidor
 * @returns {Array} Lista de advertencias
 */
function getUserWarnings(userId, guildId) {
  const datos = leerWarnings();
  return datos.warnings.filter(
    w => w.user_id === userId && w.guild_id === guildId && w.active
  );
}

/**
 * Obtiene todas las advertencias (activas e inactivas) de un usuario
 * @param {string} userId - ID del usuario
 * @param {string} guildId - ID del servidor
 * @returns {Array} Lista de todas las advertencias
 */
function getAllUserWarnings(userId, guildId) {
  const datos = leerWarnings();
  return datos.warnings.filter(
    w => w.user_id === userId && w.guild_id === guildId
  );
}

/**
 * Desactiva una advertencia específica
 * @param {string} warningId - ID de la advertencia
 * @returns {boolean} true si se desactivó correctamente
 */
function removeWarning(warningId) {
  const datos = leerWarnings();
  const warning = datos.warnings.find(w => w.id === warningId);
  
  if (!warning) return false;
  
  warning.active = false;
  warning.removed_at = new Date().toISOString();
  guardarWarnings(datos);
  
  return true;
}

/**
 * Limpia todas las advertencias de un usuario
 * @param {string} userId - ID del usuario
 * @param {string} guildId - ID del servidor
 * @returns {number} Cantidad de advertencias desactivadas
 */
function clearUserWarnings(userId, guildId) {
  const datos = leerWarnings();
  let count = 0;
  
  datos.warnings.forEach(w => {
    if (w.user_id === userId && w.guild_id === guildId && w.active) {
      w.active = false;
      w.removed_at = new Date().toISOString();
      count++;
    }
  });
  
  guardarWarnings(datos);
  return count;
}

module.exports = {
  THREE_WARN_ACTION,
  addWarning,
  getUserWarnings,
  getAllUserWarnings,
  removeWarning,
  clearUserWarnings
};
