// Modalità "abbonamento": invece della chiave a consumo usa Claude Code con l'abbonamento Pro/Max di chi lo installa
// (credito mensile per i programmi fatti in casa). Claude Code qui può solo cercare su internet e usare la posta.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const posta = require("./posta");

const ATTESA_MASSIMA = 3 * 60 * 1000;

class ErroreAbbonamento extends Error {
  constructor(tipo, messaggio) { super(messaggio); this.tipo = tipo; }
}

// Dove l'installatore ufficiale mette Claude Code; altrimenti si cerca "claude" tra i programmi del sistema.
function trovaClaude(cfg = {}) {
  const candidati = [
    cfg.claudePath,
    process.platform === "win32" ? path.join(os.homedir(), ".local", "bin", "claude.exe") : path.join(os.homedir(), ".local", "bin", "claude"),
  ].filter(Boolean);
  return candidati.find((c) => fs.existsSync(c)) || null;
}

function esegui(eseguibile, args, { input = "", env, cwd, onRiga }) {
  return new Promise((ok, ko) => {
    const p = spawn(eseguibile, args, { env, cwd, windowsHide: true, shell: /\.cmd$/i.test(eseguibile) });
    let out = "", err = "";
    const timer = setTimeout(() => { p.kill(); ko(new ErroreAbbonamento("tempo", "Claude Code non ha risposto in tempo.")); }, ATTESA_MASSIMA);
    let resto = "";
    p.stdout.on("data", (d) => {
      out += d;
      if (!onRiga) return;
      const righe = (resto + d).split("\n");
      resto = righe.pop();
      righe.forEach(onRiga);
    });
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => { clearTimeout(timer); ko(new ErroreAbbonamento("mancante", e.message)); });
    p.on("close", (codice) => { clearTimeout(timer); ok({ codice, out, err }); });
    p.stdin.end(input);
  });
}

// Una domanda a Claude Code. "sessione" continua la conversazione di prima (per "stampala", "sì, mandala"…).
// "onStrumento" viene chiamato appena Claude Code usa uno strumento (per mostrare cosa sta facendo).
async function chiedi({ cfg, testo, sistema, sessione, mcp, cartella, onStrumento = () => {} }) {
  const claude = trovaClaude(cfg);
  if (!claude) throw new ErroreAbbonamento("mancante", "Claude Code non è installato.");
  fs.mkdirSync(cartella, { recursive: true });
  const fileSistema = path.join(cartella, "istruzioni.txt");
  const fileMcp = path.join(cartella, "strumenti.json");
  fs.writeFileSync(fileSistema, sistema);
  fs.writeFileSync(fileMcp, JSON.stringify({ mcpServers: { posta: { type: "stdio", ...mcp } } }));

  const args = [
    "-p", "--output-format", "stream-json", "--verbose",
    "--restricted", "--tools", "WebSearch,WebFetch",
    "--mcp-config", fileMcp, "--strict-mcp-config",
    "--allowedTools", "mcp__posta,WebSearch,WebFetch",
    "--permission-mode", "dontAsk",
    "--system-prompt-file", fileSistema,
  ];
  if (cfg.modelloAbbonamento) args.push("--model", cfg.modelloAbbonamento);
  if (sessione) args.push("--resume", sessione);

  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;            // altrimenti Claude Code userebbe la chiave a consumo invece dell'abbonamento
  delete env.ANTHROPIC_AUTH_TOKEN;
  if (cfg.tokenAbbonamento) env.CLAUDE_CODE_OAUTH_TOKEN = cfg.tokenAbbonamento;

  const leggi = (riga) => { try { return JSON.parse(riga); } catch { return null; } };
  const t0 = Date.now();
  let tPartito = null;
  const onRiga = (riga) => {
    const m = leggi(riga);
    if (m && tPartito === null) tPartito = Date.now();   // la prima riga: Claude Code è partito
    if (m && m.type === "assistant" && m.message && Array.isArray(m.message.content)) {
      for (const c of m.message.content) if (c.type === "tool_use") onStrumento(c.name);
    }
  };
  const { codice, out, err } = await esegui(claude, args, { input: testo, env, cwd: cartella, onRiga });
  // Con stream-json escono tante righe: la risposta finale è quella con type "result".
  const r = out.trim().split("\n").map(leggi).filter((m) => m && m.type === "result").pop() || null;
  if (!r || r.is_error || codice !== 0) {
    const testoErrore = `${r ? r.result || r.subtype : ""} ${err}`.trim();
    if (/log ?in|auth|token|401|credential|not logged/i.test(testoErrore)) throw new ErroreAbbonamento("accesso", testoErrore);
    if (/limit|usage|credit|quota|429/i.test(testoErrore)) throw new ErroreAbbonamento("limite", testoErrore);
    throw new ErroreAbbonamento("altro", testoErrore || `uscita ${codice}`);
  }
  const sec = (ms) => `${(ms / 1000).toFixed(1)} s`;
  const tempi = {
    avvio: tPartito ? sec(tPartito - t0) : "?",
    claude: r.duration_api_ms ? sec(r.duration_api_ms) : "?",
    totale: sec(Date.now() - t0),
    costo: typeof r.total_cost_usd === "number" ? r.total_cost_usd.toFixed(3) : null,
  };
  return { testo: String(r.result || "").trim(), sessione: r.session_id, tempi };
}

// Installa Claude Code con l'installatore ufficiale (solo Windows).
async function installa() {
  await posta.powershell("Set-ExecutionPolicy -Scope Process Bypass -Force; irm https://claude.ai/install.ps1 | iex", 10 * 60 * 1000);
  if (!trovaClaude()) throw new Error("Installazione non riuscita.");
}

// Apre una finestra dove si entra con il proprio account Claude: alla fine compare il codice da incollare.
// Si usa un piccolo file .cmd: con "start" e le virgolette scritte a mano Windows si confondeva
// (prendeva il titolo per il nome del programma, e i percorsi con gli spazi si rompevano).
function scriviCollegamento(claude, cartella) {
  fs.mkdirSync(cartella, { recursive: true });
  const file = path.join(cartella, "collega-claude.cmd");
  fs.writeFileSync(file, [
    "@echo off",
    "title Collega Claude",
    "echo Si apre il browser: entra con il tuo account Claude e conferma.",
    "echo.",
    `"${claude}" setup-token`,
    "echo.",
    "echo Copia il codice che inizia con sk-ant-oat (selezionalo col mouse e premi Invio),",
    "echo poi incollalo nelle impostazioni dell'assistente, nel campo Codice dell'abbonamento.",
    "pause",
  ].join("\r\n") + "\r\n");
  return file;
}

function apriCollegamento(cfg, cartella = os.tmpdir()) {
  const claude = trovaClaude(cfg);
  if (!claude) throw new Error("Prima installa Claude Code.");
  const file = scriviCollegamento(claude, cartella);
  spawn("cmd.exe", ["/c", "start", "", file], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

function spiegaErrore(e) {
  switch (e.tipo) {
    case "accesso": return "Il collegamento all'abbonamento di Claude non funziona più. Serve l'aiuto di tuo figlio.";
    case "limite": return "Per questo mese ho finito il credito dell'abbonamento. Serve l'aiuto di tuo figlio.";
    case "mancante": return "Manca un pezzo del programma. Serve l'aiuto di tuo figlio.";
    case "tempo": return "Ci ho messo troppo a rispondere. Riprova tra poco.";
    default: return "Claude in questo momento non risponde. Riprova tra poco.";
  }
}

module.exports = { chiedi, installa, apriCollegamento, scriviCollegamento, trovaClaude, spiegaErrore, ErroreAbbonamento };
