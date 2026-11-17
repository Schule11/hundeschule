// Bildschirm "Einstellungen" – in Schritt 1: Datensicherung und App-Infos.
// Kategorien, Kilometerpauschale, Grenzwerte und Design folgen in Schritt 3.

import { h, mount, icon, toast, choiceDialog, confirmDialog, alertDialog } from '../ui.js';
import { state, storageIsPersistent } from '../data.js';
import { formatDateTime, formatSize } from '../format.js';
import { APP_VERSION, APP_STAGE } from '../config.js';
import { createBackupFile, markBackupDone, readBackupFile, applyBackup } from '../backup.js';
import { saveFile, prefersShare } from '../files.js';

export function render(root) {
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

  const storageInfo = h('span', null, '…');
  storageIsPersistent().then((p) => {
    storageInfo.textContent = p === true ? 'dauerhaft' : p === false ? 'nicht garantiert' : 'unbekannt';
  });

  mount(root,
    h('h1', { class: 'page-title' }, 'Einstellungen'),

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
      importInput),

    h('h2', { class: 'section-title' }, 'App'),
    h('section', { class: 'card' },
      h('div', { class: 'kv' }, h('span', null, 'Version'), h('span', null, `${APP_VERSION} (${APP_STAGE})`)),
      h('div', { class: 'kv' }, h('span', null, 'Gespeicherte Buchungen'), h('span', null, String(state.bookings.length))),
      h('div', { class: 'kv' }, h('span', null, 'Speicher'), storageInfo),
      h('p', { class: 'hint' }, 'Kategorien, Kilometerpauschale, Grenzwerte und hell/dunkel kommen in Schritt 3.')),
  );
}

// ---------- Backup erstellen ----------

async function doExport(btn) {
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
