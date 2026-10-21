// Un finto sito di referti: login con utente e password (e a richiesta un codice SMS), elenco, PDF protetto.
const http = require("http");

function avvia({ utente, password, conCodice = false }) {
  const pagina = (corpo) => `<!doctype html><html><head><title>Area privata</title></head><body>${corpo}</body></html>`;
  let fase = "";
  const server = http.createServer((req, res) => {
    const cookie = req.headers.cookie || "";
    const entrato = cookie.includes("sessione=ok");
    const leggiForm = (fn) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => fn(new URLSearchParams(d))); };
    if (req.url === "/areaprivata/referti" && !entrato) {
      res.writeHead(302, { Location: "/login" }); return res.end();
    }
    if (req.url === "/login" && req.method === "GET") {
      return res.end(pagina(`<h1>Accedi</h1><form method="post" action="/login">
        <label for="u">Nome utente</label><input id="u" name="u">
        <label for="p">Password</label><input id="p" name="p" type="password">
        <button type="submit">Accedi</button></form><a href="https://altro-sito.example/">Pubblicità</a>`));
    }
    if (req.url === "/login" && req.method === "POST") {
      return leggiForm((f) => {
        if (f.get("u") !== utente || f.get("p") !== password) return res.end(pagina("<p>Credenziali errate</p>"));
        if (conCodice) { fase = "codice"; return res.end(pagina(`<form method="post" action="/codice"><label for="c">Codice ricevuto via SMS</label><input id="c" name="c"><button>Conferma</button></form>`)); }
        res.writeHead(302, { "Set-Cookie": "sessione=ok; Path=/", Location: "/areaprivata/referti" }); res.end();
      });
    }
    if (req.url === "/codice" && req.method === "POST") {
      return leggiForm((f) => {
        if (fase !== "codice" || f.get("c") !== "4521") return res.end(pagina("<p>Codice errato</p>"));
        res.writeHead(302, { "Set-Cookie": "sessione=ok; Path=/", Location: "/areaprivata/referti" }); res.end();
      });
    }
    if (req.url === "/areaprivata/referti") {
      return res.end(pagina(`<h1>I tuoi referti</h1><table><tr><td>Esami del sangue - 20/10/2026</td>
        <td><a href="/referti/1.pdf">Scarica</a></td></tr></table>`));
    }
    if (req.url === "/referti/1.pdf") {
      if (!entrato) { res.writeHead(403); return res.end("vietato"); }
      res.writeHead(200, { "Content-Type": "application/pdf" });
      return res.end("%PDF-1.4\n% referto di prova\n%%EOF\n");
    }
    res.writeHead(404); res.end();
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

module.exports = { avvia };
