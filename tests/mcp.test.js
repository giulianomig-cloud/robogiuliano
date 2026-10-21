// Il ponte degli strumenti: Claude Code vede gli strumenti della posta e ogni chiamata arriva al servizio con la parola segreta.
const { test } = require("node:test");
const assert = require("node:assert");
const http = require("http");
const path = require("path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

test("elenco degli strumenti e chiamata inoltrata al servizio", async () => {
  const ricevute = [];
  const servizio = http.createServer((req, res) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => {
      ricevute.push({ segreto: req.headers["x-assistente"], ...JSON.parse(d) });
      res.end(JSON.stringify({ esito: "3 email nuove" }));
    });
  });
  await new Promise((ok) => servizio.listen(0, "127.0.0.1", ok));
  const avvio = `require.extensions[".html"]=(m)=>{m.exports=""};require.extensions[".webp"]=require.extensions[".png"]=(m)=>{m.exports=""};
    require(${JSON.stringify(path.join(__dirname, "..", "src", "mcp"))}).avvia({ strumenti: require(${JSON.stringify(path.join(__dirname, "..", "src", "assistente"))}).STRUMENTI, porta: ${servizio.address().port} });`;
  const client = new Client({ name: "prova", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ["-e", avvio], env: { ...process.env, ASSISTENTE_TOKEN: "segreto-di-prova" } }));
  const { tools } = await client.listTools();
  assert.ok(tools.some((t) => t.name === "elenco_email"));
  assert.ok(tools.some((t) => t.name === "invia_bozza"));
  const r = await client.callTool({ name: "elenco_email", arguments: { solo_non_lette: true } });
  assert.strictEqual(r.content[0].text, "3 email nuove");
  assert.deepStrictEqual(ricevute, [{ segreto: "segreto-di-prova", nome: "elenco_email", input: { solo_non_lette: true } }]);
  await client.close();
  servizio.close();
});
