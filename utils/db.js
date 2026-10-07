const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const DATA_PATH = path.join(__dirname, '..', 'data', 'categorias.json');
const SOL_PATH  = path.join(__dirname, '..', 'data', 'solicitudes.json');
const FICHAJES_PATH = path.join(__dirname, '..', 'data', 'fichajes.json');

function plantillaVacia() {
  return { plantillas: [], propuestas: [], fichados: [], bajas: [] };
}

function mismoId(a, b) {
  return String(a || '') === String(b || '');
}

function construirPlantillaDesdeEquipo(equipo) {
  const ahora = new Date().toISOString();
  const miembros = [];
  const agregar = (userId, role, extra = {}) => {
    if (!userId || miembros.some((m) => mismoId(m.discord_user_id, userId))) return;
    const previo = (equipo.members || []).find((m) => mismoId(m.discord_user_id, userId));
    miembros.push({
      discord_user_id: String(userId),
      role,
      haxball_nick: extra.haxball_nick ?? previo?.haxball_nick ?? null,
      joined_at: extra.joined_at || previo?.joined_at || ahora,
    });
  };

  agregar(equipo.director_tecnico_id, 'DT');
  agregar(equipo.sub_director_tecnico_id, 'SUB_DT');
  for (const id of equipo.jugadores || []) agregar(id, 'PLAYER');
  for (const m of equipo.members || []) agregar(m.discord_user_id, m.role || 'PLAYER', m);

  return { team_id: equipo.id, nombre: equipo.nombre, miembros };
}

function aplicarPlantillaAlEquipo(equipo, plantilla) {
  const miembros = plantilla?.miembros || [];
  equipo.director_tecnico_id = miembros.find((m) => m.role === 'DT')?.discord_user_id || null;
  equipo.sub_director_tecnico_id = miembros.find((m) => m.role === 'SUB_DT')?.discord_user_id || null;
  equipo.jugadores = miembros.filter((m) => m.role === 'PLAYER').map((m) => m.discord_user_id);
  equipo.members = miembros.map((m) => ({
    team_id: plantilla.team_id,
    discord_user_id: m.discord_user_id,
    role: m.role,
    haxball_nick: m.haxball_nick || null,
    joined_at: m.joined_at || null,
  }));
  return equipo;
}

function sincronizarEquipoDesdePlantilla(teamId) {
  const datos = leerDatos();
  const equipo = datos.equipos.find((e) => e.id === teamId);
  const plantilla = leerFichajes().plantillas.find((p) => p.team_id === teamId);
  if (!equipo || !plantilla) return;
  aplicarPlantillaAlEquipo(equipo, plantilla);
  guardarDatos(datos);
}

function leerFichajes() {
  if (!fs.existsSync(FICHAJES_PATH)) {
    fs.writeFileSync(FICHAJES_PATH, JSON.stringify(plantillaVacia(), null, 2), 'utf-8');
  }
  const raw = JSON.parse(fs.readFileSync(FICHAJES_PATH, 'utf-8'));
  const datos = {
    plantillas: Array.isArray(raw.plantillas) ? raw.plantillas : [],
    propuestas: Array.isArray(raw.propuestas) ? raw.propuestas : [],
    fichados: Array.isArray(raw.fichados) ? raw.fichados : [],
    bajas: Array.isArray(raw.bajas) ? raw.bajas : [],
  };

  let cambio = false;
  const categorias = leerDatos();
  for (const equipo of categorias.equipos) {
    const idx = datos.plantillas.findIndex((p) => p.team_id === equipo.id);
    if (idx === -1) {
      datos.plantillas.push(construirPlantillaDesdeEquipo(equipo));
      cambio = true;
    } else if (datos.plantillas[idx].nombre !== equipo.nombre) {
      datos.plantillas[idx].nombre = equipo.nombre;
      cambio = true;
    }
  }
  if (datos.fichados.length === 0 && datos.bajas.length === 0) {
    for (const h of categorias.transferHistory || []) {
      if (h.action === 'SIGNED') {
        datos.fichados.push({
          user_id: h.user_id,
          team_id: h.to_team_id,
          team_nombre: datos.plantillas.find((p) => p.team_id === h.to_team_id)?.nombre || null,
          role: 'PLAYER',
          haxball_nick: h.haxball_nick || null,
          performed_by: h.performed_by,
          timestamp: h.timestamp,
        });
        cambio = true;
      } else if (['RELEASED', 'RESIGNED', 'LEFT_SERVER'].includes(h.action)) {
        datos.bajas.push({
          user_id: h.user_id,
          team_id: h.from_team_id,
          team_nombre: datos.plantillas.find((p) => p.team_id === h.from_team_id)?.nombre || null,
          role: 'PLAYER',
          motivo: h.action,
          haxball_nick: h.haxball_nick || null,
          performed_by: h.performed_by,
          timestamp: h.timestamp,
        });
        cambio = true;
      }
    }
  }
  if (cambio) {
    guardarFichajes(datos);
    for (const plantilla of datos.plantillas) {
      const equipo = categorias.equipos.find((e) => e.id === plantilla.team_id);
      if (equipo) aplicarPlantillaAlEquipo(equipo, plantilla);
    }
    guardarDatos(categorias);
  }
  return datos;
}

