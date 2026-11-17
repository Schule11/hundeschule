# Hundeschule – Einnahmen & Ausgaben

Eine kleine App, um die Einnahmen und Ausgaben der **Hundeschule Marburg** zu erfassen.
Am Jahresende liefert sie die Summen für die **Anlage EÜR**, als CSV und als PDF.

- läuft im Browser und lässt sich auf dem iPhone wie eine App installieren
- funktioniert auch ohne Internet
- **alle Daten bleiben auf deinem Gerät**: kein Server, keine Anmeldung, keine Kosten
- Kleinunternehmer nach § 19 UStG: keine Umsatzsteuer, alle Beträge brutto

**Adresse der App:** https://schule11.github.io/hundeschule/

---

## 1. App auf dem iPhone installieren

1. Die Adresse oben in **Safari** öffnen.
2. Auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben, bei neuem iOS erst auf „•••“).
3. **Zum Home-Bildschirm** wählen und dann **Hinzufügen**.
4. Ab jetzt die App immer über das Symbol auf dem Home-Bildschirm öffnen.

> **Wichtig:** Die installierte App hat ihren **eigenen Speicher**, getrennt vom Safari-Tab.
> Trage Buchungen nur in der installierten App ein.
>
> **Löschst du die App vom Home-Bildschirm, löscht das iPhone auch ihre Daten.**
> Mach deshalb vorher immer ein Backup (siehe Abschnitt 3).

## 2. Die App benutzen

| Bereich | Was du dort machst |
|---|---|
| **+ (runder Knopf neben der Menüleiste)** | Neue Buchung (startet als Einnahme): Betrag, Kategorie, Kund:in, Beschreibung, Zahlung, Datum, Belegfoto. Oben rechts ✓ speichert, ✕ bricht ab. |
| **Menüleiste unten** | Übersicht, Buchungen, Auswertung |
| **Übersicht** | Offene Zahlungen zum Abhaken, Einnahmen, Ausgaben und Gewinn des Monats und des Jahres, Hinweise |
| **Buchungen** | Alle Buchungen nach Monaten; Suche und Filter (auch „Offen“); antippen zum Bearbeiten oder Löschen |
| **Auswertung** | Summen für die Anlage EÜR, pro Kategorie und pro Monat; Export als PDF und CSV |
| **Einstellungen** (Zahnrad oben rechts) | Kurze Liste wie in den iPhone-Einstellungen: Name, Kategorien, Kund:innen, offene Zahlungen, Fahrtkosten, Kleinunternehmergrenze, Backup, hell/dunkel |

**Fahrtkosten:** Wählst du die Kategorie „Fahrtkosten“, gibst du statt eines Betrags die gefahrenen Kilometer ein.
Die App rechnet mit der Kilometerpauschale aus den Einstellungen (Standard 0,30 €/km).
Änderst du die Pauschale, gilt der neue Wert nur für neue Fahrten.

**Kund:innen:** Bei einer Einnahme (und auf Wunsch auch bei einer Ausgabe, z. B. einer Fahrt) wählst du,
von wem das Geld kommt. Die zuletzt benutzten Namen stehen als Knöpfe bereit; beim Tippen wird gefiltert.
Ein neuer Name wird beim Speichern automatisch angelegt. Unter *Einstellungen → Kund:innen* kannst du Namen
ändern, einen Hundenamen ergänzen (wird mit angezeigt und ist durchsuchbar) und alle Buchungen einer Person ansehen.
Die *Auswertung* zeigt außerdem „Einnahmen nach Kund:in“.

**Offene Zahlungen:** Bei einer Einnahme wählst du unter **„Zahlung“** die Zahlungsart (Bar, Überweisung, PayPal)
oder **„Noch offen“**. Ohne Auswahl gilt die Einnahme als bezahlt. Offene Einnahmen
stehen ganz oben auf der *Übersicht* unter „Offene Zahlungen“. Sobald bezahlt wurde, tippst du auf den **Kreis**
(„Rückgängig“ ist kurz möglich). Ist eine Zahlung seit **14 Tagen** offen (einstellbar unter *Einstellungen →
Offene Zahlungen*), wird sie **rot** markiert. Optional zeigt das **App-Symbol** auf dem Home-Bildschirm die Zahl
offener Zahlungen (iOS fragt dafür einmal nach der Erlaubnis für Mitteilungen; die App verschickt aber keine).
Eine Push-Nachricht zu einem bestimmten Zeitpunkt ist ohne eigenen Server nicht möglich – die Erinnerung siehst
du deshalb beim Öffnen der App.

