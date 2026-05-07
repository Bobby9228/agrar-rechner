Fixed in commit `6d53d80` on `dev`.

**What was done:**
`loadState()` now validates the parsed state structure immediately after `JSON.parse()`. Previously it only caught `JSON.parse` exceptions — valid JSON payloads like `{}`, `[]`, `{reiter:[]}`, or `{reiter:null}` silently replaced `state` with something broken, and `getActiveReiter()` crashed on `state.reiter[0]`.

The guard checks:
- `parsed` must be a non-null plain object (rejects arrays, null, primitives)
- `reiter` must be a non-empty array when present
- Old flat-format state (undefined `reiter`, but `koerner` present) still passes through to the migration chain

**Tests added** (`tests/07-state-persistence.test.js`):
- `{}` → default state
- `[]` → default state
- `{reiter:[]}` → default state
- `{reiter:null}` → default state

All 625 tests pass.
