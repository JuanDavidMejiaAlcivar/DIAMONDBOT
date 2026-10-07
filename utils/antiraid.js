const fs = require('node:fs');
const path = require('node:path');

const ANTIRAID_STATE_PATH = path.join(__dirname, '..', 'data', 'antiraid-state.json');

/**
 * Lee el estado actual del antiraid
 */
function leerEstadoAntiraid() {
  if (!fs.existsSync(ANTIRAID_STATE_PATH)) {
    const inicial = {
      active: false,
      activated_at: null,
      activated_by: null,
      guild_id: null,
      original_verification_level: null,
      affected_channels: []
    };
    fs.writeFileSync(ANTIRAID_STATE_PATH, JSON.stringify(inicial, null, 2), 'utf-8');
    return inicial;
  }
  return JSON.parse(fs.readFileSync(ANTIRAID_STATE_PATH, 'utf-8'));
}

/**
 * Guarda el estado del antiraid
 */
function guardarEstadoAntiraid(estado) {
  fs.writeFileSync(ANTIRAID_STATE_PATH, JSON.stringify(estado, null, 2), 'utf-8');
}

/**
 * Activa el modo antiraid
 */
function activarAntiraid(guildId, userId, originalVerificationLevel) {
  const estado = {
    active: true,
    activated_at: new Date().toISOString(),
    activated_by: userId,
    guild_id: guildId,
    original_verification_level: originalVerificationLevel,
    affected_channels: []
  };
  guardarEstadoAntiraid(estado);
  return estado;
}

/**
 * Desactiva el modo antiraid
 */
function desactivarAntiraid() {
  const estado = leerEstadoAntiraid();
  estado.active = false;
  estado.deactivated_at = new Date().toISOString();
  guardarEstadoAntiraid(estado);
  return estado;
}

/**
 * Verifica si el antiraid está activo
 */
function estaActivo() {
  const estado = leerEstadoAntiraid();
  return estado.active === true;
}

/**
 * Registra un canal afectado por el antiraid
 */
function registrarCanalAfectado(channelId) {
  const estado = leerEstadoAntiraid();
  if (!estado.affected_channels.includes(channelId)) {
    estado.affected_channels.push(channelId);
    guardarEstadoAntiraid(estado);
  }
}

/**
 * Detecta si un mensaje es spam
 */
function esSpam(content) {
  // Detectar URLs/links repetidos
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = content.match(urlRegex);
  if (urls && urls.length > 3) return true;

  // Detectar mensajes muy largos con repetición
  if (content.length > 500) {
    const palabras = content.toLowerCase().split(/\s+/);
    const uniques = new Set(palabras);
    if (palabras.length > 50 && uniques.size < palabras.length * 0.3) return true;
  }

  // Detectar menciones masivas
  const mentionRegex = /<@!?\d+>/g;
  const mentions = content.match(mentionRegex);
  if (mentions && mentions.length > 5) return true;

  // Detectar emojis excesivos
  const emojiRegex = /<a?:\w+:\d+>/g;
  const emojis = content.match(emojiRegex);
  if (emojis && emojis.length > 10) return true;

  // Detectar MAYÚSCULAS excesivas
  const upperCase = content.replace(/[^A-Z]/g, '');
  const lowerCase = content.replace(/[^a-z]/g, '');
  if (upperCase.length > 30 && upperCase.length > lowerCase.length * 2) return true;

  return false;
}

/**
 * Detecta si un mensaje contiene links sospechosos
 */
function tieneLinksSospechosos(content) {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = content.match(urlRegex);
  
  if (!urls) return false;

  // Lista de dominios comunes de spam/phishing
  const suspiciousDomains = [
    'discord.gift',
    'discordnitro',
    'discord-nitro',
    'steamcommunity-com',
    'steam-community',
    'free-nitro',
    'dlscord',
    'discrod',
    'discоrd', // 'о' cirílico
    'discorḍ',
    'bit.ly',
    'tinyurl.com',
    'goo.gl'
  ];

  for (const url of urls) {
    const lowerUrl = url.toLowerCase();
    for (const domain of suspiciousDomains) {
      if (lowerUrl.includes(domain)) {
        return true;
      }
    }
  }

  return false;
}

module.exports = {
  leerEstadoAntiraid,
  guardarEstadoAntiraid,
  activarAntiraid,
  desactivarAntiraid,
  estaActivo,
  registrarCanalAfectado,
  esSpam,
  tieneLinksSospechosos
};
