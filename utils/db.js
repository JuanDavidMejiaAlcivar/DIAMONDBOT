/**
 * Capa de datos principal de DiamondsBOT.
 *
 * - Categorías y equipos: siguen en `data/categorias.json` (estructura estable).
 * - Plantillas, propuestas, fichados, bajas: migrados a SQLite (database.js).
 *
 * La API pública se mantiene idéntica para no romper los comandos existentes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const sqlite = require('./database');

const DATA_PATH = path.join(__dirname, '..', 'data', 'categorias.json');
const SOL_PATH  = path.join(__dirname, '..', 'data', 'solicitudes.json');

// ═══════════════════════════════════════════════════════════════════════════
// Helpers internos
// ═══════════════════════════════════════════════════════════════════════════

function mismoId(a, b) {
  return String(a || '') === String(b || '');
}

// ═══════════════════════════════════════════════════════════════════════════
// JSON – Categorías / Equipos (se mantiene en archivo)
// ═══════════════════════════════════════════════════════════════════════════

function leerDatos() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      const inicial = { categorias: [], equipos: [], transferHistory: [] };
      fs.writeFileSync(DATA_PATH, JSON.stringify(inicial, null, 2), 'utf-8');
      return inicial;
    }
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch (err) {
    console.error('[DB] Error leyendo categorias.json:', err.message);
    return { categorias: [], equipos: [], transferHistory: [] };
  }
}

function guardarDatos(datos) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(datos, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Error guardando categorias.json:', err.message);
    throw err;
  }
}

// ── Categorías ─────────────────────────────────────────────────────────────

function obtenerCategorias() {
  return leerDatos().categorias || [];
}

function obtenerCategoriaPorId(id) {
  return leerDatos().categorias.find(c => c.id === id) || null;
}

function obtenerCategoriaPorNombre(nombre) {
  if (!nombre) return null;
  return leerDatos().categorias.find(
    c => c.nombre.toLowerCase() === nombre.toLowerCase()
  ) || null;
}

function crearCategoria(nombre, descripcion, max_equipos) {
  const datos = leerDatos();
  const id = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_');

  if (datos.categorias.find(c => c.id === id || c.nombre.toLowerCase() === nombre.toLowerCase())) {
    return { ok: false, error: 'Ya existe una categoría con ese nombre.' };
  }

  const nueva = { id, nombre, descripcion, max_equipos };
  datos.categorias.push(nueva);
  guardarDatos(datos);
  return { ok: true, categoria: nueva };
}

function editarCategoria(id, campos) {
  const datos = leerDatos();
  const idx = datos.categorias.findIndex(c => c.id === id);
  if (idx === -1) return { ok: false, error: 'Categoría no encontrada.' };
  datos.categorias[idx] = { ...datos.categorias[idx], ...campos };
  guardarDatos(datos);
  return { ok: true, categoria: datos.categorias[idx] };
}

function eliminarCategoria(id) {
  const datos = leerDatos();
  const idx = datos.categorias.findIndex(c => c.id === id);
  if (idx === -1) return { ok: false, error: 'Categoría no encontrada.' };

  const equipos = datos.equipos.filter(e => e.categoria_id === id);
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

// ── Equipos ────────────────────────────────────────────────────────────────

function obtenerEquipos() {
  return leerDatos().equipos || [];
}

function obtenerEquipoPorId(id) {
  if (!id) return null;
  return leerDatos().equipos.find(e => e.id === id) || null;
}

function obtenerEquiposPorCategoria(categoria_id) {
  return leerDatos().equipos.filter(e => e.categoria_id === categoria_id);
}

function obtenerEquipoPorNombre(nombre) {
  if (!nombre) return null;
  return leerDatos().equipos.find(
    e => e.nombre.toLowerCase() === nombre.toLowerCase()
  ) || null;
}

function obtenerEquipoPorAbreviacion(abreviacion) {
  if (!abreviacion) return null;
  return leerDatos().equipos.find(
    e => e.abreviacion?.toLowerCase() === abreviacion.toLowerCase()
  ) || null;
}

/**
 * Busca qué equipo contiene a un jugador.
 * Ahora usa SQLite en vez de iterar plantillas JSON.
 */
function obtenerEquipoPorJugador(userId) {
  const miembro = sqlite.obtenerMiembroDb(userId);
  if (!miembro || miembro.inconsistent) return null;
  return obtenerEquipoPorId(miembro.team_id);
}

