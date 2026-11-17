// Bildschirm "Einstellungen": Hundeschule, Kategorien, Fahrtkosten,
// Kleinunternehmergrenze, Datensicherung, Darstellung.
//
// Eingaben werden beim Verlassen des Feldes gespeichert. Der Bildschirm wird
// dabei bewusst nicht neu aufgebaut, damit die Tastatur offen bleibt.

import { h, mount, icon, toast, choiceDialog, confirmDialog, alertDialog, getTheme, setTheme } from '../ui.js';
import { state, storageIsPersistent, updateSettings, categoriesFor } from '../data.js';
import { formatDateTime, formatSize, formatMoney, centsToInput, parseAmount } from '../format.js';
import { APP_VERSION, APP_STAGE } from '../config.js';
import { createBackupFile, markBackupDone, readBackupFile, applyBackup } from '../backup.js';
import { saveFile, prefersShare } from '../files.js';
import { smallBusinessStatus } from '../notices.js';
import { openCategoryList } from './categories.js';

const plain = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const euroPlain = (cents) => plain.format(cents / 100); // 2500000 → "25.000"

/** Eingabefeld, das beim Verlassen prüft und speichert */
function settingField({ id, label, value, unit, inputmode = 'text', placeholder = '', hint = null, onSave }) {
  const input = h('input', {
    class: 'field', id, type: 'text', inputmode, autocomplete: 'off', value, placeholder,
    enterkeyhint: 'done',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } },
    onchange: async () => {
      const result = await onSave(input.value.trim());
      if (result === false) { input.value = value; return; } // ungültig → alter Wert
      if (typeof result === 'string') input.value = result;   // schön formatiert
      value = input.value;
      toast('Gespeichert');
    },
  });
  return [
    h('label', { class: 'lbl', for: id }, label),
    unit ? h('div', { class: 'unit-field' }, input, h('span', { class: 'unit' }, unit)) : input,
    hint ? h('p', { class: 'hint' }, hint) : null,
  ];
}

function invalid(msg) {
  alertDialog({ title: 'Ungültige Eingabe', text: msg });
  return false;
}

function meter(percent) {
  const p = Math.max(0, Math.min(100, percent));
  return h('div', { class: `meter${percent >= (state.settings.warnPercent || 80) ? ' near' : ''}`, role: 'img', 'aria-label': `${percent} %` },
    h('div', { class: 'meter-fill', style: `width: ${p}%` }));
}

function renderLimitStatus(box) {
  const st = smallBusinessStatus();
  const s = state.settings;
  box.replaceChildren(
    h('div', { class: 'kv' },
      h('span', null, `Umsatz ${st.year} bisher`),
      h('span', { class: 'num' }, formatMoney(st.current.cents))),
    meter(st.percentOfPrevLimit),
    h('p', { class: 'hint', style: 'margin-top: 6px' },
      `${st.percentOfPrevLimit} % von ${formatMoney(s.limitPrevYearCents)} · ${st.percentOfCurrentLimit} % von ${formatMoney(s.limitCurrentYearCents)}`),
    h('div', { class: 'kv', style: 'margin-top: 8px' },
      h('span', null, `Umsatz ${st.year - 1}`),
      h('span', { class: 'num' }, `${formatMoney(st.previous.cents)}${st.previous.manual ? ' (von Hand)' : ''}`)),
  );
}

