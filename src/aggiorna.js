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

function avvia({ log, occupato, riavvia }) {
  if (process.platform !== "win32" || VERSIONE.includes("sviluppo")) return;
  const exe = process.execPath;
  if (path.resolve(exe).toLowerCase() !== path.resolve(percorsoInstallato()).toLowerCase()) return;
  try { fs.rmSync(exe + ".vecchio", { force: true }); } catch {}

  async function controlla() {
    try {
      const r = await fetch(`${RILASCI}/versione.json`, { redirect: "follow" });
      if (!r.ok) return;
      const { versione } = await r.json();
      if (!piuNuova(versione, VERSIONE)) return;
      // Non si aggiorna mentre lei sta parlando con l'assistente: riprova tra poco.
      if (occupato()) return setTimeout(controlla, 5 * 60 * 1000);
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
      log("aggiornamento non riuscito", e);
    }
  }
  setTimeout(controlla, 60 * 1000);
  setInterval(controlla, OGNI);
}

// Avvia la versione nuova del servizio e chiude questa: la nuova aspetta che la porta si liberi.
function riavviaServizio(exe) {
  spawn(exe, ["--servizio"], { detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, ASSISTENTE_EXE: exe } }).unref();
  setTimeout(() => process.exit(0), 300);
}

module.exports = { VERSIONE, avvia, piuNuova, riavviaServizio };
