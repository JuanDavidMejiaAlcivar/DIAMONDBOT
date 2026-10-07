const db = require('./db');

function sanitizeEmojiName(name) {
  if (!name) return 'equipo';
  let sanitized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '');
  if (sanitized.length < 2) sanitized = 'eq_' + sanitized;
  return sanitized.slice(0, 32);
}

function getTeamEmoji(guild, teamId) {
  const team = db.obtenerEquipoPorId(teamId);
  if (!team || !team.discord_emoji_id) return '';
  const emoji = guild.emojis.cache.get(team.discord_emoji_id);
  if (emoji) return `<:${emoji.name}:${emoji.id}> `;
  return '';
}

async function syncTeamEmoji(guild, team, newImageUrl = null) {
  let emoji = null;
  const sanitizedName = sanitizeEmojiName(team.nombre);

  if (team.discord_emoji_id) {
    try {
      emoji = await guild.emojis.fetch(team.discord_emoji_id);
    } catch (e) {
      emoji = null; 
    }
  }

  if (emoji && newImageUrl) {
    try {
      await emoji.delete('Reemplazando escudo del equipo');
    } catch(e) {}
    emoji = null;
  }

  if (emoji) {
    if (emoji.name !== sanitizedName) {
      try {
        await emoji.edit({ name: sanitizedName });
      } catch(e) {
        console.error('Error updating emoji name:', e);
      }
    }
    return emoji;
  } else {
    try {
      const imageUrl = newImageUrl || team.escudo;
      if (!imageUrl) return null;

      emoji = await guild.emojis.create({
        attachment: imageUrl,
        name: sanitizedName,
        reason: `Emoji del equipo: ${team.nombre}`
      });

      db.actualizarEquipo(team.id, { discord_emoji_id: emoji.id });
      return emoji;
    } catch (e) {
      console.error('Error creating emoji:', e);
      return null;
    }
  }
}

async function deleteTeamEmoji(guild, discord_emoji_id) {
  if (!discord_emoji_id) return;
  try {
    const emoji = await guild.emojis.fetch(discord_emoji_id);
    if (emoji) {
      await emoji.delete('Equipo eliminado');
    }
  } catch(e) {}
}

module.exports = {
  sanitizeEmojiName,
  getTeamEmoji,
  syncTeamEmoji,
  deleteTeamEmoji
};
