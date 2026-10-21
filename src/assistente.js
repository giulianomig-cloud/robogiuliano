// Assistente vocale "Ehi Aurora" / "Ehi RoboGiuliano": piccolo server locale + finestra di Edge che ascolta e parla.
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");
const Anthropic = require("@anthropic-ai/sdk");
const posta = require("./posta");
const aggiorna = require("./aggiorna");
const abbonamento = require("./abbonamento");
const navigatore = require("./navigatore");
const assistenza = require("./assistenza");
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
// Le pose di RoboYaymaris (stesse posizioni della bocca).
IMMAGINI["/yaymaris-riposo.webp"] = require("./yaymaris-riposo.webp");
IMMAGINI["/yaymaris-ascolto.webp"] = require("./yaymaris-ascolto.webp");
IMMAGINI["/yaymaris-pensa.webp"] = require("./yaymaris-pensa.webp");
IMMAGINI["/yaymaris-parla.webp"] = require("./yaymaris-parla.webp");
IMMAGINI["/yaymaris-parla-2.webp"] = require("./yaymaris-parla-2.webp");
IMMAGINI["/yaymaris-parla-3.webp"] = require("./yaymaris-parla-3.webp");
// Icone per stile: la finestra e il collegamento sul desktop usano quella dello stile scelto.
const ICONE = {
  robo: { png: require("./icona.png"), ico: require("./icona.ico") },
  allegra: { png: require("./icona-aurora.png"), ico: require("./icona-aurora.ico") },
  yaymaris: { png: require("./icona-yaymaris.png"), ico: require("./icona-yaymaris.ico") },
};
const iconaDi = (cfg) => ICONE[(cfg && cfg.tema) || "allegra"] || ICONE.allegra;

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
// Parola segreta tra il servizio e il ponte degli strumenti (modalità abbonamento).
const SEGRETO = crypto.randomBytes(16).toString("hex");

fs.mkdirSync(DIR, { recursive: true });
const remota = require("./remota").crea({ cartella: DIR, trovaClaude: (cfg) => abbonamento.trovaClaude(cfg), log: (...c) => log(...c) });
function log(...cose) {
  const riga = `[${new Date().toISOString()}] ${cose.map((c) => (c instanceof Error ? c.stack : String(c))).join(" ")}\n`;
  try {
    // Il registro non cresce per sempre: oltre 5 MB si tiene solo una copia vecchia.
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 5e6) fs.renameSync(LOG, LOG.replace(/\.txt$/, "-vecchio.txt"));
    fs.appendFileSync(LOG, riga);
  } catch {}
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
  // Referti USI: Claude guida un Edge nascosto che può aprire solo usi.it.
  { name: "referti_apri", description: "Apre l'area privata dei referti USI (www.usi.it/areaprivata/referti) e restituisce cosa c'è nella pagina, con gli elementi numerati.",
    input_schema: { type: "object", properties: {} } },
  { name: "sito_leggi", description: "Rilegge la pagina del sito dei referti aperta adesso.",
    input_schema: { type: "object", properties: {} } },
  { name: "sito_clicca", description: "Clicca l'elemento con quel numero nella pagina dei referti e restituisce la pagina nuova.",
    input_schema: { type: "object", properties: { numero: { type: "integer" } }, required: ["numero"] } },
  { name: "sito_scrivi", description: "Scrive in un campo della pagina dei referti. Per i dati di accesso scrivi esattamente UTENTE_USI o PASSWORD_USI: il programma li sostituisce con quelli salvati (tu non li conosci). invio=true per inviare il modulo subito dopo.",
    input_schema: { type: "object", properties: { numero: { type: "integer" }, testo: { type: "string" }, invio: { type: "boolean" } }, required: ["numero", "testo"] } },
  { name: "sito_scarica", description: "Scarica il referto (PDF) del collegamento o pulsante con quel numero.",
    input_schema: { type: "object", properties: { numero: { type: "integer" } }, required: ["numero"] } },
  { name: "referto_stampa", description: "Stampa l'ultimo referto scaricato sulla stampante predefinita.",
    input_schema: { type: "object", properties: {} } },
  { name: "referto_mostra", description: "Apre sullo schermo l'ultimo referto scaricato.",
    input_schema: { type: "object", properties: {} } },
  { name: "salva_sul_desktop", description: "Salva sul desktop un documento arrivato per email (es. una ricetta): l'allegato con quel numero, oppure, senza numero, il testo dell'email. Usalo solo dopo che lei ha detto di sì.",
    input_schema: { type: "object", properties: { id: { type: "integer" }, numero: { type: "integer", description: "Numero dell'allegato; omettilo per salvare il testo dell'email." },
      nome: { type: "string", description: "Nome chiaro del file, senza estensione, es. \"Ricetta 21-10-2026\"." }, cartella }, required: ["id", "nome"] } },
  { name: "referto_salva_sul_desktop", description: "Salva sul desktop l'ultimo documento scaricato dal sito USI (referto o ricetta). Usalo solo dopo che lei ha detto di sì.",
    input_schema: { type: "object", properties: { nome: { type: "string", description: "Nome chiaro del file, senza estensione, es. \"Ricetta 21-10-2026\"." } }, required: ["nome"] } },
  { name: "avvia_assistenza_remota", description: "Quando lei chiede di chiamare l'assistenza o dice che il computer ha un problema che non riesci a risolvere: avvia l'assistenza da remoto (il figlio potrà lavorare sul PC dal suo telefono) e lo avvisa per email.",
    input_schema: { type: "object", properties: { problema: { type: "string", description: "Il problema, in breve, per il figlio." } }, required: ["problema"] } },
  { name: "chiedi_aiuto", description: "Manda un'email al figlio per chiedergli aiuto (quando non riesci a fare qualcosa, o quando lei chiede di chiamarlo).",
    input_schema: { type: "object", properties: { messaggio: { type: "string", description: "Cosa serve, scritto in modo chiaro." } }, required: ["messaggio"] } },
];

