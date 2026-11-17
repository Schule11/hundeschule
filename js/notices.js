// Hinweise auf der Übersicht: Kleinunternehmergrenze und Backup-Erinnerung.

import { state, revenueFor } from './data.js';
import { formatMoney } from './format.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Stand bei der Kleinunternehmergrenze (§ 19 UStG, Grenzen aus den Einstellungen):
 * - Umsatz im Vorjahr höchstens limitPrevYear (Standard 25.000 €)
 * - Umsatz im laufenden Jahr höchstens limitCurrentYear (Standard 100.000 €);
 *   wird diese Grenze überschritten, entfällt die Regelung sofort.
 * - Liegt der Umsatz dieses Jahres über limitPrevYear, gilt sie im nächsten Jahr nicht mehr.
 */
export function smallBusinessStatus(today = new Date()) {
  const s = state.settings;
  const year = today.getFullYear();
  const current = revenueFor(year);
  const previous = revenueFor(year - 1);
  const warnAt = (s.warnPercent || 80) / 100;
  const lp = s.limitPrevYearCents;
  const lc = s.limitCurrentYearCents;
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const notices = [];

  if (previous.cents > lp) {
    notices.push({
      level: 'alert',
      title: `Umsatz ${year - 1} über ${formatMoney(lp)}`,
      text: `Dein Umsatz ${year - 1} lag bei ${formatMoney(previous.cents)}. Damit giltst du ${year} voraussichtlich nicht mehr als `
        + 'Kleinunternehmer. Bitte mit Steuerberatung oder Finanzamt klären.',
    });
  }

  if (current.cents > lc) {
    notices.push({
      level: 'alert',
      title: `Umsatz ${year} über ${formatMoney(lc)}`,
      text: 'Ab dem Umsatz, mit dem diese Grenze überschritten wurde, gilt die Kleinunternehmerregelung nicht mehr. '
        + 'Bitte umgehend mit Steuerberatung klären.',
    });
  } else if (current.cents >= lc * warnAt) {
    notices.push({
      level: 'warn',
      title: `Umsatz nähert sich ${formatMoney(lc)}`,
      text: `${year} bisher ${formatMoney(current.cents)} (${pct(current.cents, lc)} %). Wird diese Grenze im laufenden Jahr `
        + 'überschritten, entfällt die Kleinunternehmerregelung sofort.',
      percent: pct(current.cents, lc),
    });
  }

  if (current.cents > lp) {
    notices.push({
      level: 'warn',
      title: `Umsatz ${year} über ${formatMoney(lp)}`,
      text: `${year} bisher ${formatMoney(current.cents)}. Damit bist du ab ${year + 1} voraussichtlich kein Kleinunternehmer mehr. `
        + 'Plane das rechtzeitig mit deiner Steuerberatung.',
    });
  } else if (current.cents >= lp * warnAt) {
    notices.push({
      level: 'warn',
      title: 'Umsatz nähert sich der Kleinunternehmergrenze',
      text: `${year} bisher ${formatMoney(current.cents)} – das sind ${pct(current.cents, lp)} % von ${formatMoney(lp)}. `
        + `Liegt der Umsatz am Jahresende darüber, bist du ab ${year + 1} kein Kleinunternehmer mehr.`,
      percent: pct(current.cents, lp),
    });
  }

  return {
    year,
    current,
    previous,
    percentOfPrevLimit: pct(current.cents, lp),
    percentOfCurrentLimit: pct(current.cents, lc),
    notices: notices.slice(0, 2),
  };
}

/** Ist ein Backup fällig? Gibt null oder { last, ageDays } zurück. */
export function backupDue(now = Date.now()) {
  const days = state.settings.backupReminderDays;
  if (!days || !state.bookings.length) return null;
  const { lastBackupAt: last, bookingsAtLastBackup, backupSnoozeUntil } = state.local;
  if (backupSnoozeUntil && Date.parse(backupSnoozeUntil) > now) return null;

  const changed = !last
    || state.bookings.length !== bookingsAtLastBackup
    || state.bookings.some((b) => b.updatedAt > last);
  if (!changed) return null;

  // Ohne bisheriges Backup: Erinnerung eine Woche nach der ersten Buchung
  const reference = last || state.bookings.reduce((min, b) => (b.createdAt < min ? b.createdAt : min), state.bookings[0].createdAt);
  const ageDays = Math.floor((now - Date.parse(reference)) / DAY);
  if (ageDays < (last ? days : Math.min(7, days))) return null;
  return { last, ageDays };
}

export function snoozeUntil(days, now = Date.now()) {
  return new Date(now + days * DAY).toISOString();
}
