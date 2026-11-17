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

const DATA_VERSION = 2;

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
  // Version 2: Name der Hundeschule vorbelegen (vorher nur "Hundeschule")
  if (from < 2 && (!state.settings.businessName || state.settings.businessName === 'Hundeschule')) {
    state.settings = { ...state.settings, businessName: DEFAULT_SETTINGS.businessName };
    await db.write(['meta'], (s) => s.meta.put({ key: 'settings', value: state.settings }));
  }
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

export function bookingCount(categoryId) {
  return state.bookings.filter((b) => b.categoryId === categoryId).length;
}

function replaceInState(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
}

/** Neue oder geänderte Kategorie speichern */
export async function saveCategory(input) {
  const existing = input.id ? categoryById(input.id) : null;
  const sameType = state.categories.filter((c) => c.type === input.type);
  const cat = {
    key: null,
    euer: '',
    mileage: false,
    ...existing,
    ...input,
    id: existing?.id || uid('cat'),
    order: existing ? existing.order : Math.max(-1, ...sameType.map((c) => c.order)) + 1,
    updatedAt: nowISO(),
  };
  await db.write(['categories'], (s) => s.categories.put(cat));
  replaceInState(state.categories, cat);
  emitChange();
  return cat;
}

/** Kategorie in der Reihenfolge nach oben (-1) oder unten (+1) schieben */
export async function moveCategory(id, direction) {
  const cat = categoryById(id);
  if (!cat) return;
  const list = categoriesFor(cat.type);
  const i = list.findIndex((c) => c.id === id);
  const j = i + direction;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const now = nowISO();
  const changed = [];
  list.forEach((c, idx) => { if (c.order !== idx) changed.push({ ...c, order: idx, updatedAt: now }); });
  await db.write(['categories'], (s) => { for (const c of changed) s.categories.put(c); });
  for (const c of changed) replaceInState(state.categories, c);
  emitChange();
}

/** Kategorie löschen; vorhandene Buchungen wandern in moveToId */
export async function deleteCategory(id, moveToId = null) {
  const now = nowISO();
  const moved = state.bookings
    .filter((b) => b.categoryId === id)
    .map((b) => ({ ...b, categoryId: moveToId, updatedAt: now }));
  if (moved.length && !categoryById(moveToId)) throw new Error('Bitte eine Kategorie wählen, in die die Buchungen verschoben werden.');
  await db.write(['categories', 'bookings', 'tombstones'], (s) => {
    s.categories.delete(id);
    s.tombstones.put({ id, kind: 'category', deletedAt: now });
    for (const b of moved) s.bookings.put(b);
  });
  state.categories = state.categories.filter((c) => c.id !== id);
  for (const b of moved) replaceInState(state.bookings, b);
  emitChange();
  return moved.length;
}

// ---------- Umsatz (für die Kleinunternehmergrenze) ----------

/** Umsatz eines Jahres: von Hand eingetragen, sonst Summe der Einnahmen in der App */
export function revenueFor(year) {
  const manual = state.settings.manualRevenue?.[String(year)];
  if (Number.isSafeInteger(manual)) return { cents: manual, manual: true };
  const cents = state.bookings
    .filter((b) => b.type === 'income' && b.date.startsWith(String(year)))
    .reduce((sum, b) => sum + b.amountCents, 0);
  return { cents, manual: false };
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

/** silent: Bildschirm nicht neu aufbauen (z. B. beim Tippen in den Einstellungen) */
export async function updateSettings(patch, { silent = false } = {}) {
  state.settings = { ...state.settings, ...patch, updatedAt: nowISO() };
  await db.write(['meta'], (s) => s.meta.put({ key: 'settings', value: state.settings }));
  if (!silent) emitChange();
}

/** Nur für dieses Gerät (wird nicht ins Backup übernommen) */
export async function updateLocal(patch, { silent = false } = {}) {
  state.local = { ...state.local, ...patch };
  await db.write(['meta'], (s) => s.meta.put({ key: 'local', value: state.local }));
  if (!silent) emitChange();
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
