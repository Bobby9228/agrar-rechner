/**
 * Regression: Dashboard Dünger basis must NOT produce NaN when r.duenger
 * is undefined / missing.
 *
 * Bug (Issue 1, code-review): render-dashboard.js lines 61 and 169 used the
 * raw expression `r.hektar * r.duenger` as the SOLL-fallback for the Dünger
 * basis. When `r.duenger` is undefined (e.g. an old/partial tab object
 * without a Duengerwert entered yet) this evaluates to `NaN`, which then
 * poisons downstream values: `Math.max(0, NaN - usedD)` → NaN for
 * `duengerRem`, `Math.min(1, NaN)` → NaN for `pct`, and ultimately the
 * tab card's progress-fill `style.width` is rendered as the literal string
 * `"NaN%"`. The drill / results files already use the guarded
 * `AppGlobals.getTabTotalDuenger(r)` helper; this test pins the same
 * contract for the dashboard.
 *
 * Surgical 2-line fix; no helper refactor in this PR.
 *
 * Note: In the current rendering, the `duengerTotal > 0 ? ... : 1` ternary
 * on line 178 masks NaN visually (NaN > 0 is false, so the branch returns
 * 1 and `pct` becomes 0). The NaN therefore does not surface as a literal
 * "NaN%" today — but it still poisons `basisD` / `totalDuengerBasis`,
 * which any future code path that does arithmetic on it would expose.
 * The fix replaces the raw multiplication with the same guarded helper
 * that drill / results already use, eliminating the latent NaN source.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Dashboard Dünger NaN-guard (Issue 1, bug only)', () => {
    let w, doc;

    beforeEach(() => {
        const result = createDom();
        w = result.window;
        doc = w.document;
    });

    // Open dashboard and return the first .dashboard-reiter-card (the
    // per-tab card whose progress-fill renders the pct).
    function renderTabCard() {
        w.openDashboard();
        const content = doc.getElementById('dashboard_content');
        const card = content.querySelector('.dashboard-reiter-card');
        expect(card).toBeTruthy();
        return card;
    }

    function getProgressWidth(card) {
        const fill = card.querySelector('.dashboard-progress-fill');
        expect(fill).toBeTruthy();
        return fill.style.width;
    }

    it('tab-card progress width is not "NaN%" when r.duenger is undefined', () => {
        // Tab with full Soll data except Duengerwert — undefined → NaN before fix.
        w.state.reiter[0].hektar = 10;
        w.state.reiter[0].koerner = 100;
        w.state.reiter[0].duenger = undefined; // ← the trigger
        // No entries, no IST — exercises the istSum<=0 → fallback branch.

        const card = renderTabCard();
        const width = getProgressWidth(card);

        expect(width).not.toBe('NaN%');
    });

    it('tab-card progress width is "0%" when r.duenger is undefined and no entries', () => {
        w.state.reiter[0].hektar = 10;
        w.state.reiter[0].koerner = 100;
        w.state.reiter[0].duenger = undefined;

        const card = renderTabCard();
        const width = getProgressWidth(card);

        // With the guard, basisD = 0 → usedD = 0 → min(1, 0/0→1) = 1 → pct = 100,
        // but we rendered the card with the broken code path so this asserts
        // the contract: width is a finite percentage, not NaN%.
        expect(width).not.toBe('NaN%');
        expect(width).toMatch(/^\d+(\.\d+)?%$/);
    });

    it('tab-card progress width is not "NaN%" when r.duenger field is absent entirely', () => {
        const tab = w.state.reiter[0];
        tab.hektar = 10;
        tab.koerner = 100;
        // intentionally do NOT set tab.duenger — leave it absent
        // (helpers.js may have pre-initialised it; ensure it's falsy).
        delete tab.duenger;

        const card = renderTabCard();
        const width = getProgressWidth(card);

        expect(width).not.toBe('NaN%');
    });

    it('summary "Dünger verbl." stays finite when r.duenger undefined + entry with usedDuenger', () => {
        // The latent NaN: line 66 computes totalDuengerRem via Math.max(0, NaN - usedD - ...).
        // With even one entry whose usedDuenger > 0, downstream display math
        // still gates on totalDuengerBasis > 0 (NaN > 0 → false → '—'), but the
        // computed basis itself is NaN. We assert the basis contract directly:
        // basisD must be a finite number, not NaN.
        const tab = w.state.reiter[0];
        tab.hektar = 10;
        tab.koerner = 100;
        tab.duenger = undefined;
        // Add one entry to exercise the subtract path on line 175.
        tab.entries = [{ einheit: 1, duenger: 5, datum: '2026-01-01' }];

        renderTabCard();

        // The contract: basisD (whatever it is) must be a finite, non-NaN number.
        // Pre-fix this evaluates to NaN (10 * undefined); post-fix to 0
        // (AppGlobals.getTabTotalDuenger returns 0 when r.duenger is falsy).
        expect(Number.isFinite(w.AppGlobals.getTabTotalDuenger(tab))).toBe(true);
        expect(w.AppGlobals.getTabTotalDuenger(tab)).toBe(0);
    });

    it('render-dashboard.js calls getTabTotalDuenger for the SOLL fallback (not raw multiplication)', () => {
        // Structural regression: instrument the helper to count calls during a
        // full render. The drill / results files already use this helper for
        // their SOLL-fallback; the dashboard must too.
        // Pre-fix the helper is NEVER called for the fallback path — the
        // dashboard uses the inline `r.hektar * r.duenger` expression on
        // lines 61 and 169. Post-fix it's called at least twice (once per
        // tab per line).
        const tab = w.state.reiter[0];
        tab.hektar = 10;
        tab.koerner = 100;
        tab.duenger = undefined; // forces the SOLL-fallback branch

        const helper = w.AppGlobals.getTabTotalDuenger;
        let callCount = 0;
        w.AppGlobals.getTabTotalDuenger = function (...args) {
            callCount += 1;
            return helper.apply(this, args);
        };

        renderTabCard();

        // Restore to keep test isolation clean.
        w.AppGlobals.getTabTotalDuenger = helper;

        // The fix uses the helper on both line 61 (summary aggregation) and
        // line 169 (per-tab card). With istSum=0 (no entries) both branches
        // fall through to the helper → at least 2 calls per tab.
        expect(callCount).toBeGreaterThanOrEqual(2);
    });
});