# RoboGiuliano (Aurora assistente) — istruzioni per Claude

## Lingua
- Rispondi sempre in **italiano**, con spiegazioni semplici: l'utente (Giuliano) non è un programmatore.
- L'assistente è per sua madre, che non sa usare il computer (Windows, posta Yahoo).

## Il progetto
- Programma Windows unico (`AssistenteClaude.exe`, Node "single executable"): un piccolo server locale
  (`src/assistente.js`, porta 7777) + una finestra di Edge in modalità app (`src/pagina.html`) che ascolta
  (Web Speech API, it-IT) e parla (speechSynthesis).
- Claude via API (chiave dell'utente, ricarica a consumo, scelta "C"): modello `claude-opus-5-5`, `effort: low`,
  fallback server-side `"default"`, strumenti per la posta in `src/assistente.js`.
- Posta Yahoo via IMAP/SMTP con **password per app** (`src/posta.js`); stampa silenziosa con PowerShell
  `Out-Printer` (stampante predefinita), allegati con `Start-Process -Verb Print`.
- Impostazioni e dati personali SOLO in `%APPDATA%\AssistenteClaude\config.json` sul PC: **mai nel repository**
  (il repo è pubblico; l'utente lo ha permesso purché non ci finiscano i dati della madre).
- Le email partono solo con `prepara_email`/`prepara_risposta` + `invia_bozza`, e il server controlla che nel
  messaggio successivo ci sia un "sì" (regex `SI`): non fidarsi solo del modello.

## Stili (decisi dall'utente: SOLO questi due)
- **Aurora** (`data-tema="allegra"`): goccia colorata con faccina (occhi che sbattono, bocca che parla),
  bollicine, onde. Voce femminile. "Ehi Aurora". È lo stile predefinito, da lasciare com'è.
- **RoboGiuliano** (`data-tema="robo"`): avatar robot con la faccia di Giuliano, 4 pose
  (`src/robo-riposo|ascolto|pensa|parla.webp`, ricavate da un'immagine sua con lo sfondo tolto) + 2 posizioni della
  bocca (`robo-parla-2/3.webp`, mascella alzata) che si alternano mentre parla. Voce maschile.
  "Ehi RoboGiuliano" (accetta "robo/robot Giuliano"; "Giuliano" da solo NON lo sveglia).
- Scartati (non riproporli): Classico crema/oro, Sfera, Ologramma, Aurora "vetro", Zeus (avatar neon e con la
  foto di Giuliano), le 4 facce con robottino e scritte.

## Versioni e aggiornamenti
- La versione è `version` in `package.json` (finisce nell'exe come `__VERSIONE__`).
- Push su `main` → GitHub Actions (`.github/workflows/rilascio.yml`, Windows): `npm test`, costruzione, prova
  dell'exe su Windows, e release `v<versione>` se la versione è nuova.
- Il programma installato (`%LOCALAPPDATA%\AssistenteClaude\AssistenteClaude.exe`) controlla
  `releases/latest/download/versione.json` e si aggiorna da solo (`src/aggiorna.js`).
- **A ogni modifica da pubblicare: aumenta `version`.**

## Come lavorare
- Non fare modifiche che l'utente non ha chiesto; per le proposte grafiche prima anteprime (immagini/video).
- Prima di ogni push: `npm test`.
- Le conversazioni non si salvano tra una sessione e l'altra: scrivi qui le decisioni importanti.
