"use strict";

/* =========================================================
   GameHub auth — Cognito via the raw REST API.
   ---------------------------------------------------------
   No AWS SDK, no Amplify: the two calls that matter are
   InitiateAuth (USER_PASSWORD_AUTH) and SignUp/ConfirmSignUp,
   both plain JSON POSTs to the regional Cognito endpoint.

   Session model: the ID token lives in localStorage with its
   own expiry; the API verifies it server-side (backend/auth.js)
   — the frontend guard is UX, never the security boundary.

   When the pool is not configured (local dev) everything here
   degrades to a no-op so the app stays usable.
   ========================================================= */

(function () {
    const CONFIG = window.GAMEHUB_CONFIG || { authEnabled: false };
    const STORAGE_KEY = "gamehub.session";
    const TARGET_PREFIX = "AWSCognitoIdentityProviderService.";

    function configured() {
        return Boolean(
            CONFIG.authEnabled && CONFIG.region &&
            CONFIG.userPoolId && CONFIG.clientId
        );
    }

    function endpoint() {
        return `https://cognito-idp.${CONFIG.region}.amazonaws.com/`;
    }

    function decodeJwtPayload(token) {
        try {
            const part = token.split(".")[1];
            const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
            return JSON.parse(json);
        } catch (_error) {
            return null;
        }
    }

    function readSession() {
        try {
            return JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        } catch (_error) {
            return null;
        }
    }

    function saveSession(session) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        } catch (_error) {
            /* storage disabled — session lives only in memory below */
            memorySession = session;
        }
    }

    let memorySession = null;

    function clearSession() {
        memorySession = null;
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch (_error) {
            /* nothing to do */
        }
    }

    function getSession() {
        const session = readSession() || memorySession;
        if (!session || !session.idToken) return null;
        const payload = decodeJwtPayload(session.idToken);
        if (!payload || typeof payload.exp !== "number") return null;
        if (payload.exp * 1000 <= Date.now()) return null; // expired
        return { ...session, claims: payload };
    }

    function isAuthenticated() {
        return Boolean(getSession());
    }

    function currentUser() {
        const session = getSession();
        if (!session) return null;
        return session.email || session.claims.email ||
            session.claims["cognito:username"] || "player";
    }

    // --- Cognito REST -------------------------------------------------
    async function cognito(target, body) {
        const response = await window.fetch(endpoint(), {
            method: "POST",
            headers: {
                "Content-Type": "application/x-amz-json-1.1",
                "X-Amz-Target": TARGET_PREFIX + target
            },
            body: JSON.stringify(body)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = data.message || data.__type || "Request failed";
            throw new Error(String(message).split(":").pop().trim());
        }
        return data;
    }

    async function signUp(email, password) {
        return cognito("SignUp", {
            ClientId: CONFIG.clientId,
            Username: email,
            Password: password
        });
    }

    async function confirmSignUp(email, code) {
        return cognito("ConfirmSignUp", {
            ClientId: CONFIG.clientId,
            Username: email,
            ConfirmationCode: code
        });
    }

    async function signIn(email, password) {
        const data = await cognito("InitiateAuth", {
            AuthFlow: "USER_PASSWORD_AUTH",
            ClientId: CONFIG.clientId,
            AuthParameters: { USERNAME: email, PASSWORD: password }
        });

        const result = data.AuthenticationResult;
        if (!result || !result.IdToken) {
            throw new Error("Sign-in did not return a token");
        }

        const claims = decodeJwtPayload(result.IdToken) || {};
        saveSession({
            idToken: result.IdToken,
            accessToken: result.AccessToken || null,
            refreshToken: result.RefreshToken || null,
            email: claimEmail(claims) || email
        });
        return claims;
    }

    function claimEmail(claims) {
        return claims.email || claims["cognito:username"] || null;
    }

    function signOut() {
        clearSession();
        // replace(), not href: the back button must not return to a
        // page the visitor is no longer signed in for.
        window.location.replace("index.html");
    }

    // --- guards and API helper ---------------------------------------
    function requireAuthGuard() {
        if (!configured()) return; // local development
        if (isAuthenticated()) return;

        const next = encodeURIComponent(
            window.location.pathname.split("/").pop() +
            window.location.search
        );
        window.location.replace(`signin.html?next=${next}`);
    }

    // Attach the ID token to every API call when signed in.
    async function apiFetch(path, options = {}) {
        const headers = { ...(options.headers || {}) };
        const session = getSession();
        if (session) {
            headers.Authorization = `Bearer ${session.idToken}`;
        }
        return window.fetch(path, { ...options, headers });
    }

    // --- nav button: Join Arena → Sign in / Sign out ------------------
    function wireNav() {
        const button = document.querySelector(".nav-button");
        if (!button || !configured()) return;

        if (isAuthenticated()) {
            button.textContent = `SIGN OUT (${currentUser()})`;
            button.title = "Sign out of GameHub";
            button.addEventListener("click", signOut);
            addAccountLink();
        } else {
            button.textContent = "SIGN IN";
            button.addEventListener("click", () => {
                window.location.href = "signin.html";
            });
        }
    }

    // A signed-in player needs a way to reach the page that shows and
    // deletes their data (GDPR art. 15 and 17). Added here rather than in
    // five HTML files so it cannot drift out of sync with the session.
    function addAccountLink() {
        const nav = document.querySelector(".nav-links");
        if (!nav || nav.querySelector("[data-account-link]")) return;

        const link = document.createElement("a");
        link.href = "profile.html";
        link.textContent = "Account";
        link.setAttribute("data-account-link", "");
        nav.appendChild(link);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", wireNav);
    } else {
        wireNav();
    }

    window.GameHubAuth = {
        configured,
        isAuthenticated,
        currentUser,
        getSession,
        get idToken() {
            const session = getSession();
            return session ? session.idToken : null;
        },
        signUp,
        confirmSignUp,
        signIn,
        signOut,
        requireAuthGuard,
        apiFetch
    };

    // Convenience for page scripts (play.js, script.js).
    window.apiFetch = apiFetch;
})();
