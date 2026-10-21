// Posta Yahoo (IMAP/SMTP) e stampa silenziosa su Windows: usate sia dall'estensione sia dall'assistente vocale.
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const nodemailer = require("nodemailer");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CARTELLA_ALLEGATI = path.join(os.homedir(), "Documents", "Allegati posta");
const MAX_TESTO = 15000;

function crea({ email, password, nome = "", imapHost = "imap.mail.yahoo.com", imapPort = 993, smtpHost = "smtp.mail.yahoo.com" }) {
  const EMAIL = (email || "").trim();
  const PASSWORD = (password || "").replace(/\s+/g, "");
  const NOME = (nome || "").trim();

  // Apre la casella, esegue fn dentro la cartella e chiude sempre la connessione.
  async function conCartella(cartella, fn) {
    const client = new ImapFlow({
      host: imapHost, port: imapPort, secure: imapPort === 993,
      auth: { user: EMAIL, pass: PASSWORD },
      logger: false,
    });
    await client.connect();
    const lock = await client.getMailboxLock(cartella || "INBOX");
    try {
      return await fn(client);
    } finally {
      lock.release();
      await client.logout().catch(() => {});
    }
  }

  async function riassunti(client, uids) {
    const righe = [];
    for await (const m of client.fetch(uids, { uid: true, envelope: true, flags: true }, { uid: true })) {
      righe.push({
        uid: m.uid,
        letta: m.flags.has("\\Seen"),
        da: mittente(m.envelope),
        oggetto: m.envelope.subject || "(senza oggetto)",
        data: m.envelope.date,
      });
    }
    righe.sort((a, b) => new Date(b.data) - new Date(a.data));
    return righe.map((r) => `• [id ${r.uid}] ${r.letta ? "" : "NON LETTA · "}${data(r.data)}\n  Da: ${r.da}\n  Oggetto: ${r.oggetto}`).join("\n\n");
  }

  async function scarica(client, uid) {
    const { content } = await client.download(String(uid), undefined, { uid: true });
    return simpleParser(content);
  }

  async function elenco({ quante = 10, solo_non_lette = false, cartella } = {}) {
    return conCartella(cartella, async (client) => {
      const tutte = await client.search(solo_non_lette ? { seen: false } : { all: true }, { uid: true });
      if (!tutte || !tutte.length) return solo_non_lette ? "Nessuna email nuova." : "La cartella è vuota.";
      const ultime = tutte.slice(-quante);
      return `${solo_non_lette ? `Email non lette: ${tutte.length}` : `Ultime ${ultime.length} email`}\n\n${await riassunti(client, ultime)}`;
    });
  }

  async function leggi({ id, cartella }) {
    return conCartella(cartella, async (client) => {
      const mail = await scarica(client, id);
      await client.messageFlagsAdd(String(id), ["\\Seen"], { uid: true });
      return comeTesto(mail);
    });
  }

  async function cerca({ testo, quante = 10, cartella }) {
    return conCartella(cartella, async (client) => {
      const trovate = await client.search({ or: [{ from: testo }, { subject: testo }, { body: testo }] }, { uid: true });
      if (!trovate || !trovate.length) return `Nessuna email trovata per "${testo}".`;
      return `Trovate ${trovate.length} email per "${testo}" (le più recenti):\n\n${await riassunti(client, trovate.slice(-quante))}`;
    });
  }

  async function stampa({ id, cartella }) {
    const mail = await conCartella(cartella, (client) => scarica(client, id));
    await stampaTesto(comeTesto(mail));
    return `Email "${mail.subject || "(senza oggetto)"}" mandata alla stampante.`;
  }

  async function salvaAllegato(id, numero, cartella) {
    return conCartella(cartella, async (client) => {
      const mail = await scarica(client, id);
      const a = (mail.attachments || [])[numero - 1];
      if (!a) throw new Error(`L'email non ha l'allegato numero ${numero}.`);
      fs.mkdirSync(CARTELLA_ALLEGATI, { recursive: true });
      const nome = (a.filename || `allegato-${numero}`).replace(/[\\/:*?"<>|]/g, "_");
      const file = path.join(CARTELLA_ALLEGATI, nome);
      fs.writeFileSync(file, a.content);
      return file;
    });
  }

  // Ricette e documenti sul desktop: l'allegato (PDF…) oppure, se non ce n'è, il testo dell'email.
  async function salvaSulDesktop({ id, numero, cartella, nome }) {
    if (numero) {
      const file = await salvaAllegato(id, numero, cartella);
      return copiaSulDesktop(file, nome);
    }
    const mail = await conCartella(cartella, (client) => scarica(client, id));
    const tmp = path.join(os.tmpdir(), `email-${Date.now()}.txt`);
    fs.writeFileSync(tmp, "\ufeff" + comeTesto(mail), "utf8");
    return copiaSulDesktop(tmp, nome);
  }

  async function stampaAllegato({ id, numero = 1, cartella }) {
    const file = await salvaAllegato(id, numero, cartella);
    await stampaFile(file);
    return `Allegato mandato alla stampante. Una copia è in: ${file}`;
  }

  async function apriAllegato({ id, numero = 1, cartella }) {
    const file = await salvaAllegato(id, numero, cartella);
    if (process.platform === "win32") await powershell(`Start-Process -FilePath ${psStr(file)}`);
    return `Allegato aperto. È salvato in: ${file}`;
  }

  const smtp = () => nodemailer.createTransport({ host: smtpHost, port: 465, secure: true, auth: { user: EMAIL, pass: PASSWORD } });
  const da = () => (NOME ? `"${NOME}" <${EMAIL}>` : EMAIL);

  async function invia({ a, oggetto, testo }) {
    await smtp().sendMail({ from: da(), to: a, subject: oggetto, text: testo });
    return `Email inviata a ${a}.`;
  }

  async function rispondi({ id, testo, cartella }) {
    const orig = await conCartella(cartella, (client) => scarica(client, id));
    const a = (orig.replyTo || orig.from).value[0].address;
    const oggetto = /^re:/i.test(orig.subject || "") ? orig.subject : `Re: ${orig.subject || ""}`;
    const citato = (orig.text || "").split("\n").map((r) => "> " + r).join("\n");
    await smtp().sendMail({
      from: da(), to: a, subject: oggetto,
      text: `${testo}\n\n${data(orig.date)}, ${orig.from ? orig.from.text : ""} ha scritto:\n${citato}`,
      inReplyTo: orig.messageId,
      references: [].concat(orig.references || [], orig.messageId || []),
    });
    return `Risposta inviata a ${a}.`;
  }

  // Controlla subito che email e password per app funzionino.
  async function prova() {
    return conCartella("INBOX", async (client) => client.status("INBOX", { messages: true, unseen: true }));
  }

  return { elenco, leggi, cerca, stampa, stampaAllegato, apriAllegato, salvaSulDesktop, invia, rispondi, prova, destinatarioRisposta };

  async function destinatarioRisposta({ id, cartella }) {
    const orig = await conCartella(cartella, (client) => scarica(client, id));
    return { a: (orig.replyTo || orig.from).value[0].address, oggetto: orig.subject || "" };
  }
}

const data = (d) => (d ? new Date(d).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" }) : "");
const mittente = (env) => {
  const a = env && env.from && env.from[0];
  return a ? (a.name ? `${a.name} <${a.address}>` : a.address) : "(sconosciuto)";
};

function comeTesto(mail) {
  const corpo = (mail.text || "").trim() || "(email senza testo)";
  const allegati = (mail.attachments || []).map((a, i) => `  ${i + 1}. ${a.filename || "allegato"} (${Math.ceil(a.size / 1024)} KB)`);
  return [
    `Da: ${mail.from ? mail.from.text : ""}`,
    `A: ${mail.to ? mail.to.text : ""}`,
    `Data: ${data(mail.date)}`,
    `Oggetto: ${mail.subject || "(senza oggetto)"}`,
    "",
    corpo.length > MAX_TESTO ? corpo.slice(0, MAX_TESTO) + "\n[…testo tagliato perché troppo lungo]" : corpo,
    allegati.length ? `\nAllegati:\n${allegati.join("\n")}` : "",
  ].join("\n");
}

function powershell(comando, attesa = 60000) {
  return new Promise((ok, ko) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", comando], { windowsHide: true, timeout: attesa },
      (err, _out, stderr) => (err ? ko(new Error(stderr || err.message)) : ok()));
  });
}
const psStr = (s) => "'" + s.replace(/'/g, "''") + "'";

// Prima di stampare: la stampante predefinita è vera, accesa e senza fogli rimasti in coda?
// (Con la stampante spenta Windows mette il foglio in coda senza errori, e uscirebbe ore dopo.)
const FINTE = /pdf|onenote|fax|xps|anydesk|send to/i;
function giudicaStampante(s) {
  if (!s || !s.nome) return "Su questo computer non c'è una stampante predefinita: serve l'aiuto del figlio per sceglierla.";
  if (FINTE.test(s.nome)) return `La stampante predefinita è "${s.nome}", che non stampa su carta: serve l'aiuto del figlio per scegliere quella vera.`;
  if (s.offline) return `La stampante "${s.nome}" sembra spenta o scollegata. Chiedile di accenderla e di dirti quando è pronta, poi riprova.`;
  if (s.inCoda > 0) return `Nella stampante "${s.nome}" ci sono ancora ${s.inCoda} fogli in attesa (forse era spenta prima): chiedile se la stampante è accesa e se sono usciti, così non escono doppi; poi riprova.`;
  return null;
}
async function controllaStampante() {
  if (process.platform !== "win32") return;
  const out = await new Promise((ok) => execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `
    [Console]::OutputEncoding = [Text.Encoding]::UTF8
    $p = Get-CimInstance Win32_Printer -Filter "Default=TRUE" | Select-Object -First 1
    if (-not $p) { '{}'; exit }
    $coda = @(Get-PrintJob -PrinterName $p.Name -ErrorAction SilentlyContinue).Count
    @{ nome = $p.Name; offline = ($p.WorkOffline -or $p.PrinterStatus -eq 7 -or $p.ExtendedPrinterStatus -eq 7 -or $p.DetectedErrorState -eq 9); inCoda = $coda } | ConvertTo-Json -Compress`],
    { windowsHide: true, timeout: 30000, encoding: "utf8" }, (err, stdout) => ok(err ? "" : stdout)));
  let stato;
  try { stato = JSON.parse(out.trim() || "{}"); } catch { return; }     // se il controllo non riesce, si stampa lo stesso
  const problema = giudicaStampante(stato);
  if (problema) throw new Error(problema);
}