> **Steuerlich wichtig:** Offene Einnahmen zählen **noch nicht** zu Einnahmen, Gewinn, Anlage EÜR und
> Kleinunternehmergrenze – erst, wenn das Geld da ist (Zuflussprinzip). Beim Abhaken wird **heute** als
> Zahlungsdatum eingetragen; kam das Geld früher, änderst du das Datum in der Buchung. Eine Stunde im Dezember,
> die im Januar bezahlt wird, zählt im neuen Jahr.

**Datum = Tag der Zahlung.** Die EÜR zählt, wann das Geld geflossen ist, nicht wann die Rechnung kam.

## 3. Backup machen (bitte regelmäßig!)

Deine Daten liegen nur auf dem Handy. Ein Backup schützt vor Verlust, zum Beispiel bei einem Handywechsel,
einem Defekt oder wenn du die App versehentlich löschst. Die App erinnert dich automatisch
(einstellbar unter *Einstellungen → An Backup erinnern*).

**Backup erstellen:**
1. *Einstellungen → Backup erstellen → Sichern …*
2. Im Teilen-Menü **In Dateien sichern** wählen, dann **iCloud Drive** und **Sichern**.
   Die Datei heißt z. B. `hundeschule-backup-2026-11-17.json` und enthält alle Buchungen, Kategorien,
   Einstellungen und Belegfotos.

**Backup einspielen** (neues Handy, nach Neuinstallation, am Laptop):
1. *Einstellungen → Backup einspielen* und die Datei auswählen.
2. **Zusammenführen** (empfohlen): Buchungen aus dem Backup kommen dazu, nichts wird doppelt,
   das jeweils Neuere gilt. **Alles ersetzen**: Die Daten auf diesem Gerät werden durch das Backup ersetzt.

**Handy wechseln:** Auf dem alten Handy ein Backup in iCloud Drive sichern. Auf dem neuen Handy die App
installieren (Abschnitt 1) und das Backup einspielen.

**Am Laptop ansehen oder ausdrucken:** Die Adresse im Browser öffnen, das neueste Backup vom Handy einspielen,
dann unter *Auswertung* das PDF erstellen. Das Handy bleibt das Hauptgerät.

## 4. Steuererklärung (Anlage EÜR)

1. *Auswertung* öffnen und das Jahr wählen. Von Januar bis Mai ist automatisch das Vorjahr ausgewählt.
2. Unter **„Für die Anlage EÜR“** stehen die Summen je Posten des Formulars. Die Bezeichnungen entsprechen
   denen in der Anlage EÜR bzw. in ELSTER. **Die Zeilennummern ändern sich fast jedes Jahr**, deshalb nennt
   die App die Bezeichnungen.
3. Als Kleinunternehmer gehören **alle Einnahmen** in den Posten
   „Betriebseinnahmen als umsatzsteuerlicher Kleinunternehmer“ (im Formular 2025: Zeile 12).
   Ausgaben trägst du **brutto** ein, also so, wie du bezahlt hast.
4. **PDF erstellen** gibt dir eine Jahresübersicht mit allen Buchungen zum Ablegen oder für die Steuerberatung.
   **CSV** öffnet sich direkt in Excel oder Numbers.

Welche Kategorie zu welchem Posten gehört, kannst du unter *Einstellungen → Kategorien Einnahmen/Ausgaben* ändern.

> Die App ersetzt keine Steuerberatung. Bitte prüfe die Zuordnung vor der Abgabe mit dem aktuellen Formular.
> Hinweise: Anschaffungen über 800 € netto (z. B. Geräte) müssen meist über mehrere Jahre abgeschrieben werden;
> das berechnet die App nicht. Bewahre die Original-Belege trotz Foto in der App auf (Aufbewahrungsfristen).

