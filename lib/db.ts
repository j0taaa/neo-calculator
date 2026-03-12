import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { Database } from "bun:sqlite";

const dataDir = join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const sqlitePath = join(dataDir, "app.sqlite");

export const db = new Database(sqlitePath);

db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 10000;");

function hasColumn(tableName: string, columnName: string) {
  const columns = db.query<{ name: string }, []>(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

function ensureColumn(tableName: string, columnName: string, definition: string) {
  if (hasColumn(tableName, columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL,
    image TEXT,
    createdAt DATE NOT NULL,
    updatedAt DATE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expiresAt DATE NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt DATE NOT NULL,
    updatedAt DATE NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt DATE,
    refreshTokenExpiresAt DATE,
    scope TEXT,
    password TEXT,
    createdAt DATE NOT NULL,
    updatedAt DATE NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt DATE NOT NULL,
    createdAt DATE NOT NULL,
    updatedAt DATE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS project_list (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    huawei_cart_key TEXT,
    huawei_cart_name TEXT,
    huawei_last_synced_at TEXT,
    huawei_last_error TEXT,
    huawei_last_remote_updated_at INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS list_product (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    service_code TEXT NOT NULL,
    service_name TEXT NOT NULL,
    product_type TEXT NOT NULL,
    title TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    config_json TEXT NOT NULL,
    pricing_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (list_id) REFERENCES project_list(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ecs_catalog_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ecs_catalog_region (
    region_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ecs_flavor (
    region_id TEXT NOT NULL,
    resource_spec_code TEXT NOT NULL,
    family TEXT,
    architecture TEXT,
    series TEXT,
    description TEXT,
    cpu INTEGER NOT NULL,
    ram_gib REAL NOT NULL,
    flavor_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (region_id, resource_spec_code),
    FOREIGN KEY (region_id) REFERENCES ecs_catalog_region(region_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ecs_flavor_price (
    region_id TEXT NOT NULL,
    resource_spec_code TEXT NOT NULL,
    billing_mode TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    source TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (region_id, resource_spec_code, billing_mode),
    FOREIGN KEY (region_id, resource_spec_code) REFERENCES ecs_flavor(region_id, resource_spec_code) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS session_userId_idx ON session (userId);
  CREATE INDEX IF NOT EXISTS account_userId_idx ON account (userId);
  CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification (identifier);
`);

ensureColumn("project_list", "huawei_cart_key", "TEXT");
ensureColumn("project_list", "huawei_cart_name", "TEXT");
ensureColumn("project_list", "huawei_last_synced_at", "TEXT");
ensureColumn("project_list", "huawei_last_error", "TEXT");
ensureColumn("project_list", "huawei_last_remote_updated_at", "INTEGER");

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS project_list_user_huawei_cart_key_unique
  ON project_list (user_id, huawei_cart_key)
  WHERE huawei_cart_key IS NOT NULL;
`);
