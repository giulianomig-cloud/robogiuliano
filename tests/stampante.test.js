// Prima di stampare: niente fogli "persi" con la stampante spenta, né finestre "Salva con nome" delle stampanti finte.
const { test } = require("node:test");
const assert = require("node:assert");
const { giudicaStampante } = require("../src/posta");

test("stampante accesa e libera: si stampa", () => {
  assert.strictEqual(giudicaStampante({ nome: "HP DeskJet 2700", offline: false, inCoda: 0 }), null);
});
test("stampante spenta: chiede di accenderla", () => {
  assert.match(giudicaStampante({ nome: "HP DeskJet 2700", offline: true, inCoda: 0 }), /spenta/);
});
test("fogli rimasti in coda: avvisa per non stampare doppio", () => {
  assert.match(giudicaStampante({ nome: "HP DeskJet 2700", offline: false, inCoda: 2 }), /2 fogli in attesa/);
});
test("stampante finta o mancante: serve il figlio", () => {
  assert.match(giudicaStampante({ nome: "Microsoft Print to PDF", offline: false, inCoda: 0 }), /non stampa su carta/);
  assert.match(giudicaStampante({}), /non c'è una stampante predefinita/);
});
