"use strict";

/* =========================================================
   Account page — the GDPR surface of the app.
   ---------------------------------------------------------
   Three jobs, all of them from the same principle: the data a
   service holds about you should be visible to you and
   deletable by you, not by an email to support.

     1. SHOW   — identity + every personal best (/api/scores/me)
     2. EXPORT — the same data as JSON, one click
     3. ERASE  — DELETE /api/me, which removes the scores AND
                 the Cognito identity (the email)

   The guard is UX only: the API verifies the token on every
   call, so hiding this page proves nothing and is not meant to.
   ========================================================= */

(function () {
    const auth = window.GameHubAuth;
    const notice = document.getElementById("auth-notice");
    const content = document.getElementById("account-content");
    const scoresBody = document.getElementById("scores-body");
    const scoresStatus = document.getElementById("scores-status");

    // No pool configured (local development): say so, don't pretend.
    if (!auth || !auth.configured()) {
        if (notice) notice.hidden = false;
        return;
    }

    // Sends the browser to sign-in when there is no valid session.
    auth.requireAuthGuard();

    const session = auth.getSession();
    if (!session) return; // the guard is already redirecting

    if (content) content.hidden = false;

    const email = session.email || session.claims.email || "(no email claim)";
    const sub = session.claims.sub || "(no sub claim)";
    document.getElementById("account-email").textContent = email;
    document.getElementById("account-sub").textContent = sub;

    // --- 1. show the stored data ---------------------------------------
    let latestScores = { count: 0, scores: [] };

    async function loadScores() {
        try {
            const response = await auth.apiFetch("/api/scores/me");
            if (!response.ok) {
                scoresStatus.textContent =
                    `Could not load scores (HTTP ${response.status}).`;
                return;
            }
            latestScores = await response.json();

            if (latestScores.count === 0) {
                scoresStatus.textContent =
                    "No scores stored yet — play a game and your best lands here.";
                return;
            }

            scoresBody.innerHTML = "";
            for (const row of latestScores.scores) {
                const tr = document.createElement("tr");
                const updated = row.updated_at
                    ? String(row.updated_at).slice(0, 10)
                    : "—";
                for (const text of [row.game, String(row.score), updated]) {
                    const td = document.createElement("td");
                    // textContent, never innerHTML: game names come from the
                    // database, and escaping is the browser's job, not ours.
                    td.textContent = text;
                    tr.appendChild(td);
                }
                scoresBody.appendChild(tr);
            }
        } catch (_error) {
            scoresStatus.textContent =
                "Could not reach the API. Are you offline?";
        }
    }

    loadScores();

    // --- 2. export ------------------------------------------------------
    const copyButton = document.getElementById("copy-data-button");
    if (copyButton) {
        copyButton.addEventListener("click", async () => {
            const payload = JSON.stringify({
                exported_at: new Date().toISOString(),
                email,
                player_identifier: sub,
                personal_bests: latestScores.scores
            }, null, 2);

            try {
                await navigator.clipboard.writeText(payload);
                copyButton.textContent = "COPIED";
            } catch (_error) {
                // Clipboard blocked (older browser, no permission): show
                // the data the user asked for instead of failing silently.
                window.prompt("Your GameHub data:", payload);
            }
            setTimeout(() => { copyButton.textContent = "COPY AS JSON"; }, 2000);
        });
    }

    // --- 3. erasure -----------------------------------------------------
    const form = document.getElementById("delete-form");
    const confirmField = document.getElementById("delete-confirm");
    const deleteButton = document.getElementById("delete-button");
    const errorBox = document.getElementById("delete-error");
    const doneBox = document.getElementById("delete-done");

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
    }

    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            errorBox.hidden = true;

            if (confirmField.value.trim().toUpperCase() !== "DELETE") {
                showError('Type DELETE in the box to confirm.');
                return;
            }

            deleteButton.disabled = true;
            deleteButton.textContent = "DELETING…";

            try {
                const response = await auth.apiFetch("/api/me", {
                    method: "DELETE"
                });

                if (response.status === 204) {
                    // Gone. Clear the local session and be unambiguous
                    // about it — the account no longer exists.
                    auth.signOut();
                    form.hidden = true;
                    if (doneBox) doneBox.hidden = false;
                    document.getElementById("account-content").hidden = true;
                    return;
                }

                const body = await response.json().catch(() => ({}));
                showError(body.error ||
                    `Deletion failed (HTTP ${response.status}).`);
            } catch (_error) {
                showError("Could not reach the API — nothing was deleted.");
            }

            deleteButton.disabled = false;
            deleteButton.textContent = "DELETE MY ACCOUNT";
        });
    }

    // The nav button on this page is the sign-out control.
    const navButton = document.getElementById("account-nav-button");
    if (navButton) {
        navButton.textContent = `SIGN OUT (${auth.currentUser()})`;
        navButton.addEventListener("click", auth.signOut);
    }
})();
