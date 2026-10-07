const { EmbedBuilder } = require('discord.js');
const db = require('./db');

const DT_ROLE_ID = process.env.DT_ROLE_ID?.trim();
const SUBDT_ROLE_ID = process.env.SUBDT_ROLE_ID?.trim();
const TURQUOISE = 0x00bfa6;

function getOperator(interaction, allowSub = true) {
  const member = db.obtenerMiembro(interaction.user.id);
  if (!member || member.inconsistent) return { error: 'No tienes permisos para realizar esta acción. Tu cargo debe estar registrado en un equipo.' };
  if (member.role !== 'DT' && !(allowSub && member.role === 'SUB_DT')) return { error: allowSub
    ? 'No tienes permisos para realizar fichajes. Solo el Director Técnico y el Subdirector Técnico pueden fichar jugadores.'
    : 'Solo el Director Técnico puede quitar al Subdirector Técnico de su equipo.' };
  const team = db.obtenerEquipoPorId(member.team_id);
  if (!team) return { error: 'Tu registro de equipo no es válido. Contacta a un administrador.' };
  return { member, team };
}

function card(title, description, fields = [], color = TURQUOISE, thumbnail = null) {
  const embed = new EmbedBuilder().setColor(color).setTitle(title);
  if (typeof description === 'string' && description.length > 0) embed.setDescription(description);
  if (fields.length) embed.addFields(...fields);
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

async function dm(user, content, action) {
  try { await user.send({ embeds: [card('DIAMONDS LEAGUE', content)] }); }
  catch (error) { console.error(`No se pudo enviar DM (${action}) a ${user.id}:`, error); }
}

async function notifyDirector(guild, team, content, action) {
  if (!team?.director_tecnico_id) return;
  const director = await guild.client.users.fetch(team.director_tecnico_id).catch((error) => {
    console.error(`No se pudo encontrar al DT (${action}) de ${team.id}:`, error);
    return null;
  });
  if (director) await dm(director, content, action);
}

async function fetchTeamRole(guild, team) {
  if (!team?.role_id) return null;
  return guild.roles.fetch(team.role_id).catch(() => null);
}

function technicalRoleId(role) { return role === 'DT' ? DT_ROLE_ID : role === 'SUB_DT' ? SUBDT_ROLE_ID : null; }

module.exports = { db, DT_ROLE_ID, SUBDT_ROLE_ID, TURQUOISE, getOperator, card, dm, notifyDirector, fetchTeamRole, technicalRoleId };
