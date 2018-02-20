CREATE TABLE IF NOT EXISTS "settings" (
    "name" TEXT  PRIMARY KEY,
    "value" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY,
    "username" TEXT NOT NULL,
    "authenticated" INTEGER NOT NULL DEFAULT 0,
    "details" TEXT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS "endpoints" (
    "id" TEXT PRIMARY KEY,
    "domain" TEXT NULL,
    "host" TEXT NULL,
    "name" TEXT NULL,
    "platform" TEXT NULL,
    "platformIcon" TEXT NULL,
    "browser" TEXT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS "user_endpoints" (
    "user_id" TEXT NOT NULL,
    "endpoint_id" TEXT NOT NULL,
    "createdDate" INTEGER NULL,
    "lastActive" INTEGER NULL,
    "details" TEXT NULL,
    PRIMARY KEY ("user_id", "endpoint_id"),
    CONSTRAINT "user_user_endpoints_fk"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "endpoint_user_endpoints_fk"
    FOREIGN KEY ("endpoint_id") REFERENCES "endpoints" ("id") ON DELETE CASCADE
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS "user_access_points" (
    "ip" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "endpoint_id" TEXT NOT NULL,
    "type" TEXT NULL,
    "first" INTEGER NULL,
    "active" INTEGER NULL,
    "count" INTEGER NULL,
    CONSTRAINT "user_user_access_points_fk"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "endpoint_user_access_points_fk"
    FOREIGN KEY ("endpoint_id") REFERENCES "endpoints" ("id") ON DELETE CASCADE
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS "roles" (
    "id" INTEGER PRIMARY KEY,
    "name" TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "disabled" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "user_user_roles_fk"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "role_user_roles_fk"
    FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "policies" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS "access_roles" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "policy_id" TEXT NOT NULL,
    "role_id" INTEGER NULL,
    "disabled" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "policy_access_rules_fk"
    FOREIGN KEY ("policy_id") REFERENCES "policies" ("id") ON DELETE CASCADE,
    CONSTRAINT "role_access_rules_fk"
    FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "access_endpoints" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "policy_id" TEXT NOT NULL,
    "endpoint_id" TEXT NULL,
    "white_listed" INTEGER NOT NULL DEFAULT 1,
    "disabled" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "policy_access_rules_fk"
    FOREIGN KEY ("policy_id") REFERENCES "policies" ("id") ON DELETE CASCADE,
    CONSTRAINT "endpoint_access_rules_fk"
    FOREIGN KEY ("endpoint_id") REFERENCES "endpoints" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "access_tokens" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "endpoint_id" TEXT NULL,
    "refresh_token" TEXT NULL,
    "encoding" TEXT NULL,
    "create_at" INTEGER NOT NULL,
    "expires_in" INTEGER NULL,
    "scope" TEXT NULL,
    "token_type" TEXT NULL,
    "access_token" TEXT NULL,
    CONSTRAINT "user_access_tokens_fk"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "endpoint_access_tokens_fk"
    FOREIGN KEY ("endpoint_id") REFERENCES "endpoints" ("id") ON DELETE CASCADE
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS "local_mdns_cache" (
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "create_date" INTEGER NOT NULL,
    "data" TEXT NULL,
    PRIMARY KEY ("name", "type")
) WITHOUT ROWID;

INSERT INTo "policies" ("id", "name") VALUES ('guest', 'guest');
INSERT INTo "policies" ("id", "name") VALUES ('default', 'default');
INSERT INTo "policies" ("id", "name") VALUES ('admin', 'admin');
INSERT INTo "roles" ("id", "name") VALUES (1, 'admin');
INSERT INTo "roles" ("id", "name") VALUES (2, 'operator');
INSERT INTo "roles" ("id", "name") VALUES (3, 'cast-access');
INSERT INTo "access_roles" ("policy_id", "role_id") VALUES ('admin', 1);
INSERT INTo "access_roles" ("policy_id", "role_id") VALUES ('default', 3);