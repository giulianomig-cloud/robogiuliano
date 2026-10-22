// Consumi di Claude: prezzo dai token e riassunto per periodo.
const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { casaFinta } = require("./aiuto");

let a, dir;
before(() => { dir = casaFinta({ apiKey: "x" }); a = require("../src/assistente"); });

test("costo dai token (Opus 5.5: $4 entrata, $20 uscita per milione)", () => {
  assert.strictEqual(+a.costoDi("claude-opus-5-5", { input_tokens: 1e6, output_tokens: 1e5 }).toFixed(2), 6);
  assert.strictEqual(+a.costoDi("modello-sconosciuto", { cache_read_input_tokens: 1e6 }).toFixed(2), 0.2);
});

test("riassunto: oggi, settimana, mese, mese scorso", () => {
  const cartella = dir;
  const adesso = new Date(2026, 9, 22, 12);
  const riga = (giorno, costo) => JSON.stringify({ t: new Date(2026, 9, giorno, 10).toISOString(), costo }) + "\n";
  const vecchio = JSON.stringify({ t: new Date(2026, 8, 30, 10).toISOString(), costo: 1 }) + "\n";
  fs.writeFileSync(path.join(cartella, "consumi.jsonl"), riga(22, 0.02) + riga(20, 0.03) + riga(2, 0.05) + vecchio);
  const r = Object.fromEntries(a.riassuntoConsumi(adesso).map((p) => [p.nome, p]));
  assert.deepStrictEqual([r["oggi"].domande, r["ultimi 7 giorni"].domande, r["questo mese"].domande, r["mese scorso"].domande], [1, 2, 3, 1]);
  assert.strictEqual(r["questo mese"].costo, 0.1);
});
