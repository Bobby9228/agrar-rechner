// ============================================================================
// CULTURE — Globale Kultur-Auswahl (Mais / Raps / Sonstiges)
//
// Die Kultur bestimmt den globalen Standard für die Einheitsgröße
// (Körner pro Einheit) und den Empfehlungstext unter dem Körner/ha-Feld.
// Sie ist persistent in `state.kultur`, gilt für die gesamte Arbeit
// und ist NICHT pro Feld.
//
// Reihenfolge: wird NACH state.js, VOR calculations.js/ui-handlers.js geladen
// (siehe index.html). Stellt nur Daten + pure Helper bereit — keine
// State-Mutation, keine DOM-Logik.
// ============================================================================

// Profile (Single Source of Truth für Kultur-Defaults).
//   key:                 interner Schlüssel (state.kultur)
//   label:               Anzeigename in der UI (Header-Badge, Modal-Button)
//   emoji:               Icon für Badge / Modal
//   defaultKoernerProEinheit: 0 = "noch keine Größe, User-Eingabe nötig"
//   empfehlung:          Text unter "Körner pro Hektar"; null = keine Zahl
var CULTURE_PROFILES = {
  mais: {
    key: 'mais',
    label: 'Mais',
    emoji: '🌽',
    defaultKoernerProEinheit: 50000,
    empfehlung: 'üblich: 80.000 – 100.000'
  },
  raps: {
    key: 'raps',
    label: 'Raps',
    emoji: '🌼',
    defaultKoernerProEinheit: 1500000,
    empfehlung: 'üblich: 250.000 – 350.000'
  },
  sonstiges: {
    key: 'sonstiges',
    label: 'Sonstiges',
    emoji: '🌱',
    defaultKoernerProEinheit: 0,
    empfehlung: null
  }
};

// Whitelist valider Kultur-Keys — alles andere (z.B. aus Cross-Tab-Sync
// oder manipuliertem localStorage) wird auf null normalisiert.
var VALID_CULTURE_KEYS = ['mais', 'raps', 'sonstiges'];

function getCultureProfile(key) {
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(CULTURE_PROFILES, key)) {
    return CULTURE_PROFILES[key];
  }
  return null;
}

function getCultureLabel(key) {
  var p = getCultureProfile(key);
  return p ? p.label : '';
}

function getCultureEmoji(key) {
  var p = getCultureProfile(key);
  return p ? p.emoji : '';
}

function getDefaultKoernerProEinheit(key) {
  var p = getCultureProfile(key);
  return p ? p.defaultKoernerProEinheit : 0;
}

function getCultureEmpfehlung(key) {
  var p = getCultureProfile(key);
  return p ? p.empfehlung : null;
}

function isValidCultureKey(key) {
  return VALID_CULTURE_KEYS.indexOf(key) !== -1;
}

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  CULTURE_PROFILES: CULTURE_PROFILES,
  getCultureProfile: getCultureProfile,
  getCultureLabel: getCultureLabel,
  getCultureEmoji: getCultureEmoji,
  getDefaultKoernerProEinheit: getDefaultKoernerProEinheit,
  getCultureEmpfehlung: getCultureEmpfehlung,
  isValidCultureKey: isValidCultureKey
});