export function render(root) {
  const s = state.settings;
  const year = new Date().getFullYear();

  // --- Datensicherung ---
  const lastBackup = state.local.lastBackupAt;
  const since = state.bookings.length - (state.local.bookingsAtLastBackup || 0);
  const exportBtn = h('button', { type: 'button', class: 'btn primary block', onclick: () => doExport(exportBtn) },
    icon('download'), 'Backup erstellen');
  const importInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (file) doImport(file);
    },
  });
  const importBtn = h('button', { type: 'button', class: 'btn block', onclick: () => importInput.click() },
    icon('upload'), 'Backup einspielen');
  const reminder = h('select', {
    class: 'field', id: 'backup-reminder',
    onchange: async (e) => { await updateSettings({ backupReminderDays: Number(e.target.value) }, { silent: true }); toast('Gespeichert'); },
  },
  [[14, 'alle 14 Tage'], [30, 'alle 30 Tage'], [60, 'alle 60 Tage'], [90, 'alle 90 Tage'], [0, 'nie']]
    .map(([v, l]) => h('option', { value: String(v) }, l)));
  reminder.value = String(s.backupReminderDays ?? 30);

  // --- Kleinunternehmer ---
  const limitStatus = h('div');
  renderLimitStatus(limitStatus);
  const refreshLimits = () => renderLimitStatus(limitStatus);

  const moneySetting = (key, label, hint) => settingField({
    id: `set-${key}`, label, unit: '€', inputmode: 'decimal', hint,
    value: euroPlain(s[key]),
    onSave: async (v) => {
      const cents = parseAmount(v);
      if (cents == null || cents <= 0) return invalid('Bitte einen Betrag eingeben, z. B. 25.000.');
      await updateSettings({ [key]: cents }, { silent: true });
      refreshLimits();
      return euroPlain(cents);
    },
  });

  const manualPrev = s.manualRevenue?.[String(year - 1)];

  // --- Darstellung ---
  const themeButtons = [['system', 'Wie Handy'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, l]) =>
    h('button', {
      type: 'button',
      'aria-pressed': String(getTheme() === v),
      onclick: (e) => {
        setTheme(v);
        for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
      },
    }, l));

  const storageInfo = h('span', null, '…');
  storageIsPersistent().then((p) => {
    storageInfo.textContent = p === true ? 'dauerhaft' : p === false ? 'nicht garantiert' : 'unbekannt';
  });

  const catButton = (type, label) => {
    const n = categoriesFor(type).length;
    return h('button', { type: 'button', class: 'row', onclick: () => openCategoryList(type) },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, label),
        h('div', { class: 'row-sub' }, `${n} Kategorien`)),
      h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›'));
  };

  mount(root,
    h('h1', { class: 'page-title' }, 'Einstellungen'),

    h('h2', { class: 'section-title' }, 'Hundeschule'),
    h('section', { class: 'card' },
      settingField({
        id: 'set-name', label: 'Name (steht auf dem PDF)', value: s.businessName || '',
        onSave: async (v) => {
          if (!v) return invalid('Bitte einen Namen eingeben.');
          await updateSettings({ businessName: v }, { silent: true });
          return v;
        },
      })),

    h('h2', { class: 'section-title' }, 'Kategorien'),
    h('div', { class: 'rows' }, catButton('income', 'Einnahmen'), catButton('expense', 'Ausgaben')),

    h('h2', { class: 'section-title' }, 'Fahrtkosten'),
    h('section', { class: 'card' },
      settingField({
        id: 'set-km', label: 'Kilometerpauschale', unit: '€ pro km', inputmode: 'decimal',
        value: centsToInput(s.kmRateCents),
        hint: 'Für betriebliche Fahrten mit dem privaten Auto sind 0,30 € pro gefahrenem Kilometer üblich. '
          + 'Fahrten zwischen Wohnung und einem festen Trainingsplatz können steuerlich anders zu behandeln sein – im Zweifel nachfragen. '
          + 'Eine Änderung gilt nur für neue Fahrten.',
        onSave: async (v) => {
          const cents = parseAmount(v);
          if (cents == null || cents < 1 || cents > 500) return invalid('Bitte einen Betrag zwischen 0,01 € und 5,00 € eingeben, z. B. 0,30.');
          await updateSettings({ kmRateCents: cents }, { silent: true });
          return centsToInput(cents);
        },
      })),

    h('h2', { class: 'section-title' }, 'Kleinunternehmergrenze'),
    h('section', { class: 'card' },
      limitStatus,
      moneySetting('limitPrevYearCents', 'Grenze Vorjahresumsatz', 'Wird sie in einem Jahr überschritten, entfällt die Regelung im Folgejahr.'),
      moneySetting('limitCurrentYearCents', 'Grenze im laufenden Jahr', 'Wird sie überschritten, entfällt die Regelung sofort.'),
      settingField({
        id: 'set-warn', label: 'Hinweis anzeigen ab', unit: '%', inputmode: 'numeric', value: String(s.warnPercent),
        onSave: async (v) => {
          const n = Number(v.replace(',', '.'));
          if (!Number.isInteger(n) || n < 10 || n > 100) return invalid('Bitte eine ganze Zahl zwischen 10 und 100 eingeben.');
          await updateSettings({ warnPercent: n }, { silent: true });
          refreshLimits();
          return String(n);
        },
      }),
      settingField({
        id: 'set-prev', label: `Umsatz ${year - 1} von Hand (optional)`, unit: '€', inputmode: 'decimal',
        value: manualPrev != null ? euroPlain(manualPrev) : '',
        placeholder: 'aus der App',
        hint: `Nur ausfüllen, wenn ${year - 1} nicht vollständig in der App erfasst ist. Leer lassen = Summe der Einnahmen in der App.`,
        onSave: async (v) => {
          const manualRevenue = { ...(state.settings.manualRevenue || {}) };
          if (!v) {
            delete manualRevenue[String(year - 1)];
          } else {
            const cents = parseAmount(v);
            if (cents == null) return invalid('Bitte einen Betrag eingeben, z. B. 12.500 – oder das Feld leer lassen.');
            manualRevenue[String(year - 1)] = cents;
          }
          await updateSettings({ manualRevenue }, { silent: true });
          refreshLimits();
          return v ? euroPlain(manualRevenue[String(year - 1)]) : '';
        },
      })),

    h('h2', { class: 'section-title' }, 'Datensicherung'),
    h('section', { class: 'card' },
      h('p', { class: 'setting-text' },
        'Deine Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig als Datei – am besten in iCloud Drive –, '
        + 'damit nichts verloren geht, wenn du das Handy wechselst.'),
      h('div', { class: 'kv' },
        h('span', null, 'Letztes Backup'),
        h('span', null, lastBackup ? formatDateTime(lastBackup) : 'noch keins')),
      lastBackup && since > 0
        ? h('div', { class: 'kv' }, h('span', null, 'Seitdem neu/gelöscht'), h('span', null, `${since} Buchungen`))
        : null,
      h('div', { class: 'btn-row', style: 'margin-top: 14px' }, exportBtn, importBtn),
      importInput,
      h('label', { class: 'lbl', for: 'backup-reminder' }, 'An Backup erinnern'),
      reminder),

    h('h2', { class: 'section-title' }, 'Darstellung'),
    h('div', { class: 'segmented segmented-3', role: 'group', 'aria-label': 'Darstellung' }, themeButtons),

    h('h2', { class: 'section-title' }, 'App'),
    h('section', { class: 'card' },
      h('div', { class: 'kv' }, h('span', null, 'Version'), h('span', null, `${APP_VERSION} (${APP_STAGE})`)),
      h('div', { class: 'kv' }, h('span', null, 'Gespeicherte Buchungen'), h('span', null, String(state.bookings.length))),
      h('div', { class: 'kv' }, h('span', null, 'Speicher'), storageInfo)),
  );
}

