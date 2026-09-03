import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function getMigrations() {
  const files = (await readdir(__dirname))
    .filter((f) => f.endsWith(".js") && f !== "index.js")
    .sort();

  const migrations = [];
  for (const file of files) {
    const mod = await import(join(__dirname, file));
    migrations.push(mod.default);
  }

  return migrations;
}

export async function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      appliedAt TEXT
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT name FROM _migrations")
      .all()
      .map((r) => r.name)
  );

  const migrations = await getMigrations();

  const insert = db.prepare(
    "INSERT INTO _migrations (name, appliedAt) VALUES (?, ?)"
  );

  const apply = db.transaction((pending) => {
    for (const migration of pending) {
      migration.up(db);
      insert.run(migration.name, new Date().toISOString());
    }
  });

  const pending = migrations.filter((m) => !applied.has(m.name));
  if (pending.length > 0) {
    apply(pending);
  }
}
