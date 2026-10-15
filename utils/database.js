/**
 * Módulo central de base de datos SQLite para DiamondsBOT.
 * Usa better-sqlite3 (síncrono) – ideal para bots de Discord.
 *
 * Tablas principales:
 *   members     – plantilla activa de cada equipo
 *   proposals   – propuestas de fichaje pendientes / resueltas
 *   signings    – historial de fichajes completados
 *   releases    – historial de bajas (RELEASED, RESIGNED, LEFT_SERVER)
 */

const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'diamondsbot.db');

// ─── Instancia global ───────────────────────────────────────────────────────
let _db = null;

/**
 * Devuelve (y crea si no existe) la conexión a la base de datos.
 */
function getDb() {
  if (_db) return _db;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  _db = new Database(DB_PATH);

  // Configuraciones de rendimiento
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  crearTablas(_db);
  return _db;
}

// ─── Esquema ────────────────────────────────────────────────────────────────
function crearTablas(db) {
  db.exec(`
    -- Miembros activos de cada equipo
    CREATE TABLE IF NOT EXISTS members (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id         TEXT    NOT NULL,
      discord_user_id TEXT    NOT NULL,
      role            TEXT    NOT NULL CHECK (role IN ('DT','SUB_DT','PLAYER')),
      haxball_nick    TEXT,
      joined_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(team_id, discord_user_id)
    );

    -- Índice para buscar rápido por usuario
    CREATE INDEX IF NOT EXISTS idx_members_user ON members(discord_user_id);

    -- Propuestas de fichaje
    CREATE TABLE IF NOT EXISTS proposals (
      id              TEXT    PRIMARY KEY,
      guild_id        TEXT    NOT NULL,
      team_id         TEXT    NOT NULL,
      target_id       TEXT    NOT NULL,
      requested_by    TEXT    NOT NULL,
      requester_role  TEXT,
      haxball_nick    TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','ACCEPTED','REJECTED','CANCELLED','FAILED')),
      public_message_id TEXT,
      public_channel_id TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      resolved_at     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
    CREATE INDEX IF NOT EXISTS idx_proposals_target ON proposals(target_id);

    -- Historial de fichajes completados
    CREATE TABLE IF NOT EXISTS signings (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT    NOT NULL,
      team_id         TEXT    NOT NULL,
      team_nombre     TEXT,
      role            TEXT    NOT NULL DEFAULT 'PLAYER',
      haxball_nick    TEXT,
      performed_by    TEXT,
      timestamp       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Historial de bajas
    CREATE TABLE IF NOT EXISTS releases (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT    NOT NULL,
      team_id         TEXT    NOT NULL,
      team_nombre     TEXT,
      role            TEXT,
      motivo          TEXT    NOT NULL CHECK (motivo IN ('RELEASED','RESIGNED','LEFT_SERVER','TEAM_DELETED')),
      haxball_nick    TEXT,
      performed_by    TEXT,
      timestamp       TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ─── Funciones de miembros ──────────────────────────────────────────────────

/**
 * Obtiene la plantilla completa de un equipo.
 * @param {string} teamId
 * @returns {{ team_id: string, miembros: Array }}
 */
function obtenerPlantillaDb(teamId) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM members WHERE team_id = ?').all(teamId);
  return {
    team_id: teamId,
    miembros: rows.map(r => ({
      discord_user_id: r.discord_user_id,
      role: r.role,
      haxball_nick: r.haxball_nick,
      joined_at: r.joined_at,
    })),
  };
}

/**
 * Busca a un miembro en cualquier equipo.
 * @param {string} userId
 * @returns {null | { inconsistent: true, teams: Array } | Object}
 */
function obtenerMiembroDb(userId) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM members WHERE discord_user_id = ?').all(userId);
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    return {
      inconsistent: true,
      teams: rows.map(r => r.team_id),
    };
  }
  const r = rows[0];
  return {
    team_id: r.team_id,
    discord_user_id: r.discord_user_id,
    role: r.role,
    haxball_nick: r.haxball_nick,
    joined_at: r.joined_at,
  };
}

/**
 * Registra un miembro en un equipo. Lanza si ya está en otro equipo.
 */
function registrarMiembroDb(teamId, userId, role, haxballNick = null, performedBy = null) {
  const db = getDb();

  // Verificar que no esté en otro equipo
  const ocupado = db.prepare(
    'SELECT team_id FROM members WHERE discord_user_id = ? AND team_id != ?'
  ).get(userId, teamId);
  if (ocupado) {
    throw new Error(`Usuario ${userId} ya pertenece al equipo ${ocupado.team_id}`);
  }

  // Upsert
  db.prepare(`
    INSERT INTO members (team_id, discord_user_id, role, haxball_nick, joined_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(team_id, discord_user_id) DO UPDATE SET
      role = excluded.role,
      haxball_nick = COALESCE(excluded.haxball_nick, members.haxball_nick)
  `).run(teamId, userId, role, haxballNick);

  // Registrar en historial si hay performedBy
  if (performedBy) {
    registrarFichajeDb(userId, teamId, null, role, haxballNick, performedBy);
  }

  return { team_id: teamId, discord_user_id: userId, role, haxball_nick: haxballNick };
}

/**
 * Quita un miembro de su equipo y lo registra en bajas.
 */
function quitarMiembroDb(teamId, userId, action, performedBy) {
  const db = getDb();
  const member = db.prepare(
    'SELECT * FROM members WHERE team_id = ? AND discord_user_id = ?'
  ).get(teamId, userId);

  db.prepare('DELETE FROM members WHERE team_id = ? AND discord_user_id = ?').run(teamId, userId);

  // Registrar baja
  db.prepare(`
    INSERT INTO releases (user_id, team_id, team_nombre, role, motivo, haxball_nick, performed_by)
    VALUES (?, ?, NULL, ?, ?, ?, ?)
  `).run(userId, teamId, member?.role || null, action, member?.haxball_nick || null, performedBy);

  return { role: member?.role || null, member };
}

/**
 * Asigna el cargo de Sub-DT a un miembro existente.
 */
function asignarSubDtDb(teamId, userId, performedBy) {
  const db = getDb();

  // Verificar que no haya ya un SUB_DT
  const existing = db.prepare(
    "SELECT discord_user_id FROM members WHERE team_id = ? AND role = 'SUB_DT'"
  ).get(teamId);
  if (existing) throw new Error('El equipo ya tiene Sub-Director Técnico.');

  // Verificar que el usuario pertenece al equipo
  const member = db.prepare(
    'SELECT * FROM members WHERE team_id = ? AND discord_user_id = ?'
  ).get(teamId, userId);
  if (!member) throw new Error('El usuario no pertenece a la plantilla.');

  db.prepare('UPDATE members SET role = ? WHERE team_id = ? AND discord_user_id = ?')
    .run('SUB_DT', teamId, userId);

  return { ...member, role: 'SUB_DT' };
}

/**
 * Quita el cargo de Sub-DT y lo devuelve a PLAYER.
 */
function quitarSubDtDb(teamId, userId, performedBy) {
  const db = getDb();
  const member = db.prepare(
    'SELECT * FROM members WHERE team_id = ? AND discord_user_id = ?'
  ).get(teamId, userId);
  if (!member || member.role !== 'SUB_DT') throw new Error('El usuario no es Sub-Director Técnico.');

  db.prepare("UPDATE members SET role = 'PLAYER' WHERE team_id = ? AND discord_user_id = ?")
    .run(teamId, userId);

  return { ...member, role: 'PLAYER' };
}

/**
 * Elimina todos los miembros de un equipo (cuando se elimina el equipo).
 */
function eliminarMiembrosEquipoDb(teamId) {
  const db = getDb();
  const members = db.prepare('SELECT * FROM members WHERE team_id = ?').all(teamId);

  // Registrar baja para todos
  const insertRelease = db.prepare(`
    INSERT INTO releases (user_id, team_id, team_nombre, role, motivo, haxball_nick, performed_by)
    VALUES (?, ?, NULL, ?, 'TEAM_DELETED', ?, 'SYSTEM')
  `);

  const transaction = db.transaction(() => {
    for (const m of members) {
      insertRelease.run(m.discord_user_id, teamId, m.role, m.haxball_nick);
    }
    db.prepare('DELETE FROM members WHERE team_id = ?').run(teamId);
  });
  transaction();

  return members;
}

// ─── Funciones de propuestas ────────────────────────────────────────────────

function crearPropuestaDb(datos) {
  const db = getDb();
  db.prepare(`
    INSERT INTO proposals (id, guild_id, team_id, target_id, requested_by, requester_role,
                           haxball_nick, status, public_message_id, public_channel_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    datos.id,
    datos.guild_id,
    datos.team_id,
    datos.target_id,
    datos.requested_by,
    datos.requester_role || null,
    datos.haxball_nick,
    datos.status || 'PENDING',
    datos.public_message_id || null,
    datos.public_channel_id || null,
    datos.created_at || new Date().toISOString()
  );
  return { ...datos, status: datos.status || 'PENDING' };
}

function obtenerPropuestaDb(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM proposals WHERE id = ?').get(id) || null;
}

function actualizarPropuestaDb(id, campos) {
  const db = getDb();
  const sets = [];
  const values = [];
  for (const [key, val] of Object.entries(campos)) {
    sets.push(`${key} = ?`);
    values.push(val);
  }
  if (sets.length === 0) return null;
  values.push(id);
  db.prepare(`UPDATE proposals SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return obtenerPropuestaDb(id);
}

// ─── Funciones de historial ─────────────────────────────────────────────────

function registrarFichajeDb(userId, teamId, teamNombre, role, haxballNick, performedBy) {
  const db = getDb();
  db.prepare(`
    INSERT INTO signings (user_id, team_id, team_nombre, role, haxball_nick, performed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, teamId, teamNombre, role, haxballNick, performedBy);
}

function registrarBajaDb(userId, teamId, teamNombre, role, motivo, haxballNick, performedBy) {
  const db = getDb();
  db.prepare(`
    INSERT INTO releases (user_id, team_id, team_nombre, role, motivo, haxball_nick, performed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, teamId, teamNombre, role, motivo, haxballNick, performedBy);
}

// ─── Migración desde JSON ───────────────────────────────────────────────────

/**
 * Migra datos existentes de fichajes.json a SQLite.
 * Solo se ejecuta una vez; si ya hay datos en SQLite, se omite.
 */
function migrarDesdeJson() {
  const db = getDb();
  const FICHAJES_PATH = path.join(__dirname, '..', 'data', 'fichajes.json');

  if (!fs.existsSync(FICHAJES_PATH)) return;

  // Verificar si ya se migró (hay datos en members o proposals)
  const memberCount = db.prepare('SELECT COUNT(*) as cnt FROM members').get().cnt;
  const proposalCount = db.prepare('SELECT COUNT(*) as cnt FROM proposals').get().cnt;
  if (memberCount > 0 || proposalCount > 0) {
    console.log('[DB] SQLite ya tiene datos, omitiendo migración de JSON.');
    return;
  }

  console.log('[DB] Migrando fichajes.json a SQLite...');

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(FICHAJES_PATH, 'utf-8'));
  } catch (err) {
    console.error('[DB] Error leyendo fichajes.json para migración:', err.message);
    return;
  }

  const transaction = db.transaction(() => {
    // Migrar plantillas → members
    const plantillas = Array.isArray(raw.plantillas) ? raw.plantillas : [];
    const insertMember = db.prepare(`
      INSERT OR IGNORE INTO members (team_id, discord_user_id, role, haxball_nick, joined_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const p of plantillas) {
      for (const m of p.miembros || []) {
        insertMember.run(
          p.team_id,
          m.discord_user_id,
          m.role || 'PLAYER',
          m.haxball_nick || null,
          m.joined_at || new Date().toISOString()
        );
      }
    }

    // Migrar propuestas
    const propuestas = Array.isArray(raw.propuestas) ? raw.propuestas : [];
    const insertProposal = db.prepare(`
      INSERT OR IGNORE INTO proposals
        (id, guild_id, team_id, target_id, requested_by, requester_role,
         haxball_nick, status, public_message_id, public_channel_id, created_at, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of propuestas) {
      insertProposal.run(
        p.id, p.guild_id || '', p.team_id, p.target_id, p.requested_by,
        p.requester_role || null, p.haxball_nick, p.status || 'PENDING',
        p.public_message_id || null, p.public_channel_id || null,
        p.created_at || new Date().toISOString(), p.resolved_at || null
      );
    }

    // Migrar fichados → signings
    const fichados = Array.isArray(raw.fichados) ? raw.fichados : [];
    const insertSigning = db.prepare(`
      INSERT INTO signings (user_id, team_id, team_nombre, role, haxball_nick, performed_by, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const f of fichados) {
      insertSigning.run(
        f.user_id, f.team_id, f.team_nombre || null, f.role || 'PLAYER',
        f.haxball_nick || null, f.performed_by || null, f.timestamp || new Date().toISOString()
      );
    }

    // Migrar bajas → releases
    const bajas = Array.isArray(raw.bajas) ? raw.bajas : [];
    const insertRelease = db.prepare(`
      INSERT INTO releases (user_id, team_id, team_nombre, role, motivo, haxball_nick, performed_by, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const b of bajas) {
      const motivo = ['RELEASED', 'RESIGNED', 'LEFT_SERVER', 'TEAM_DELETED'].includes(b.motivo)
        ? b.motivo
        : 'RELEASED';
      insertRelease.run(
        b.user_id, b.team_id, b.team_nombre || null, b.role || null,
        motivo, b.haxball_nick || null, b.performed_by || null,
        b.timestamp || new Date().toISOString()
      );
    }
  });

  try {
    transaction();
    console.log('[DB] ✅ Migración completada exitosamente.');

    // Renombrar el archivo JSON para que no se vuelva a migrar
    const backupPath = FICHAJES_PATH.replace('.json', '.json.bak');
    fs.renameSync(FICHAJES_PATH, backupPath);
    console.log(`[DB] Archivo original renombrado a ${path.basename(backupPath)}`);
  } catch (err) {
    console.error('[DB] ❌ Error durante la migración:', err);
  }
}

// ─── Cerrar base de datos ───────────────────────────────────────────────────

function cerrarDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = {
  getDb,
  migrarDesdeJson,
  cerrarDb,
  // Members
  obtenerPlantillaDb,
  obtenerMiembroDb,
  registrarMiembroDb,
  quitarMiembroDb,
  asignarSubDtDb,
  quitarSubDtDb,
  eliminarMiembrosEquipoDb,
  // Proposals
  crearPropuestaDb,
  obtenerPropuestaDb,
  actualizarPropuestaDb,
  // History
  registrarFichajeDb,
  registrarBajaDb,
};
