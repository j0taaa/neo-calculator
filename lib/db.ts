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

db.exec(`
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
