// Bildschirm "Buchungen": Liste nach Monaten, mit Suche und Filtern.

import { h, mount } from '../ui.js';
import { state, categoriesFor, categoryName, sortBookings, sumBookings, bookingYears, contactById, contactLabel } from '../data.js';
import { paymentLabel } from '../defaults.js';
import { formatSigned, formatDate, centsToInput, monthLabel, normalizeText } from '../format.js';
import { bookingRow, yearSelect } from './components.js';

// Filter bleiben erhalten, solange die App offen ist
const filters = {
  year: String(new Date().getFullYear()),
  type: 'all',
  category: 'all',
  person: null, // nur Buchungen einer Kund:in (aus Auswertung/Kundenliste)
  q: '',
};

/** Liste mit Filter öffnen (z. B. aus der Auswertung: "alle Buchungen dieser Kategorie") */
export function showBookings({ year = 'all', type = 'all', category = 'all', person = null } = {}) {
  Object.assign(filters, { year, type, category, person, q: '' });
  location.hash = '#/buchungen';
}

export function render(root) {
  const results = h('div', { 'aria-live': 'polite' });

  const search = h('input', {
    class: 'field field-search',
    type: 'search',
    placeholder: 'Suchen …',
    'aria-label': 'Buchungen durchsuchen',
    enterkeyhint: 'search',
    autocomplete: 'off',
    value: filters.q,
    oninput: (e) => { filters.q = e.target.value; renderResults(); },
    onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
  });

  const years = bookingYears();
  if (filters.year !== 'all' && !years.includes(Number(filters.year))) filters.year = String(years[0]);
  const yearSel = yearSelect(years, filters.year, (v) => { filters.year = v; renderResults(); }, { withAll: true });

  const typeSel = h('select', {
    class: 'field',
    'aria-label': 'Art',
    onchange: (e) => {
      filters.type = e.target.value;
      if (filters.category !== 'all' && !matchesCategoryType(filters.category)) filters.category = 'all';
      fillCategories();
      renderResults();
    },
  },
  h('option', { value: 'all' }, 'Alle'),
  h('option', { value: 'income' }, 'Einnahmen'),
  h('option', { value: 'expense' }, 'Ausgaben'));
  typeSel.value = filters.type;

  const catSel = h('select', {
    class: 'field',
    'aria-label': 'Kategorie',
    onchange: (e) => { filters.category = e.target.value; renderResults(); },
  });

  function matchesCategoryType(catId) {
    if (filters.type === 'all') return true;
    return categoriesFor(filters.type).some((c) => c.id === catId);
  }

  function fillCategories() {
    const groups = [];
    const add = (type, label) => {
      const cats = categoriesFor(type);
      if (!cats.length) return;
      groups.push(h('optgroup', { label }, cats.map((c) => h('option', { value: c.id }, c.name))));
    };
    if (filters.type !== 'expense') add('income', 'Einnahmen');
    if (filters.type !== 'income') add('expense', 'Ausgaben');
    catSel.replaceChildren(h('option', { value: 'all' }, 'Alle Kategorien'), ...groups);
    catSel.value = filters.category;
    if (catSel.value !== filters.category) { filters.category = 'all'; catSel.value = 'all'; }
  }

  function filtered() {
    const q = normalizeText(filters.q);
    return state.bookings.filter((b) => {
      if (filters.year !== 'all' && b.date.slice(0, 4) !== filters.year) return false;
      if (filters.type !== 'all' && b.type !== filters.type) return false;
      if (filters.category !== 'all' && b.categoryId !== filters.category) return false;
      if (filters.person && (b.personId || 'none') !== filters.person) return false;
      if (q) {
        const hay = normalizeText([
          b.description,
          categoryName(b.categoryId),
          contactLabel(contactById(b.personId)),
          centsToInput(b.amountCents),
          formatDate(b.date),
          paymentLabel(b.payment),
        ].join(' '));
        if (!q.split(/\s+/).every((word) => hay.includes(word))) return false;
      }
      return true;
    });
  }

  function renderResults() {
    const list = sortBookings(filtered());
    const total = sumBookings(list);
    const isFiltered = filters.q || filters.type !== 'all' || filters.category !== 'all' || filters.person;

    if (!state.bookings.length) {
      results.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, 'Noch keine Buchungen'),
        'Tippe unten rechts auf +, um die erste Einnahme oder Ausgabe einzutragen.'));
      return;
    }
    if (!list.length) {
      results.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, 'Nichts gefunden'),
        isFiltered ? 'Versuche einen anderen Suchbegriff oder Filter.' : 'In diesem Jahr gibt es noch keine Buchungen.'));
      return;
    }

    // Nach Monat gruppieren (Liste ist schon nach Datum sortiert)
    const groups = new Map();
    for (const b of list) {
      const ym = b.date.slice(0, 7);
      if (!groups.has(ym)) groups.set(ym, []);
      groups.get(ym).push(b);
    }

    const summaryParts = [`${list.length} ${list.length === 1 ? 'Buchung' : 'Buchungen'}`];
    if (total.income) summaryParts.push(h('span', { class: 'num pos' }, formatSigned(total.income, 'income')));
    if (total.expense) summaryParts.push(h('span', { class: 'num neg' }, formatSigned(total.expense, 'expense')));

    results.replaceChildren(
      h('p', { class: 'list-summary' }, summaryParts.flatMap((p, i) => (i ? [' · ', p] : [p]))),
      ...[...groups].map(([ym, items]) => {
        const s = sumBookings(items);
        const sums = [];
        if (s.income) sums.push(h('span', { class: 'pos' }, formatSigned(s.income, 'income')));
        if (s.expense) sums.push(h('span', { class: 'neg' }, formatSigned(s.expense, 'expense')));
        return h('section', { 'aria-label': monthLabel(ym) },
          h('div', { class: 'month-head' },
            h('h2', null, monthLabel(ym)),
            h('span', { class: 'small num' }, sums.flatMap((p, i) => (i ? ['  ', p] : [p])))),
          h('div', { class: 'rows' }, items.map(bookingRow)));
      }),
    );
  }

  // Gelöschte Kund:in? Dann Filter zurücksetzen
  if (filters.person && filters.person !== 'none' && !contactById(filters.person)) filters.person = null;

  // Aktiver Kund:innen-Filter als entfernbares Schild
  let personChip = null;
  if (filters.person) {
    const label = filters.person === 'none' ? 'ohne Kund:in' : (contactLabel(contactById(filters.person)) || 'unbekannt');
    personChip = h('div', { class: 'person-pill filter-pill' },
      h('span', { class: 'person-pill-name' }, `Kund:in: ${label}`),
      h('button', {
        type: 'button',
        class: 'pill-clear',
        'aria-label': 'Filter entfernen',
        onclick: () => { filters.person = null; personChip.remove(); renderResults(); },
      }, '✕'));
  }

  fillCategories();
  mount(root,
    h('h1', { class: 'page-title' }, 'Buchungen'),
    h('div', { class: 'filters' },
      search,
      h('div', { class: 'filter-row' }, yearSel, typeSel, catSel),
      personChip),
    results,
  );
  renderResults();
}
