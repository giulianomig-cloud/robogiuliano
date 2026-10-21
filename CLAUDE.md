# RoboGiuliano (Aurora assistente) — istruzioni per Claude

## Lingua
- Rispondi sempre in **italiano**, con spiegazioni semplici: l'utente (Giuliano) non è un programmatore.
- L'assistente è per sua madre, che non sa usare il computer (Windows, posta Yahoo).

## Il progetto
- Programma Windows unico (`AssistenteClaude.exe`, Node "single executable"): un piccolo server locale
  (`src/assistente.js`, porta 7777) + una finestra di Edge in modalità app (`src/pagina.html`) che ascolta
  (Web Speech API, it-IT) e parla (speechSynthesis).
- Due modi di collegarsi a Claude (impostazione `modo`):
  - `chiave` (API a consumo): modello `claude-opus-5-5`, `effort: low`, fallback server-side `"default"`,
    strumenti per la posta in `src/assistente.js`.
  - `abbonamento` (v1.1, abbonamento Pro di Giuliano, credito mensile per i programmi fatti in casa): `src/abbonamento.js`
    lancia `claude -p` (Claude Code installato dalle impostazioni con l'installatore ufficiale, accesso con
    `claude setup-token` → codice `sk-ant-oat…` in `tokenAbbonamento`, passato come `CLAUDE_CODE_OAUTH_TOKEN`;
    `ANTHROPIC_API_KEY` tolta dall'ambiente). Solo `--tools WebSearch,WebFetch` + `--restricted` + `dontAsk`;
    gli strumenti della posta arrivano da `AssistenteClaude.exe --mcp` (`src/mcp.js`), che li inoltra al servizio
    (`POST /strumento` con parola segreta) dove c'è la conversazione e il controllo del "sì". `--resume` per continuare.
- Referti USI (v1.2): `src/navigatore.js` apre Edge **headless** (protocollo DevTools, niente librerie) con profilo in
  `%APPDATA%\AssistenteClaude\referti`, solo domini consentiti (`usi.it`, config `refertiSiti`), pagina letta come testo +
  elementi numerati; strumenti `referti_apri`, `sito_leggi/clicca/scrivi/scarica`, `referto_stampa/mostra`.
  Utente/password in `usiUtente`/`usiPassword`: Claude scrive i segnaposto `UTENTE_USI`/`PASSWORD_USI`, il programma li
  sostituisce e li maschera nel testo letto. Codice SMS: Claude lo chiede a voce. Provato con un finto sito
  (`tests/sito-finto.js`) e con il vero Claude; il sito vero (www.usi.it/areaprivata/referti) NON si raggiunge
  dall'ambiente cloud: la prima prova vera è sul PC della madre. Notifica USI: "il suo referto è disponibile
  online all'indirizzo https://www.usi.it/areaprivata/referti" (niente PDF allegato).
- Icone (v1.3): nell'exe sempre quella di RoboGiuliano (`src/icona.ico`, con rcedit); il collegamento sul desktop e la finestra
  usano quella dello stile scelto (`icona.ico/png` RoboGiuliano, `icona-aurora.ico/png` Aurora): l'.ico viene scritta nella
  cartella del programma con il nome dello stile e il collegamento la usa (`IconLocation`), poi `ie4uinit.exe -show`.
- Stampa PDF (v1.3): prima SumatraPDF se installato (`-print-to-default -silent`), altrimenti il verbo "Print" del lettore predefinito.
- Posta Yahoo via IMAP/SMTP con **password per app** (`src/posta.js`); stampa silenziosa con PowerShell
  `Out-Printer` (stampante predefinita), allegati con `Start-Process -Verb Print`.
- Impostazioni e dati personali SOLO in `%APPDATA%\AssistenteClaude\config.json` sul PC: **mai nel repository**
  (il repo è pubblico; l'utente lo ha permesso purché non ci finiscano i dati della madre).
- Le email partono solo con `prepara_email`/`prepara_risposta` + `invia_bozza`, e il server controlla che nel
  messaggio successivo ci sia un "sì" (regex `SI`): non fidarsi solo del modello.

## Stili e personaggi (decisi dall'utente)
- **Aurora** (`data-tema="allegra"`): goccia colorata con faccina (occhi che sbattono, bocca che parla),
  bollicine, onde. Voce femminile. "Ehi Aurora". È lo stile predefinito, da lasciare com'è.
- **RoboGiuliano** (`data-tema="robo"`): avatar robot con la faccia di Giuliano, 4 pose
  (`src/robo-riposo|ascolto|pensa|parla.webp`, ricavate da un'immagine sua con lo sfondo tolto) + 2 posizioni della
  bocca (`robo-parla-2/3.webp`, mascella alzata) che si alternano mentre parla. Voce maschile.
  "Ehi RoboGiuliano" (accetta "robo/robot Giuliano"; "Giuliano" da solo NON lo sveglia).
- **RoboYaymaris** (impostazione `tema: "yaymaris"`, v1.4): terzo personaggio, stesso stile
  dei robot (`data-tema="robo"` + `data-personaggio="yaymaris"` per i colori rosa/viola), 4 pose `src/yaymaris-*.webp`
  (dall'immagine mandata da Giuliano, sfondo a scacchi tolto) + bocca `yaymaris-parla-2/3.webp`, icona `icona-yaymaris`.
  "Ehi RoboYaymaris": il nome lo scrive il riconoscimento in tanti modi (yay/jay/ia/gia + maris), "robo/robot" obbligatorio.
  Voce predefinita femminile (cambiabile nelle impostazioni).
- Scartati (non riproporli): Classico crema/oro, Sfera, Ologramma, Aurora "vetro", Zeus (avatar neon e con la
  foto di Giuliano), le 4 facce con robottino e scritte.

## Versioni e aggiornamenti
- La versione è `version` in `package.json` (finisce nell'exe come `__VERSIONE__`).
- Push su `main` → GitHub Actions (`.github/workflows/rilascio.yml`, Windows): `npm test`, costruzione, prova
  dell'exe su Windows, e release `v<versione>` se la versione è nuova.
- Il programma installato (`%LOCALAPPDATA%\AssistenteClaude\AssistenteClaude.exe`) controlla
  `releases/latest/download/versione.json` e si aggiorna da solo (`src/aggiorna.js`).
- **A ogni modifica da pubblicare: aumenta `version`.**

## Stato (21/10/2026, v1.4.0)
- v1.4: ricette (vedere/salvare sul desktop/stampare, strumenti `salva_sul_desktop`, `referto_salva_sul_desktop`),
  controllo stampante prima di stampare (`giudicaStampante`: spenta, finta tipo "Print to PDF", fogli in coda), RoboYaymaris.
- Giuliano preferisce raccogliere più modifiche e pubblicarle insieme quando dice "pubblica": nel frattempo lavorare sul
  branch `in-corso` (il workflow pubblica solo da `main`).
- Sul PC vero (Windows) Giuliano conferma che "sembra funzionare tutto": posta Yahoo, abbonamento Claude, impostazioni.
- Da verificare sul PC vero: referti sul sito USI vero, stampa PDF (serve Acrobat Reader), aggiornamento automatico
  (dalla 1.0.0 non era partito da solo: aggiornato a mano; causa non ancora trovata, chiedere `registro.txt`).
- Bug corretti dal PC vero: v1.2.2 il pulsante "Collega il mio account Claude" (`start` prendeva il titolo per il programma).

## Come lavorare
- Non fare modifiche che l'utente non ha chiesto; per le proposte grafiche prima anteprime (immagini/video).
- Prima di ogni push: `npm test`.
- Le conversazioni non si salvano tra una sessione e l'altra: scrivi qui le decisioni importanti.
