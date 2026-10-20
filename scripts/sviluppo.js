// Avvia l'assistente senza costruire l'.exe (per provarlo sul proprio computer): poi aprire http://127.0.0.1:7777
require.extensions[".html"] = (m, f) => { m.exports = require("fs").readFileSync(f, "utf8"); };
require.extensions[".webp"] = (m, f) => { m.exports = require("fs").readFileSync(f).toString("base64"); };
require("../src/assistente").avviaServer();
console.log("Assistente acceso: apri http://127.0.0.1:7777 con Microsoft Edge o Chrome (?tema=robo per RoboGiuliano)");
