# AGENTS.md — Working Agreement for agrar-rechner

Repository-level guidance for AI agents and human contributors. If anything here
conflicts with `README.md`, the README wins for user-facing docs; this file
wins for engineering workflow.

## 1. Load Order

Read these files in this order before making changes:

1. `README.md` — project overview, features, usage
2. `IDEAS.md` — roadmap / open ideas (do not start work on items in here
   without checking they're not already done or out of scope for the current
   milestone)
3. `eslint.config.js` — lint rules (4-space indent, no semicolons absent, ESM)
4. `vitest.config.js` — test setup (jsdom env, Node test runner via `vitest`)
5. `wrangler.jsonc` — deploy target (Cloudflare Pages, `./public` assets)
6. `.github/workflows/*.yml` — CI behaviour (test + deploy on `dev`)

Do **not** read `node_modules/`, `pnpm-lock.yaml` (treat as generated), or
`.local/` (untracked scratch).

## 2. Test Command

```bash
pnpm test          # one-shot, CI-equivalent
pnpm test:watch    # local watch mode
pnpm lint          # eslint over public/js/ and tests/
```

`pnpm` is the only supported package manager. Do not introduce `npm`,
`yarn`, or `bun` workflows. If you see a `package-lock.json`, it is a
bug — see §6.

## 3. Deploy Flow

- **Hosting:** Cloudflare Pages (project `agrar-rechner-dev`)
- **Trigger:** push to `dev` branch (and PRs targeting `dev`)
- **Concurrency:** `ci-${{ github.ref }}` group, in-progress runs are
  cancelled on new push
- **Steps (CI workflow `ci.yml` / `deploy.yml`):** checkout →
  setup-node@v4 (Node 22) → pnpm/action-setup@v4 (pnpm 9) →
  `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm test`
- **Deploy step is intentionally absent.** Deployment is handled by the
  Cloudflare Dashboard Git integration (Workers Builds for
  `agrar-rechner-dev`), which builds and deploys on every push to `dev`.
  The previous `cloudflare/wrangler-action@v3 pages deploy public/`
  step was removed because it failed with "Authentication error
  [code: 10000]" — the `CLOUDFLARE_API_TOKEN` secret lacked
  `Account:Read` scope. Since the Dashboard integration already
  deploys successfully, the GitHub Actions deploy step was redundant.
- **Branch model:** feature branches → PR into `dev` → merge to `dev`
  triggers deploy (via Cloudflare Dashboard) → periodic sync `dev` →
  `master`

`master` is the stable public mirror; do not push feature work there
directly.

## 4. Conventions

- **Commit messages:** Conventional Commits
  (`feat:`, `fix:`, `refactor:`, `chore:`, `dx:`, etc.). Reference the
  GitHub issue: `refactor(#209): CSS variables for colors`.
- **Node version:** 22.x (pinned via `.nvmrc`, enforced by CI).
- **Package manager:** `pnpm` only. Commit `pnpm-lock.yaml`, never
  `package-lock.json`.
- **Indentation:** 4 spaces, LF line endings, UTF-8, final newline
  (enforced by `.editorconfig` and `.gitattributes`).
- **Code style:** ESLint config in repo; run `pnpm lint` before
  committing JS changes.
- **Tests:** colocate in `tests/`, use `vitest` + `jsdom`; one
  `describe` per module under test.
- **No build step.** This is a static PWA — edit files in `public/`
  directly. Do not introduce a bundler.

## 5. Out of scope

- Adding a build system (Webpack, Vite, esbuild) — explicitly rejected
  to keep the PWA dependency-free at runtime.
- Adding a Node server / API — site is fully static.
- Tracking users / analytics — no telemetry, no cookies beyond
  what the browser does natively.
- Rewriting in TypeScript — intentional JS-only for transparency.

## 6. Red flags — stop and ask

- A `package-lock.json` appears in `git status`.
- A PR touches `wrangler.jsonc` or `.github/workflows/`.
- A new runtime dependency is proposed (anything in `dependencies`,
  not `devDependencies`).
- A change to `public/sw.js` (service worker) — caching rules need
  human review.
- A migration of `public/js/*.js` away from the split-module layout
  established in #212.
