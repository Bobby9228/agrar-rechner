// ESLint flat config — agrar-rechner
// Phase 2: baseline. Empfohlene Rules aus dem Refactor-Plan.
// Ziel: gemeinsamer Style ohne große Brüche. Severity-Empfehlungen:
//   - "error"   : harte Regel, sollte erfüllt sein
//   - "warn"    : Hinweis, in Baseline dokumentieren und schrittweise fixen
//   - "off"     : deaktiviert (Begründung jeweils dokumentiert)

import js from "@eslint/js";

export default [
    // Basisregeln (Recommended)
    js.configs.recommended,

    // Projektregeln
    {
        files: ["public/js/**/*.js", "tests/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "module",
            globals: {
                // Browser
                window: "readonly",
                document: "readonly",
                console: "readonly",
                alert: "readonly",
                confirm: "readonly",
                prompt: "readonly",
                localStorage: "readonly",
                sessionStorage: "readonly",
                navigator: "readonly",
                location: "readonly",
                history: "readonly",
                fetch: "readonly",
                URL: "readonly",
                URLSearchParams: "readonly",
                FormData: "readonly",
                Blob: "readonly",
                File: "readonly",
                FileReader: "readonly",
                atob: "readonly",
                btoa: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                requestAnimationFrame: "readonly",
                cancelAnimationFrame: "readonly",
                event: "readonly",
                DOMParser: "readonly",
                Element: "readonly",
                HTMLElement: "readonly",
                HTMLInputElement: "readonly",
                Event: "readonly",
                CustomEvent: "readonly",
                ResizeObserver: "readonly",
                IntersectionObserver: "readonly",
                MutationObserver: "readonly",
                getComputedStyle: "readonly",
                // Node / Test
                process: "readonly",
                global: "readonly",
                globalThis: "readonly",
            },
        },
        rules: {
            // === Empfehlungen aus dem Plan ===

            // Strikte Gleichheit
            eqeqeq: ["error", "always", { null: "ignore" }],

            // Variablen-Deklaration
            "no-var": "error",
            "prefer-const": "error",

            // Tote Code-Pfade
            "no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],

            // Debug-Code
            "no-console": "warn",      // console.log im Prod-Code markieren
            "no-debugger": "error",
            "no-alert": "warn",

            // Sauberkeit
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-with": "error",
            "no-multi-spaces": ["warn", { ignoreEOLComments: true }],
            "no-trailing-spaces": "warn",
            "eol-last": ["warn", "always"],

            // === Pragmatische Ausnahmen ===
            // Bestehender Code verwendet Single-Quotes sehr uneinheitlich —
            // wir warnen nur, brechen aber nicht.
            quotes: ["warn", "double", { avoidEscape: true, allowTemplateLiterals: true }],
            semi: ["warn", "always"],

            // Legacy-Code oft ohne Curly bei single-statement ifs — nur warnen
            curly: ["warn", "multi-line"],

            // Magic-Numbers / max-len bewusst NICHT aktivieren:
            // bestehende Dateien würden sonst hunderte Warnings produzieren,
            // die nicht zum Refactor-Ziel beitragen.
            "no-magic-numbers": "off",
            "max-len": "off",
        },
    },

    // Test-Konfiguration: lockerer — Tests dürfen console.log etc.
    {
        files: ["tests/**/*.js", "test_*.mjs"],
        rules: {
            "no-console": "off",
            "no-unused-vars": "off", // helper-Importe können ungenutzt sein
        },
    },

    // Ignoriere Build-Artefakte
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "build/**",
            ".wrangler/**",
            "coverage/**",
        ],
    },
];
