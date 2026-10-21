// Assistenza da remoto: avvia Claude Code in modalità Remote Control sul PC della mamma, così il figlio
// dall'app Claude sul telefono (o da claude.ai/code) lavora sul PC. Si può attivare/disattivare nelle impostazioni,
// si chiude da sola dopo 2 ore. Ogni azione importante va approvata dal figlio sul telefono.
const fs = require("fs");
const path = require("path");
const { spawn, execFile } = require("child_process");

const DURATA = 2 * 60 * 60 * 1000;
const NOME_SESSIONE = "PC della mamma";

function crea({ cartella, trovaClaude, log }) {
  let timer = null;
  const lavoro = path.join(cartella, "assistenza-remota");

  // Un piccolo file .cmd che apre la finestra con il titolo giusto (come per "Collega il mio account").
  function scriviCmd(nome, righe) {
    fs.mkdirSync(lavoro, { recursive: true });
    const file = path.join(lavoro, nome);
    fs.writeFileSync(file, ["@echo off", `cd /d "${lavoro}"`, ...righe].join("\r\n") + "\r\n");
    return file;
  }

  function apri(file, ridotta) {
    if (process.platform !== "win32") return log("assistenza da remoto: solo su Windows", file);
    const args = ["/c", "start", "", ...(ridotta ? ["/min"] : []), file];
    spawn("cmd.exe", args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
  }

  // Una volta sola: si entra con il proprio account Claude e si dice che la cartella è "fidata".
  function prepara(cfg) {
    const claude = trovaClaude(cfg);
    if (!claude) throw new Error("Prima installa Claude Code (sezione abbonamento).");
    apri(scriviCmd("prepara.cmd", [
      "title Prepara assistenza da remoto",
      "echo Entra con il tuo account Claude (se lo chiede) e conferma che questa cartella e' fidata.",
      "echo Poi scrivi /exit e premi Invio per chiudere.",
      "echo.",
      `"${claude}"`,
    ]), false);
  }

  function avvia(cfg) {
    if (!cfg.assistenzaRemota) throw new Error("L'assistenza da remoto è disattivata nelle impostazioni.");
    const claude = trovaClaude(cfg);
    if (!claude) throw new Error("Claude Code non è installato.");
    ferma();
    apri(scriviCmd("assistenza.cmd", [
      "title Assistenza in corso - non chiudere",
      "echo Assistenza da remoto in corso: il figlio puo' aiutare da lontano. Si chiude da sola.",
      `"${claude}" remote-control --name "${NOME_SESSIONE}" --spawn session`,
    ]), true);
    clearTimeout(timer);
    timer = setTimeout(() => { log("assistenza da remoto chiusa dopo 2 ore"); ferma(); }, DURATA);
    log("assistenza da remoto avviata");
    return `Assistenza da remoto avviata: apri l'app Claude e cerca la sessione "${NOME_SESSIONE}". Si chiude da sola tra 2 ore.`;
  }

  // Chiude Claude Code in Remote Control (solo quello: le altre cose di Claude Code restano).
  function ferma() {
    clearTimeout(timer);
    if (process.platform !== "win32") return;
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='claude.exe'\" | Where-Object { $_.CommandLine -like '*remote-control*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"],
      { windowsHide: true }, () => {});
  }

  return { prepara, avvia, ferma, NOME_SESSIONE };
}

module.exports = { crea };
