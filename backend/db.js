"use strict";

// =========================================================
// Database access — one shared POOL (not a connection per
// request). The pool bounds concurrent connections, reuses
// them, and survives individual connection drops.
// =========================================================

const mysql = require("mysql2/promise");

const dbConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    enableKeepAlive: true
};

// TLS: the local dev database runs on the private Docker
// network without TLS. DB_SSL=true enables TLS for managed
// databases (Phase 4 adds the RDS CA bundle here so the
// certificate chain is actually verified).
if (process.env.DB_SSL === "true") {
    dbConfig.ssl = { rejectUnauthorized: true };
}

const pool = mysql.createPool(dbConfig);

// Readiness probe helper — throws if the database is unreachable.
async function ping() {
    await pool.query("SELECT 1");
}

module.exports = { pool, ping };
