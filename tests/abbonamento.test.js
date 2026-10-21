// Modalità abbonamento: Claude Code chiamato con i permessi giusti, la conversazione che continua, gli errori capiti.
const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { casaFinta } = require("./aiuto");

// Su Windows un file .cmd, altrove uno script: tutti e due lanciano il Claude Code finto.
function claudeFinto() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-"));
  const script = path.join(__dirname, "claude-finto.js");
  if (process.platform === "win32") {
    const f = path.join(dir, "claude.cmd");
    fs.writeFileSync(f, `@"${process.execPath}" "${script}" %*\r\n`);
    return f;
  }
  const f = path.join(dir, "claude");
  fs.writeFileSync(f, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
  fs.chmodSync(f, 0o755);
  return f;
}

let a;
before(() => {
  process.env.ANTHROPIC_API_KEY = "sk-non-deve-passare";
  casaFinta({ modo: "abbonamento", claudePath: claudeFinto(), tokenAbbonamento: "sk-ant-oat-prova", tema: "robo", nome: "Maria" });
  a = require("../src/assistente");
});

const chiamata = (risposta) => JSON.parse(risposta.replace(/^RISPOSTA /, ""));

test("Claude Code può solo cercare su internet e usare la posta, senza chiedere permessi", async () => {
  const c = chiamata(await a.chiedi("che tempo fa domani?"));
  assert.match(c.domanda, /che tempo fa domani\?$/);
  assert.strictEqual(c.ristretto, true);
  assert.strictEqual(c.tools, "WebSearch,WebFetch");
  assert.strictEqual(c.permessi, "dontAsk");
  assert.strictEqual(c.consentiti, "mcp__posta,WebSearch,WebFetch");
  assert.match(c.istruzioni, /Ti chiami RoboGiuliano/);
  assert.match(c.istruzioni, /ricerca su internet/);
  assert.deepStrictEqual(c.strumenti.mcpServers.posta.args.slice(-1), ["--mcp"]);
  assert.ok(c.strumenti.mcpServers.posta.env.ASSISTENTE_TOKEN.length >= 32);
});

test("usa l'abbonamento e mai la chiave a consumo", async () => {
  const c = chiamata(await a.chiedi("ciao"));
  assert.strictEqual(c.chiaveApi, false);
  assert.strictEqual(c.codice, "sk-ant-oat-prova");
});

test("la conversazione continua (per dire \"stampala\" o \"sì, mandala\")", async () => {
  const c = chiamata(await a.chiedi("e dopodomani?"));
  assert.strictEqual(c.resume, "sessione-1");
});

test("credito finito: lo dice in modo semplice", async () => {
  await assert.rejects(a.chiedi("LIMITE"), (e) => {
    assert.strictEqual(e.tipo, "limite");
    return true;
  });
});
