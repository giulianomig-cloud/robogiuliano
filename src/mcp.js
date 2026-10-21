// Ponte per la modalità "abbonamento": Claude Code avvia il programma con --mcp e da qui usa gli strumenti
// della posta. Ogni richiesta passa al servizio acceso, che tiene la conversazione (e il controllo del "sì").
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

async function avvia({ strumenti, porta }) {
  const server = new Server({ name: "posta", version: "1.0.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: strumenti.map((s) => ({ name: s.name, description: s.description, inputSchema: s.input_schema })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/strumento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Assistente": process.env.ASSISTENTE_TOKEN || "" },
        body: JSON.stringify({ nome: req.params.name, input: req.params.arguments || {} }),
      });
      const { esito, errore } = await r.json();
      return errore
        ? { content: [{ type: "text", text: `Errore: ${errore}` }], isError: true }
        : { content: [{ type: "text", text: String(esito) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Errore: ${e.message}` }], isError: true };
    }
  });
  await server.connect(new StdioServerTransport());
}

module.exports = { avvia };
