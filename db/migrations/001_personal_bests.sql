-- =========================================================
-- 001 — personal bests
--
-- Adds the one row per (player, game) table used for the
-- signed-in high scores and for the account-deletion flow.
--
-- Idempotent: safe to re-run, and it produces exactly the
-- same table db/init.sql creates for a fresh database.
-- =========================================================

CREATE TABLE IF NOT EXISTS personal_bests (
    user_sub   VARCHAR(64)  NOT NULL,
    game       VARCHAR(100) NOT NULL,
    score      INT UNSIGNED NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_sub, game),
    INDEX idx_personal_bests_game (game, score DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
