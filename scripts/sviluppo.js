// Avvia l'assistente senza costruire l'.exe (per provarlo sul proprio computer): poi aprire http://127.0.0.1:7777
// Con --mcp fa da ponte degli strumenti per Claude Code (modalità abbonamento), come "AssistenteClaude.exe --mcp".
const fs = require("fs");
require.extensions[".html"] = (m, f) => { m.exports = fs.readFileSync(f, "utf8"); };
require.extensions[".webp"] = require.extensions[".png"] = require.extensions[".ico"] = (m, f) => { m.exports = fs.readFileSync(f).toString("base64"); };
const assistente = require("../src/assistente");
if (process.argv.includes("--mcp")) {
  require("../src/mcp").avvia({ strumenti: assistente.STRUMENTI, porta: 7777 });
} else {
  process.env.ASSISTENTE_MCP = JSON.stringify([process.execPath, __filename, "--mcp"]);
  assistente.avviaServer();
  console.log("Assistente acceso: apri http://127.0.0.1:7777 con Microsoft Edge o Chrome (?tema=robo per RoboGiuliano)");
}
