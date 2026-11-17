// Auswahl der Kundin / des Kunden im Buchungsformular.
// Zuletzt benutzte Namen stehen als Knöpfe bereit; beim Tippen wird gefiltert.
// Ein neuer Name wird beim Speichern der Buchung automatisch angelegt.

import { h } from '../ui.js';
import { state, contactById, contactLabel, recentContacts, findContactByName } from '../data.js';
import { normalizeText } from '../format.js';

export function personPicker({ initialId = null, onChange = () => {} } = {}) {
  let selectedId = contactById(initialId) ? initialId : null;

  const pill = h('div', { class: 'person-pill', hidden: true });
  const suggestions = h('div', { class: 'chips person-suggestions', role: 'group', 'aria-label': 'Vorschläge' });
  const input = h('input', {
    class: 'field',
    id: 'person',
    type: 'text',
    maxlength: 80,
    autocomplete: 'off',
    autocapitalize: 'words',
    enterkeyhint: 'done',
    placeholder: 'Name suchen oder neu eingeben',
    oninput: () => { renderSuggestions(); onChange(); },
    onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const matches = matching();
      if (matches.length === 1) select(matches[0].id);
      else input.blur();
    },
  });
  // Vorschläge stehen ÜBER dem Eingabefeld, damit die Tastatur sie nicht verdeckt
  const el = h('div', { class: 'person-picker' }, pill, suggestions, input);

  function matching() {
    const q = normalizeText(input.value);
    if (!q) return [];
    const words = q.split(/\s+/);
    return state.contacts
      .filter((c) => {
        const hay = normalizeText(`${c.name} ${c.dog || ''}`);
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .slice(0, 8);
  }

  function select(id) {
    selectedId = id;
    input.value = '';
    render();
    onChange();
  }

  function renderSuggestions() {
    const typed = input.value.trim();
    const list = typed ? matching() : recentContacts(6);
    const chips = list.map((c) => h('button', { type: 'button', class: 'chip', onclick: () => select(c.id) }, contactLabel(c)));
    if (typed && !findContactByName(typed)) {
      chips.push(h('span', { class: 'person-new-hint' }, `„${typed}“ wird beim Speichern neu angelegt`));
    }
    suggestions.replaceChildren(...chips);
    suggestions.hidden = chips.length === 0;
  }

  function render() {
    const c = contactById(selectedId);
    if (c) {
      pill.replaceChildren(
        h('span', { class: 'person-pill-name' }, contactLabel(c)),
        h('button', {
          type: 'button',
          class: 'pill-clear',
          'aria-label': 'Auswahl entfernen',
          onclick: () => { selectedId = null; render(); onChange(); },
        }, '✕'));
      pill.hidden = false;
      input.hidden = true;
      suggestions.hidden = true;
    } else {
      pill.hidden = true;
      input.hidden = false;
      renderSuggestions();
    }
  }

  render();

  return {
    el,
    input,
    hasSelection: () => !!contactById(selectedId),
    /** { personId } oder { newName } (neu anzulegen) oder { personId: null } */
    value() {
      if (contactById(selectedId)) return { personId: selectedId };
      const name = input.value.trim();
      if (!name) return { personId: null };
      const match = findContactByName(name);
      return match ? { personId: match.id } : { newName: name };
    },
  };
}
