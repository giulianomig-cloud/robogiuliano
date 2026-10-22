// Assistenza a distanza: il figlio vede il registro senza che la mamma faccia niente.
// - Il figlio scrive alla casella della mamma con oggetto "registro": la risposta (solo a lui) ha il registro allegato,
//   e la richiesta finisce nel cestino.
// - Se ci sono errori, gli arriva il registro da solo, al massimo una volta al giorno.
// - Con oggetto "assistenza" parte l'assistenza da remoto (Claude Code in Remote Control), se è attivata.
// - Con oggetto "consumi" gli arriva quanto ha usato Claude (oggi, ultimi 7 giorni, questo mese, mese scorso).
// Nel registro mandato non ci sono le conversazioni (righe "lei:" e "claude:"), a meno che non lo si scelga.
const fs = require("fs");

const OGNI = 5 * 60 * 1000;
const UN_GIORNO = 24 * 60 * 60 * 1000;
const MAX_REGISTRO = 400 * 1024;

// Le ultime righe del registro, senza le conversazioni.
function registroDaMandare(fileLog, { conversazioni = false } = {}) {
  let testo = "";
  try {
    const dim = fs.statSync(fileLog).size;
    const fd = fs.openSync(fileLog, "r");
    const da = Math.max(0, dim - MAX_REGISTRO);
    const buf = Buffer.alloc(dim - da);
    fs.readSync(fd, buf, 0, buf.length, da);
    fs.closeSync(fd);
    testo = buf.toString("utf8");
    if (da > 0) testo = testo.slice(testo.indexOf("\n") + 1);
  } catch { return "(registro vuoto)"; }
  if (conversazioni) return testo;
  // Le righe di una conversazione possono andare a capo: si salta fino alla prossima riga con la data.
  const righe = [];
  let salta = false;
  for (const r of testo.split("\n")) {
    if (/^\[\d{4}-\d\d-\d\dT/.test(r)) salta = /^\[[^\]]+\] (lei|claude):/.test(r);
    if (!salta) righe.push(r);
  }
  return righe.join("\n");
}

function haErrori(testo, dopo) {
  return testo.split("\n").some((r) => {
    const m = r.match(/^\[([^\]]+)\] (.*)/);
    return m && new Date(m[1]).getTime() > dopo && /error|errore|non riuscit|eccezione|promessa/i.test(m[2]);
  });
}

function crea({ leggiConfig, posta, log, fileLog, diagnosi, remota, testoConsumi, adesso = () => Date.now() }) {
  let ultimoAvviso = 0;

  async function manda(cfg, motivo) {
    const testo = registroDaMandare(fileLog, { conversazioni: !!cfg.registroConConversazioni });
    await posta.crea(cfg).invia({
      a: cfg.emailFiglio,
      oggetto: `Registro dell'assistente (${motivo})`,
      testo: `${diagnosi(cfg)}\n\nIl registro è allegato.`,
      allegati: [{ filename: "registro.txt", content: "﻿" + testo }],
    });
    log("registro mandato al figlio:", motivo);
  }

  async function controlla() {
    const cfg = leggiConfig();
    if (!cfg || !cfg.emailFiglio || !cfg.email || !cfg.password) return;
    try {
      if (cfg.registroSuRichiesta !== false) {
        const richieste = await posta.crea(cfg).prendiRichieste({ mittente: cfg.emailFiglio, parola: "registro" });
        if (richieste > 0) await manda(cfg, "richiesto da te");
      }
      if (remota && (await posta.crea(cfg).prendiRichieste({ mittente: cfg.emailFiglio, parola: "assistenza" })) > 0) {
        let testo;
        try { testo = remota.avvia(cfg); } catch (e) { testo = `Non avviata: ${e.message}`; }
        await posta.crea(cfg).invia({ a: cfg.emailFiglio, oggetto: "Assistenza da remoto", testo });
        log("assistenza da remoto richiesta per email:", testo);
      }
      // Oggetto "consumi": quanto ha usato Claude (oggi, settimana, mese).
      if (testoConsumi && (await posta.crea(cfg).prendiRichieste({ mittente: cfg.emailFiglio, parola: "consumi" })) > 0) {
        await posta.crea(cfg).invia({ a: cfg.emailFiglio, oggetto: "Consumi dell'assistente", testo: testoConsumi(cfg) });
        log("consumi mandati al figlio");
      }
      if (cfg.avvisaErrori !== false && adesso() - ultimoAvviso > UN_GIORNO) {
        const testo = registroDaMandare(fileLog);
        if (haErrori(testo, adesso() - UN_GIORNO)) {
          ultimoAvviso = adesso();
          await manda(cfg, "ci sono stati degli errori");
        }
      }
    } catch (e) {
      log("assistenza a distanza non riuscita", e.message);
    }
  }

  function avvia() {
    setTimeout(controlla, 2 * 60 * 1000);
    setInterval(controlla, OGNI);
  }

  return { avvia, controlla };
}

module.exports = { crea, registroDaMandare, haErrori };
