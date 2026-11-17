// Wiederverwendbare Bausteine für mehrere Bildschirme.

import { h, icon } from '../ui.js';
import { categoryName } from '../data.js';
import { paymentLabel } from '../defaults.js';
import { formatDate, formatSigned, formatMoney, formatProfit } from '../format.js';
import { openBookingForm } from './form.js';

/** Eine Zeile in der Buchungsliste – Tippen öffnet die Buchung zum Bearbeiten. */
export function bookingRow(b) {
  const cat = categoryName(b.categoryId);
  const sub = [formatDate(b.date)];
  if (b.description) sub.push(cat);
  if (b.payment) sub.push(paymentLabel(b.payment));
  const kind = b.type === 'income' ? 'Einnahme' : 'Ausgabe';

  return h('button', {
    type: 'button',
    class: 'row',
    'aria-label': `${kind} ${formatMoney(b.amountCents)}, ${b.description || cat}, ${formatDate(b.date)}. Bearbeiten`,
    onclick: () => openBookingForm(b),
  },
  h('div', { class: 'row-main' },
    h('div', { class: 'row-title' }, b.description || cat),
    h('div', { class: 'row-sub' }, sub.join(' · '), b.receiptId ? icon('receipt', 16) : null)),
  h('div', { class: `amt ${b.type}` }, formatSigned(b.amountCents, b.type)));
}

/** Einnahmen / Ausgaben / Gewinn als Block */
export function statBlock(sums) {
  return [
    h('div', { class: 'stat' },
      h('span', { class: 'stat-label' }, 'Einnahmen'),
      h('span', { class: 'stat-value pos' }, formatSigned(sums.income, 'income'))),
    h('div', { class: 'stat' },
      h('span', { class: 'stat-label' }, 'Ausgaben'),
      h('span', { class: 'stat-value neg' }, formatSigned(sums.expense, 'expense'))),
    h('div', { class: 'stat total' },
      h('span', { class: 'stat-label' }, sums.profit < 0 ? 'Verlust' : 'Gewinn'),
      h('span', { class: `stat-value ${sums.profit < 0 ? 'neg' : ''}` }, formatProfit(sums.profit))),
  ];
}

/** Jahresauswahl als Klappliste */
export function yearSelect(years, value, onChange, { withAll = false, label = 'Jahr' } = {}) {
  const select = h('select', { class: 'field', 'aria-label': label, onchange: (e) => onChange(e.target.value) },
    withAll ? h('option', { value: 'all' }, 'Alle Jahre') : null,
    years.map((y) => h('option', { value: String(y) }, String(y))));
  select.value = String(value);
  return select;
}
