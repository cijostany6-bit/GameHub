"use strict";

// =========================================================
// Express application (exported for tests).
// The HTTP listener lives in server.js so tests can mount
// this app on an ephemeral port without side effects.
// =========================================================

const express = require("express");
const cors = require("cors");
const { pool, ping } = require("./db");

const app = express();

app.disable("x-powered-by");

// Same-origin via the nginx proxy means CORS rarely applies,
// but lock it down to explicit origins instead of wildcard.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:8080")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "100kb" }));

// Structured access log: one JSON object per line — ready for
// the observability stack in Phase 3.
app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        console.log(JSON.stringify({
            ts: new Date().toISOString(),
            level: "info",
            msg: "request",
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration_ms: Number(durationMs.toFixed(1))
        }));
    });
    next();
});

// ---------------------------------------------------------
// Liveness — is the process up? NEVER touches the database,
// so a DB outage does not make the container look "dead"
// and get restarted in a crash loop.
// ---------------------------------------------------------
app.get("/api/health", (req, res) => {
    res.json({
        status: "healthy",
        service: "gamehub-backend",
        timestamp: new Date().toISOString()
    });
});

// ---------------------------------------------------------
// Readiness — can we actually serve traffic? This is the
// endpoint the orchestrator should gate routing on.
// ---------------------------------------------------------
app.get("/api/ready", async (req, res) => {
    try {
        await ping();
        res.json({
            status: "ready",
            service: "gamehub-backend",
            database: "up",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(JSON.stringify({
            ts: new Date().toISOString(),
            level: "error",
            msg: "readiness_probe_failed",
            error_code: error.code || "UNKNOWN"
        }));
        res.status(503).json({
            status: "not_ready",
            service: "gamehub-backend",
            database: "down",
            timestamp: new Date().toISOString()
        });
    }
});

// ---------------------------------------------------------
// Games catalogue
// ---------------------------------------------------------
app.get("/api/games", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, name, category, description FROM games ORDER BY id"
        );
        res.json(rows);
    } catch (error) {
        // Full detail goes to the log; clients get a generic body.
        console.error(JSON.stringify({
            ts: new Date().toISOString(),
            level: "error",
            msg: "games_query_failed",
            error_code: error.code || "UNKNOWN"
        }));
        res.status(500).json({ error: "Failed to retrieve games" });
    }
});

// ---------------------------------------------------------
// 404 + central error handler — internals never leak.
// ---------------------------------------------------------
app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});

// Body-parser failures (malformed JSON) are client errors.
app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed") {
        res.status(400).json({ error: "Invalid JSON body" });
        return;
    }
    next(error);
});

app.use((error, req, res, _next) => {
    console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        msg: "unhandled_error",
        error_message: error.message
    }));
    res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