function guardarFichajes(datos) {
  fs.writeFileSync(FICHAJES_PATH, JSON.stringify(datos, null, 2), 'utf-8');
}

function obtenerPlantilla(teamId) {
  return leerFichajes().plantillas.find((p) => p.team_id === teamId) || null;
}

function leerDatos() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

function guardarDatos(datos) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(datos, null, 2), 'utf-8');
}

function leerSolicitudes() {
  if (!fs.existsSync(SOL_PATH)) {
    const inicial = { solicitudes: [] };
    fs.writeFileSync(SOL_PATH, JSON.stringify(inicial, null, 2), 'utf-8');
    return inicial;
  }
  return JSON.parse(fs.readFileSync(SOL_PATH, 'utf-8'));
}

function guardarSolicitudes(datos) {
  fs.writeFileSync(SOL_PATH, JSON.stringify(datos, null, 2), 'utf-8');
}

function obtenerCategorias() {
  return leerDatos().categorias;
}

function obtenerCategoriaPorId(id) {
  return leerDatos().categorias.find((c) => c.id === id) || null;
}

function obtenerCategoriaPorNombre(nombre) {
  return leerDatos().categorias.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase()) || null;
}

function crearCategoria(nombre, descripcion, max_equipos) {
  const datos = leerDatos();
  const id = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_');

  if (datos.categorias.find((c) => c.id === id || c.nombre.toLowerCase() === nombre.toLowerCase())) {
    return { ok: false, error: 'Ya existe una categoría con ese nombre.' };
  }

  const nueva = { id, nombre, descripcion, max_equipos };
  datos.categorias.push(nueva);
  guardarDatos(datos);
  return { ok: true, categoria: nueva };
}

function editarCategoria(id, campos) {
  const datos = leerDatos();
  const idx = datos.categorias.findIndex((c) => c.id === id);
  if (idx === -1) return { ok: false, error: 'Categoría no encontrada.' };
  datos.categorias[idx] = { ...datos.categorias[idx], ...campos };
  guardarDatos(datos);
  return { ok: true, categoria: datos.categorias[idx] };
}

function eliminarCategoria(id) {
  const datos = leerDatos();
  const idx = datos.categorias.findIndex((c) => c.id === id);
  if (idx === -1) return { ok: false, error: 'Categoría no encontrada.' };

  const equipos = datos.equipos.filter((e) => e.categoria_id === id);
  if (equipos.length > 0) {
    return {
      ok: false,
      error: `La categoría contiene **${equipos.length}** equipo(s) registrado(s). Gestiona esos equipos antes de eliminar la categoría.`,
    };
  }

  datos.categorias.splice(idx, 1);
  guardarDatos(datos);
  return { ok: true };
}

function obtenerEquipos() {
  return leerDatos().equipos;
}

function obtenerEquipoPorId(id) {
  return leerDatos().equipos.find((e) => e.id === id) || null;
}

function obtenerEquiposPorCategoria(categoria_id) {
  return leerDatos().equipos.filter((e) => e.categoria_id === categoria_id);
}

function obtenerEquipoPorNombre(nombre) {
  return leerDatos().equipos.find((e) => e.nombre.toLowerCase() === nombre.toLowerCase()) || null;
}

function obtenerEquipoPorAbreviacion(abreviacion) {
  return leerDatos().equipos.find((e) => e.abreviacion?.toLowerCase() === abreviacion.toLowerCase()) || null;
}

function obtenerEquipoPorJugador(userId) {
  const plantillas = leerFichajes().plantillas.filter((p) =>
    p.miembros?.some((m) => mismoId(m.discord_user_id, userId))
  );
  if (plantillas.length === 0) return null;
  return obtenerEquipoPorId(plantillas[0].team_id);
}

