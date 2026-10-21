// Navigatore per i referti: apre Edge di nascosto (senza finestre) e lo guida con il protocollo di DevTools.
// Claude "legge" la pagina come elenco di testi e pulsanti numerati, e sceglie cosa cliccare o scrivere.
// Utente e password li scrive il programma (segnaposto UTENTE_USI / PASSWORD_USI): Claude non li vede mai.
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const CHIUDI_DOPO = 5 * 60 * 1000;
const MAX_TESTO = 6000;

function trovaEdge() {
  if (process.env.NAVIGATORE_BROWSER) return process.env.NAVIGATORE_BROWSER;
  const candidati = [
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft\\Edge\\Application\\msedge.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Microsoft\\Edge\\Application\\msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft\\Edge\\Application\\msedge.exe"),
  ];
  return candidati.find((c) => fs.existsSync(c));
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (url) => new Promise((ok, ko) => {
  http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { ok(JSON.parse(d)); } catch (e) { ko(e); } }); }).on("error", ko);
});

// Il codice che gira dentro la pagina: numera ciò che si può toccare e riassume il testo visibile.
const LEGGI = `(() => {
  const visibile = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const nomeDi = (e) => (e.getAttribute("aria-label") || e.innerText || e.value || e.title || e.alt ||
    (e.labels && e.labels[0] && e.labels[0].innerText) || e.placeholder || e.name || e.id || "").trim().replace(/\\s+/g, " ").slice(0, 80);
  const elementi = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [onclick]')].filter(visibile);
  const righe = elementi.map((e, i) => {
    e.setAttribute("data-nav", i + 1);
    const tag = e.tagName.toLowerCase(), tipo = (e.type || "").toLowerCase();
    let cosa = tag === "a" ? "collegamento" : tag === "button" || tipo === "submit" || tipo === "button" || e.getAttribute("role") === "button" ? "pulsante"
      : tipo === "password" ? "campo password" : tipo === "checkbox" ? "casella da spuntare" : tag === "select" ? "menu" : "campo di testo";
    let extra = "";
    if (tipo === "password") extra = e.value ? " (compilato)" : " (vuoto)";
    else if (tag === "input" || tag === "textarea") extra = e.value ? " (compilato)" : " (vuoto)";
    if (tipo === "checkbox") extra = e.checked ? " (spuntata)" : " (non spuntata)";
    if (tag === "a" && /\\.pdf($|\\?)/i.test(e.getAttribute("href") || "")) extra += " [PDF]";
    return "[" + (i + 1) + "] " + cosa + ": " + (nomeDi(e) || "(senza nome)") + extra;
  });
  const testo = (document.body ? document.body.innerText : "").replace(/\\n\\s*\\n+/g, "\\n").trim();
  return JSON.stringify({ titolo: document.title, indirizzo: location.href, testo, elementi: righe });
})()`;