const SI = /\b(s[iì]|ok|okay|va bene|invia(la)?|manda(la)?|spedisci(la)?|certo|esatto|confermo|d'accordo|procedi)\b/i;

// Se il nome non è scelto, si usa quello dello stile.
const NOMI = { allegra: "Aurora", robo: "RoboGiuliano", yaymaris: "RoboYaymaris" };
const nomeDi = (cfg) => cfg.nomeAssistente || NOMI[cfg.tema] || "Aurora";

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
- Le email del figlio con oggetto "registro" o "assistenza" sono richieste tecniche per il programma: non leggerle e non nominarle.
- Se il computer ha un problema che non riesci a risolvere a voce (stampante, internet, programmi), proponi di chiamare l'assistenza e, se dice sì, usa avvia_assistenza_remota.
- Non usare mai la posta per pagamenti, banca o acquisti: in quei casi consiglia di sentire il figlio.

Referti USI (analisi e visite):
- Quando chiede i referti, o un'email/SMS dice che un referto USI è disponibile, usa referti_apri. Se c'è da entrare, scrivi UTENTE_USI nel campo dell'utente (o codice fiscale) e PASSWORD_USI nel campo della password con sito_scrivi, poi entra.
- Se il sito chiede un codice arrivato per SMS, chiedile di leggertelo ad alta voce e scrivilo tu.
- Trova il referto più recente (o quello che chiede), scaricalo con sito_scarica e stampalo con referto_stampa, a meno che non chieda solo di vederlo (referto_mostra).
- Dille in parole semplici di che referto si tratta e la data, ma non interpretare i risultati medici: per quelli consiglia di sentire il medico.
- Se il sito non funziona o i dati di accesso sono sbagliati, dillo con calma e proponi di chiedere aiuto al figlio.

Ricette del medico:
- Se in un'email (oggetto, testo o allegato) o sul sito USI trovi una ricetta medica (promemoria della ricetta elettronica, codice NRE, prescrizione di farmaci o esami), diglielo e chiedile: "Vuole vederla, salvarla sul desktop o stamparla?".
- Fai quello che sceglie (anche più cose insieme):
  vedere: apri_allegato o referto_mostra; se è solo nel testo dell'email, leggiglila;
  salvare: salva_sul_desktop o referto_salva_sul_desktop, con un nome come "Ricetta 21-10-2026" (aggiungi il medico o il farmaco se li conosci), poi dille che la trova sul desktop;
  stampare: stampa_allegato, stampa_email (se è nel testo) o referto_stampa.
- Non salvare né stampare niente senza il suo sì.

Stampa: se lo strumento dice che la stampante è spenta, chiedile con calma di accenderla e di dirti quando è pronta, poi riprova. Non dire mai che hai stampato se lo strumento ha dato errore.

Se qualcosa non funziona o lei è in difficoltà, rassicurala e proponi di chiedere aiuto al figlio con chiedi_aiuto.${cfg.modo === "abbonamento" ? `

Internet: per meteo, notizie, orari, numeri di negozi e uffici o altre cose di oggi usa la ricerca su internet (WebSearch, WebFetch) e riassumi in poche parole, senza dire i siti.` : ""}`;
}

// ---------- Conversazione ----------

let conversazione = nuovaConversazione();
function nuovaConversazione() {
  return { messaggi: [], ultimo: 0, turno: 0, bozza: null, sessione: null, testoUtente: "" };
}

// Un solo navigatore per i referti, chiuso da solo dopo qualche minuto di pausa.
let nav = null;
function sitoReferti(cfg) {
  if (!cfg.usiUtente || !cfg.usiPassword) throw new Error("Nelle impostazioni mancano utente e password dei referti USI.");
  nav = nav || navigatore.crea({
    cartella: path.join(DIR, "referti"), consentiti: cfg.refertiSiti || ["usi.it"], log,
    segreti: () => { const c = leggiConfig() || {}; return { UTENTE_USI: c.usiUtente, PASSWORD_USI: c.usiPassword }; },
  });
  return nav;
}

// Quello che l'assistente sta facendo davvero, mostrato nella finestra mentre lei aspetta.
const ATTIVITA = [
  [/^(elenco|cerca)_email$/, "Sto controllando la posta", "📧", "Posta di Yahoo"],
  [/^leggi_email$/, "Sto leggendo l'email", "📧", "Posta di Yahoo"],
  [/^(stampa_|referto_stampa)/, "Sto stampando", "🖨️", "Stampante"],
  [/^(apri_allegato|referto_mostra)$/, "Sto aprendo il documento", "📄", "Documento"],
  [/^prepara_/, "Sto scrivendo l'email", "✉️", "Posta di Yahoo"],
  [/^invia_bozza$/, "Sto mandando l'email", "✉️", "Posta di Yahoo"],
  [/^sito_scrivi$/, "Sto entrando nel sito USI", "🏥", "Referti USI"],
  [/^sito_scarica$/, "Sto scaricando il referto", "🏥", "Referti USI"],
  [/^(referti_apri|sito_)/, "Sto guardando i referti USI", "🏥", "Referti USI"],
  [/salva_sul_desktop$/, "Sto salvando sul desktop", "💾", "Desktop"],
  [/^chiedi_aiuto$/, "Sto scrivendo a tuo figlio", "🆘", "Email al figlio"],
  [/^avvia_assistenza_remota$/, "Sto chiamando l'assistenza", "🛠️", "Assistenza"],
  [/^Web(Search|Fetch)$/, "Sto cercando su internet", "🌐", "Internet"],
];
let attivita = null;
function segnaAttivita(nome) {
  const a = ATTIVITA.find(([re]) => re.test(nome));
  if (a) attivita = { testo: a[1], icona: a[2], dove: a[3] };
}

async function eseguiStrumento(nome, input, cfg, conv, testoUtente) {
  segnaAttivita(nome);
  const p = posta.crea(cfg);
  switch (nome) {
    case "referti_apri": return sitoReferti(cfg).apri(cfg.refertiIndirizzo || "https://www.usi.it/areaprivata/referti");
    case "sito_leggi": return sitoReferti(cfg).leggi();
    case "sito_clicca": return sitoReferti(cfg).clicca(input.numero);
    case "sito_scrivi": return sitoReferti(cfg).scrivi(input.numero, input.testo, input.invio);
    case "sito_scarica": return sitoReferti(cfg).scarica(input.numero);
    case "salva_sul_desktop": {
      const dest = await p.salvaSulDesktop(input);
      return `Salvato sul desktop come "${path.basename(dest)}".`;
    }
    case "referto_salva_sul_desktop": {
      const file = nav && nav.ultimoScaricato();
      if (!file) throw new Error("Non ho ancora scaricato nessun documento da USI.");
      return `Salvato sul desktop come "${path.basename(posta.copiaSulDesktop(file, input.nome))}".`;
    }
    case "referto_stampa":
    case "referto_mostra": {
      const file = nav && nav.ultimoScaricato();
      if (!file) throw new Error("Non ho ancora scaricato nessun referto.");
      if (nome === "referto_stampa") { await posta.stampaFile(file); return "Referto mandato alla stampante."; }
      await posta.apriFile(file); return "Referto aperto sullo schermo.";
    }
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
    case "avvia_assistenza_remota": {
      const esito = remota.avvia(cfg);
      if (cfg.emailFiglio) await p.invia({ a: cfg.emailFiglio, oggetto: "La mamma ha chiamato l'assistenza", testo: `Problema: ${input.problema}\n\n${esito}` });
      return esito + " Il figlio è stato avvisato.";
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
  const conAbbonamento = cfg && cfg.modo === "abbonamento";
  if (!cfg || (!conAbbonamento && !cfg.apiKey)) return "Non sono ancora configurato. Serve l'aiuto di tuo figlio.";
  const conv = Date.now() - conversazione.ultimo > PAUSA_NUOVA_CONVERSAZIONE || conversazione.messaggi.length > MAX_MESSAGGI || conversazione.turno > MAX_MESSAGGI
    ? (conversazione = nuovaConversazione())
    : conversazione;
  conv.ultimo = Date.now();
  conv.turno++;
  conv.testoUtente = testoUtente;
  if (conAbbonamento) return chiediConAbbonamento(cfg, conv, testoUtente);

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

// Modalità abbonamento: risponde Claude Code; gli strumenti della posta arrivano qui da /strumento.
async function chiediConAbbonamento(cfg, conv, testoUtente) {
  const adesso = new Date().toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" });
  const [command, ...args] = process.env.ASSISTENTE_MCP ? JSON.parse(process.env.ASSISTENTE_MCP) : [process.execPath, "--mcp"];
  const r = await abbonamento.chiedi({
    cfg, testo: `[${adesso}] ${testoUtente}`, sistema: sistema(cfg), sessione: conv.sessione,
    mcp: { command, args, env: { ASSISTENTE_TOKEN: SEGRETO } }, cartella: path.join(DIR, "abbonamento"),
    onStrumento: (nome) => segnaAttivita(nome.replace(/^mcp__posta__/, "")),
  });
  conv.sessione = r.sessione;
  return r.testo || "Fatto.";
}

function spiegaErrore(e) {
  if (e instanceof abbonamento.ErroreAbbonamento) return abbonamento.spiegaErrore(e);
  if (e instanceof Anthropic.AuthenticationError) return "La chiave di Claude non funziona. Serve l'aiuto di tuo figlio.";
  if (e instanceof Anthropic.PermissionDeniedError) return "Il credito di Claude è finito o bloccato. Serve l'aiuto di tuo figlio.";
  if (e instanceof Anthropic.RateLimitError) return "Sono un po' occupato, riprova tra un minuto.";
  if (e instanceof Anthropic.APIConnectionError) return "Non riesco a collegarmi a internet. Controlla che il computer sia connesso.";
  if (e instanceof Anthropic.APIError) return "Claude in questo momento non risponde. Riprova tra poco.";
  return "Scusa, qualcosa non ha funzionato. Riprova.";
}

// Un riassunto tecnico per il figlio (niente password, niente conversazioni).
function diagnosi(cfg) {
  const righe = [
    `Versione: ${aggiorna.VERSIONE}`,
    `Programma: ${process.execPath}`,
    `Windows: ${os.release()} · acceso da ${Math.round(os.uptime() / 3600)} ore`,
    `Personaggio: ${nomeDi(cfg)} · collegamento a Claude: ${cfg.modo === "abbonamento" ? "abbonamento" : "chiave API"}`,
    `Claude Code: ${abbonamento.trovaClaude(cfg) ? "installato" : "non installato"}`,
    `SumatraPDF: ${posta.trovaSumatra() ? "installato" : "non installato"}`,
    `Referti USI: ${cfg.usiUtente ? "impostati" : "non impostati"}`,
    `Assistenza da remoto: ${cfg.assistenzaRemota ? "attivata" : "disattivata"}`,
  ];
  return righe.join("\n");
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
    modo: dati.modo === "abbonamento" ? "abbonamento" : "chiave",
    tokenAbbonamento: (dati.tokenAbbonamento || "").trim() || vecchia.tokenAbbonamento,
    usiUtente: (dati.usiUtente || "").trim(),
    usiPassword: dati.usiPassword || vecchia.usiPassword,
    registroSuRichiesta: dati.registroSuRichiesta === "on" || dati.registroSuRichiesta === true,
    avvisaErrori: dati.avvisaErrori === "on" || dati.avvisaErrori === true,
    registroConConversazioni: dati.registroConConversazioni === "on" || dati.registroConConversazioni === true,
    assistenzaRemota: dati.assistenzaRemota === "on" || dati.assistenzaRemota === true,
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
    if (cfg.modo === "abbonamento") {
      await chiediConAbbonamento(cfg, nuovaConversazione(), "Rispondi solo: ok");
      esiti.push({ ok: true, testo: "Abbonamento Claude collegato." });
    } else {
      await new Anthropic({ apiKey: cfg.apiKey }).messages.create({ model: cfg.modello || MODELLO_PREDEFINITO, max_tokens: 50, messages: [{ role: "user", content: "Rispondi solo: ok" }] });
      esiti.push({ ok: true, testo: "Chiave di Claude funzionante." });
    }
  } catch (e) {
    log("prova claude", e);
    esiti.push({ ok: false, testo: `${cfg.modo === "abbonamento" ? "Abbonamento" : "Chiave di Claude"} NON funzionante: ${spiegaErrore(e)}` });
  }
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
  if (process.platform === "win32" && process.env.ASSISTENTE_EXE) {
    try {
      await installaCollegamenti(process.env.ASSISTENTE_EXE, cfg.avvioAutomatico, nomeDi(cfg), cfg);
      esiti.push({ ok: true, testo: cfg.avvioAutomatico ? `Si aprirà da solo all'accensione. Icona "${nomeDi(cfg)}" sul desktop.` : `Icona "${nomeDi(cfg)}" sul desktop (non si apre da solo all'accensione).` });
    } catch (e) {
      log("collegamenti", e);
      esiti.push({ ok: false, testo: `Avvio automatico non impostato: ${e.message}` });
    }
  }
  conversazione = nuovaConversazione();
  return esiti;
}

// Copia il programma in AppData e crea l'avvio automatico e l'icona sul desktop.
async function installaCollegamenti(exe, avvio, nome, cfg) {
  const dest = path.join(process.env.LOCALAPPDATA || DIR, "AssistenteClaude", "AssistenteClaude.exe");
  if (path.resolve(exe).toLowerCase() !== path.resolve(dest).toLowerCase()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(exe, dest);
  }
  // L'icona dello stile scelto, con il nome dello stile: se si cambia stile cambia anche il file, e Windows la aggiorna.
  const icona = path.join(path.dirname(dest), `icona-${nomeDi({ tema: cfg && cfg.tema }).toLowerCase()}.ico`);
  fs.writeFileSync(icona, Buffer.from(iconaDi(cfg).ico, "base64"));
  const ps = `
