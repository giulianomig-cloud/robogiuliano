// Prepara l'ambiente di prova: pagine e immagini caricabili da Node, cartella delle impostazioni temporanea.
const fs = require("fs");
const os = require("os");
const path = require("path");

require.extensions[".html"] = (m, f) => { m.exports = fs.readFileSync(f, "utf8"); };
require.extensions[".webp"] = require.extensions[".png"] = require.extensions[".ico"] = (m, f) => { m.exports = fs.readFileSync(f).toString("base64"); };

function casaFinta(config) {
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), "casa-"));
  process.env.HOME = process.env.USERPROFILE = process.env.APPDATA = casa;
  const dir = process.platform === "win32" ? path.join(casa, "AssistenteClaude") : path.join(casa, ".assistente-claude");
  fs.mkdirSync(dir, { recursive: true });
  if (config) fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(config));
  return dir;
}

// Il codice della pagina (senza eseguirlo): serve per provare la parola d'ordine.
function codicePagina() {
  const s = fs.readFileSync(path.join(__dirname, "..", "src", "pagina.html"), "utf8");
  return s.slice(s.lastIndexOf("<script>") + 8, s.lastIndexOf("</script>"));
}

module.exports = { casaFinta, codicePagina };
