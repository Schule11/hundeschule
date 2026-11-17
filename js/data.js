// Daten der App: Alles wird beim Start in den Arbeitsspeicher geladen
// (das sind auch nach Jahren nur ein paar tausend Einträge) und bei jeder
// Änderung sofort in die Datenbank auf dem Gerät geschrieben.
// Nur die Belegfotos bleiben in der Datenbank und werden bei Bedarf geladen.

import * as db from './db.js';
import { DEFAULT_SETTINGS, defaultCategoryRecords } from './defaults.js';

/**
 * Buchung:
 * {
 *   id, type: 'income'|'expense', date: 'JJJJ-MM-TT' (Tag der Zahlung),
 *   amountCents: Integer, categoryId, description,
 *   payment: 'cash'|'transfer'|'paypal'|null,
 *   receiptId: ID des Belegfotos oder null,
 *   km: Zahl oder null, kmRateCents: Integer oder null   (nur Fahrtkosten),
 *   createdAt, updatedAt
 * }
 */
export const state = {
  bookings: [],
  categories: [],
  settings: { ...DEFAULT_SETTINGS },
  local: {}, // nur für dieses Gerät (z. B. Zeitpunkt des letzten Backups)
};

// ---------- Benachrichtigung bei Änderungen ----------

const listeners = new Set();

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitChange() {
  for (const fn of listeners) {
    try { fn(); } catch (err) { console.error(err); }
  }
}

// ---------- Hilfsfunktionen ----------

export function uid(prefix) {
  let hex;
  if (crypto.randomUUID) {
    hex = crypto.randomUUID().replace(/-/g, '');
  } else {
    hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
  }
  return `${prefix}-${hex}`;
}

export const nowISO = () => new Date().toISOString();

// ---------- Laden ----------

const DATA_VERSION = 1;

export async function load() {
  let [bookings, categories, meta] = await Promise.all([
    db.getAll('bookings'),
    db.getAll('categories'),
    db.getAll('meta'),
  ]);
  const m = Object.fromEntries(meta.map((x) => [x.key, x.value]));

  if (categories.length === 0) {
    categories = defaultCategoryRecords();
    await db.write(['categories'], (s) => { for (const c of categories) s.categories.put(c); });
  }

  state.bookings = bookings;
  state.categories = categories;
  state.settings = { ...DEFAULT_SETTINGS, ...(m.settings || {}) };
  state.local = m.local || {};

  await migrate(m.dataVersion || 0);
}

/** Datenanpassungen für neue App-Versionen laufen hier genau einmal. */
async function migrate(from) {
  if (from >= DATA_VERSION) return;
  // Version 1: Ausgangszustand – nichts umzubauen.
  await db.write(['meta'], (s) => s.meta.put({ key: 'dataVersion', value: DATA_VERSION }));
}

// ---------- Kategorien ----------

export function categoryById(id) {
  return state.categories.find((c) => c.id === id) || null;
}

export function categoryName(id) {
  return categoryById(id)?.name || 'Ohne Kategorie';
}

/**
 * Kategorien eines Typs. Mit recentFirst stehen die zuletzt benutzten
 * (höchstens 4) vorne, der Rest bleibt in der gewohnten Reihenfolge.
 */
export function categoriesFor(type, { recentFirst = false } = {}) {
  const cats = state.categories
    .filter((c) => c.type === type)
    .sort((a, b) => a.order - b.order);
  if (!recentFirst) return cats;

  const lastUsed = new Map();
  for (const b of state.bookings) {
    if (b.type !== type) continue;
    const prev = lastUsed.get(b.categoryId);
    if (!prev || prev < b.createdAt) lastUsed.set(b.categoryId, b.createdAt);
  }
  const recent = cats
    .filter((c) => lastUsed.has(c.id))
    .sort((a, b) => (lastUsed.get(b.id) > lastUsed.get(a.id) ? 1 : -1))
    .slice(0, 4);
  const rest = cats.filter((c) => !recent.includes(c));
  return [...recent, ...rest];
}