// ---------- Backup erstellen ----------

export async function doExport(btn) {
  btn.disabled = true;
  try {
    const { file, counts } = await createBackupFile();
    const share = prefersShare(file);
    const text = h('div', null,
      h('p', null, `${counts.bookings} Buchungen und ${counts.receipts} Belegfotos · ${formatSize(file.size)}`),
      h('p', null, share
        ? 'Tippe auf „Sichern“ und wähle dann „In Dateien sichern“ → iCloud Drive. So liegt das Backup nicht nur auf dem Handy.'
        : 'Die Datei wird in deinen Download-Ordner geladen. Bewahre sie an einem sicheren Ort auf.'));

    await choiceDialog({
      title: 'Backup ist bereit',
      text,
      buttons: [
        {
          label: share ? 'Sichern …' : 'Herunterladen',
          kind: 'primary',
          // Muss direkt im Tipp passieren, sonst blockiert das iPhone das Teilen
          onClick: () => saveFile(file, (ok) => {
            if (!ok) return;
            markBackupDone();
            toast(share ? 'Backup gesichert' : 'Backup heruntergeladen');
          }),
        },
        { label: 'Abbrechen' },
      ],
    });
  } catch (err) {
    console.error(err);
    alertDialog({ title: 'Backup fehlgeschlagen', text: err.message || String(err) });
  } finally {
    btn.disabled = false;
  }
}

// ---------- Backup einspielen ----------

async function doImport(file) {
  let backup;
  try {
    backup = await readBackupFile(file);
  } catch (err) {
    alertDialog({ title: 'Backup nicht lesbar', text: err.message });
    return;
  }

  const date = backup.exportedAt ? formatDateTime(backup.exportedAt) : 'unbekannt';
  const mode = await choiceDialog({
    title: 'Backup einspielen',
    text: h('div', null,
      h('p', null, `Backup vom ${date}: ${backup.bookings.length} Buchungen, ${backup.receipts.length} Belegfotos.`),
      h('p', null, h('strong', null, 'Zusammenführen: '), 'Buchungen aus dem Backup kommen dazu, nichts wird doppelt. Das jeweils Neuere gilt.'),
      h('p', null, h('strong', null, 'Ersetzen: '), 'Alle Daten auf diesem Gerät werden gelöscht und durch das Backup ersetzt.')),
    buttons: [
      { label: 'Zusammenführen (empfohlen)', value: 'merge', kind: 'primary' },
      { label: 'Alles ersetzen', value: 'replace' },
      { label: 'Abbrechen' },
    ],
  });
  if (!mode) return;

  if (mode === 'replace' && state.bookings.length) {
    const ok = await confirmDialog({
      title: 'Wirklich ersetzen?',
      text: `Die ${state.bookings.length} Buchungen auf diesem Gerät werden gelöscht und durch das Backup ersetzt.`,
      confirmLabel: 'Ja, ersetzen',
      danger: true,
    });
    if (!ok) return;
  }

  try {
    const r = await applyBackup(backup, mode);
    const lines = mode === 'replace'
      ? [`${r.added} Buchungen übernommen.`]
      : [`${r.added} neu, ${r.updated} aktualisiert, ${r.removed} entfernt.`, `Jetzt gespeichert: ${state.bookings.length} Buchungen.`];
    if (r.skipped) lines.push(`${r.skipped} fehlerhafte Einträge wurden übersprungen.`);
    alertDialog({ title: 'Backup eingespielt', text: h('div', null, lines.map((l) => h('p', null, l))) });
  } catch (err) {
    console.error(err);
    alertDialog({ title: 'Einspielen fehlgeschlagen', text: `Es wurde nichts verändert. (${err.message || err})` });
  }
}
