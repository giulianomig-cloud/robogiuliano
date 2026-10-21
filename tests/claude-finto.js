// Finto "claude -p": risponde in JSON come Claude Code e racconta con cosa è stato chiamato.
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  const a = process.argv.slice(2);
  const val = (nome) => (a.includes(nome) ? a[a.indexOf(nome) + 1] : null);
  const chiamata = {
    domanda: input,
    resume: val("--resume"),
    tools: val("--tools"),
    permessi: val("--permission-mode"),
    ristretto: a.includes("--restricted"),
    consentiti: val("--allowedTools"),
    istruzioni: require("fs").readFileSync(val("--system-prompt-file"), "utf8"),
    strumenti: JSON.parse(require("fs").readFileSync(val("--mcp-config"), "utf8")),
    chiaveApi: !!process.env.ANTHROPIC_API_KEY,
    codice: process.env.CLAUDE_CODE_OAUTH_TOKEN || null,
  };
  if (a.includes("stream-json")) {
    console.log(JSON.stringify({ type: "system", subtype: "init" }));
    if (input.includes("CERCA")) console.log(JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "WebSearch", input: {} }] } }));
  }
  if (input.includes("LIMITE")) {
    console.log(JSON.stringify({ type: "result", is_error: true, result: "Claude usage limit reached" }));
    process.exit(1);
  }
  console.log(JSON.stringify({ type: "result", is_error: false, result: "RISPOSTA " + JSON.stringify(chiamata), session_id: "sessione-1" }));
});
