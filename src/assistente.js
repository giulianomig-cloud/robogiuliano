// Assistente vocale "Ehi Aurora" / "Ehi RoboGiuliano": piccolo server locale + finestra di Edge che ascolta e parla.
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const Anthropic = require("@anthropic-ai/sdk");
const posta = require("./posta");
const aggiorna = require("./aggiorna");
const PAGINA = require("./pagina.html");
const IMPOSTAZIONI = require("./impostazioni.html");
// Le pose di RoboGiuliano (la bocca ha tre posizioni: aperta, a metà, chiusa).
const IMMAGINI = {};
IMMAGINI["/robo-riposo.webp"] = require("./robo-riposo.webp");
IMMAGINI["/robo-ascolto.webp"] = require("./robo-ascolto.webp");
IMMAGINI["/robo-pensa.webp"] = require("./robo-pensa.webp");
IMMAGINI["/robo-parla.webp"] = require("./robo-parla.webp");
IMMAGINI["/robo-parla-2.webp"] = require("./robo-parla-2.webp");
IMMAGINI["/robo-parla-3.webp"] = require("./robo-parla-3.webp");

const PORTA = 7777;
const DIR = process.platform === "win32"
  ? path.join(process.env.APPDATA || os.homedir(), "AssistenteClaude")
  : path.join(os.homedir(), ".assistente-claude");
const CONFIG = path.join(DIR, "config.json");
const LOG = path.join(DIR, "registro.txt");
const MODELLO_PREDEFINITO = "claude-opus-5-5";
const PAUSA_NUOVA_CONVERSAZIONE = 10 * 60 * 1000;
const MAX_MESSAGGI = 40;
const MAX_GIRI = 8;

fs.mkdirSync(DIR, { recursive: true });
function log(...cose) {
  const riga = `[${new Date().toISOString()}] ${cose.map((c) => (c instanceof Error ? c.stack : String(c))).join(" ")}\n`;
  try { fs.appendFileSync(LOG, riga); } catch {}
}

function leggiConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, "utf8")); } catch { return null; }
}

// ---------- Strumenti che Claude può usare ----------

const cartella = { type: "string", description: 'Cartella della posta: "INBOX" (predefinita), "Sent", "Bulk" (spam), "Trash".' };
const STRUMENTI = [
  { name: "elenco_email", description: "Elenco delle email più recenti (mittente, oggetto, data, se già letta). Ogni email ha un id.",
    input_schema: { type: "object", properties: { quante: { type: "integer", description: "Quante (predefinito 10, max 30)." }, solo_non_lette: { type: "boolean" }, cartella } } },
  { name: "leggi_email", description: "Testo completo di un'email (la segna come letta).",
    input_schema: { type: "object", properties: { id: { type: "integer" }, cartella }, required: ["id"] } },
  { name: "cerca_email", description: "Cerca email per mittente, oggetto o parola nel testo.",
    input_schema: { type: "object", properties: { testo: { type: "string" }, quante: { type: "integer" }, cartella }, required: ["testo"] } },
  { name: "stampa_email", description: "Stampa un'email sulla stampante predefinita, senza finestre.",
    input_schema: { type: "object", properties: { id: { type: "integer" }, cartella }, required: ["id"] } },
  { name: "stampa_allegato", description: "Salva un allegato in Documenti\\Allegati posta e lo stampa.",
    input_schema: { type: "object", properties: { id: { type: "integer" }, numero: { type: "integer", description: "Numero dell'allegato (predefinito 1)." }, cartella }, required: ["id"] } },
  { name: "apri_allegato", description: "Salva un allegato e lo apre sullo schermo (foto, PDF, documenti).",
    input_schema: { type: "object", properties: { id: { type: "integer" }, numero: { type: "integer" }, cartella }, required: ["id"] } },
  { name: "prepara_email", description: "Prepara una NUOVA email da inviare. Non la invia: dopo devi leggerla ad alta voce e chiedere conferma.",
    input_schema: { type: "object", properties: { a: { type: "string", description: "Indirizzo email del destinatario." }, oggetto: { type: "string" }, testo: { type: "string" } }, required: ["a", "oggetto", "testo"] } },
  { name: "prepara_risposta", description: "Prepara una RISPOSTA a un'email ricevuta. Non la invia: dopo devi leggerla ad alta voce e chiedere conferma.",
    input_schema: { type: "object", properties: { id: { type: "integer" }, testo: { type: "string" }, cartella }, required: ["id", "testo"] } },
  { name: "invia_bozza", description: "Invia l'email preparata. Usalo SOLO se nel suo ultimo messaggio la persona ha detto chiaramente di sì all'invio.",
    input_schema: { type: "object", properties: {} } },
  { name: "chiedi_aiuto", description: "Manda un'email al figlio per chiedergli aiuto (quando non riesci a fare qualcosa, o quando lei chiede di chiamarlo).",
    input_schema: { type: "object", properties: { messaggio: { type: "string", description: "Cosa serve, scritto in modo chiaro." } }, required: ["messaggio"] } },
];

