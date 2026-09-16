require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// RDS configuration
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    }
};

// Health check
app.get("/api/health", async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);

        await connection.execute("SELECT 1");

        await connection.end();

        res.json({
            status: "healthy",
            service: "GameHub backend",
            database: "RDS connected",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Database connection error:", error.message);

        res.status(500).json({
            status: "unhealthy",
            service: "GameHub backend",
            database: "RDS connection failed",
            error: error.message
        });
    }
});

// Get games from RDS
app.get("/api/games", async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);

        const [rows] = await connection.execute(
            "SELECT id, name, category, description FROM games"
        );

        await connection.end();

        res.json(rows);

    } catch (error) {
        console.error("Database error:", error.message);

        res.status(500).json({
            error: "Failed to retrieve games",
            details: error.message
        });
    }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`GameHub backend running on port ${PORT}`);
});