function obtenerMiembro(userId) {
  const plantillas = leerFichajes().plantillas.filter((p) =>
    p.miembros?.some((m) => mismoId(m.discord_user_id, userId))
  );
  if (plantillas.length === 0) return null;
  if (plantillas.length !== 1) {
    return { inconsistent: true, teams: plantillas.map((p) => obtenerEquipoPorId(p.team_id)).filter(Boolean) };
  }
  const plantilla = plantillas[0];
  const record = plantilla.miembros.find((m) => mismoId(m.discord_user_id, userId));
  return {
    team_id: plantilla.team_id,
    discord_user_id: String(userId),
    role: record.role,
    haxball_nick: record.haxball_nick || null,
    joined_at: record.joined_at || null,
  };
}

function registrarMiembro(teamId, userId, role, haxballNick = null, performedBy = null) {
  const fichajes = leerFichajes();
  const plantilla = fichajes.plantillas.find((p) => p.team_id === teamId);
  if (!plantilla) throw new Error(`Equipo inexistente: ${teamId}`);

  const ocupado = fichajes.plantillas.find((p) =>
    p.team_id !== teamId && p.miembros.some((m) => mismoId(m.discord_user_id, userId))
  );
  if (ocupado) throw new Error(`Usuario ${userId} ya pertenece a ${ocupado.team_id}`);

  const old = plantilla.miembros.find((m) => mismoId(m.discord_user_id, userId));
  const member = {
    discord_user_id: String(userId),
    role,
    haxball_nick: haxballNick ?? old?.haxball_nick ?? null,
    joined_at: old?.joined_at || new Date().toISOString(),
  };
  plantilla.miembros = plantilla.miembros.filter((m) => !mismoId(m.discord_user_id, userId)).concat(member);

  if (performedBy) {
    fichajes.fichados.push({
      user_id: String(userId),
      team_id: teamId,
      team_nombre: plantilla.nombre,
      role,
      haxball_nick: member.haxball_nick,
      performed_by: performedBy,
      timestamp: new Date().toISOString(),
    });
  }

  guardarFichajes(fichajes);
  sincronizarEquipoDesdePlantilla(teamId);
  return { team_id: teamId, ...member };
}

function quitarMiembro(teamId, userId, action, performedBy) {
  const fichajes = leerFichajes();
  const plantilla = fichajes.plantillas.find((p) => p.team_id === teamId);
  if (!plantilla) throw new Error(`Equipo inexistente: ${teamId}`);

  const member = plantilla.miembros.find((m) => mismoId(m.discord_user_id, userId));
  const role = member?.role || null;
  plantilla.miembros = plantilla.miembros.filter((m) => !mismoId(m.discord_user_id, userId));

  fichajes.bajas.push({
    user_id: String(userId),
    team_id: teamId,
    team_nombre: plantilla.nombre,
    role,
    motivo: action,
    haxball_nick: member?.haxball_nick || null,
    performed_by: performedBy,
    timestamp: new Date().toISOString(),
  });

  guardarFichajes(fichajes);
  sincronizarEquipoDesdePlantilla(teamId);
  return { role, member };
}

function asignarSubDt(teamId, userId, performedBy) {
  const fichajes = leerFichajes();
  const plantilla = fichajes.plantillas.find((p) => p.team_id === teamId);
  if (!plantilla) throw new Error(`Equipo inexistente: ${teamId}`);
  if (plantilla.miembros.some((m) => m.role === 'SUB_DT')) {
    throw new Error('El equipo ya tiene Sub-Director Técnico.');
  }
  const member = plantilla.miembros.find((m) => mismoId(m.discord_user_id, userId));
  if (!member) throw new Error('El usuario no pertenece a la plantilla.');
  member.role = 'SUB_DT';
  guardarFichajes(fichajes);
  sincronizarEquipoDesdePlantilla(teamId);
  return member;
}

function quitarSubDt(teamId, userId, performedBy) {
  const fichajes = leerFichajes();
  const plantilla = fichajes.plantillas.find((p) => p.team_id === teamId);
  if (!plantilla) throw new Error(`Equipo inexistente: ${teamId}`);
  const member = plantilla.miembros.find((m) => mismoId(m.discord_user_id, userId));
  if (!member || member.role !== 'SUB_DT') throw new Error('El usuario no es Sub-Director Técnico.');
  member.role = 'PLAYER';
  guardarFichajes(fichajes);
  sincronizarEquipoDesdePlantilla(teamId);
  return member;
}

function crearPropuesta(datos) {
  const fichajes = leerFichajes();
  const propuesta = { ...datos, status: datos.status || 'PENDING' };
  fichajes.propuestas.push(propuesta);
  guardarFichajes(fichajes);
  return propuesta;
}

function obtenerPropuesta(id) {
  return leerFichajes().propuestas.find((p) => p.id === id) || null;
}