**Kleinunternehmergrenze:** Die App warnt dezent auf der Übersicht, wenn dein Umsatz sich den Grenzen nähert
(Standard: 25.000 € im Vorjahr, 100.000 € im laufenden Jahr, Hinweis ab 80 %). Die Werte kannst du in den
Einstellungen anpassen, falls sich das Gesetz ändert.

## 5. Updates

Neue Versionen werden in dieses GitHub-Repository hochgeladen. Die App holt sie sich beim nächsten Öffnen
von selbst und zeigt kurz „App aktualisiert“ an. Deine Daten bleiben dabei erhalten.
Falls nichts passiert: die App im App-Umschalter wegwischen und neu öffnen.

## 6. Kostenlos online stellen (GitHub Pages)

Das ist bereits erledigt. Falls du die App einmal in ein neues Repository umziehen willst:

1. Auf github.com ein neues, **öffentliches** Repository anlegen und alle Dateien dieses Ordners hochladen
   (*Add file → Upload files*). Öffentlich ist nur der Programmcode, **nie deine Buchungen**.
2. Im Repository *Settings → Pages* öffnen, bei *Source* **Deploy from a branch** wählen,
   *Branch* **main** und Ordner **/ (root)** einstellen und auf **Save** tippen.
3. Nach 1–2 Minuten ist die App unter `https://<benutzername>.github.io/<repository>/` erreichbar.

## 7. Am Laptop lokal starten (optional)

Nur nötig, wenn du am Code etwas ausprobieren willst. Dafür brauchst du Python (kostenlos von python.org;
am Mac bietet macOS beim ersten Aufruf von `python3` die Installation an). Im Terminal im Projektordner:

```bash
cd hundeschule
```

```bash
python3 -m http.server 8000
```

Dann im Browser http://localhost:8000 öffnen. Beenden mit `Strg + C`.
(Ein Doppelklick auf `index.html` reicht nicht, weil Browser Offline-Modus und Datenbank nur über eine
Webadresse erlauben.)

---

## Für später: Aufbau des Codes

Reines HTML, CSS und JavaScript, ohne Build-Werkzeuge und ohne fremde Bibliotheken.

| Datei | Inhalt |
|---|---|
| `index.html`, `css/app.css` | Grundgerüst und Gestaltung (Farben als Variablen, hell/dunkel) |
| `js/app.js` | Start, Navigation, Updates |
| `js/db.js` | Datenbank im Browser (IndexedDB), Versionen und Umbauten |
| `js/data.js` | Buchungen, Kategorien, Einstellungen; Beträge immer in **Cent** (ganze Zahlen) |
| `js/defaults.js` | Vorbelegte Kategorien, Einstellungen, Posten der Anlage EÜR |
| `js/yearReport.js`, `js/exports.js`, `js/pdf.js` | Jahresauswertung, CSV, PDF |
| `js/backup.js` | Backup erstellen, prüfen, zusammenführen |
| `js/notices.js` | Kleinunternehmer-Hinweis, Backup-Erinnerung |
| `js/badge.js` | Zahl offener Zahlungen am App-Symbol |
| `js/views/*.js` | Die einzelnen Bildschirme (u. a. `personPicker.js`: Kund:in-Auswahl, `contacts.js`: Kund:innen verwalten) |
| `sw.js` | Offline-Modus (Liste aller Dateien) |

**Bei jeder Änderung** die Versionsnummer in `js/config.js` **und** `sw.js` erhöhen, damit Handys die neue
Version laden. Neue Dateien in die Liste in `sw.js` eintragen.

**Rechnungen ergänzen (Idee):** In `js/db.js` die `DB_VERSION` erhöhen und einen neuen Speicher `invoices`
anlegen (das Beispiel steht dort schon als Kommentar). Kund:innen gibt es bereits (`contacts`), eine Rechnung
kann also direkt auf `personId` verweisen, und eine Buchung über ein Feld `invoiceId` auf ihre Rechnung.
Vorhandene Daten bleiben dabei erhalten. Das Backup-Format (`BACKUP_FORMAT` in `js/config.js`) entsprechend erweitern.
