"use strict";

// Entrypoint: load optional local .env (ignored by Docker —
// compose injects environment variables directly), then listen.

require("dotenv").config();

const app = require("./app");

const port = Number(process.env.PORT || 3000);

app.listen(port, "0.0.0.0", () => {
    console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        msg: "server_started",
        port: port
    }));
});
