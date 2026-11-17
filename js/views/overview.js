// Bildschirm "Übersicht": aktueller Monat, gewähltes Jahr, zuletzt erfasst.

import { h, mount } from '../ui.js';
import { isIOS, isStandalone } from '../ui.js';
import { state, sumBookings, bookingYears, updateLocal } from '../data.js';
import { smallBusinessStatus, backupDue, snoozeUntil } from '../notices.js';
import { doExport } from './settings.js';
import { MONTHS, todayISO } from '../format.js';
import { bookingRow, statBlock, yearSelect } from './components.js';

let selectedYear = new Date().getFullYear();

export function render(root) {
  const today = todayISO();
  const ym = today.slice(0, 7);
  const monthName = `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

  const monthSums = sumBookings(state.bookings.filter((b) => b.date.startsWith(ym)));

  const years = bookingYears();
  if (!years.includes(selectedYear)) selectedYear = years[0];
  const yearSums = sumBookings(state.bookings.filter((b) => b.date.startsWith(String(selectedYear))));

  const recent = [...state.bookings]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5);

  mount(root,
    h('h1', { class: 'page-title' }, 'Übersicht'),
    installHint(),
    limitNotices(),
    backupNotice(),

    h('section', { class: 'card', 'aria-label': 'Aktueller Monat' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, monthName)),
      statBlock(monthSums)),

    h('section', { class: 'card', 'aria-label': 'Jahr' },
      h('div', { class: 'card-head' },
        h('h2', { class: 'card-title' }, 'Jahr'),
        h('div', { style: 'width: 130px' },
          yearSelect(years, selectedYear, (v) => { selectedYear = Number(v); rerender(root); }))),
      statBlock(yearSums)),

    h('h2', { class: 'section-title' }, 'Zuletzt erfasst'),
    recent.length
      ? [h('div', { class: 'rows' }, recent.map(bookingRow)),
        h('p', { style: 'text-align:center; margin: 8px 0 0' }, h('a', { href: '#/buchungen', class: 'btn-text', style: 'display:inline-block' }, 'Alle Buchungen'))]
      : h('div', { class: 'empty' },
        h('strong', null, 'Noch nichts erfasst'),
        'Tippe unten rechts auf +, um die erste Buchung einzutragen.'),
  );
}

function rerender(root) {
  root.replaceChildren();
  render(root);
}

/** Dezenter Hinweis, wenn sich der Umsatz der Kleinunternehmergrenze nähert */
function limitNotices() {
  return smallBusinessStatus().notices.map((n) => h('div', { class: `notice${n.level === 'alert' ? ' alert' : ''}` },
    h('strong', null, n.title),
    h('p', null, n.text),
    h('a', { href: '#/einstellungen', class: 'btn-text', style: 'display:inline-block' }, 'Grenzen in den Einstellungen')));
}

/** Erinnerung an ein Backup */
function backupNotice() {
  const due = backupDue();
  if (!due) return null;
  const btn = h('button', { type: 'button', class: 'btn primary', onclick: () => doExport(btn) }, 'Backup erstellen');
  return h('div', { class: 'notice' },
    h('strong', null, 'Zeit für ein Backup'),
    h('p', null, due.last
      ? `Dein letztes Backup ist ${due.ageDays} Tage alt und seitdem hat sich etwas geändert.`
      : 'Du hast noch kein Backup gemacht. Sichere deine Daten, damit nichts verloren geht.'),
    h('div', { class: 'notice-actions' },
      btn,
      h('button', { type: 'button', class: 'btn-text', onclick: () => updateLocal({ backupSnoozeUntil: snoozeUntil(3) }) }, 'Später')));
}

/** Auf dem iPhone im Safari-Tab: Hinweis, die App zum Home-Bildschirm hinzuzufügen. */
function installHint() {
  if (!isIOS() || isStandalone() || state.local.installHintDismissed) return null;
  return h('div', { class: 'notice' },
    h('strong', null, 'Als App installieren'),
    h('p', null, 'Tippe in Safari auf das Teilen-Symbol (Quadrat mit Pfeil, ggf. erst auf „•••“) und dann auf „Zum Home-Bildschirm“.'),
    h('p', null, 'Wichtig: Die installierte App hat ihren eigenen Speicher. Trage deine Buchungen nur dort ein – nicht hier im Safari-Tab.'),
    h('button', { type: 'button', class: 'btn-text', onclick: () => updateLocal({ installHintDismissed: true }) }, 'Verstanden'));
}