const SI = /\b(s[iì]|ok|okay|va bene|invia(la)?|manda(la)?|spedisci(la)?|certo|esatto|confermo|d'accordo|procedi)\b/i;

// Se il nome non è scelto, si usa quello dello stile.
const nomeDi = (cfg) => cfg.nomeAssistente || (cfg.tema === "robo" ? "RoboGiuliano" : "Aurora");

function sistema(cfg) {
  return `Ti chiami ${nomeDi(cfg)} e sei l'assistente vocale di ${cfg.nome || "una signora"} sul suo computer. Lei non è pratica di computer e ti parla a voce: quello che scrivi viene letto ad alta voce da una sintesi vocale.

Come parlare:
- Frasi brevi e semplici, in italiano, con calore e pazienza. Niente parole tecniche.
- Solo testo da leggere ad alta voce: niente elenchi puntati, asterischi, emoji, indirizzi web o simboli.
- Di solito bastano due o tre frasi. Per un'email: chi l'ha mandata, di cosa parla in breve, se chiede di fare qualcosa.
- Non leggere gli id delle email: sono solo per te. Gli indirizzi email dilli solo se servono.
- Se una richiesta non è chiara, fai una sola domanda breve.

La posta (Yahoo):
- Usa gli strumenti per leggere, cercare, stampare e aprire allegati. Gli strumenti di lettura e stampa li puoi usare subito, senza chiedere.
- Se un'email chiede password, codici, dati della carta, pagamenti urgenti, pacchi bloccati o di cliccare link, dille chiaramente che potrebbe essere una TRUFFA e di non fare niente; se è il caso, proponi di avvisare il figlio.
- Per scrivere o rispondere: usa prepara_email o prepara_risposta, poi leggile ad alta voce a chi va e il testo, e chiedi "La mando?". Usa invia_bozza solo dopo un sì chiaro nel messaggio successivo.
- Per scrivere a qualcuno di cui non sai l'indirizzo, cercalo tra le email ricevute; se non lo trovi, chiedilo.
- Non usare mai la posta per pagamenti, banca o acquisti: in quei casi consiglia di sentire il figlio.

Se qualcosa non funziona o lei è in difficoltà, rassicurala e proponi di chiedere aiuto al figlio con chiedi_aiuto.`;
}

// ---------- Conversazione ----------

let conversazione = nuovaConversazione();
function nuovaConversazione() {
  return { messaggi: [], ultimo: 0, turno: 0, bozza: null };
}

async function eseguiStrumento(nome, input, cfg, conv, testoUtente) {
  const p = posta.crea(cfg);
  switch (nome) {
    case "elenco_email": return p.elenco({ ...input, quante: Math.min(input.quante || 10, 30) });
    case "leggi_email": return p.leggi(input);
    case "cerca_email": return p.cerca({ ...input, quante: Math.min(input.quante || 10, 30) });
    case "stampa_email": return p.stampa(input);
    case "stampa_allegato": return p.stampaAllegato(input);
    case "apri_allegato": return p.apriAllegato(input);
    case "prepara_email":
      conv.bozza = { tipo: "nuova", a: input.a, oggetto: input.oggetto, testo: input.testo, turno: conv.turno };
      return `Bozza pronta, NON ancora inviata. A: ${input.a}. Oggetto: ${input.oggetto}. Testo: ${input.testo}. Leggila ad alta voce e chiedi se va bene mandarla.`;
    case "prepara_risposta": {
      const { a, oggetto } = await p.destinatarioRisposta(input);
      conv.bozza = { tipo: "risposta", id: input.id, cartella: input.cartella, a, testo: input.testo, turno: conv.turno };
      return `Risposta pronta, NON ancora inviata. A: ${a}. Oggetto: Re: ${oggetto}. Testo: ${input.testo}. Leggila ad alta voce e chiedi se va bene mandarla.`;
    }
    case "invia_bozza": {
      const b = conv.bozza;
      if (!b) throw new Error("Non c'è nessuna email preparata.");
      // Si invia solo se la bozza è stata letta in un turno precedente e lei ha appena detto di sì.
      if (b.turno >= conv.turno || !SI.test(testoUtente)) {
        throw new Error("Non ho ancora una conferma chiara. Leggi la bozza e chiedi se va bene mandarla.");
      }
      conv.bozza = null;
      return b.tipo === "nuova" ? p.invia(b) : p.rispondi({ id: b.id, testo: b.testo, cartella: b.cartella });
    }
    case "chiedi_aiuto":
      if (!cfg.emailFiglio) throw new Error("Non è impostata l'email del figlio.");
      await p.invia({ a: cfg.emailFiglio, oggetto: "La mamma ha bisogno di aiuto col computer", testo: `Messaggio dall'assistente vocale:\n\n${input.messaggio}` });
      return "Email di aiuto mandata al figlio.";
    default:
      throw new Error(`Strumento sconosciuto: ${nome}`);
  }
}

async function chiedi(testoUtente) {
  const cfg = leggiConfig();
  if (!cfg || !cfg.apiKey) return "Non sono ancora configurato. Serve l'aiuto di tuo figlio.";
  const conv = Date.now() - conversazione.ultimo > PAUSA_NUOVA_CONVERSAZIONE || conversazione.messaggi.length > MAX_MESSAGGI
    ? (conversazione = nuovaConversazione())
    : conversazione;
  conv.ultimo = Date.now();
  conv.turno++;

  const client = new Anthropic({ apiKey: cfg.apiKey });
  const modello = cfg.modello || MODELLO_PREDEFINITO;
  const adesso = new Date().toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" });
  conv.messaggi.push({ role: "user", content: `[${adesso}] ${testoUtente}` });

  for (let giro = 0; giro < MAX_GIRI; giro++) {
    const richiesta = {
      model: modello,
      max_tokens: 16000,
      system: sistema(cfg),
      tools: STRUMENTI,
      messages: conv.messaggi,
      cache_control: { type: "ephemeral" },
      output_config: { effort: "low" },
    };
    // Se il modello rifiuta per sicurezza, l'API riprova da sola con un modello di riserva.
    if (/opus|fable|sonnet-5-5/.test(modello)) {
      richiesta.betas = ["server-side-fallback-2026-07-01"];
      richiesta.fallbacks = "default";
    }
    const risposta = await client.beta.messages.create(richiesta);

    if (risposta.stop_reason === "refusal") {
      conv.messaggi.push({ role: "assistant", content: risposta.content.length ? risposta.content : [{ type: "text", text: "Mi dispiace, con questo non posso aiutarti." }] });
      return "Mi dispiace, con questo non posso aiutarti.";
    }
    conv.messaggi.push({ role: "assistant", content: risposta.content });

    if (risposta.stop_reason === "pause_turn") continue;
    const chiamate = risposta.content.filter((b) => b.type === "tool_use");
    if (risposta.stop_reason !== "tool_use" || !chiamate.length) {
      return risposta.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim() || "Fatto.";
    }

    const risultati = [];
    for (const c of chiamate) {
      try {
        const esito = await eseguiStrumento(c.name, c.input || {}, cfg, conv, testoUtente);
        risultati.push({ type: "tool_result", tool_use_id: c.id, content: String(esito) });
      } catch (e) {
        log("strumento", c.name, e);
        risultati.push({ type: "tool_result", tool_use_id: c.id, content: `Errore: ${e.message}`, is_error: true });
      }
    }
    conv.messaggi.push({ role: "user", content: risultati });
  }
  return "Scusa, ci sto mettendo troppo. Riproviamo?";
}

function spiegaErrore(e) {
  if (e instanceof Anthropic.AuthenticationError) return "La chiave di Claude non funziona. Serve l'aiuto di tuo figlio.";
  if (e instanceof Anthropic.PermissionDeniedError) return "Il credito di Claude è finito o bloccato. Serve l'aiuto di tuo figlio.";
  if (e instanceof Anthropic.RateLimitError) return "Sono un po' occupato, riprova tra un minuto.";
  if (e instanceof Anthropic.APIConnectionError) return "Non riesco a collegarmi a internet. Controlla che il computer sia connesso.";
  if (e instanceof Anthropic.APIError) return "Claude in questo momento non risponde. Riprova tra poco.";
  return "Scusa, qualcosa non ha funzionato. Riprova.";
}

// ---------- Impostazioni e avvio automatico ----------

async function salvaImpostazioni(dati) {
  const vecchia = leggiConfig() || {};
  const cfg = {
    ...vecchia,
    nome: (dati.nome || "").trim(),
    email: (dati.email || "").trim(),
    password: (dati.password || "").replace(/\s+/g, "") || vecchia.password,
    apiKey: (dati.apiKey || "").trim() || vecchia.apiKey,
    emailFiglio: (dati.emailFiglio || "").trim(),
    nomeAssistente: (dati.nomeAssistente || "").trim(),
    tema: dati.tema || vecchia.tema || "allegra",
    voce: dati.voce || vecchia.voce || "auto",
    avvioAutomatico: dati.avvioAutomatico === "on" || dati.avvioAutomatico === true,
  };
  const esiti = [];
  try {
    const s = await posta.crea(cfg).prova();
    esiti.push({ ok: true, testo: `Posta Yahoo collegata: ${s.messages} email, ${s.unseen} non lette.` });
  } catch (e) {
    log("prova posta", e);
    esiti.push({ ok: false, testo: `Posta Yahoo NON collegata: controlla email e password per app (${e.responseText || e.message}).` });
  }
  try {
    await new Anthropic({ apiKey: cfg.apiKey }).messages.create({ model: cfg.modello || MODELLO_PREDEFINITO, max_tokens: 50, messages: [{ role: "user", content: "Rispondi solo: ok" }] });
    esiti.push({ ok: true, testo: "Chiave di Claude funzionante." });
  } catch (e) {
    log("prova claude", e);
    esiti.push({ ok: false, testo: `Chiave di Claude NON funzionante: ${spiegaErrore(e)}` });
  }
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
  if (process.platform === "win32" && process.env.ASSISTENTE_EXE) {
    try {
      await installaCollegamenti(process.env.ASSISTENTE_EXE, cfg.avvioAutomatico);
      esiti.push({ ok: true, testo: cfg.avvioAutomatico ? "Si aprirà da solo all'accensione. Icona \"Assistente Aurora\" sul desktop." : "Icona \"Assistente Aurora\" sul desktop (non si apre da solo all'accensione)." });
    } catch (e) {
      log("collegamenti", e);
      esiti.push({ ok: false, testo: `Avvio automatico non impostato: ${e.message}` });
    }
  }
  conversazione = nuovaConversazione();
  return esiti;
}

// Copia il programma in AppData e crea l'avvio automatico e l'icona sul desktop.
async function installaCollegamenti(exe, avvio) {
  const dest = path.join(process.env.LOCALAPPDATA || DIR, "AssistenteClaude", "AssistenteClaude.exe");
  if (path.resolve(exe).toLowerCase() !== path.resolve(dest).toLowerCase()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(exe, dest);
  }
  const ps = `
$s = New-Object -ComObject WScript.Shell
foreach ($vecchio in @('Assistente Aurora.lnk', 'Ehi Claude.lnk')) {
  $f = Join-Path ([Environment]::GetFolderPath('Startup')) $vecchio; if (Test-Path $f) { Remove-Item $f }
  $f = Join-Path ([Environment]::GetFolderPath('Desktop')) $vecchio; if (Test-Path $f) { Remove-Item $f }
}
$cartelle = @([Environment]::GetFolderPath('Desktop'))
if (${avvio ? "$true" : "$false"}) { $cartelle += [Environment]::GetFolderPath('Startup') }
foreach ($p in $cartelle) {
  $l = $s.CreateShortcut((Join-Path $p 'Assistente Aurora.lnk'))
  $l.TargetPath = ${posta.psStr(dest)}
  $l.WorkingDirectory = ${posta.psStr(path.dirname(dest))}
  $l.Description = 'Assistente vocale'
  $l.Save()
}`;
  await posta.powershell(ps);
}

function trovaEdge() {
  const candidati = [
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft\\Edge\\Application\\msedge.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Microsoft\\Edge\\Application\\msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft\\Edge\\Application\\msedge.exe"),
  ];
  return candidati.find((c) => fs.existsSync(c));
}

function apriFinestra(pagina = "") {
  const url = `http://127.0.0.1:${PORTA}/${pagina}`;
  if (process.platform !== "win32") return log("finestra:", url);
  const edge = trovaEdge();
  const args = [
    `--app=${url}`, `--user-data-dir=${path.join(DIR, "edge")}`,
    "--autoplay-policy=no-user-gesture-required", "--start-maximized", "--no-first-run", "--no-default-browser-check",
  ];
  const p = edge
    ? spawn(edge, args, { detached: true, stdio: "ignore" })
    : spawn("cmd.exe", ["/c", "start", "", "msedge", ...args], { detached: true, stdio: "ignore", windowsHide: true });
  p.unref();
}

// ---------- Server ----------

function corpo(req) {
  return new Promise((ok, ko) => {
    let d = "";
    req.on("data", (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on("end", () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { ko(e); } });
  });
}

function avviaServer() {
  const server = http.createServer(async (req, res) => {
    const json = (o, stato = 200) => { res.writeHead(stato, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(o)); };
    const html = (h) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(h); };
    // Accetta solo richieste dalla finestra locale.
    const origine = req.headers.origin;
    if (origine && origine !== `http://127.0.0.1:${PORTA}`) return json({ errore: "vietato" }, 403);
    try {
      const url = req.url.split("?")[0];
      if (req.method === "GET" && url === "/ping") return json({ ok: true, versione: aggiorna.VERSIONE });
      if (req.method === "GET" && url === "/") return html(leggiConfig() ? PAGINA : IMPOSTAZIONI);
      if (req.method === "GET" && url === "/impostazioni") return html(IMPOSTAZIONI);
      if (req.method === "GET" && IMMAGINI[url]) { res.writeHead(200, { "Content-Type": "image/webp", "Cache-Control": "max-age=86400" }); return res.end(Buffer.from(IMMAGINI[url], "base64")); }
      if (req.method === "GET" && url === "/config") {
        const c = leggiConfig() || {};
        return json({ avvioAutomatico: c.avvioAutomatico !== false, tema: c.tema || "allegra", nomeAssistente: c.nomeAssistente || "", voce: c.voce || "auto", nome: c.nome || "", email: c.email || "", emailFiglio: c.emailFiglio || "", haPassword: !!c.password, haChiave: !!c.apiKey });
      }
      if (req.method === "POST" && url === "/salva") return json({ esiti: await salvaImpostazioni(await corpo(req)) });
      if (req.method === "POST" && url === "/nuova") { conversazione = nuovaConversazione(); return json({ ok: true }); }
      if (req.method === "POST" && url === "/chiedi") {
        const { testo } = await corpo(req);
        log("lei:", testo);
        let risposta;
        try { risposta = await chiedi(String(testo || "").slice(0, 2000)); } catch (e) { log("chiedi", e); risposta = spiegaErrore(e); }
        log("claude:", risposta);
        return json({ risposta });
      }
      json({ errore: "non trovato" }, 404);
    } catch (e) {
      log("server", e);
      json({ errore: e.message }, 500);
    }
  });
  // Dopo un aggiornamento la versione vecchia libera la porta un attimo dopo: si riprova.
  let tentativi = 0;
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE" && tentativi++ < 60) return setTimeout(() => server.listen(PORTA, "127.0.0.1"), 500);
    log("server", e);
  });
  server.listen(PORTA, "127.0.0.1", () => log("in ascolto sulla porta", PORTA, "versione", aggiorna.VERSIONE));
  return server;
}

