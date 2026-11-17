// Bildschirm "Übersicht": aktueller Monat, gewähltes Jahr, zuletzt erfasst.

import { h, mount } from '../ui.js';
import { isIOS, isStandalone } from '../ui.js';
import { state, sumBookings, bookingYears, updateLocal } from '../data.js';
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

/** Auf dem iPhone im Safari-Tab: Hinweis, die App zum Home-Bildschirm hinzuzufügen. */
function installHint() {
  if (!isIOS() || isStandalone() || state.local.installHintDismissed) return null;
  return h('div', { class: 'notice' },
    h('strong', null, 'Als App installieren'),
    h('p', null, 'Tippe in Safari auf das Teilen-Symbol (Quadrat mit Pfeil, ggf. erst auf „•••“) und dann auf „Zum Home-Bildschirm“.'),
    h('p', null, 'Wichtig: Die installierte App hat ihren eigenen Speicher. Trage deine Buchungen nur dort ein – nicht hier im Safari-Tab.'),
    h('button', { type: 'button', class: 'btn-text', onclick: () => updateLocal({ installHintDismissed: true }) }, 'Verstanden'));
}