function crearEquipo(datos_equipo) {
  const datos = leerDatos();
  const id = `eq_${randomUUID().slice(0, 8)}`;
  const ahora = new Date().toISOString();
  const equipo = { id, ...datos_equipo, created_at: ahora, updated_at: ahora };
  datos.equipos.push(equipo);
  guardarDatos(datos);

  // Registrar DT, SUB_DT y jugadores en SQLite
  _sincronizarEquipoASqlite(equipo);

  return obtenerEquipoPorId(id);
}

function actualizarEquipo(id, campos) {
  const datos = leerDatos();
  const idx = datos.equipos.findIndex(e => e.id === id);
  if (idx === -1) return null;
  datos.equipos[idx] = { ...datos.equipos[idx], ...campos, updated_at: new Date().toISOString() };
  guardarDatos(datos);
  return datos.equipos[idx];
}

function eliminarEquipoPorId(id) {
  const datos = leerDatos();
  const idx = datos.equipos.findIndex(e => e.id === id);
  if (idx === -1) return false;
  datos.equipos.splice(idx, 1);
  guardarDatos(datos);

  // Limpiar SQLite: cancelar propuestas pendientes y eliminar miembros
  sqlite.eliminarMiembrosEquipoDb(id);

  const db = sqlite.getDb();
  db.prepare("UPDATE proposals SET status = 'CANCELLED', resolved_at = datetime('now') WHERE team_id = ? AND status = 'PENDING'")
    .run(id);

  return true;
}

function cuposDisponibles(categoria) {
  if (!categoria) return 0;
  return categoria.max_equipos - obtenerEquiposPorCategoria(categoria.id).length;
}

function categoriaLlena(categoria) {
  return cuposDisponibles(categoria) <= 0;
}

/**
 * Sincroniza un equipo recién creado a las tablas de SQLite.
 * Se llama al crear un equipo para poblar la tabla `members`.
 */
