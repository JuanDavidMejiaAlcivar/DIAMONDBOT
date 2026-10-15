const db = require('../utils/database');
const d = db.getDb();

console.log('=== SQLite Schema ===');
const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite%'").all();
for (const t of tables) {
  console.log(`\nTable: ${t.name}`);
  const info = d.prepare(`PRAGMA table_info(${t.name})`).all();
  info.forEach(c => console.log(`  - ${c.name} ${c.type} ${c.notnull ? 'NOT NULL' : ''} ${c.pk ? 'PK' : ''}`));
  const cnt = d.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get();
  console.log(`  (${cnt.c} registros)`);
}
