"use strict";

/* =========================================================
   Runtime configuration for the static frontend.
   ---------------------------------------------------------
   Local development: authEnabled=false → sign-in is not
   enforced and the API is open (see backend boot warning).

   The deploy pipeline (Phase 4 CD) overwrites this file with
   real values after uploading to S3 — same artifact, real
   config, no rebuild:
       aws s3 cp frontend/config.js s3://<site>/config.js
   ========================================================= */

window.GAMEHUB_CONFIG = {
    authEnabled: false,
    region: "",
    userPoolId: "",
    clientId: "",
    apiBase: ""
};
