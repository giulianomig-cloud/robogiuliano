// Il figlio riceve il registro (senza le conversazioni) quando lo chiede, e da solo se ci sono errori.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const assistenza = require("../src/assistenza");

function registro() {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "reg-")), "registro.txt");
  const ora = new Date().toISOString();
  fs.writeFileSync(f, [
    `[${ora}] in ascolto sulla porta 7777 versione 1.4.0`,
    `[${ora}] lei: mi legge l'email del dottore?`,
    `[${ora}] claude: Il dottore scrive che gli esami vanno bene.`,
    `seconda riga della risposta con dati personali`,
    `[${ora}] strumento stampa_email Error: La stampante "HP" sembra spenta`,
  ].join("\n") + "\n");
  return f;
}

function finto(richieste) {
  const mandate = [];
  const posta = { crea: () => ({
    prendiRichieste: async ({ mittente, parola }) => { assert.strictEqual(mittente, "figlio@example.com"); assert.strictEqual(parola, "registro"); return richieste; },
    invia: async (m) => { mandate.push(m); },
  }) };
  return { posta, mandate };
}
const cfg = { email: "mamma@yahoo.it", password: "x", emailFiglio: "figlio@example.com" };

test("il registro mandato non contiene le conversazioni", () => {
  const t = assistenza.registroDaMandare(registro());
  assert.match(t, /in ascolto/);
  assert.match(t, /sembra spenta/);
  assert.doesNotMatch(t, /dottore|dati personali/);
});

test("su richiesta: risponde solo al figlio, con il registro allegato", async () => {
  const { posta, mandate } = finto(1);
  await assistenza.crea({ leggiConfig: () => ({ ...cfg, avvisaErrori: false }), posta, log() {}, fileLog: registro(), diagnosi: () => "Versione: 1.4.0" }).controlla();
  assert.strictEqual(mandate.length, 1);
  assert.strictEqual(mandate[0].a, "figlio@example.com");
  assert.match(mandate[0].oggetto, /richiesto da te/);
  assert.match(mandate[0].testo, /Versione: 1.4.0/);
  assert.doesNotMatch(mandate[0].allegati[0].content, /dottore/);
});

test("errori: avvisa da solo, ma una volta al giorno", async () => {
  const { posta, mandate } = finto(0);
  const a = assistenza.crea({ leggiConfig: () => cfg, posta, log() {}, fileLog: registro(), diagnosi: () => "" });
  await a.controlla();
  await a.controlla();
  assert.strictEqual(mandate.length, 1);
  assert.match(mandate[0].oggetto, /errori/);
});

test("senza email del figlio non fa niente", async () => {
  const { posta, mandate } = finto(1);
  await assistenza.crea({ leggiConfig: () => ({ ...cfg, emailFiglio: "" }), posta, log() {}, fileLog: registro(), diagnosi: () => "" }).controlla();
  assert.strictEqual(mandate.length, 0);
});
