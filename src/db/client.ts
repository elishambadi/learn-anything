import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL ?? "./data/learn.db";

function resolveDatabaseFile(url: string): string {
  const withoutScheme = url.replace(/^file:/, "");
  if (withoutScheme === ":memory:") return ":memory:";
  const resolved = path.resolve(process.cwd(), withoutScheme);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

type Db = ReturnType<typeof drizzle<typeof schema>>;
type DbBundle = {
  sqlite: Database.Database;
  db: Db;
  migrated: boolean;
};

const globalForDb = globalThis as unknown as { __learnAnythingDb?: DbBundle };

function createBundle(): DbBundle {
  const file = resolveDatabaseFile(DATABASE_URL);
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  return { sqlite, db, migrated: false };
}

function getBundle(): DbBundle {
  if (!globalForDb.__learnAnythingDb) {
    globalForDb.__learnAnythingDb = createBundle();
  }
  const bundle = globalForDb.__learnAnythingDb;
  if (!bundle.migrated) {
    migrate(bundle.db, {
      migrationsFolder: path.join(process.cwd(), "src/db/migrations"),
    });
    bundle.migrated = true;
  }
  return bundle;
}

/**
 * Open SQLite lazily. Importing a route handler during `next build` must not
 * create or migrate the database; several build workers would race for the
 * same file and fail with SQLITE_BUSY.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, property) {
    const bundle = getBundle();
    const value = Reflect.get(bundle.db, property, bundle.db);
    return typeof value === "function" ? value.bind(bundle.db) : value;
  },
  has(_target, property) {
    return Reflect.has(getBundle().db, property);
  },
});

/** Test helper: drop the process-level cache so a new DATABASE_URL is honoured. */
export function resetDbForTests(): void {
  const existing = globalForDb.__learnAnythingDb;
  if (existing) existing.sqlite.close();
  globalForDb.__learnAnythingDb = undefined;
}