function giaAcceso() {
  return new Promise((ok) => {
    http.get(`http://127.0.0.1:${PORTA}/ping`, (r) => { r.resume(); ok(r.statusCode === 200); }).on("error", () => ok(false));
  });
}

async function main() {
  process.on("uncaughtException", (e) => log("eccezione", e));
  process.on("unhandledRejection", (e) => log("promessa", e));
  if (process.argv.includes("--servizio")) {
    avviaServer();
    aggiorna.avvia({ log, occupato: () => Date.now() - conversazione.ultimo < 2 * 60 * 1000, riavvia: aggiorna.riavviaServizio });
    return;
  }
  // Doppio clic o avvio di Windows: accende il servizio nascosto (se serve) e apre la finestra.
  if (!(await giaAcceso())) {
    const figlio = spawn(process.execPath, process.env.ASSISTENTE_SCRIPT ? [process.env.ASSISTENTE_SCRIPT, "--servizio"] : ["--servizio"], {
      detached: true, stdio: "ignore", windowsHide: true,
      env: { ...process.env, ASSISTENTE_EXE: process.execPath },
    });
    figlio.unref();
    for (let i = 0; i < 50 && !(await giaAcceso()); i++) await new Promise((r) => setTimeout(r, 200));
  }
  apriFinestra();
  setTimeout(() => process.exit(0), 500);
}

module.exports = { main, chiedi, STRUMENTI, avviaServer, eseguiStrumento, nuovaConversazione, SI };
