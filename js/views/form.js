// Formular "Neue Buchung" / "Buchung bearbeiten" – öffnet sich im Vollbild.

import { h, icon, toast, confirmDialog, openImageViewer, isTouchDevice } from '../ui.js';
import {
  state, categoriesFor, categoryById, saveBooking, deleteBooking, getReceipt, receiptToBlob, saveContact,
} from '../data.js';
import { personPicker } from './personPicker.js';
import { PAYMENT_METHODS } from '../defaults.js';
import { parseAmount, centsToInput, todayISO, formatMoney, formatDate, formatKm } from '../format.js';
import { resizeImage } from '../image.js';

const GWG_HINT_CENTS = 80000; // ab 800 € Hinweis auf mögliche Abschreibung

let open = false;
const closeListeners = new Set();

export function isFormOpen() { return open; }
export function onFormClosed(fn) { closeListeners.add(fn); }

function getLastType() {
  // Standard: Einnahme (das Häufigste nach einer Trainingsstunde)
  try { return localStorage.getItem('lastType') === 'expense' ? 'expense' : 'income'; } catch { return 'income'; }
}
function setLastType(type) {
  try { localStorage.setItem('lastType', type); } catch { /* egal */ }
}
function getLastPaid() {
  try { return localStorage.getItem('lastPaid') !== 'open'; } catch { return true; }
}
function setLastPaid(paid) {
  try { localStorage.setItem('lastPaid', paid ? 'paid' : 'open'); } catch { /* egal */ }
}

/**
 * Öffnet das Formular. WICHTIG: Muss direkt im Klick-Handler aufgerufen
 * werden (ohne await davor), sonst öffnet das iPhone die Tastatur nicht.
 */
