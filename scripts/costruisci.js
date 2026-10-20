// Costruisce AssistenteClaude.exe: un solo file con dentro Node, il programma, le pagine e le immagini.
// Uso: node scripts/costruisci.js [percorso di node.exe per Windows]
// Su Windows usa il node.exe che lo sta eseguendo; altrove serve il node.exe di Windows della stessa versione.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const esbuild = require("esbuild");

const radice = path.join(__dirname, "..");
const uscita = path.join(radice, "uscita");
const { version } = require("../package.json");
fs.mkdirSync(uscita, { recursive: true });

// 1. Tutto il codice in un unico file, con la versione scritta dentro.
esbuild.buildSync({
  entryPoints: [path.join(radice, "src", "avvio.js")],
  bundle: true, platform: "node", target: "node22", format: "cjs",
  loader: { ".html": "text", ".webp": "base64" },
  define: { __VERSIONE__: JSON.stringify(version) },
  outfile: path.join(uscita, "assistente.js"),
  logLevel: "warning",
});

// 2. Il "pacchetto" da iniettare dentro node.exe.
const seaConfig = path.join(uscita, "sea-config.json");
fs.writeFileSync(seaConfig, JSON.stringify({
  main: path.join(uscita, "assistente.js"), output: path.join(uscita, "sea-prep.blob"),
  disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false,
}));
execFileSync(process.execPath, ["--experimental-sea-config", seaConfig], { stdio: "inherit" });

// 3. node.exe + pacchetto = AssistenteClaude.exe
const nodeExe = process.argv[2] || (process.platform === "win32" ? process.execPath : null);
if (!nodeExe) {
  console.log("Pacchetto pronto. Per l'.exe serve node.exe di Windows: node scripts/costruisci.js percorso/node.exe");
  process.exit(0);
}
const exe = path.join(uscita, "AssistenteClaude.exe");
fs.copyFileSync(nodeExe, exe);
if (process.platform === "win32") {
  // La firma digitale di node.exe non vale più dopo l'iniezione: si toglie se signtool c'è.
  try { execFileSync("signtool", ["remove", "/s", exe], { stdio: "ignore" }); } catch {}
}
execFileSync(process.execPath, [require.resolve("postject/dist/cli.js"), exe, "NODE_SEA_BLOB", path.join(uscita, "sea-prep.blob"),
  "--sentinel-fuse", "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"], { stdio: "inherit" });

// 4. Programma "a finestre" invece che "a riga di comando": così non compare la finestra nera.
const fd = fs.openSync(exe, "r+");
const testa = Buffer.alloc(0x400);
fs.readSync(fd, testa, 0, testa.length, 0);
const pe = testa.readUInt32LE(0x3c);
const sottosistema = Buffer.alloc(2); sottosistema.writeUInt16LE(2);
fs.writeSync(fd, sottosistema, 0, 2, pe + 0x18 + 0x44);
fs.closeSync(fd);

fs.writeFileSync(path.join(uscita, "versione.json"), JSON.stringify({ versione: version }));
console.log(`Pronto: ${exe} (versione ${version})`);
