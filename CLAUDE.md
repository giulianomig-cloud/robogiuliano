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
- **RoboGiuliano** (`data-tema="robo"`): avatar robot con la faccia di Giuliano. Dalla v1.6 immagini da un "foglio del
  personaggio" 3x3 fatto da Giuliano con ChatGPT (prompt in sessione: una sola immagine con 9 pose, sfondo verde #00FF00):
  ritagliate, verde tolto, ingrandite a 768x512, busto che sfuma in basso. Pose `riposo|ascolto|pensa|parla`, espressioni
  `contento|dispiaciuto|sorpreso`, `occhiolino` (ChatGPT ha fatto l'occhiolino invece degli occhi chiusi: usato ogni tanto a
  riposo). Bocca: `parla-2/3` = posa "parla" con SOLO la bocca della posa a bocca chiusa incollata e allineata (il corpo non
  si muove). Voce maschile. "Ehi RoboGiuliano" (accetta "robo/robot Giuliano"; "Giuliano" da solo NON lo sveglia).
- **RoboYaymaris** (impostazione `tema: "yaymaris"`, v1.4): terzo personaggio, stesso stile
  dei robot (`data-tema="robo"` + `data-personaggio="yaymaris"` per i colori rosa/viola), 4 pose `src/yaymaris-*.webp`
  (dalla v1.6 anche lei dal foglio 3x3 di ChatGPT, stesse pose/espressioni di RoboGiuliano), icona `icona-yaymaris`.
  "Ehi RoboYaymaris": il nome lo scrive il riconoscimento in tanti modi (yay/jay/ia/gia + maris), "robo/robot" obbligatorio.
  Voce predefinita femminile (cambiabile nelle impostazioni).
- Scartati (non riproporli): Classico crema/oro, Sfera, Ologramma, Aurora "vetro", Zeus (avatar neon e con la
  foto di Giuliano), le 4 facce con robottino e scritte.

## Assistenza a distanza (v1.5)
- `src/assistenza.js`: ogni 5 minuti cerca nella posta della madre email non lette dal figlio (`emailFiglio`) con oggetto
  "registro" → le sposta nel cestino (o le cancella) e manda SOLO a `emailFiglio` il registro (senza righe `lei:`/`claude:`,
  salvo `registroConConversazioni`) + `diagnosi()`. Errori nelle ultime 24 ore → registro mandato da solo, max 1 al giorno.
  Il registro ruota oltre 5 MB (`registro-vecchio.txt`).

- Assistenza da remoto (`src/remota.js`, impostazione `assistenzaRemota`, spenta di partenza): avvia
  `claude remote-control --name "PC della mamma" --spawn session` in una finestra ridotta (cartella
  `%APPDATA%\AssistenteClaude\assistenza-remota`), chiusa dopo 2 ore o con "Ferma" (Stop-Process dei claude.exe con
  "remote-control"). Parte con email "assistenza" dal figlio, con lo strumento `avvia_assistenza_remota` (la madre dice
  "chiama l'assistenza") o dal pulsante. Prima volta: "Prepara" apre `claude` per il login completo + fiducia nella cartella
  (Remote Control vuole il login completo, non basta il token di setup-token). NON provata: serve Windows + account vero.