function _sincronizarEquipoASqlite(equipo) {
  const db = sqlite.getDb();
  const insertMember = db.prepare(`
    INSERT OR IGNORE INTO members (team_id, discord_user_id, role, haxball_nick, joined_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  const added = new Set();

  const agregar = (userId, role, haxballNick = null) => {
    if (!userId || added.has(userId)) return;
    added.add(userId);
    insertMember.run(equipo.id, userId, role, haxballNick);
  };

  agregar(equipo.director_tecnico_id, 'DT');
  agregar(equipo.sub_director_tecnico_id, 'SUB_DT');
  for (const id of equipo.jugadores || []) agregar(id, 'PLAYER');
  for (const m of equipo.members || []) agregar(m.discord_user_id, m.role || 'PLAYER', m.haxball_nick);
}

// ═══════════════════════════════════════════════════════════════════════════
// SQLite – Plantillas / Fichajes / Propuestas (API compatible)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene la plantilla de un equipo.
 */
function obtenerPlantilla(teamId) {
  const plantilla = sqlite.obtenerPlantillaDb(teamId);
  if (!plantilla || plantilla.miembros.length === 0) return null;
  const equipo = obtenerEquipoPorId(teamId);
  return {
    ...plantilla,
    nombre: equipo?.nombre || null,
  };
}

/**
 * Busca el registro de un miembro.
 * Devuelve null, { inconsistent: true, teams: [...] } o el registro.
 */
function obtenerMiembro(userId) {
  const result = sqlite.obtenerMiembroDb(userId);
  if (!result) return null;
  if (result.inconsistent) {
    return {
      inconsistent: true,
      teams: result.teams.map(tid => obtenerEquipoPorId(tid)).filter(Boolean),
    };
  }
  return result;
}

/**
 * Registra un miembro en un equipo.
 */
function registrarMiembro(teamId, userId, role, haxballNick = null, performedBy = null) {
  return sqlite.registrarMiembroDb(teamId, userId, role, haxballNick, performedBy);
}

/**
 * Quita a un miembro de su equipo.
 */
function quitarMiembro(teamId, userId, action, performedBy) {
  return sqlite.quitarMiembroDb(teamId, userId, action, performedBy);
}

/**
 * Asigna el cargo de Sub-DT.
 */
function asignarSubDt(teamId, userId, performedBy) {
  return sqlite.asignarSubDtDb(teamId, userId, performedBy);
}

/**
 * Quita el cargo de Sub-DT.
 */
function quitarSubDt(teamId, userId, performedBy) {
  return sqlite.quitarSubDtDb(teamId, userId, performedBy);
}

// ── Propuestas ─────────────────────────────────────────────────────────────

function crearPropuesta(datos) {
  return sqlite.crearPropuestaDb(datos);
}

function obtenerPropuesta(id) {
  return sqlite.obtenerPropuestaDb(id);
}

function actualizarPropuesta(id, campos) {
  return sqlite.actualizarPropuestaDb(id, campos);
}

function agregarHistorial(entry) {
  if (entry.action === 'SIGNED') {
    sqlite.registrarFichajeDb(
      entry.user_id, entry.team_id, entry.team_nombre || null,
      entry.role || 'PLAYER', entry.haxball_nick || null, entry.performed_by || null
    );
  } else {
    const motivo = ['RELEASED', 'RESIGNED', 'LEFT_SERVER', 'TEAM_DELETED'].includes(entry.action)
      ? entry.action
      : 'RELEASED';
    sqlite.registrarBajaDb(
      entry.user_id, entry.team_id, entry.team_nombre || null,
      entry.role || null, motivo, entry.haxball_nick || null, entry.performed_by || null
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Solicitudes de inscripción (se mantiene en JSON por simplicidad)
// ═══════════════════════════════════════════════════════════════════════════

function leerSolicitudes() {
  try {
    if (!fs.existsSync(SOL_PATH)) {
      const inicial = { solicitudes: [] };
      fs.writeFileSync(SOL_PATH, JSON.stringify(inicial, null, 2), 'utf-8');
      return inicial;
    }
    return JSON.parse(fs.readFileSync(SOL_PATH, 'utf-8'));
  } catch (err) {
    console.error('[DB] Error leyendo solicitudes.json:', err.message);
    return { solicitudes: [] };
  }
}

function guardarSolicitudes(datos) {
  try {
    fs.writeFileSync(SOL_PATH, JSON.stringify(datos, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Error guardando solicitudes.json:', err.message);
    throw err;
  }
}

function obtenerSolicitudPorId(id) {
  return leerSolicitudes().solicitudes.find(s => s.id === id) || null;
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
  const idx = sol.solicitudes.findIndex(s => s.id === id);
  if (idx === -1) return null;
  sol.solicitudes[idx] = { ...sol.solicitudes[idx], ...campos };
  guardarSolicitudes(sol);
  return sol.solicitudes[idx];
}

function solicitudPendientePorNombre(nombre) {
  if (!nombre) return null;
  return (
    leerSolicitudes().solicitudes.find(
      s => s.team_name.toLowerCase() === nombre.toLowerCase() && s.status === 'PENDING'
    ) || null
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Inicialización – migración automática
// ═══════════════════════════════════════════════════════════════════════════

// Ejecutar migración al primer require
sqlite.migrarDesdeJson();

// ═══════════════════════════════════════════════════════════════════════════
// Exportaciones
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // JSON
  leerDatos,
  guardarDatos,
  // Categorías
  obtenerCategorias,
  obtenerCategoriaPorId,
  obtenerCategoriaPorNombre,
  crearCategoria,
  editarCategoria,
  eliminarCategoria,
  // Equipos
  obtenerEquipos,
  obtenerEquipoPorId,
  obtenerEquiposPorCategoria,
  obtenerEquipoPorNombre,
  obtenerEquipoPorAbreviacion,
  obtenerEquipoPorJugador,
  // Plantillas / Miembros (SQLite)
  obtenerPlantilla,
  obtenerMiembro,
  registrarMiembro,
  quitarMiembro,
  asignarSubDt,
  quitarSubDt,
  // Propuestas (SQLite)
  crearPropuesta,
  obtenerPropuesta,
  actualizarPropuesta,
  agregarHistorial,
  // Equipos CRUD
  crearEquipo,
  actualizarEquipo,
  eliminarEquipoPorId,
  cuposDisponibles,
  categoriaLlena,
  // Solicitudes (JSON)
  obtenerSolicitudPorId,
  crearSolicitud,
  actualizarSolicitud,
  solicitudPendientePorNombre,
};
