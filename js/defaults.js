// Vorbelegte Kategorien und Einstellungen.
//
// Die vorbelegten Kategorien haben feste IDs ("cat-<key>"). Dadurch entstehen
// beim Zusammenführen von Backups zweier Geräte keine doppelten Kategorien.

// Sehr alter Zeitstempel für vorbelegte Daten: Jede echte Änderung ist
// "neuer" und gewinnt beim Zusammenführen.
export const EPOCH = '1970-01-01T00:00:00.000Z';

export const DEFAULT_CATEGORIES = [
  // Einnahmen
  { key: 'einzeltraining', type: 'income', name: 'Einzeltraining' },
  { key: 'gruppenkurse', type: 'income', name: 'Gruppenkurse' },
  { key: 'welpenkurse', type: 'income', name: 'Welpenkurse' },
  { key: 'workshops', type: 'income', name: 'Workshops/Seminare' },
  { key: 'sonstiges-einnahmen', type: 'income', name: 'Sonstiges' },
  // Ausgaben
  { key: 'platzmiete', type: 'expense', name: 'Platzmiete' },
  { key: 'material', type: 'expense', name: 'Trainingsmaterial & Zubehör' },
  { key: 'leckerlis', type: 'expense', name: 'Leckerlis/Futter' },
  { key: 'versicherungen', type: 'expense', name: 'Versicherungen' },
  { key: 'fortbildung', type: 'expense', name: 'Fortbildung' },
  { key: 'werbung', type: 'expense', name: 'Werbung/Website' },
  { key: 'telefon', type: 'expense', name: 'Telefon & Internet' },
  { key: 'fahrtkosten', type: 'expense', name: 'Fahrtkosten', mileage: true },
  { key: 'buero', type: 'expense', name: 'Büromaterial' },
  { key: 'gebuehren', type: 'expense', name: 'Gebühren & Beiträge' },
  { key: 'sonstiges-ausgaben', type: 'expense', name: 'Sonstiges' },
];

export function defaultCategoryRecords() {
  return DEFAULT_CATEGORIES.map((c, i) => ({
    id: `cat-${c.key}`,
    key: c.key,
    type: c.type,
    name: c.name,
    euer: '',              // Posten der Anlage EÜR; leer = Standard (siehe euerPostenFor)
    mileage: !!c.mileage,  // Fahrtkosten: Betrag = km × Pauschale (Schritt 3)
    order: i,
    updatedAt: EPOCH,
  }));
}

// Alle Geldbeträge in Cent (ganze Zahlen).
export const DEFAULT_SETTINGS = {
  businessName: 'Hundeschule Marburg',
  kmRateCents: 30,                 // 0,30 € pro gefahrenem Kilometer
  limitPrevYearCents: 2500000,     // 25.000 € Umsatz im Vorjahr
  limitCurrentYearCents: 10000000, // 100.000 € Umsatz im laufenden Jahr
  warnPercent: 80,                 // Hinweis ab 80 % der Grenze
  manualRevenue: {},               // Umsatz von Hand je Jahr, z. B. { "2025": 1200000 }
  backupReminderDays: 30,          // 0 = keine Erinnerung
  updatedAt: EPOCH,
};

// ---------- Anlage EÜR ----------
//
// Bezeichnungen der Posten in der Anlage EÜR, in der Reihenfolge des Formulars.
// Bewusst ohne Zeilennummern: Die ändern sich fast jedes Jahr, die Bezeichnungen
// bleiben. Bitte vor der Abgabe mit dem aktuellen Formular abgleichen.

export const EUER_INCOME = 'Betriebseinnahmen als umsatzsteuerlicher Kleinunternehmer';
export const EUER_OTHER_EXPENSES = 'Übrige unbeschränkt abziehbare Betriebsausgaben';

export const EUER_POSTEN = [
  { type: 'income', name: EUER_INCOME },
  { type: 'expense', name: 'Waren, Roh- und Hilfsstoffe einschließlich der Nebenkosten' },
  { type: 'expense', name: 'Bezogene Fremdleistungen' },
  { type: 'expense', name: 'Aufwendungen für geringwertige Wirtschaftsgüter' },
  { type: 'expense', name: 'Miete/Pacht für Geschäftsräume und betrieblich genutzte Grundstücke' },
  { type: 'expense', name: 'Aufwendungen für Telekommunikation (z. B. Telefon, Internet)' },
  { type: 'expense', name: 'Übernachtungs- und Reisenebenkosten bei Geschäftsreisen' },
  { type: 'expense', name: 'Fortbildungskosten (ohne Reisekosten)' },
  { type: 'expense', name: 'Beiträge, Gebühren, Abgaben und Versicherungen (ohne solche für Gebäude und Kfz)' },
  { type: 'expense', name: 'Werbekosten (z. B. Inserate, Werbespots, Plakate)' },
  { type: 'expense', name: 'Fahrtkosten für nicht betriebliche Fahrzeuge (Nutzungseinlage)' },
  { type: 'expense', name: EUER_OTHER_EXPENSES },
];

// Vorschlag je vorbelegter Kategorie (änderbar in den Einstellungen, Schritt 3)
const EUER_DEFAULTS = {
  platzmiete: 'Miete/Pacht für Geschäftsräume und betrieblich genutzte Grundstücke',
  versicherungen: 'Beiträge, Gebühren, Abgaben und Versicherungen (ohne solche für Gebäude und Kfz)',
  gebuehren: 'Beiträge, Gebühren, Abgaben und Versicherungen (ohne solche für Gebäude und Kfz)',
  fortbildung: 'Fortbildungskosten (ohne Reisekosten)',
  werbung: 'Werbekosten (z. B. Inserate, Werbespots, Plakate)',
  telefon: 'Aufwendungen für Telekommunikation (z. B. Telefon, Internet)',
  fahrtkosten: 'Fahrtkosten für nicht betriebliche Fahrzeuge (Nutzungseinlage)',
};

/** EÜR-Posten einer Kategorie: eigene Angabe, sonst Vorschlag, sonst Sammelposten */
export function euerPostenFor(category) {
  if (!category) return 'Nicht zugeordnet';
  if (category.euer) return category.euer;
  if (category.type === 'income') return EUER_INCOME;
  return EUER_DEFAULTS[category.key] || EUER_OTHER_EXPENSES;
}

export function euerOrder(name) {
  const i = EUER_POSTEN.findIndex((p) => p.name === name);
  return i < 0 ? 999 : i;
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Bar' },
  { value: 'transfer', label: 'Überweisung' },
  { value: 'paypal', label: 'PayPal' },
];

export function paymentLabel(value) {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label || '';
}