async function stampaTesto(contenuto) {
  if (process.platform !== "win32") throw new Error("La stampa funziona solo su Windows.");
  await controllaStampante();
  const file = path.join(os.tmpdir(), `email-${Date.now()}.txt`);
  fs.writeFileSync(file, "﻿" + contenuto, "utf8");
  // Out-Printer manda il testo alla stampante predefinita senza aprire finestre.
  await powershell(`Get-Content -LiteralPath ${psStr(file)} -Encoding UTF8 | Out-Printer`);
}

// La cartella del desktop vera (con OneDrive può non essere in C:\Users\nome\Desktop).
let desktop = null;
function cartellaDesktop() {
  if (desktop) return desktop;
  if (process.platform === "win32") {
    try {
      desktop = require("child_process").execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        "[Console]::OutputEncoding=[Text.Encoding]::UTF8; [Environment]::GetFolderPath('Desktop')"], { windowsHide: true, encoding: "utf8" }).trim();
    } catch {}
  }
  desktop = desktop || path.join(os.homedir(), "Desktop");
  return desktop;
}

// Copia un file sul desktop con un nome chiaro (es. "Ricetta 21-10-2026.pdf"), senza sovrascrivere quelli che ci sono.
function copiaSulDesktop(file, nome) {
  const est = path.extname(file) || ".pdf";
  const base = String(nome || path.basename(file, est)).replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 80) || "Documento";
  fs.mkdirSync(cartellaDesktop(), { recursive: true });
  let dest = path.join(cartellaDesktop(), base + est);
  for (let i = 2; fs.existsSync(dest); i++) dest = path.join(cartellaDesktop(), `${base} (${i})${est}`);
  fs.copyFileSync(file, dest);
  return dest;
}

