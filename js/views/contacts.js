// Kund:innen verwalten: Liste mit Suche, anlegen, bearbeiten, löschen.

import { h, toast, openSheet, confirmDialog } from '../ui.js';
import {
  onChange, contactsSorted, contactLabel, contactStats, saveContact, deleteContact, findContactByName,
} from '../data.js';
import { formatSigned, formatMoney, normalizeText } from '../format.js';
import { showBookings } from './bookings.js';

export function openContactList(onClose = null) {
  const list = h('div');
  let unsubscribe = null;
  const { body, close } = openSheet({ title: 'Kund:innen', onClose: () => { unsubscribe?.(); onClose?.(); } });

  const search = h('input', {
    class: 'field field-search', type: 'search', placeholder: 'Name oder Hund suchen …', autocomplete: 'off',
    'aria-label': 'Kund:innen durchsuchen', enterkeyhint: 'search',
    oninput: () => render(),
    onkeydown: (e) => { if (e.key === 'Enter') search.blur(); },
  });

  function render() {
    const q = normalizeText(search.value);
    const all = contactsSorted();
    const shown = q ? all.filter((c) => normalizeText(`${c.name} ${c.dog || ''}`).includes(q)) : all;
    if (!all.length) {
      list.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, 'Noch keine Kund:innen'),
        'Namen legst du am einfachsten direkt beim Erfassen einer Einnahme an – oder hier mit „Neue Kund:in“.'));
      return;
    }
    if (!shown.length) {
      list.replaceChildren(h('div', { class: 'empty' }, h('strong', null, 'Nichts gefunden')));
      return;
    }
    list.replaceChildren(h('div', { class: 'rows' }, shown.map((c) => {
      const s = contactStats(c.id);
      const sub = [`${s.count} ${s.count === 1 ? 'Buchung' : 'Buchungen'}`];
      if (s.open) sub.push(`offen ${formatMoney(s.open)}`);
      return h('button', { type: 'button', class: 'row', onclick: () => openContactEditor(c, close) },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, c.name),
          h('div', { class: 'row-sub' }, [c.dog ? `Hund: ${c.dog}` : null, ...sub].filter(Boolean).join(' · '))),
        s.income ? h('div', { class: 'amt income' }, formatSigned(s.income, 'income')) : null);
    })));
  }

  body.append(
    h('div', { class: 'filters' }, search),
    h('div', { style: 'margin: 12px 0 16px' },
      h('button', { type: 'button', class: 'btn block', onclick: () => openContactEditor(null, close) }, '+ Neue Kund:in')),
    list,
  );
  render();
  unsubscribe = onChange(render);
}

/** closeList: schließt die Liste (für "Buchungen anzeigen") */
export function openContactEditor(contact = null, closeList = null) {
  const isNew = !contact;
  const nameInput = h('input', {
    class: 'field', id: 'contact-name', type: 'text', maxlength: 80, autocomplete: 'off', autocapitalize: 'words',
    value: contact?.name || '', placeholder: 'z. B. Anna Müller',
  });
  const dogInput = h('input', {
    class: 'field', id: 'contact-dog', type: 'text', maxlength: 80, autocomplete: 'off', autocapitalize: 'words',
    value: contact?.dog || '', placeholder: 'z. B. Bello',
  });
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });

  const { body, close } = openSheet({
    title: isNew ? 'Neue Kund:in' : 'Kund:in bearbeiten',
    cancel: true,
    onConfirm: () => save(),
  });

  async function save() {
    const name = nameInput.value.trim();
    const fail = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
    if (!name) return fail('Bitte einen Namen eingeben.');
    const same = findContactByName(name);
    if (same && same.id !== contact?.id) return fail(`„${same.name}“ gibt es schon.`);
    try {
      await saveContact({ id: contact?.id, name, dog: dogInput.value.trim() });
      close();
      toast(isNew ? 'Kund:in angelegt' : 'Gespeichert');
    } catch (err) {
      fail(`Speichern hat nicht geklappt: ${err.message || err}`);
    }
  }

  async function remove() {
    const { count } = contactStats(contact.id);
    const ok = await confirmDialog({
      title: `„${contactLabel(contact)}“ löschen?`,
      text: count
        ? `Die ${count} ${count === 1 ? 'Buchung bleibt' : 'Buchungen bleiben'} erhalten, nur der Name wird dort entfernt.`
        : 'Der Name wird nicht mehr zur Auswahl angeboten.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    await deleteContact(contact.id);
    close();
    toast('Kund:in gelöscht');
  }

  const stats = contact ? contactStats(contact.id) : null;
  body.append(
    h('label', { class: 'lbl', for: 'contact-name', style: 'margin-top: 4px' }, 'Name'),
    nameInput,
    h('label', { class: 'lbl', for: 'contact-dog' }, 'Hund (optional)'),
    dogInput,
    h('p', { class: 'hint' }, 'Der Hundename wird bei der Auswahl mit angezeigt und ist durchsuchbar.'),
    errorBox,
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn primary block', onclick: save }, 'Speichern'),
      stats?.count
        ? h('button', {
          type: 'button',
          class: 'btn block',
          onclick: () => { close(); closeList?.(); showBookings({ person: contact.id }); },
        }, `${stats.count} ${stats.count === 1 ? 'Buchung' : 'Buchungen'} anzeigen`)
        : null,
      !isNew ? h('button', { type: 'button', class: 'btn-text danger', onclick: remove }, 'Kund:in löschen') : null),
  );
  if (isNew) nameInput.focus();
}
