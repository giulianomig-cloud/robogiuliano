// La pagina ha codice valido e tutte le immagini che usa esistono.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { codicePagina } = require("./aiuto");

const src = path.join(__dirname, "..", "src");
const pagina = fs.readFileSync(path.join(src, "pagina.html"), "utf8");

test("il codice della pagina è scritto correttamente", () => {
  assert.doesNotThrow(() => new Function(codicePagina()));
});

test("ci sono solo gli stili Aurora e robot, e i personaggi Aurora, RoboGiuliano e RoboYaymaris", () => {
  const temi = new Set([...pagina.matchAll(/data-tema="([a-z]+)"\]/g)].map((m) => m[1]));
  assert.deepStrictEqual([...temi].sort(), ["allegra", "robo"]);
  for (const p of ["allegra:", "robo:", "yaymaris:"]) assert.ok(pagina.includes(p), p);
});

test("ogni foto dei personaggi esiste ed è servita dal programma", () => {
  const assistente = fs.readFileSync(path.join(src, "assistente.js"), "utf8");
  const pose = [...pagina.matchAll(/data-f="([\w-]+)"/g)].map((m) => m[1]);
  assert.strictEqual(pose.length, 6);
  for (const chi of ["robo", "yaymaris"]) {
    for (const posa of pose) {
      const nome = `${chi}-${posa}.webp`;
      assert.ok(fs.existsSync(path.join(src, nome)), nome);
      assert.ok(assistente.includes(`require("./${nome}")`), nome);
    }
    assert.ok(pagina.includes(`file: "${chi}"`), chi);
  }
});

test("le impostazioni hanno codice valido e tutti i campi che il programma salva", () => {
  const imp = fs.readFileSync(path.join(src, "impostazioni.html"), "utf8");
  for (const m of imp.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new Function(m[1]));
  for (const campo of ["nome", "nomeAssistente", "tema", "voce", "email", "password", "modo", "tokenAbbonamento", "apiKey", "usiUtente", "usiPassword", "emailFiglio",
    "registroSuRichiesta", "avvisaErrori", "registroConConversazioni", "assistenzaRemota", "avvioAutomatico"]) {
    assert.ok(imp.includes(`name="${campo}"`), campo);
  }
  // ogni voce del menu a sinistra apre una scheda che esiste
  for (const m of imp.matchAll(/data-vai="(\w+)"/g)) assert.ok(imp.includes(`id="s-${m[1]}"`), m[1]);
});
