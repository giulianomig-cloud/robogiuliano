// Il navigatore entra nel finto sito come farebbe Claude: legge, scrive (con i segnaposto), clicca, scarica.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const navigatore = require("../src/navigatore");
const sito = require("./sito-finto");

const browser = navigatore.trovaEdge() || (fs.existsSync("/opt/pw-browsers/chromium") && "/opt/pw-browsers/chromium");
const numero = (pagina, testo) => Number(pagina.split("\n").find((r) => r.startsWith("[") && r.includes(testo)).match(/^\[(\d+)\]/)[1]);

async function prova(conCodice) {
  if (browser) process.env.NAVIGATORE_BROWSER = browser;
  const { server, url } = await sito.avvia({ utente: "MARIA1", password: "segreta!", conCodice });
  const n = navigatore.crea({
    cartella: fs.mkdtempSync(path.join(os.tmpdir(), "nav-")), consentiti: ["127.0.0.1"],
    segreti: () => ({ UTENTE_USI: "MARIA1", PASSWORD_USI: "segreta!" }),
  });
  try {
    let p = await n.apri(`${url}/areaprivata/referti`);
    assert.match(p, /Accedi/);
    await n.scrivi(numero(p, "campo di testo: Nome utente"), "UTENTE_USI");
    p = await n.scrivi(numero(p, "campo password: Password"), "PASSWORD_USI", true);
    assert.doesNotMatch(p, /segreta!/, "la password non deve mai comparire a Claude");
    if (conCodice) {
      assert.match(p, /Codice ricevuto via SMS/);
      p = await n.scrivi(numero(p, "Codice ricevuto"), "4521", true);
    }
    assert.match(p, /Esami del sangue/);
    const esito = await n.scarica(numero(p, "collegamento: Scarica"));
    assert.match(esito, /Scaricato/);
    assert.strictEqual(fs.readFileSync(n.ultimoScaricato(), "utf8").slice(0, 4), "%PDF");
    await assert.rejects(n.apri("https://altro-sito.example/"), /Posso aprire solo/);
    p = await n.leggi();
  } finally {
    n.chiudi();
    server.close();
  }
}

test("entra con utente e password, trova e scarica il referto", { skip: !browser && "nessun browser" }, () => prova(false));
test("con il codice SMS detto a voce", { skip: !browser && "nessun browser" }, () => prova(true));
