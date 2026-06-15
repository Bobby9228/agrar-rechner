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
                // Modul-globals (Phase 3 — in js und tests sichtbar)
                APP_VERSION: "readonly",
                APP_BUILD_DATE: "readonly",
                UPDATE_CHANGELOG: "readonly",
                isIOS: "writable",
                isStandalone: "writable",
                _pendingKey: "writable",
            },
        },
        rules: {
            // === Empfehlungen aus dem Plan ===

            // Strikte Gleichheit
            eqeqeq: ["error", "always", { null: "ignore" }],

            // Variablen-Deklaration — pragmativ off, da bestehender Code
            // überwiegend `var` ohne `const` einsetzt (Issue #233).
            "no-var": "off",
            "prefer-const": "off",

            // Tote Code-Pfade
            "no-unused-vars": "off",

            // Debug-Code
            "no-console": "off",      // Legacy-Code nutzt console.* stark
            "no-debugger": "error",
            "no-alert": "off",        // Legacy-Code nutzt alert() in UI-Flows

            // Sauberkeit
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-with": "error",
            // === Pragmatische Off-Regeln (Issue #233) ===
            // Legacy-Code enthält absichtliche leere Block-Statements
            // (z. B. No-op-Catch-Handler) — Regel deaktiviert.
            "no-empty": "off",
            // Legacy-Code weist Variablen zu, die in bestimmten Branches
            // ungenutzt bleiben (frühe Returns, bewusste Re-Assigments) —
            // Regel deaktiviert.
            "no-useless-assignment": "off",
            "no-multi-spaces": "off",
            "no-trailing-spaces": "off",
            "eol-last": "off",

            // === Pragmatische Ausnahmen (Issue #233) ===
            // Bestehender Code verwendet Single-Quotes sehr uneinheitlich —
            // Regel deaktiviert (Warnung würde tausende Treffer produzieren).
            quotes: "off",
            // Bestehender Code verwendet überwiegend keine Semikolons —
            // Regel deaktiviert (Warnung würde tausende Treffer produzieren).
            semi: "off",

            // Legacy-Code oft ohne Curly bei single-statement ifs — deaktiviert
            curly: "off",

            // === Pragmatische Off-Regeln (Issue #233) ===
            // Bestehender Code referenziert implizite Modul-Globals (z. B.
            // `state`), die in legacy-Dateien nicht importiert werden — diese
            // Regel war der Hauptverursacher der 348 Errors.
            //
            // Re-enabled per-file für `tests/` und `public/js/`. Tests
            // verwenden bereits ESM `import`, public/js/ migriert nach
            // ADR-001 (Issue #278) auf das AppGlobals-Namespace-Objekt —
            // beide profitieren also von `no-undef` ohne Refactor-Aufwand.
            // Stand 2026-06-15 (fix #278): 0 Errors in beiden Trees.
            // "no-undef": "off",
            // Bestehender Code deklariert Schleifen-Variablen in
            // aufeinanderfolgenden Blöcken mehrfach — typisches Legacy-Pattern.
            "no-redeclare": "off",
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
            // Re-enabled no-undef für Tests: sie verwenden ESM `import`,
            // also profitieren sie von der Regel ohne Refactor. 0 Errors
            // verifiziert (Stand: 2026-06-08, t_ddd81e3a). public/js/*
            // bekommt eine eigene Override-Section weiter unten (ADR-001,
            // Issue #278).
            "no-undef": ["error", { typeof: true }],
        },
    },

    // public/js/* Override (ADR-001, Issue #278): AppGlobals-Namespace ist
    // der neue Single-Entry-Point. Konsumenten greifen über
    // `AppGlobals.state.foo()` zu statt über den impliziten globalen
    // `state`. `typeof`-Checks bleiben erlaubt (für defensive Initial-
    // Checks à la `typeof AppGlobals.X === 'function'`). 0 Errors verifiziert
    // nach Migration der Cross-File-Calls auf `AppGlobals.X`.
    {
        files: ["public/js/**/*.js"],
        languageOptions: {
            globals: {
                AppGlobals: "readonly",
            },
        },
        rules: {
            "no-undef": ["error", { typeof: true }],
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
