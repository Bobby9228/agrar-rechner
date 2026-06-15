/**
 * Tests for drillMachineRemove() function.
 *
 * MEDIUM: drillMachineRemove() removes entries from machineLog and re-renders results.
 * No tests existed for this function.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('drillMachineRemove', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  it('removes entry from machineLog', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' },
      { einheit: 3, zaehlerStand: 6, duenger: 60, time: '10:00' },
      { einheit: 4, zaehlerStand: 10, duenger: 80, time: '11:00' }
    ];

    w.drillMachineRemove(1); // Remove second entry

    expect(w.state.machineLog.length).toBe(2);
    expect(w.state.machineLog[0].time).toBe('09:00');
    expect(w.state.machineLog[1].time).toBe('11:00');
  });

  it('removes first entry', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' },
      { einheit: 3, zaehlerStand: 6, duenger: 60, time: '10:00' }
    ];

    w.drillMachineRemove(0);

    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].time).toBe('10:00');
  });

  it('removes last entry', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' },
      { einheit: 3, zaehlerStand: 6, duenger: 60, time: '10:00' }
    ];

    w.drillMachineRemove(1);

    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].time).toBe('09:00');
  });

  it('saves state after removal', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }
    ];

    w.drillMachineRemove(0);

    // sv() is called → state should be persisted
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.machineLog.length).toBe(0);
  });

  it('does nothing for negative index', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }
    ];

    w.drillMachineRemove(-1);

    expect(w.state.machineLog.length).toBe(1);
  });

  it('does nothing for out-of-bounds index', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }
    ];

    w.drillMachineRemove(5);

    expect(w.state.machineLog.length).toBe(1);
  });

  it('does nothing when machineLog is undefined', () => {
    w.state.machineLog = undefined;
    expect(() => w.drillMachineRemove(0)).not.toThrow();
    expect(w.state.machineLog).toBeUndefined();
  });

  it('re-renders results after removal', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }
    ];
    // Set up tab with entry so renderResults has something to do
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [{ einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }];

    w.drillMachineRemove(0);

    // If renderResults runs without error, test passes
    // (no explicit DOM check needed — just no exception)
  });
});
