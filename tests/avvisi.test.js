// La striscia in alto: dagli errori veri alla scritta giusta.
const { test, before } = require("node:test");
const assert = require("node:assert");
const { casaFinta } = require("./aiuto");

let a;
before(() => { casaFinta({ apiKey: "x" }); a = require("../src/assistente"); });

test("stampante spenta, fogli in attesa, stampante finta", () => {
  assert.strictEqual(a.avvisoDa(new Error('La stampante "HP" sembra spenta o scollegata. Chiedile di accenderla')).testo, "La stampante è spenta");
  assert.strictEqual(a.avvisoDa(new Error('Nella stampante "HP" ci sono ancora 2 fogli in attesa')).tipo, "arancio");
  assert.strictEqual(a.avvisoDa(new Error('La stampante predefinita è "Microsoft Print to PDF", che non stampa su carta')).tipo, "rosso");
});

test("internet che non va", () => {
  assert.strictEqual(a.avvisoDa(new Error("getaddrinfo ENOTFOUND imap.mail.yahoo.com")).icona, "📶");
});

test("errori qualunque: nessuna striscia", () => {
  assert.strictEqual(a.avvisoDa(new Error("Email non trovata")), null);
});