$s = New-Object -ComObject WScript.Shell
foreach ($vecchio in @('Assistente Aurora.lnk', 'Ehi Claude.lnk', 'Aurora.lnk', 'RoboGiuliano.lnk', 'RoboYaymaris.lnk', ${posta.psStr(nome + ".lnk")})) {
  $f = Join-Path ([Environment]::GetFolderPath('Startup')) $vecchio; if (Test-Path $f) { Remove-Item $f }
  $f = Join-Path ([Environment]::GetFolderPath('Desktop')) $vecchio; if (Test-Path $f) { Remove-Item $f }
}
$cartelle = @([Environment]::GetFolderPath('Desktop'))
if (${avvio ? "$true" : "$false"}) { $cartelle += [Environment]::GetFolderPath('Startup') }
foreach ($p in $cartelle) {
  $l = $s.CreateShortcut((Join-Path $p ${posta.psStr(nome + ".lnk")}))
  $l.TargetPath = ${posta.psStr(dest)}
  $l.WorkingDirectory = ${posta.psStr(path.dirname(dest))}
  $l.Description = 'Assistente vocale'
  $l.IconLocation = ${posta.psStr(icona + ",0")}
  $l.Save()
}`;
  await posta.powershell(ps + "\nie4uinit.exe -show");
}

function apriFinestra(pagina = "") {
  const url = `http://127.0.0.1:${PORTA}/${pagina}`;
  if (process.platform !== "win32") return log("finestra:", url);
  const edge = navigatore.trovaEdge();
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
      if (req.method === "GET" && url === "/attivita") return json(attivita || {});
      if (req.method === "GET" && url === "/ping") return json({ ok: true, versione: aggiorna.VERSIONE });
      if (req.method === "GET" && url === "/") return html(leggiConfig() ? PAGINA : IMPOSTAZIONI);
      if (req.method === "GET" && url === "/impostazioni") return html(IMPOSTAZIONI);
      if (req.method === "GET" && IMMAGINI[url]) { res.writeHead(200, { "Content-Type": "image/webp", "Cache-Control": "max-age=86400" }); return res.end(Buffer.from(IMMAGINI[url], "base64")); }
      if (req.method === "GET" && url === "/config") {
        const c = leggiConfig() || {};
        return json({ versione: aggiorna.VERSIONE, avvioAutomatico: c.avvioAutomatico !== false, tema: c.tema || "allegra", nomeAssistente: c.nomeAssistente || "", voce: c.voce || "auto", nome: c.nome || "", email: c.email || "", emailFiglio: c.emailFiglio || "", haPassword: !!c.password, haChiave: !!c.apiKey, modo: c.modo || "chiave", haToken: !!c.tokenAbbonamento, usiUtente: c.usiUtente || "", haUsi: !!c.usiPassword,
          registroSuRichiesta: c.registroSuRichiesta !== false, avvisaErrori: c.avvisaErrori !== false, registroConConversazioni: !!c.registroConConversazioni, assistenzaRemota: !!c.assistenzaRemota });
      }
      if (req.method === "POST" && url === "/salva") return json({ esiti: await salvaImpostazioni(await corpo(req)) });
      if (req.method === "GET" && url === "/icona.png") { res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-cache" }); return res.end(Buffer.from(iconaDi(leggiConfig()).png, "base64")); }
      // Strumenti della posta chiesti da Claude Code (modalità abbonamento), solo con la parola segreta.
      if (req.method === "POST" && url === "/strumento") {
        if (req.headers["x-assistente"] !== SEGRETO) return json({ errore: "vietato" }, 403);
        const { nome, input } = await corpo(req);
        try {
          return json({ esito: await eseguiStrumento(String(nome).replace(/^mcp__posta__/, ""), input || {}, leggiConfig() || {}, conversazione, conversazione.testoUtente) });
        } catch (e) {
          log("strumento", nome, e);
          return json({ errore: e.message });
        }
      }
      if (req.method === "GET" && url === "/stato-claude") return json({ installato: !!abbonamento.trovaClaude(leggiConfig() || {}), windows: process.platform === "win32" });
      if (req.method === "POST" && url === "/installa-claude") {
        try { await abbonamento.installa(); return json({ ok: true }); } catch (e) { log("installa claude", e); return json({ ok: false, errore: e.message }); }
      }
      if (req.method === "POST" && url === "/collega-claude") {
        try { abbonamento.apriCollegamento(leggiConfig() || {}); return json({ ok: true }); } catch (e) { return json({ ok: false, errore: e.message }); }
      }
      if (req.method === "POST" && url === "/aggiorna") return json(await aggiorna.controllaOra());
      if (req.method === "POST" && /^\/remota\/(prepara|avvia|ferma)$/.test(url)) {
        const cosa = url.split("/").pop(), c = leggiConfig() || {};
        try {
          if (cosa === "prepara") remota.prepara(c);
          if (cosa === "ferma") remota.ferma();
          return json({ ok: true, testo: cosa === "avvia" ? remota.avvia(c) : cosa === "ferma" ? "Assistenza da remoto chiusa." : "Si è aperta la finestra: segui le istruzioni." });
        } catch (e) { return json({ ok: false, testo: e.message }); }
      }
      if (req.method === "POST" && url === "/nuova") { conversazione = nuovaConversazione(); return json({ ok: true }); }
      if (req.method === "POST" && url === "/chiedi") {
        const { testo } = await corpo(req);
        log("lei:", testo);
        let risposta;
        attivita = null;
        try { risposta = await chiedi(String(testo || "").slice(0, 2000)); } catch (e) { log("chiedi", e); risposta = spiegaErrore(e); }
        attivita = null;
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
  // Ponte degli strumenti per Claude Code (modalità abbonamento): niente finestre, niente server.
  if (process.argv.includes("--mcp")) {
    await require("./mcp").avvia({ strumenti: STRUMENTI, porta: PORTA });
    return;
  }
  if (process.argv.includes("--servizio")) {
    avviaServer();
    aggiorna.avvia({ log, occupato: () => Date.now() - conversazione.ultimo < 2 * 60 * 1000, riavvia: aggiorna.riavviaServizio });
    assistenza.crea({ leggiConfig, posta, log, fileLog: LOG, diagnosi, remota }).avvia();
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
