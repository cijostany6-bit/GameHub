"use strict";

const js = require("@eslint/js");

module.exports = [
    {
        ignores: ["node_modules/**"]
    },
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "commonjs",
            ecmaVersion: 2023,
            globals: {
                process: "readonly",
                console: "readonly",
                require: "readonly",
                module: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                fetch: "readonly",
                URL: "readonly",
                Buffer: "readonly"
            }
        },
        rules: {
            "no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
            ],
            "no-console": "off"
        }
    }
];
