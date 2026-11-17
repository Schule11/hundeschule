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
    euer: '',              // Zeile der Anlage EÜR (wird in Schritt 2 vorbelegt)
    mileage: !!c.mileage,  // Fahrtkosten: Betrag = km × Pauschale (Schritt 3)
    order: i,
    updatedAt: EPOCH,
  }));
}

// Alle Geldbeträge in Cent (ganze Zahlen).
export const DEFAULT_SETTINGS = {
  businessName: 'Hundeschule',
  kmRateCents: 30,                 // 0,30 € pro gefahrenem Kilometer
  limitPrevYearCents: 2500000,     // 25.000 € Umsatz im Vorjahr
  limitCurrentYearCents: 10000000, // 100.000 € Umsatz im laufenden Jahr
  warnPercent: 80,                 // Hinweis ab 80 % der Grenze
  prevYearRevenueCents: null,      // Vorjahresumsatz von Hand, falls nicht in der App
  backupReminderDays: 30,
  theme: 'system',                 // 'system' | 'light' | 'dark'
  updatedAt: EPOCH,
};

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Bar' },
  { value: 'transfer', label: 'Überweisung' },
  { value: 'paypal', label: 'PayPal' },
];

export function paymentLabel(value) {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label || '';
}
