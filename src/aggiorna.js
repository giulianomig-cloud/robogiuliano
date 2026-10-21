// Aggiornamento automatico: scarica da GitHub la versione nuova del programma e si sostituisce da solo.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const RILASCI = "https://github.com/giulianomig-cloud/robogiuliano/releases/latest/download";
const VERSIONE = typeof __VERSIONE__ !== "undefined" ? __VERSIONE__ : "0.0.0-sviluppo";
const OGNI = 6 * 60 * 60 * 1000;

// "1.2.10" > "1.2.9"
function piuNuova(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

// Il programma installato (quello dell'icona e dell'avvio automatico) è l'unico che si aggiorna.
function percorsoInstallato() {
  return path.join(process.env.LOCALAPPDATA || "", "AssistenteClaude", "AssistenteClaude.exe");
}

let impostazioni = null;        // { log, occupato, riavvia } dal servizio acceso
let inCorso = false;

function installato() {
  return process.platform === "win32" && !VERSIONE.includes("sviluppo") &&
    path.resolve(process.execPath).toLowerCase() === path.resolve(percorsoInstallato()).toLowerCase();
}

async function ultimaVersione() {
  const r = await fetch(`${RILASCI}/versione.json`, { redirect: "follow" });
  if (!r.ok) throw new Error(`versione.json: ${r.status}`);
  return (await r.json()).versione;
}

async function scaricaESostituisci(versione) {
  const { log, riavvia } = impostazioni;
  const exe = process.execPath;
  inCorso = true;
  try {
    log("aggiornamento", VERSIONE, "→", versione);
    const nuovo = exe + ".nuovo";
    const d = await fetch(`${RILASCI}/AssistenteClaude.exe`, { redirect: "follow" });
    if (!d.ok) throw new Error(`download: ${d.status}`);
    fs.writeFileSync(nuovo, Buffer.from(await d.arrayBuffer()));
    if (fs.statSync(nuovo).size < 10e6) throw new Error("file scaricato troppo piccolo");
    // Windows permette di rinominare un programma acceso, non di sovrascriverlo.
    fs.renameSync(exe, exe + ".vecchio");
    fs.renameSync(nuovo, exe);
    riavvia(exe);
  } catch (e) {
    inCorso = false;
    log("aggiornamento non riuscito", e);
  }
}

function avvia(opzioni) {
  impostazioni = opzioni;
  if (!installato()) return;
  try { fs.rmSync(process.execPath + ".vecchio", { force: true }); } catch {}

  async function controlla() {
    try {
      const versione = await ultimaVersione();
      if (!piuNuova(versione, VERSIONE) || inCorso) return;
      // Non si aggiorna mentre lei sta parlando con l'assistente: riprova tra poco.
      if (opzioni.occupato()) return setTimeout(controlla, 5 * 60 * 1000);
      await scaricaESostituisci(versione);
    } catch (e) {
      opzioni.log("controllo aggiornamenti non riuscito", e);
    }
  }
  setTimeout(controlla, 60 * 1000);
  setInterval(controlla, OGNI);
}

// Pulsante "Controlla aggiornamenti" nelle impostazioni: risponde subito, e se serve scarica e si riavvia.
async function controllaOra() {
  if (VERSIONE.includes("sviluppo")) return { ok: false, testo: "Versione di prova: non si aggiorna." };
  if (!installato()) return { ok: false, testo: "Questo è il file scaricato, non il programma installato: chiudi e apri l'assistente dall'icona sul desktop, poi riprova." };
  if (inCorso) return { ok: true, aggiorna: true, testo: "Aggiornamento già in corso: tra un paio di minuti si riavvia da solo." };
  let versione;
  try { versione = await ultimaVersione(); } catch { return { ok: false, testo: "Non riesco a controllare: il computer è collegato a internet?" }; }
  if (!piuNuova(versione, VERSIONE)) return { ok: true, testo: `Hai già l'ultima versione (${VERSIONE}).` };
  scaricaESostituisci(versione);
  return { ok: true, aggiorna: true, versione, testo: `C'è la versione ${versione}: la scarico e mi riavvio da solo (un paio di minuti). Questa pagina si ricarica quando ho finito.` };
}

// Avvia la versione nuova del servizio e chiude questa: la nuova aspetta che la porta si liberi.
function riavviaServizio(exe) {
  spawn(exe, ["--servizio"], { detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, ASSISTENTE_EXE: exe } }).unref();
  setTimeout(() => process.exit(0), 300);
}

module.exports = { VERSIONE, avvia, controllaOra, piuNuova, riavviaServizio };