// SumatraPDF stampa i PDF sulla stampante predefinita senza aprire finestre, qualunque sia il lettore predefinito.
function trovaSumatra() {
  return [
    path.join(process.env.LOCALAPPDATA || "", "SumatraPDF", "SumatraPDF.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "SumatraPDF", "SumatraPDF.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "SumatraPDF", "SumatraPDF.exe"),
  ].find((p) => fs.existsSync(p));
}

// Stampa un file (PDF, foto…) sulla stampante predefinita: per i PDF prima SumatraPDF, altrimenti il comando "Stampa"
// di Windows del programma predefinito (Acrobat Reader, Foxit…).
async function stampaFile(file) {
  if (process.platform !== "win32") throw new Error("La stampa funziona solo su Windows.");
  await controllaStampante();
  const sumatra = /\.pdf$/i.test(file) && trovaSumatra();
  if (sumatra) {
    await new Promise((ok, ko) => execFile(sumatra, ["-print-to-default", "-silent", file], { windowsHide: true, timeout: 120000 },
      (err) => (err ? ko(err) : ok())));
    return;
  }
  try {
    await powershell(`Start-Process -FilePath ${psStr(file)} -Verb Print -WindowStyle Hidden`);
  } catch {
    throw new Error(`Non riesco a stamparlo da solo: manca un programma che sappia stampare questo tipo di file (per i PDF installa SumatraPDF o Adobe Acrobat Reader). Il file è in: ${file}`);
  }
}
async function apriFile(file) {
  if (process.platform === "win32") await powershell(`Start-Process -FilePath ${psStr(file)}`);
}

module.exports = { crea, powershell, psStr, stampaFile, apriFile, trovaSumatra, copiaSulDesktop, cartellaDesktop, giudicaStampante };
