// Le email partono solo dopo un "sì" detto nel messaggio successivo alla lettura della bozza.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("http");
const { casaFinta } = require("./aiuto");

// Claude finto: risponde con una sequenza di risposte prestabilite.
const copioni = [];
const richieste = [];
let server;
before(async () => {
  server = http.createServer((req, res) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => {
      const b = JSON.parse(d); richieste.push(b);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: b.model, usage: { input_tokens: 1, output_tokens: 1 }, ...copioni.shift() }));
    });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  casaFinta({ apiKey: "sk-finta", email: "prova@yahoo.it", password: "x", nome: "Maria", smtpHost: "127.0.0.1", tema: "robo" });
});
after(() => server.close());

const uso = (id, name, input = {}) => ({ type: "tool_use", id, name, input });
const ultimoEsito = (id) => richieste.at(-1).messages.at(-1).content.find((b) => b.tool_use_id === id);

test("bozza e invio nello stesso turno: l'invio è bloccato", async () => {
  const a = require("../src/assistente");
  copioni.push(
    { content: [uso("t1", "prepara_email", { a: "maria@example.com", oggetto: "Pranzo", testo: "Vengo volentieri" }), uso("t2", "invia_bozza")], stop_reason: "tool_use" },
    { content: [{ type: "text", text: "Ho preparato: Vengo volentieri. La mando?" }], stop_reason: "end_turn" },
  );
  assert.strictEqual(await a.chiedi("scrivi a Maria che vengo"), "Ho preparato: Vengo volentieri. La mando?");
  const esito = ultimoEsito("t2");
  assert.strictEqual(esito.is_error, true);
  assert.match(esito.content, /conferma/);
});

test("dopo un sì l'invio parte (qui fallisce solo perché non c'è un server di posta)", async () => {
  const a = require("../src/assistente");
  copioni.push(
    { content: [uso("t3", "invia_bozza")], stop_reason: "tool_use" },
    { content: [{ type: "text", text: "Fatto." }], stop_reason: "end_turn" },
  );
  await a.chiedi("sì mandala");
  assert.doesNotMatch(ultimoEsito("t3").content, /conferma/);
});

test("senza un sì l'invio resta bloccato", async () => {
  const a = require("../src/assistente");
  copioni.push(
    { content: [uso("t4", "prepara_email", { a: "x@example.com", oggetto: "Ciao", testo: "Ciao" })], stop_reason: "tool_use" },
    { content: [{ type: "text", text: "La mando?" }], stop_reason: "end_turn" },
    { content: [uso("t5", "invia_bozza")], stop_reason: "tool_use" },
    { content: [{ type: "text", text: "Va bene, non la mando." }], stop_reason: "end_turn" },
  );
  await a.chiedi("scrivi a x un ciao");
  await a.chiedi("no aspetta");
  assert.match(ultimoEsito("t5").content, /conferma/);
});

test("la richiesta usa il modello, lo sforzo basso e il nome dello stile", () => {
  const r = richieste[0];
  assert.strictEqual(r.model, "claude-opus-5-5");
  assert.deepStrictEqual(r.output_config, { effort: "low" });
  assert.match(r.system, /Ti chiami RoboGiuliano/);
});
