// Bildschirm "Auswertung": Jahressummen für die Anlage EÜR, CSV- und PDF-Export.

import { h, mount, icon, toast, alertDialog } from '../ui.js';
import { state, bookingYears } from '../data.js';
import { formatMoney, formatSigned, formatProfit, formatKm, MONTHS } from '../format.js';
import { yearReport } from '../yearReport.js';
import { bookingsCsv, summaryCsv, reportPdf, preloadLogo } from '../exports.js';
import { saveFile, prefersShare } from '../files.js';
import { statBlock, yearSelect, pageHeader } from './components.js';
import { showBookings } from './bookings.js';

let selectedYear = defaultYear();

/** Januar bis Mai: meist wird gerade die Steuererklärung fürs Vorjahr gemacht */
function defaultYear() {
  const now = new Date();
  const prev = now.getFullYear() - 1;
  if (now.getMonth() <= 4 && state.bookings.some((b) => b.date.startsWith(String(prev)))) return prev;
  return now.getFullYear();
}

export function render(root) {
  preloadLogo();
  const years = bookingYears();
  if (!years.includes(selectedYear)) selectedYear = years[0];
  const r = yearReport(selectedYear);
  const rerender = () => { root.replaceChildren(); render(root); };

  const head = h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', { class: 'card-title' }, 'Ergebnis'),
      h('div', { style: 'width: 130px' },
        yearSelect(years, selectedYear, (v) => { selectedYear = Number(v); rerender(); }))),
    statBlock(r.totals, { income: 'Betriebseinnahmen', expense: 'Betriebsausgaben' }));

  // Hinweis: offene Einnahmen sind nicht enthalten
  const openNote = r.open.count
    ? h('button', {
      type: 'button',
      class: 'notice notice-button',
      onclick: () => showBookings({ type: 'open' }),
    },
    h('strong', null, `${r.open.count} offene ${r.open.count === 1 ? 'Zahlung' : 'Zahlungen'} (${formatMoney(r.open.cents)}) nicht enthalten`),
    h('span', null, 'Sie zählen erst, wenn das Geld eingegangen ist – und zwar im Jahr der Zahlung. Antippen zum Anzeigen.'))
    : null;

  if (!r.bookings.length) {
    mount(root,
      pageHeader('Auswertung'),
      head,
      openNote,
      h('div', { class: 'empty' },
        h('strong', null, `Keine Buchungen in ${selectedYear}`),
        'Sobald du Buchungen erfasst hast, siehst du hier die Summen für die Anlage EÜR.'));
    return;
  }

  // --- Anlage EÜR ---
  const euer = h('section', { class: 'card' },
    h('p', { class: 'hint', style: 'margin-top: 0' },
      'Diese Bruttobeträge überträgst du in die Anlage EÜR. Die Posten heißen in ELSTER so wie hier (Zeilennummern ändern sich jährlich).'),
    r.posten.map((p) => h('div', { class: 'report-row' },
      h('div', { class: 'report-main' },
        h('div', { class: 'report-name' }, p.name),
        h('div', { class: 'report-sub' }, p.categories.join(', '))),
      h('div', { class: `report-amt ${p.type === 'income' ? 'pos' : ''}` }, formatMoney(p.cents)))),
    h('div', { class: 'stat total' },
      h('span', { class: 'stat-label' }, r.totals.profit < 0 ? 'Verlust' : 'Gewinn'),
      h('span', { class: `stat-value ${r.totals.profit < 0 ? 'neg' : ''}` }, formatProfit(r.totals.profit))));

  // --- Kategorien (antippen = Buchungen dieser Kategorie zeigen) ---
  const catCard = (list) => h('section', { class: 'card card-list' },
    list.map((c) => h('button', {
      type: 'button',
      class: 'report-row report-link',
      onclick: () => showBookings({ year: String(selectedYear), category: c.id || 'all' }),
    },
    h('div', { class: 'report-main' },
      h('div', { class: 'report-name' }, c.name),
      h('div', { class: 'report-sub' }, `${c.count} ${c.count === 1 ? 'Buchung' : 'Buchungen'}${c.km ? ` · ${formatKm(c.km)} km` : ''}`)),
    h('div', { class: `report-amt ${c.type === 'income' ? 'pos' : 'neg'}` }, formatSigned(c.cents, c.type)))));

  // --- Monate ---
  const monthRows = r.months
    .map((m, i) => ({ ...m, name: MONTHS[i].slice(0, 3) }))
    .filter((m) => m.count);
  const monthTable = h('section', { class: 'card' },
    h('div', { class: 'month-table' },
      h('span', { class: 'th' }, 'Monat'),
      h('span', { class: 'th' }, 'Einnahmen'),
      h('span', { class: 'th' }, 'Ausgaben'),
      h('span', { class: 'th' }, 'Ergebnis'),
      monthRows.map((m) => [
        h('span', null, m.name),
        h('span', { class: 'pos' }, m.income ? formatMoney(m.income) : '–'),
        h('span', { class: 'neg' }, m.expense ? formatMoney(m.expense) : '–'),
        h('span', { class: m.profit < 0 ? 'neg' : '' }, formatProfit(m.profit)),
      ])));

  // --- Export ---
  const exportBtn = (label, iconName, make, primary = false) => h('button', {
    type: 'button',
    class: `btn block${primary ? ' primary' : ' btn-small'}`,
    onclick: () => {
      // Datei sofort im Tipp erzeugen und weitergeben (wichtig fürs iPhone)
      let file;
      try {
        file = make(selectedYear);
      } catch (err) {
        console.error(err);
        alertDialog({ title: 'Export fehlgeschlagen', text: err.message || String(err) });
        return;
      }
      const share = prefersShare(file);
      saveFile(file, (ok) => { if (ok && !share) toast(`${file.name} heruntergeladen`); });
    },
  }, iconName ? icon(iconName) : null, label);

  mount(root,
    pageHeader('Auswertung'),
    head,
    openNote,
    h('section', { class: 'card export-card', 'aria-label': 'Export' },
      exportBtn('PDF erstellen', 'download', reportPdf, true),
      h('div', { class: 'btn-pair' },
        exportBtn('Buchungen (CSV)', null, bookingsCsv),
        exportBtn('Summen (CSV)', null, summaryCsv)),
      h('p', { class: 'hint', style: 'margin-bottom: 0' },
        'PDF: Jahresübersicht mit allen Buchungen – zum Ablegen oder für die Steuerberatung. CSV: für Excel oder Numbers.')),
    h('h2', { class: 'section-title' }, 'Für die Anlage EÜR'),
    euer,
    r.categories.income.length ? [h('h2', { class: 'section-title' }, 'Einnahmen nach Kategorie'), catCard(r.categories.income)] : null,
    r.categories.expense.length ? [h('h2', { class: 'section-title' }, 'Ausgaben nach Kategorie'), catCard(r.categories.expense)] : null,
    r.persons.length ? [
      h('h2', { class: 'section-title' }, 'Einnahmen nach Kund:in'),
      h('section', { class: 'card card-list' },
        r.persons.map((p) => h('button', {
          type: 'button',
          class: 'report-row report-link',
          onclick: () => showBookings({ year: String(selectedYear), type: 'income', person: p.id }),
        },
        h('div', { class: 'report-main' },
          h('div', { class: 'report-name' }, p.label),
          h('div', { class: 'report-sub' }, `${p.count} ${p.count === 1 ? 'Zahlung' : 'Zahlungen'}`)),
        h('div', { class: 'report-amt pos' }, formatSigned(p.cents, 'income'))))),
    ] : null,
    h('h2', { class: 'section-title' }, 'Monate'),
    monthTable,
  );
}
