// Wiederverwendbare Bausteine für mehrere Bildschirme.

import { h, icon, toast } from '../ui.js';
import { categoryName, contactById, contactLabel, isOpen, daysOpen, isOverdue, markPaid, saveBooking } from '../data.js';
import { paymentLabel } from '../defaults.js';
import { formatDate, formatSigned, formatMoney, formatProfit, formatKm } from '../format.js';
import { openBookingForm } from './form.js';

/** Offene Einnahme abhaken – mit "Rückgängig" */
export async function tickPaid(b) {
  const previous = await markPaid(b.id);
  if (!previous) return;
  toast('Als bezahlt markiert', { action: { label: 'Rückgängig', onClick: () => saveBooking(previous) } });
}

/** Zeile für eine offene Einnahme: links zum Abhaken, rechts zum Bearbeiten */
function openRow(b, title, cat, person) {
  const days = daysOpen(b);
  const overdue = isOverdue(b);
  const sub = [formatDate(b.serviceDate || b.date)];
  if (title !== cat) sub.push(cat);
  if (person && title !== person) sub.push(person);
  const age = days === 0 ? 'seit heute offen' : days === 1 ? 'seit 1 Tag offen' : `seit ${days} Tagen offen`;
  return h('div', { class: `row open-row${overdue ? ' overdue' : ''}` },
    h('button', {
      type: 'button',
      class: 'check',
      'aria-label': `${title}, ${formatMoney(b.amountCents)}: als bezahlt abhaken`,
      onclick: () => tickPaid(b),
    }),
    h('button', {
      type: 'button',
      class: 'row-body',
      'aria-label': `Offene Einnahme ${formatMoney(b.amountCents)}, ${title}, ${age}. Bearbeiten`,
      onclick: () => openBookingForm(b),
    },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, title),
      h('div', { class: 'row-sub' }, sub.join(' · ')),
      h('div', { class: `row-age${overdue ? ' neg' : ''}` }, age)),
    h('div', { class: 'amt open' }, formatMoney(b.amountCents))));
}

/** Eine Zeile in der Buchungsliste – Tippen öffnet die Buchung zum Bearbeiten. */
export function bookingRow(b) {
  const cat = categoryName(b.categoryId);
  const person = contactLabel(contactById(b.personId));
  const title = b.description || person || cat;
  if (isOpen(b)) return openRow(b, title, cat, person);
  const sub = [formatDate(b.date)];
  if (title !== cat) sub.push(cat);
  if (person && title !== person) sub.push(person);
  if (b.km) sub.push(`${formatKm(b.km)} km`);
  if (b.payment) sub.push(paymentLabel(b.payment));
  const kind = b.type === 'income' ? 'Einnahme' : 'Ausgabe';

  return h('button', {
    type: 'button',
    class: 'row',
    'aria-label': `${kind} ${formatMoney(b.amountCents)}, ${title}, ${formatDate(b.date)}. Bearbeiten`,
    onclick: () => openBookingForm(b),
  },
  h('div', { class: 'row-main' },
    h('div', { class: 'row-title' }, title),
    h('div', { class: 'row-sub' }, sub.join(' · '), b.receiptId ? icon('receipt', 16) : null)),
  h('div', { class: `amt ${b.type}` }, formatSigned(b.amountCents, b.type)));
}

/** Einnahmen / Ausgaben / Gewinn als Block */
export function statBlock(sums, labels = {}) {
  return [
    h('div', { class: 'stat' },
      h('span', { class: 'stat-label' }, labels.income || 'Einnahmen'),
      h('span', { class: 'stat-value pos' }, formatSigned(sums.income, 'income'))),
    h('div', { class: 'stat' },
      h('span', { class: 'stat-label' }, labels.expense || 'Ausgaben'),
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
