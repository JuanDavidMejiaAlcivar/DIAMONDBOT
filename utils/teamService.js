const { ChannelType } = require('discord.js');
const db = require('./db');
const { syncTeamEmoji } = require('./emojiService');

function hexAInt(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

function nombreACanal(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 100);
}

async function rollback(guild, recursos) {
  if (recursos.canal)   try { await recursos.canal.delete('Rollback'); }   catch (_) {}
  if (recursos.rol)     try { await recursos.rol.delete('Rollback'); }     catch (_) {}
  if (recursos.equipo)  db.eliminarEquipoPorId(recursos.equipo.id);
}

async function crearEquipoCompleto(guild, datos, botUserId) {
  const recursos = { equipo: null, rol: null, canal: null };

  recursos.equipo = db.crearEquipo({
    nombre:                  datos.nombre,
    abreviacion:             datos.abreviacion,
    color_primario:          datos.color_primario,
    color_secundario:        datos.color_secundario,
    escudo:                  datos.escudo_url,
    categoria_id:            datos.categoria_id,
    jugadores:               datos.jugadores || [],
    director_tecnico_id:     datos.director_tecnico_id     || null,
    sub_director_tecnico_id: datos.sub_director_tecnico_id || null,
    role_id:     null,
    channel_id:  null,
  });

  try {
    recursos.rol = await guild.roles.create({
      name:   datos.nombre,
      color:  hexAInt(datos.color_primario),
      reason: `Equipo: ${datos.nombre}`,
    });
    db.actualizarEquipo(recursos.equipo.id, { role_id: recursos.rol.id });
  } catch (err) {
    await rollback(guild, recursos);
    throw new Error('No se pudo crear el rol del equipo. Verifica que el bot tenga el permiso Gestionar Roles.');
  }

  const overwrites = [
    { id: guild.id, deny: ['ViewChannel'] },
    { id: recursos.rol.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
    { id: botUserId, allow: ['ViewChannel', 'SendMessages', 'ManageChannels'] },
  ];

  // Obtener la categoría de canal asignada a esta división
  const categoria = db.obtenerCategoriaPorId(datos.categoria_id);
  const parentCategoryId = categoria?.category_channel_id || null;

  try {
    const channelData = {
      name: nombreACanal(datos.nombre),
      type: ChannelType.GuildText,
      reason: `Canal del equipo: ${datos.nombre}`,
      permissionOverwrites: overwrites,
    };

    // Solo agregar parent si hay una categoría asignada
    if (parentCategoryId) {
      channelData.parent = parentCategoryId;
    }

    recursos.canal = await guild.channels.create(channelData);
    db.actualizarEquipo(recursos.equipo.id, { channel_id: recursos.canal.id });
  } catch (err) {
    await rollback(guild, recursos);
    throw new Error('No se pudo crear el canal. Verifica que el bot tenga el permiso Gestionar Canales.');
  }

  await syncTeamEmoji(guild, db.obtenerEquipoPorId(recursos.equipo.id));

  return {
    equipo: db.obtenerEquipoPorId(recursos.equipo.id),
    rol:    recursos.rol,
    canal:  recursos.canal,
  };
}

module.exports = { hexAInt, nombreACanal, crearEquipoCompleto };
