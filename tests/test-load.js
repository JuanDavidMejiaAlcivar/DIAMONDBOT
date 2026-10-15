/**
 * Script de prueba para verificar que todos los módulos cargan correctamente
 * después de la migración a SQLite y la reestructuración del código.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let ok = 0, fail = 0, warns = 0;

// 1. Probar utils
console.log('=== UTILS ===');
const utils = ['db', 'database', 'permissions', 'rosterCommands', 'teamService', 'emojiService', 'ticketSystem', 'logger', 'antiraid', 'warnings', 'state', 'errorEmbeds'];
for (const u of utils) {
  try {
    require(path.join(ROOT, 'utils', u));
    console.log(`  ✅ utils/${u}.js`);
    ok++;
  } catch (e) {
    console.error(`  ❌ utils/${u}.js: ${e.message}`);
    fail++;
  }
}

// 2. Probar handlers
console.log('\n=== HANDLERS ===');
const handlers = ['buttonHandler', 'modalHandler', 'safeReply'];
for (const h of handlers) {
  try {
    require(path.join(ROOT, 'handlers', h));
    console.log(`  ✅ handlers/${h}.js`);
    ok++;
  } catch (e) {
    console.error(`  ❌ handlers/${h}.js: ${e.message}`);
    fail++;
  }
}

// 3. Probar comandos
console.log('\n=== COMMANDS ===');
const commandsDir = path.join(ROOT, 'commands');
const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  try {
    const cmd = require(path.join(commandsDir, file));
    if (cmd.data && cmd.execute) {
      console.log(`  ✅ ${file} -> /${cmd.data.name}`);
      ok++;
    } else {
      console.warn(`  ⚠️  ${file}: no exporta {data, execute}`);
      warns++;
    }
  } catch (e) {
    console.error(`  ❌ ${file}: ${e.message}`);
    fail++;
  }
}

// 4. Probar que SQLite funciona
console.log('\n=== SQLITE ===');
try {
  const sqlite = require(path.join(ROOT, 'utils', 'database'));
  const db = sqlite.getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(`  ✅ Tablas: ${tables.map(t => t.name).join(', ')}`);
  ok++;
} catch (e) {
  console.error(`  ❌ SQLite: ${e.message}`);
  fail++;
}

// Resumen
console.log(`\n=== RESUMEN ===`);
console.log(`  ✅ ${ok} OK`);
if (warns > 0) console.log(`  ⚠️  ${warns} advertencias`);
if (fail > 0) console.log(`  ❌ ${fail} fallos`);
else console.log('  🎉 Todo cargó correctamente');

process.exit(fail > 0 ? 1 : 0);
