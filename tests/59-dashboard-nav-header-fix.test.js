/**
 * Regression test — Issue: opening the Dashboard (Übersicht) from the
 * Protokoll view left "Protokoll" highlighted green in the bottom nav bar
 * at the same time as "Übersicht", and the dashboard sheet's own header
 * did not show the "Agrar-Rechner" branding present on the other views.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Dashboard nav-bar + header fix', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
  });

  it('only "Übersicht" is active in the nav bar when the dashboard is opened from Rechner', () => {
    w.openDashboard();
    expect(doc.getElementById('nav_uebersicht').classList.contains('active')).toBe(true);
    expect(doc.getElementById('nav_rechner').classList.contains('active')).toBe(false);
    expect(doc.getElementById('nav_protokoll').classList.contains('active')).toBe(false);
  });

  it('only "Übersicht" is active in the nav bar when the dashboard is opened from Protokoll', () => {
    w.switchToProtokoll();
    expect(doc.getElementById('nav_protokoll').classList.contains('active')).toBe(true);

    w.openDashboard();
    expect(doc.getElementById('nav_uebersicht').classList.contains('active')).toBe(true);
    expect(doc.getElementById('nav_protokoll').classList.contains('active')).toBe(false);
    expect(doc.getElementById('nav_rechner').classList.contains('active')).toBe(false);
  });

  it('closing the dashboard restores the Protokoll highlight', () => {
    w.switchToProtokoll();
    w.openDashboard();
    w.closeDashboard();
    expect(doc.getElementById('nav_protokoll').classList.contains('active')).toBe(true);
    expect(doc.getElementById('nav_uebersicht').classList.contains('active')).toBe(false);
  });

  it('dashboard header shows the Agrar-Rechner branding like the other views', () => {
    const dashboardHeader = doc.querySelector('.dashboard-header');
    expect(dashboardHeader.textContent).toContain('Agrar-Rechner');
  });
});
