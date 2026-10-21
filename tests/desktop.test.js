// Le ricette vanno sul desktop con un nome chiaro, senza cancellare quelle già salvate.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

test("salva sul desktop con un nome chiaro e non sovrascrive", () => {
  process.env.HOME = process.env.USERPROFILE = fs.mkdtempSync(path.join(os.tmpdir(), "casa-"));
  delete require.cache[require.resolve("../src/posta")];
  const posta = require("../src/posta");
  const pdf = path.join(os.tmpdir(), `prova-${Date.now()}.pdf`);
  fs.writeFileSync(pdf, "%PDF-1.4");
  const uno = posta.copiaSulDesktop(pdf, "Ricetta 21/10/2026");
  const due = posta.copiaSulDesktop(pdf, "Ricetta 21/10/2026");
  assert.strictEqual(path.basename(uno), "Ricetta 21-10-2026.pdf");
  assert.strictEqual(path.basename(due), "Ricetta 21-10-2026 (2).pdf");
  assert.strictEqual(path.dirname(uno), posta.cartellaDesktop());
});