export function openBookingForm(existing = null) {
  if (open) return;
  open = true;

  const isEdit = !!existing;
  const st = {
    type: existing?.type || getLastType(),
    categoryId: existing?.categoryId || null,
    payment: existing?.payment || null,
    receiptId: existing?.receiptId || null, // gespeichertes Foto
    newReceipt: null,                        // neu gewähltes Foto
    removeReceipt: false,
    receiptBusy: false,
    saving: false,
    dirty: false,
    mileage: false, // Fahrtkosten-Modus: Kilometer statt Betrag
    // Einnahme schon bezahlt? (Ausgaben sind immer bezahlt)
    paid: existing ? existing.paid !== false : getLastPaid(),
    // Datum der Stunde zusätzlich zeigen, wenn die Buchung offen war/ist
    showService: !!existing?.serviceDate || existing?.paid === false,
  };
  // Kilometerpauschale: bei bestehenden Fahrten die damals gültige, sonst die aktuelle
  const kmRateCents = existing?.kmRateCents ?? state.settings.kmRateCents;
  const objectUrls = [];

  // ---------- Elemente ----------

  const title = h('h1', { class: 'sheet-title', id: 'sheet-title' });

  const typeButtons = {
    expense: h('button', { type: 'button', class: 'expense', onclick: () => setType('expense') }, 'Ausgabe'),
    income: h('button', { type: 'button', class: 'income', onclick: () => setType('income') }, 'Einnahme'),
  };

  const amountInput = h('input', {
    class: 'amount-input',
    id: 'amount',
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    placeholder: '0,00',
    'aria-label': 'Betrag in Euro',
    value: existing ? (existing.km != null ? formatKm(existing.km) : centsToInput(existing.amountCents)) : '',
    oninput: () => { st.dirty = true; updateAmountHint(); clearError(); },
  });
  const amountLabel = h('label', { class: 'lbl', for: 'amount' }, 'Betrag');
  const amountSuffix = h('span', { class: 'amount-suffix', 'aria-hidden': 'true' }, '€');
  const kmInfo = h('p', { class: 'hint km-info', hidden: true });
  const amountHint = h('p', { class: 'hint warn', hidden: true },
    'Hinweis: Kostet eine Anschaffung (z. B. ein Gerät, das länger als ein Jahr hält) netto mehr als 800 €, '
    + 'muss sie meist über mehrere Jahre abgeschrieben werden. Im Zweifel bei Steuerberatung nachfragen.');

  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Kategorie' });

  const personLabel = h('label', { class: 'lbl', for: 'person' }, 'Kund:in (optional)');
  const picker = personPicker({ initialId: existing?.personId, onChange: () => { st.dirty = true; } });

  const descInput = h('input', {
    class: 'field',
    id: 'desc',
    type: 'text',
    maxlength: 200,
    autocomplete: 'off',
    autocapitalize: 'sentences',
    enterkeyhint: 'done',
    placeholder: 'z. B. Einzelstunde Bello',
    value: existing?.description || '',
    oninput: () => { st.dirty = true; },
    onkeydown: (e) => {
      // Auf dem Handy schließt "Fertig" nur die Tastatur, statt zu speichern
      if (e.key === 'Enter' && isTouchDevice()) { e.preventDefault(); descInput.blur(); }
    },
  });

  // Zahlungsdatum (zählt für die EÜR)
  const dateInput = h('input', {
    class: 'field',
    id: 'date',
    type: 'date',
    required: true,
    value: existing && existing.paid !== false ? existing.date : todayISO(),
    onchange: () => { st.dirty = true; clearError(); },
  });
  const dateWrap = h('div', null, h('label', { class: 'lbl', for: 'date' }, 'Datum der Zahlung'), dateInput);

  // Datum der Stunde (bei offenen Einnahmen)
  const serviceInput = h('input', {
    class: 'field',
    id: 'service-date',
    type: 'date',
    value: existing?.serviceDate || existing?.date || todayISO(),
    onchange: () => { st.dirty = true; clearError(); },
  });
  const serviceWrap = h('div', null, h('label', { class: 'lbl', for: 'service-date' }, 'Datum der Stunde'), serviceInput);

  const openHint = h('p', { class: 'hint' },
    'Erscheint unter „Offene Zahlungen“ und zählt erst zum Gewinn, wenn du sie als bezahlt abhakst.');

  // Zahlung: Bar / Überweisung / PayPal – oder (nur Einnahmen) "Noch offen"
  const openChip = h('button', {
    type: 'button',
    class: 'chip chip-open',
    onclick: () => setPaid(!st.paid),
  }, 'Noch offen');
  const payChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Zahlung' },
    PAYMENT_METHODS.map((p) => h('button', {
      type: 'button',
      class: 'chip',
      'data-value': p.value,
      onclick: () => {
        // nochmal tippen = abwählen; eine Zahlungsart heißt immer "bezahlt"
        st.payment = st.payment === p.value && st.paid ? null : p.value;
        st.dirty = true;
        if (!st.paid) setPaid(true);
        else updatePayChips();
      },
    }, p.label)),
    openChip);

  const payLabel = h('div', { class: 'lbl' }, 'Zahlung');
  const payWrap = h('div', null, payLabel, payChips, openHint);
  const personWrap = h('div');

  const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: onFileChosen });
  const receiptRow = h('div', { class: 'receipt-row' });

  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const saveBtn = h('button', { type: 'submit', class: 'btn primary block' }, 'Speichern');
  const saveBtnTop = h('button', { type: 'submit', class: 'round-btn confirm', 'aria-label': 'Speichern' }, icon('check', 24));

  const form = h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); save(); } },
    h('header', { class: 'sheet-bar' },
      h('button', { type: 'button', class: 'round-btn', 'aria-label': 'Abbrechen', onclick: cancel }, icon('close', 22)),
      title,
      saveBtnTop),
    h('div', { class: 'sheet-body' },
      h('div', { class: 'segmented', role: 'group', 'aria-label': 'Art der Buchung' },
        typeButtons.income, typeButtons.expense),

      amountLabel,
      h('div', { class: 'amount-wrap' }, amountInput, amountSuffix),
      kmInfo,
      amountHint,

      h('div', { class: 'lbl', id: 'cat-label' }, 'Kategorie'),
      chips,

      personWrap,

      h('label', { class: 'lbl', for: 'desc' }, 'Beschreibung (optional)'),
      descInput,

      payWrap,
      serviceWrap,
      dateWrap,

      h('div', { class: 'lbl' }, 'Beleg (optional)'),
      receiptRow,
      fileInput,

      errorBox,

      h('div', { class: 'form-actions' },
        saveBtn,
        isEdit ? h('button', { type: 'button', class: 'btn-text danger', onclick: remove }, 'Buchung löschen') : null)));

  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' }, form);

  // ---------- Anzeige aktualisieren ----------

  function setType(type) {
    if (st.type === type) return;
    st.type = type;
    const cat = categoryById(st.categoryId);
    if (cat && cat.type !== type) st.categoryId = null;
    updateType();
    renderChips();
    updateMode();
  }

  /** Fahrtkosten-Kategorie gewählt? Dann Kilometer statt Betrag eingeben. */
  function updateMode() {
    st.mileage = !!categoryById(st.categoryId)?.mileage;
    amountLabel.textContent = st.mileage ? 'Gefahrene Kilometer' : 'Betrag';
    amountSuffix.textContent = st.mileage ? 'km' : '€';
    amountInput.placeholder = st.mileage ? '0' : '0,00';
    amountInput.setAttribute('aria-label', st.mileage ? 'Gefahrene Kilometer' : 'Betrag in Euro');
    updateAmountHint();
    updatePerson();
  }

  function updateType() {
    sheet.classList.toggle('t-expense', st.type === 'expense');
    sheet.classList.toggle('t-income', st.type === 'income');
    typeButtons.expense.setAttribute('aria-pressed', String(st.type === 'expense'));
    typeButtons.income.setAttribute('aria-pressed', String(st.type === 'income'));
    const word = st.type === 'income' ? 'Einnahme' : 'Ausgabe';
    title.textContent = isEdit ? `${word} bearbeiten` : `Neue ${word}`;
    personLabel.textContent = 'Kund:in (optional)';
    updateStatus();
  }

  function setPaid(paid) {
    if (st.paid === paid) return;
    st.paid = paid;
    st.dirty = true;
    if (!paid) { st.showService = true; st.payment = null; }
    updateStatus();
  }

  function isOpenEntry() { return st.type === 'income' && !st.paid; }

  function updateStatus() {
    const income = st.type === 'income';
    const open = isOpenEntry();
    openChip.hidden = !income;
    payLabel.textContent = income ? 'Zahlung' : 'Zahlung (optional)';
    openHint.hidden = !open;
    serviceWrap.hidden = !(open || (income && st.showService));
    dateWrap.hidden = open;
    updatePayChips();
    updatePerson();
  }

  // Kund:in: bei Einnahmen immer, bei Ausgaben nur für Fahrten (oder wenn schon gewählt)
  function updatePerson() {
    const show = st.type === 'income' || st.mileage || picker.hasSelection() || !!picker.input.value.trim();
    if (show && !personWrap.firstChild) personWrap.append(personLabel, picker.el);
    if (!show) personWrap.replaceChildren();
  }

  function renderChips() {
    const cats = categoriesFor(st.type, { recentFirst: !isEdit });
    chips.replaceChildren(...cats.map((c) => h('button', {
      type: 'button',
      class: 'chip',
      'aria-pressed': String(c.id === st.categoryId),
      onclick: (e) => {
        st.categoryId = c.id;
        st.dirty = true;
        clearError();
        for (const el of chips.children) el.setAttribute('aria-pressed', String(el === e.currentTarget));
        const wasMileage = st.mileage;
        updateMode();
        if (st.mileage && !wasMileage) {
          // Fahrtkosten: weiter zur Kilometer-Eingabe
          amountInput.focus();
          amountInput.select();
        } else if (isEdit) {
          // beim Bearbeiten nichts automatisch fokussieren
        } else if (st.type === 'income' && !picker.hasSelection()) {
          // Einnahme: weiter zur Kund:in. Gibt es schon Namen, Tastatur schließen,
          // damit die Vorschläge zu sehen sind; sonst gleich tippen lassen.
          if (state.contacts.length) document.activeElement?.blur();
          else picker.input.focus();
        } else if (!descInput.value) {
          // sonst direkt weiter zur Beschreibung
          descInput.focus();
        }
      },
    }, c.name)));
  }

  function updatePayChips() {
    for (const el of payChips.children) {
      if (el === openChip) el.setAttribute('aria-pressed', String(isOpenEntry()));
      else el.setAttribute('aria-pressed', String(st.paid && el.dataset.value === st.payment));
    }
  }

  function updateAmountHint() {
    const value = parseAmount(amountInput.value);
    amountHint.hidden = st.mileage || !(st.type === 'expense' && value != null && value > GWG_HINT_CENTS);
    kmInfo.hidden = !st.mileage;
    if (st.mileage) {
      const rate = formatMoney(kmRateCents);
      kmInfo.textContent = value
        ? `= ${formatMoney(Math.round((value * kmRateCents) / 100))}  (${formatKm(value / 100)} km × ${rate})`
        : `Der Betrag wird mit ${rate} pro km berechnet (änderbar in den Einstellungen).`;
    }
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function clearError() { errorBox.hidden = true; }

  // ---------- Belegfoto ----------

  function urlFor(blob) {
    const url = URL.createObjectURL(blob);
    objectUrls.push(url);
    return url;
  }

  function thumb(url) {
    return h('button', { type: 'button', class: 'receipt-thumb', 'aria-label': 'Beleg ansehen', onclick: () => openImageViewer(url) },
      h('img', { src: url, alt: 'Beleg' }));
  }

  async function renderReceipt() {
    if (st.receiptBusy) {
      receiptRow.replaceChildren(h('span', { class: 'muted' }, 'Foto wird verkleinert …'));
      return;
    }
    const addBtn = (label) => h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, icon('camera'), label);
    const removeBtn = h('button', {
      type: 'button',
      class: 'btn-text danger',
      onclick: () => { st.newReceipt = null; st.removeReceipt = !!st.receiptId; st.dirty = true; renderReceipt(); },
    }, 'Entfernen');

    if (st.newReceipt) {
      receiptRow.replaceChildren(thumb(urlFor(receiptToBlob(st.newReceipt))), addBtn('Ersetzen'), removeBtn);
      return;
    }
    if (st.receiptId && !st.removeReceipt) {
      receiptRow.replaceChildren(h('span', { class: 'muted' }, 'Beleg wird geladen …'));
      const rec = await getReceipt(st.receiptId).catch(() => null);
      if (st.newReceipt || st.removeReceipt) return; // inzwischen geändert
      if (rec) {
        receiptRow.replaceChildren(thumb(urlFor(receiptToBlob(rec))), addBtn('Ersetzen'), removeBtn);
      } else {
        receiptRow.replaceChildren(h('span', { class: 'muted' }, 'Foto nicht gefunden.'), addBtn('Foto hinzufügen'));
      }
      return;
    }
    receiptRow.replaceChildren(addBtn('Foto hinzufügen'));
  }

  async function onFileChosen() {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    st.receiptBusy = true;
    renderReceipt();
    try {
      st.newReceipt = await resizeImage(file);
      st.removeReceipt = false;
      st.dirty = true;
    } catch (err) {
      showError(err.message || 'Das Foto konnte nicht verarbeitet werden.');
    } finally {
      st.receiptBusy = false;
      renderReceipt();
    }
  }

  // ---------- Speichern / Löschen / Schließen ----------

  async function save() {
    if (st.saving || st.receiptBusy) return;
    const cat = categoryById(st.categoryId);
    const value = parseAmount(amountInput.value); // Cent bzw. Hundertstel-Kilometer
    let cents = value;
    let km = null;
    if (cat?.mileage) {
      if (value == null || value <= 0) {
        showError(amountInput.value.trim() ? 'Bitte gültige Kilometer eingeben, z. B. 42 oder 12,5.' : 'Bitte die gefahrenen Kilometer eingeben.');
        return;
      }
      if (value > 10000000) { showError('So viele Kilometer? Bitte prüfen.'); return; }
      km = value / 100;
      cents = Math.round((value * kmRateCents) / 100);
    } else {
      if (value == null || value <= 0) {
        showError(amountInput.value.trim() ? 'Bitte einen gültigen Betrag eingeben, z. B. 45,50.' : 'Bitte einen Betrag eingeben.');
        return;
      }
      if (value > 100000000) { showError('Der Betrag ist ungewöhnlich hoch. Bitte prüfen.'); return; }
    }
    if (!cat || cat.type !== st.type) { showError('Bitte eine Kategorie wählen.'); return; }
    const DATE = /^\d{4}-\d{2}-\d{2}$/;
    const open = isOpenEntry();
    const withService = open || (st.type === 'income' && st.showService);
    if (withService && !DATE.test(serviceInput.value)) { showError('Bitte das Datum der Stunde wählen.'); return; }
    if (!open && !DATE.test(dateInput.value)) { showError('Bitte das Datum der Zahlung wählen.'); return; }

    st.saving = true;
    saveBtn.disabled = true;
    saveBtnTop.disabled = true;
    try {
      // Neue Kund:in gleich mit anlegen
      let { personId = null, newName } = picker.value();
      if (newName) personId = (await saveContact({ name: newName }, { silent: true })).id;

      const receiptChange = st.newReceipt
        ? { add: { data: st.newReceipt.data, type: st.newReceipt.type, width: st.newReceipt.width, height: st.newReceipt.height } }
        : (st.removeReceipt ? { remove: true } : null);
      await saveBooking({
        id: existing?.id,
        type: st.type,
        // Offen: Datum der Stunde (bis zur Zahlung). Bezahlt: Datum der Zahlung.
        date: open ? serviceInput.value : dateInput.value,
        paid: !open,
        serviceDate: withService ? serviceInput.value : null,
        amountCents: cents,
        categoryId: cat.id,
        description: descInput.value.trim(),
        payment: open ? null : st.payment,
        km,
        kmRateCents: km != null ? kmRateCents : null,
        personId,
      }, receiptChange);
      setLastType(st.type);
      if (!isEdit && st.type === 'income') setLastPaid(!open);
      close();
      toast(isEdit ? 'Änderung gespeichert' : open ? 'Offene Einnahme gespeichert' : `${st.type === 'income' ? 'Einnahme' : 'Ausgabe'} gespeichert`);
    } catch (err) {
      console.error(err);
      showError(`Speichern hat nicht geklappt: ${err.message || err}`);
      st.saving = false;
      saveBtn.disabled = false;
      saveBtnTop.disabled = false;
    }
  }

  async function remove() {
    const label = existing.description || categoryById(existing.categoryId)?.name || 'Buchung';
    const ok = await confirmDialog({
      title: 'Buchung löschen?',
      text: `„${label}“ vom ${formatDate(existing.date)} über ${formatMoney(existing.amountCents)} wird gelöscht. Das lässt sich nicht rückgängig machen.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBooking(existing.id);
      close();
      toast('Buchung gelöscht');
    } catch (err) {
      showError(`Löschen hat nicht geklappt: ${err.message || err}`);
    }
  }

  async function cancel() {
    if (st.dirty && !st.saving) {
      const ok = await confirmDialog({
        title: 'Änderungen verwerfen?',
        text: 'Die Eingaben werden nicht gespeichert.',
        confirmLabel: 'Verwerfen',
        cancelLabel: 'Weiter bearbeiten',
        danger: true,
      });
      if (!ok) return;
    }
    close();
  }

  function onKey(e) {
    if (e.key === 'Escape' && !document.querySelector('dialog[open], .viewer')) cancel();
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    document.body.classList.remove('sheet-open');
    for (const url of objectUrls) URL.revokeObjectURL(url);
    open = false;
    for (const fn of closeListeners) fn();
  }

  // ---------- Start ----------

  updateType();
  renderChips();
  updateMode();
  renderReceipt();

  document.body.append(sheet);
  document.body.classList.add('sheet-open');
  document.addEventListener('keydown', onKey);

  // Sofort fokussieren (noch im selben Tipp), damit die Zahlentastatur aufgeht
  if (!isEdit) amountInput.focus({ preventScroll: true });
}
