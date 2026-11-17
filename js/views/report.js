// Bildschirm "Auswertung": Jahressummen für die Anlage EÜR, CSV- und PDF-Export.

import { h, mount, icon, toast, alertDialog } from '../ui.js';
import { state, bookingYears } from '../data.js';
import { formatMoney, formatSigned, formatProfit, formatKm, MONTHS } from '../format.js';
import { yearReport } from '../yearReport.js';
import { bookingsCsv, summaryCsv, reportPdf, preloadLogo } from '../exports.js';
import { saveFile, prefersShare } from '../files.js';
import { statBlock, yearSelect } from './components.js';
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
      h('h2', { class: 'card-title' }, `Ergebnis ${selectedYear}`),
      h('div', { style: 'width: 130px' },
        yearSelect(years, selectedYear, (v) => { selectedYear = Number(v); rerender(); }))),
    statBlock(r.totals, { income: 'Betriebseinnahmen', expense: 'Betriebsausgaben' }));

  if (!r.bookings.length) {
    mount(root,
      h('h1', { class: 'page-title' }, 'Auswertung'),
      head,
      h('div', { class: 'empty' },
        h('strong', null, `Keine Buchungen in ${selectedYear}`),
        'Sobald du Buchungen erfasst hast, siehst du hier die Summen für die Anlage EÜR.'));
    return;
  }

  // --- Anlage EÜR ---
  const euer = h('section', { class: 'card' },
    h('p', { class: 'hint', style: 'margin-top: 0' },
      'Diese Beträge überträgst du in die Anlage EÜR. Als Kleinunternehmer sind es Bruttobeträge – genau so, wie du bezahlt hast. '
      + 'Die Zeilennummern ändern sich jährlich; im Formular und in ELSTER heißen die Posten so wie hier.'),
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
    class: `btn block${primary ? ' primary' : ''}`,
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
  }, icon(iconName), label);

  mount(root,
    h('h1', { class: 'page-title' }, 'Auswertung'),
    head,
    h('h2', { class: 'section-title' }, 'Für die Anlage EÜR'),
    euer,
    r.categories.income.length ? [h('h2', { class: 'section-title' }, 'Einnahmen nach Kategorie'), catCard(r.categories.income)] : null,
    r.categories.expense.length ? [h('h2', { class: 'section-title' }, 'Ausgaben nach Kategorie'), catCard(r.categories.expense)] : null,
    h('h2', { class: 'section-title' }, 'Monate'),
    monthTable,
    h('h2', { class: 'section-title' }, 'Export'),
    h('section', { class: 'card' },
      h('div', { class: 'btn-row' },
        exportBtn('PDF erstellen', 'download', reportPdf, true),
        exportBtn('Buchungen als CSV', 'download', bookingsCsv),
        exportBtn('Summen als CSV', 'download', summaryCsv)),
      h('p', { class: 'hint' },
        'PDF: Jahresübersicht mit allen Buchungen – zum Ablegen oder für die Steuerberatung. '
        + 'CSV: zum Öffnen in Excel oder Numbers. Auf dem iPhone öffnet sich das Teilen-Menü '
        + '(„In Dateien sichern“, Mail …).')),
  );
}
