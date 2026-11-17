// Bildschirm "Auswertung" – folgt in Schritt 2 (Summen pro Kategorie, CSV, PDF).

import { h, mount } from '../ui.js';

export function render(root) {
  mount(root,
    h('h1', { class: 'page-title' }, 'Auswertung'),
    h('div', { class: 'card' },
      h('h2', { class: 'card-title' }, 'Kommt in Schritt 2'),
      h('p', { class: 'muted', style: 'margin: 8px 0 0' },
        'Hier siehst du bald die Summen pro Kategorie für ein Kalenderjahr – passend für die Anlage EÜR – '
        + 'und kannst sie als CSV oder PDF exportieren.')),
  );
}
