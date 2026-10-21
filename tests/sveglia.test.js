// La parola d'ordine ("Ehi Aurora", "Ehi RoboGiuliano") e cosa resta come domanda.
const { test } = require("node:test");
const assert = require("node:assert");
const { codicePagina } = require("./aiuto");

const creaSveglia = new Function(codicePagina().match(/function creaSveglia[\s\S]*?\r?\n  }\r?\n/)[0] + "return creaSveglia;")();
const dopo = (nome, frase) => {
  const m = frase.match(creaSveglia(nome));
  return m ? frase.slice(m.index + m[0].length) : null;
};

test("Aurora: con e senza Ehi, con accenti", () => {
  assert.strictEqual(dopo("Aurora", "Ehi Aurora, leggimi la posta"), "leggimi la posta");
  assert.strictEqual(dopo("Aurora", "aurora che ore sono"), "che ore sono");
  assert.strictEqual(dopo("Aurora", "ehi àurora stampa"), "stampa");
  assert.strictEqual(dopo("Aurora", "auroraaa"), null);
});

test("RoboGiuliano: tutte le varianti che scrive il riconoscimento della voce", () => {
  assert.strictEqual(dopo("RoboGiuliano", "Ehi RoboGiuliano stampa"), "stampa");
  assert.strictEqual(dopo("RoboGiuliano", "ehi robo giuliano ho email nuove"), "ho email nuove");
  assert.strictEqual(dopo("RoboGiuliano", "Ehi robot Giuliano, leggimi la posta"), "leggimi la posta");
  assert.strictEqual(dopo("RoboGiuliano", "ehi robo-giuliano ciao"), "ciao");
});

test("RoboGiuliano: il nome Giuliano da solo NON lo sveglia", () => {
  assert.strictEqual(dopo("RoboGiuliano", "ho parlato con Giuliano ieri"), null);
  assert.strictEqual(dopo("RoboGiuliano", "ehi Giuliano vieni a pranzo"), null);
});

test("RoboYaymaris: i modi in cui il riconoscimento della voce può scrivere il nome", () => {
  assert.strictEqual(dopo("RoboYaymaris", "Ehi RoboYaymaris, ho email nuove?"), "ho email nuove?");
  assert.strictEqual(dopo("RoboYaymaris", "ehi robo yaymaris stampa"), "stampa");
  assert.strictEqual(dopo("RoboYaymaris", "ehi robot Jaymaris leggimi la posta"), "leggimi la posta");
  assert.strictEqual(dopo("RoboYaymaris", "ehi robo jay maris che ore sono"), "che ore sono");
  assert.strictEqual(dopo("RoboYaymaris", "ehi robot Iamaris ciao"), "ciao");
  assert.strictEqual(dopo("RoboYaymaris", "ehi robot giamaris ciao"), "ciao");
});

test("RoboYaymaris: senza \"robo\" non si sveglia", () => {
  assert.strictEqual(dopo("RoboYaymaris", "ho visto Yaymaris ieri"), null);
  assert.strictEqual(dopo("RoboYaymaris", "andiamo al mare"), null);
});