- Grafica della finestra (v1.5, scelte dell'utente "2 3 4", NIENTE orologio): risposta grande (34px) bianca su riquadro scuro;
  sottotitoli a karaoke (`scriviRisposta`/`arrivaA`, eventi `onboundary` della voce, altrimenti stima ~14 lettere/s): parole
  dette accese, quella detta ora in giallo; mentre pensa scrive cosa fa DAVVERO: il servizio tiene `attivita` (tabella
  `ATTIVITA` in `assistente.js`, segnata in `eseguiStrumento`), la pagina chiede `GET /attivita` ogni 0,5 s e mostra
  "Sto controllando la posta" + pastiglia "📧 Posta di Yahoo". In abbonamento `claude -p` usa `--output-format stream-json
  --verbose` (stream-json senza `--verbose` dà errore) per vedere anche WebSearch/WebFetch ("Sto cercando su internet").
- Impostazioni (v1.5, scelta "A · Schede" fra A / B riquadri in fila): barra scura in alto con lucine di stato (verde
  compilato, rosso manca, grigio facoltativo non usato; dicono "compilato", NON "funziona"), menu a sinistra con 6 schede
  (Mamma e personaggio con tessere-figura, Posta Yahoo, Claude, Referti USI, Aiuto del figlio, Programma), interruttori,
  "Salva e prova" sempre visibile. Campo obbligatorio vuoto in un'altra scheda → si apre quella scheda.
- Avatar più vivi (v1.5, approvati 1-4): bocca a tempo con le parole (`diciParola`: per ogni sillaba `data-bocca` 2→1, poi 0;
  dalla v1.5.2 NON più per la bocca, vedi sotto); mentre ascolta onde/luce seguono il volume del
  microfono (`avviaVolume`, getUserMedia + AnalyserNode → `--vol`; se non va, nessun effetto); espressioni da parole della
  risposta (`umoreDi` → `data-umore` contenta/triste/sorpresa: Aurora occhi/sopracciglia/guance, robot luce verde/arancione/
  gialla, per 2,5 s dopo la risposta); luce del robot che pulsa a ogni parola. Scartato per ora: robot che sbattono le palpebre.
- Immagini di RoboGiuliano pulite (v1.5.1): con ChatGPT Giuliano non è riuscito a fare pose nuove, quindi
  "opzione 1": contorno stretto di 1 px e sfumato, colori del bordo presi dall'interno, filtro bilaterale al 60%, colori -15%,
  contrasto -5% (script nella sessione, non nel repo). Yaymaris lasciata com'è (era già pulita).

- Avatar v1.6 (approvato): espressioni vere dei robot con `data-espressione` (contenta/triste/sorpresa/occhiolino) per 1,2 s
  all'inizio della risposta e 2,5 s dopo (regole con !important, prevalgono sulla posa del momento); nastri di luce animati
  disegnati in SVG (`.nastri.dietro` sotto le immagini, `.nastri.davanti` sopra, 3 ellissi): colori del personaggio, più veloci
  quando ascolta/pensa, si accendono a ritmo quando parla, verdi/arancioni/gialli con le emozioni.

## Versioni e aggiornamenti
- La versione è `version` in `package.json` (finisce nell'exe come `__VERSIONE__`).
- Push su `main` → GitHub Actions (`.github/workflows/rilascio.yml`, Windows): `npm test`, costruzione, prova
  dell'exe su Windows, e release `v<versione>` se la versione è nuova.
- Il programma installato (`%LOCALAPPDATA%\AssistenteClaude\AssistenteClaude.exe`) controlla
  `releases/latest/download/versione.json` e si aggiorna da solo (`src/aggiorna.js`).
- **A ogni modifica da pubblicare: aumenta `version`.**

## Stato (21/10/2026, v1.5.2)
- v1.5.2: sul PC vero con la 1.5.1 la bocca NON si apriva (le parole del karaoke invece si colorano: causa non trovata).
  Su richiesta di Giuliano ("se più sicuro rimettilo come era") la bocca è tornata come prima della 1.5: si apre e chiude a
  ritmo fisso mentre parla (keyframes `bocca`, `bocca-meta`, `bocca-chiusa`). `diciParola`/`data-bocca` restano solo per
  la luce del robot che pulsa; la stima del karaoke è sempre attiva e ignora gli avvisi delle parole troppo avanti.
- v1.5.1: solo immagini di RoboGiuliano pulite. iPhone: chiesto, deciso di NON farlo (resta solo Windows).
- v1.5: registro per email, assistenza da remoto, finestra nuova (risposta grande, karaoke, cosa sta facendo), impostazioni
  a schede, avatar più vivi. Da verificare sul PC vero: onde col microfono, "Sto cercando su internet" in abbonamento,
  assistenza da remoto.
- Da pubblicare (v1.6, branch `in-corso`): avatar nuovi da ChatGPT con espressioni, occhiolino e nastri di luce.
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