// ---------- Buchungen ----------

/** Neueste zuerst (nach Datum, bei gleichem Datum nach Erfassungszeit) */
export function sortBookings(list) {
  return list.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.createdAt < b.createdAt ? 1 : -1));
}

/** Summen einer Liste: { income, expense, profit } in Cent */
export function sumBookings(list) {
  let income = 0;
  let expense = 0;
  for (const b of list) {
    if (b.type === 'income') income += b.amountCents;
    else expense += b.amountCents;
  }
  return { income, expense, profit: income - expense };
}

export function bookingYears() {
  const years = new Set(state.bookings.map((b) => Number(b.date.slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

/**
 * Speichert eine neue oder geänderte Buchung.
 * receiptChange: { add: { data, type, width, height } } | { remove: true } | null
 */
export async function saveBooking(input, receiptChange = null) {
  const existing = input.id ? state.bookings.find((b) => b.id === input.id) : null;
  const now = nowISO();
  const booking = {
    km: null,
    kmRateCents: null,
    receiptId: null,
    ...existing,
    ...input,
    id: existing?.id || uid('b'),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  let newReceipt = null;
  let oldReceiptId = null;
  if (receiptChange?.add) {
    newReceipt = { ...receiptChange.add, id: uid('r'), createdAt: now };
    oldReceiptId = existing?.receiptId || null;
    booking.receiptId = newReceipt.id;
  } else if (receiptChange?.remove) {
    oldReceiptId = existing?.receiptId || null;
    booking.receiptId = null;
  }

  await db.write(['bookings', 'receipts', 'tombstones'], (s) => {
    s.bookings.put(booking);
    if (newReceipt) s.receipts.put(newReceipt);
    if (oldReceiptId) {
      s.receipts.delete(oldReceiptId);
      s.tombstones.put({ id: oldReceiptId, kind: 'receipt', deletedAt: now });
    }
  });

  const i = state.bookings.findIndex((b) => b.id === booking.id);
  if (i >= 0) state.bookings[i] = booking;
  else state.bookings.push(booking);

  requestPersistentStorage();
  emitChange();
  return booking;
}

export async function deleteBooking(id) {
  const existing = state.bookings.find((b) => b.id === id);
  if (!existing) return;
  const now = nowISO();
  await db.write(['bookings', 'receipts', 'tombstones'], (s) => {
    s.bookings.delete(id);
    s.tombstones.put({ id, kind: 'booking', deletedAt: now });
    if (existing.receiptId) {
      s.receipts.delete(existing.receiptId);
      s.tombstones.put({ id: existing.receiptId, kind: 'receipt', deletedAt: now });
    }
  });
  state.bookings = state.bookings.filter((b) => b.id !== id);
  emitChange();
}

// ---------- Belegfotos ----------

export function getReceipt(id) {
  return db.get('receipts', id);
}

export function receiptToBlob(receipt) {
  return new Blob([receipt.data], { type: receipt.type || 'image/jpeg' });
}

// ---------- Einstellungen ----------

export async function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch, updatedAt: nowISO() };
  await db.write(['meta'], (s) => s.meta.put({ key: 'settings', value: state.settings }));
  emitChange();
}

/** Nur für dieses Gerät (wird nicht ins Backup übernommen) */
export async function updateLocal(patch) {
  state.local = { ...state.local, ...patch };
  await db.write(['meta'], (s) => s.meta.put({ key: 'local', value: state.local }));
  emitChange();
}

// ---------- Dauerhafter Speicher ----------

let persistAsked = false;

/** Bittet den Browser, die Daten nicht von selbst zu löschen. */
export function requestPersistentStorage() {
  if (persistAsked || !navigator.storage?.persist) return;
  persistAsked = true;
  navigator.storage.persist().catch(() => {});
}

export async function storageIsPersistent() {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    return null;
  }
}