function actualizarPropuesta(id, campos) {
  const fichajes = leerFichajes();
  const idx = fichajes.propuestas.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  fichajes.propuestas[idx] = { ...fichajes.propuestas[idx], ...campos };
  guardarFichajes(fichajes);
  return fichajes.propuestas[idx];
}

function agregarHistorial(entry) {
  const fichajes = leerFichajes();
  const item = { ...entry, timestamp: entry.timestamp || new Date().toISOString() };
  if (entry.action === 'SIGNED') fichajes.fichados.push(item);
  else fichajes.bajas.push(item);
  guardarFichajes(fichajes);
}

function crearEquipo(datos_equipo) {
  const datos = leerDatos();
  const id = `eq_${randomUUID().slice(0, 8)}`;
  const ahora = new Date().toISOString();
  const equipo = { id, ...datos_equipo, created_at: ahora, updated_at: ahora };
  datos.equipos.push(equipo);
  guardarDatos(datos);

  const fichajes = leerFichajes();
  const plantilla = construirPlantillaDesdeEquipo(equipo);
  fichajes.plantillas = fichajes.plantillas.filter((p) => p.team_id !== id).concat(plantilla);
  guardarFichajes(fichajes);
  sincronizarEquipoDesdePlantilla(id);
  return obtenerEquipoPorId(id);
}

function actualizarEquipo(id, campos) {
  const datos = leerDatos();
  const idx = datos.equipos.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  datos.equipos[idx] = { ...datos.equipos[idx], ...campos, updated_at: new Date().toISOString() };
  guardarDatos(datos);
  if (campos.nombre) {
    const fichajes = leerFichajes();
    const plantilla = fichajes.plantillas.find((p) => p.team_id === id);
    if (plantilla) {
      plantilla.nombre = campos.nombre;
      guardarFichajes(fichajes);
    }
  }
  return datos.equipos[idx];
}

function eliminarEquipoPorId(id) {
  const datos = leerDatos();
  const idx = datos.equipos.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  datos.equipos.splice(idx, 1);
  guardarDatos(datos);

  const fichajes = leerFichajes();
  fichajes.plantillas = fichajes.plantillas.filter((p) => p.team_id !== id);
  fichajes.propuestas = fichajes.propuestas.map((p) =>
    p.team_id === id && p.status === 'PENDING' ? { ...p, status: 'CANCELLED' } : p
  );
  guardarFichajes(fichajes);
  return true;
}

function cuposDisponibles(categoria) {
  return categoria.max_equipos - obtenerEquiposPorCategoria(categoria.id).length;
}

function categoriaLlena(categoria) {
  return cuposDisponibles(categoria) <= 0;
}

function obtenerSolicitudPorId(id) {
  return leerSolicitudes().solicitudes.find((s) => s.id === id) || null;
}

function crearSolicitud(datos) {
  const sol = leerSolicitudes();
  const id = `sol_${randomUUID().slice(0, 8)}`;
  const nueva = {
    id,
    ...datos,
    status: 'PENDING',
    message_id: null,
    review_channel_id: null,
    created_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
  };
  sol.solicitudes.push(nueva);
  guardarSolicitudes(sol);
  return nueva;
}

function actualizarSolicitud(id, campos) {
  const sol = leerSolicitudes();
  const idx = sol.solicitudes.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  sol.solicitudes[idx] = { ...sol.solicitudes[idx], ...campos };
  guardarSolicitudes(sol);
  return sol.solicitudes[idx];
}

function solicitudPendientePorNombre(nombre) {
  return (
    leerSolicitudes().solicitudes.find(
      (s) => s.team_name.toLowerCase() === nombre.toLowerCase() && s.status === 'PENDING'
    ) || null
  );
}

module.exports = {
  leerDatos,
  guardarDatos,
  obtenerCategorias,
  obtenerCategoriaPorId,
  obtenerCategoriaPorNombre,
  crearCategoria,
  editarCategoria,
  eliminarCategoria,
  obtenerEquipos,
  obtenerEquipoPorId,
  obtenerEquiposPorCategoria,
  obtenerEquipoPorNombre,
  obtenerEquipoPorAbreviacion,
  obtenerEquipoPorJugador,
  obtenerPlantilla,
  obtenerMiembro,
  registrarMiembro,
  quitarMiembro,
  asignarSubDt,
  quitarSubDt,
  crearPropuesta,
  obtenerPropuesta,
  actualizarPropuesta,
  agregarHistorial,
  crearEquipo,
  actualizarEquipo,
  eliminarEquipoPorId,
  cuposDisponibles,
  categoriaLlena,
  obtenerSolicitudPorId,
  crearSolicitud,
  actualizarSolicitud,
  solicitudPendientePorNombre,
};