function crea({ cartella, consentiti, segreti, log = () => {} }) {
  let edge = null, ws = null, id = 0, timer = null;
  const attese = new Map();
  const scaricati = path.join(cartella, "scaricati");
  const consentito = (url) => {
    try {
      const h = new URL(url).hostname;
      return consentiti.some((c) => h === c || h.endsWith("." + c));
    } catch { return false; }
  };

  function cdp(metodo, params = {}) {
    return new Promise((ok, ko) => {
      const n = ++id;
      attese.set(n, { ok, ko });
      ws.send(JSON.stringify({ id: n, method: metodo, params }));
      setTimeout(() => { if (attese.delete(n)) ko(new Error(`Il sito non risponde (${metodo})`)); }, 30000);
    });
  }
  async function valuta(espressione) {
    const r = await cdp("Runtime.evaluate", { expression: espressione, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || "errore nella pagina");
    return r.result.value;
  }

  function rinvia() {
    clearTimeout(timer);
    timer = setTimeout(chiudi, CHIUDI_DOPO);
  }

  async function avvia() {
    rinvia();
    if (ws && ws.readyState === 1) return;
    const exe = trovaEdge();
    if (!exe) throw new Error("Microsoft Edge non trovato.");
    const profilo = path.join(cartella, "profilo");
    fs.mkdirSync(scaricati, { recursive: true });
    try { fs.rmSync(path.join(profilo, "DevToolsActivePort"), { force: true }); } catch {}
    edge = spawn(exe, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profilo}`,
      "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--window-size=1280,1600",
      // solo per le prove su Linux come amministratore (su Windows non serve)
      ...(process.getuid && process.getuid() === 0 ? ["--no-sandbox"] : []), "about:blank"],
      { stdio: "ignore", windowsHide: true });
    edge.on("exit", () => { edge = null; });
    let porta = null;
    for (let i = 0; i < 100 && !porta; i++) {
      await attendi(200);
      try { porta = fs.readFileSync(path.join(profilo, "DevToolsActivePort"), "utf8").split("\n")[0].trim(); } catch {}
    }
    if (!porta) throw new Error("Edge non si è avviato.");
    const pagine = await getJson(`http://127.0.0.1:${porta}/json/list`);
    const pagina = pagine.find((p) => p.type === "page");
    ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = () => ko(new Error("Collegamento a Edge non riuscito.")); });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && attese.has(m.id)) {
        const { ok, ko } = attese.get(m.id); attese.delete(m.id);
        m.error ? ko(new Error(m.error.message)) : ok(m.result);
      }
    };
    await cdp("Page.enable");
    await cdp("Runtime.enable");
    try { await cdp("Page.setDownloadBehavior", { behavior: "allow", downloadPath: scaricati }); } catch (e) { log("download", e); }
  }

  async function aspettaCaricamento() {
    for (let i = 0; i < 60; i++) {
      await attendi(300);
      try { if ((await valuta("document.readyState")) === "complete") break; } catch {}
    }
    await attendi(600);
    const qui = await valuta("location.href");
    if (!consentito(qui) && qui !== "about:blank") {
      await cdp("Page.navigate", { url: "about:blank" });
      throw new Error(`La pagina ha portato fuori dal sito consentito (${new URL(qui).hostname}): fermato.`);
    }
  }

  async function leggi() {
    await avvia();
    const p = JSON.parse(await valuta(LEGGI));
    let testo = p.testo;
    for (const s of Object.values(segreti())) if (s) testo = testo.split(s).join("•••");
    if (testo.length > MAX_TESTO) testo = testo.slice(0, MAX_TESTO) + "\n[…pagina lunga, tagliata]";
    return `Pagina: ${p.titolo}\nIndirizzo: ${p.indirizzo}\n\nTesto:\n${testo}\n\nCosa si può usare:\n${p.elementi.join("\n") || "(niente)"}`;
  }

  async function apri(indirizzo) {
    if (!consentito(indirizzo)) throw new Error(`Posso aprire solo: ${consentiti.join(", ")}.`);
    await avvia();
    await cdp("Page.navigate", { url: indirizzo });
    await aspettaCaricamento();
    return leggi();
  }

  async function elemento(numero) {
    const ok = await valuta(`!!document.querySelector('[data-nav="${Number(numero)}"]')`);
    if (!ok) throw new Error(`Non trovo l'elemento ${numero}: rileggi la pagina.`);
    return `document.querySelector('[data-nav="${Number(numero)}"]')`;
  }

  async function clicca(numero) {
    await avvia();
    const e = await elemento(numero);
    const href = await valuta(`(${e}).href || ""`);
    if (href && /^https?:/i.test(href) && !consentito(href)) throw new Error("Quel collegamento porta fuori dal sito consentito.");
    await valuta(`(${e}).scrollIntoView({block: "center"}); (${e}).click(); true`);
    await aspettaCaricamento();
    return leggi();
  }

  // UTENTE_USI e PASSWORD_USI diventano i dati salvati nelle impostazioni.
  async function scrivi(numero, testo, invio) {
    await avvia();
    const e = await elemento(numero);
    const veri = segreti();
    const valore = Object.entries(veri).reduce((t, [k, v]) => t.split(k).join(v || ""), String(testo));
    await valuta(`(() => { const el = ${e}; el.focus();
      const p = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
      p && p.set ? p.set.call(el, ${JSON.stringify(valore)}) : (el.value = ${JSON.stringify(valore)});
      el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
      ${invio ? `if (el.form) { el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit(); }` : ""} return true; })()`);
    if (invio) await aspettaCaricamento();
    return invio ? leggi() : `Scritto nel campo ${numero}.`;
  }

  // Scarica il PDF di un collegamento (con la sessione del sito) oppure clicca e aspetta il file scaricato.
  async function scarica(numero) {
    await avvia();
    const e = await elemento(numero);
    const prima = new Set(fs.readdirSync(scaricati));
    const href = await valuta(`(${e}).href || ""`);
    if (href && /^https?:/i.test(href) && consentito(href)) {
      const b64 = await valuta(`fetch(${JSON.stringify(href)}, { credentials: "include" }).then(async (r) => {
        const t = r.headers.get("content-type") || ""; const b = new Uint8Array(await r.arrayBuffer());
        if (!/pdf|octet-stream/i.test(t) && String.fromCharCode(...b.slice(0, 4)) !== "%PDF") return "";
        let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); })`);
      if (b64) {
        const file = path.join(scaricati, `referto-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.pdf`);
        fs.writeFileSync(file, Buffer.from(b64, "base64"));
        return `Scaricato: ${path.basename(file)}`;
      }
    }
    await valuta(`(${e}).click(); true`);
    for (let i = 0; i < 60; i++) {
      await attendi(500);
      const nuovi = fs.readdirSync(scaricati).filter((f) => !prima.has(f) && !/\.(crdownload|tmp)$/i.test(f));
      if (nuovi.length) return `Scaricato: ${nuovi[0]}`;
    }
    return "Non è arrivato nessun file: rileggi la pagina, forse il referto si è aperto in un'altra pagina.";
  }

  function ultimoScaricato() {
    if (!fs.existsSync(scaricati)) return null;
    const f = fs.readdirSync(scaricati).filter((x) => !/\.(crdownload|tmp)$/i.test(x))
      .map((x) => ({ x, t: fs.statSync(path.join(scaricati, x)).mtimeMs })).sort((a, b) => b.t - a.t)[0];
    return f ? path.join(scaricati, f.x) : null;
  }

  function chiudi() {
    clearTimeout(timer);
    try { ws && ws.close(); } catch {}
    try { edge && edge.kill(); } catch {}
    ws = null; edge = null;
  }

  return { apri, leggi, clicca, scrivi, scarica, ultimoScaricato, chiudi, cartellaScaricati: scaricati };
}

module.exports = { crea, trovaEdge };
