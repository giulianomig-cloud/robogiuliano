const { test } = require("node:test");
const assert = require("node:assert");
const { piuNuova } = require("../src/aggiorna");

test("confronto delle versioni", () => {
  assert.ok(piuNuova("1.0.1", "1.0.0"));
  assert.ok(piuNuova("1.2.10", "1.2.9"));
  assert.ok(!piuNuova("1.0.0", "1.0.0"));
  assert.ok(!piuNuova("0.9.9", "1.0.0"));
});
