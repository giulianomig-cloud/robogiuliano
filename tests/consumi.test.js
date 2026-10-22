// Consumi di Claude: quanto lavora (domande, token, minuti), niente dollari.
const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { casaFinta } = require("./aiuto");

let a, dir;
before(() => { dir = casaFinta({ apiKey: "x" }); a = require("../src/assistente"); });

test("token contati tutti: entrata, cache e uscita", () => {
  assert.strictEqual(a.tokenDi({ input_tokens: 100, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0, output_tokens: 50 }), 5150);
  assert.strictEqual(a.quantiToken(1250000), "1,3 milioni");
  assert.strictEqual(a.quantiToken(350400), "350 mila");
});

test("riassunto: oggi, settimana, mese, mese scorso", () => {
  const adesso = new Date(2026, 9, 22, 12);
  const riga = (m, giorno, token, secondi) => JSON.stringify({ t: new Date(2026, m, giorno, 10).toISOString(), token, secondi }) + "\n";
  fs.writeFileSync(path.join(dir, "consumi.jsonl"), riga(9, 22, 1000, 30) + riga(9, 20, 2000, 30) + riga(9, 2, 3000, 60) + riga(8, 30, 9000, 6));
  const r = Object.fromEntries(a.riassuntoConsumi(adesso).map((p) => [p.nome, p]));
  assert.deepStrictEqual([r["oggi"].domande, r["ultimi 7 giorni"].domande, r["questo mese"].domande, r["mese scorso"].domande], [1, 2, 3, 1]);
  assert.strictEqual(r["questo mese"].token, 6000);
  assert.strictEqual(r["questo mese"].minuti, 2);
  assert.doesNotMatch(a.testoConsumi(), /\$/);
});
