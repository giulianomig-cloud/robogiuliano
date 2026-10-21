# RoboGiuliano · assistente vocale (Aurora e RoboGiuliano)

Un assistente vocale per chi non è pratico di computer. Si accende da solo con Windows, si chiama a voce
(*"Ehi Aurora…"* oppure *"Ehi RoboGiuliano…"*), risponde a voce e sa:

- leggere, cercare e riassumere le email **Yahoo**;
- **stampare** email e allegati, senza finestre da confermare;
- **rispondere** o scrivere email (solo dopo un *"sì"* detto ad alta voce);
- avvisare se un'email sembra una **truffa**;
- chiedere aiuto al figlio via email;
- rispondere a domande di ogni giorno (ricette, parole, curiosità…);
- con l'abbonamento Claude, anche **cercare su internet** (meteo, notizie, orari, numeri di negozi e uffici).

Due stili, da scegliere nelle impostazioni:

| Stile | Parola d'ordine | Voce |
|---|---|---|
| **Aurora**: faccina colorata che sbatte gli occhi, ascolta, pensa e parla | *"Ehi Aurora"* | femminile |
| **RoboGiuliano**: avatar robot con 4 pose e la bocca che si muove | *"Ehi RoboGiuliano"* | maschile |

**Privacy:** email, password e chiave di Claude restano **solo sul computer dove è installato**
(`%APPDATA%\AssistenteClaude\config.json`). In questo repository non c'è nessun dato personale.

---

## Installazione (circa 20 minuti, una volta sola)

Servono: il PC (Windows) dove installarlo, la password di Yahoo, il telefono collegato a Yahoo e
**un abbonamento Claude Pro o Max** (oppure una carta per la ricarica a consumo).

### 1. Password per app di Yahoo
1. Entra su **login.yahoo.com** con la posta da collegare.
2. Nome in alto a destra → **Info account** → **Sicurezza account**.
3. Se lo chiede, attiva la **verifica in due passaggi**.
4. **Genera password per app** → nome `Claude` → **Genera**.
5. Copia le **16 lettere** su un foglio: Yahoo non le mostra una seconda volta.

### 2. Come si collega a Claude: scegli uno dei due
**A · Il tuo abbonamento Claude (Pro o Max) — consigliato.** Nessun costo in più: usa il credito mensile
per i programmi "fatti in casa" compreso nell'abbonamento, separato dai limiti dell'app Claude.
Si imposta al passo 4 con due pulsanti. Prima controlla su claude.ai → Impostazioni → Utilizzo che
l'**uso extra** (a pagamento oltre il compreso) sia **spento**: così, se un mese il credito finisse, l'assistente
si ferma fino al mese dopo invece di addebitare. Le regole di Anthropic su questo credito sono cambiate spesso:
la pagina ufficiale è support.claude.com/articles/15036540.

**B · Chiave API (ricarica a consumo).**
1. Vai su **console.anthropic.com** e crea un account.
2. **Billing**: carica del credito (es. 10 $) e imposta un **limite mensile** (es. 15 $).
3. **API keys** → **Create key** → copia la chiave (`sk-ant-…`).

### 3. Installa il programma
1. Vai su **[Releases](../../releases/latest)** e scarica **AssistenteClaude.zip**.
2. Tasto destro → **Estrai tutto** → doppio clic su **AssistenteClaude.exe**.
3. Se compare "Windows ha protetto il PC": **Ulteriori informazioni** → **Esegui comunque**
   (il programma non ha una firma digitale a pagamento).
4. Si apre la pagina delle **Impostazioni**.

### 4. Impostazioni
- **Nome** della persona, **Stile** (Aurora / RoboGiuliano), **Nome dell'assistente** (vuoto = quello dello stile), **Voce**.
- **Email Yahoo** e **password per app** (le 16 lettere).
- **Come si collega a Claude**:
  - *Il mio abbonamento*: **Installa Claude Code** (un paio di minuti) → **Collega il mio account Claude**: si apre
    una finestra nera e il browser, entri con il tuo account; alla fine nella finestra compare un codice lungo che
    inizia con `sk-ant-oat`: copialo nel campo **Codice dell'abbonamento**. Il tuo account resta collegato a quel PC
    (puoi scollegarlo quando vuoi dalle impostazioni del tuo account Claude).
  - *Chiave API*: incolla la chiave `sk-ant-…`.
- **Email del figlio**: lì arrivano le richieste di aiuto.
- **Apri da solo all'accensione**: lasciala accesa sul PC di chi lo usa, toglila se lo stai solo provando.

Clic su **Salva e prova**: devono comparire le righe verdi ✓ (posta collegata, Claude collegato, icona creata).
Sul desktop compare l'icona con la faccia di RoboGiuliano.

### 5. Microfono
Clic su **Apri l'assistente** → Edge chiede il **microfono** → **Consenti** (una volta sola).

### 6. Stampante
Impostazioni di Windows → **Bluetooth e dispositivi** → **Stampanti e scanner** → togli la spunta da
*"Consenti a Windows di gestire la stampante predefinita"* → stampante giusta → **Imposta come predefinita**.
Per stampare gli allegati PDF serve **Adobe Acrobat Reader** (gratis).

### 7. Prova
- *"Ehi Aurora, ho email nuove?"*
- *"Ehi Aurora, stampa l'ultima email"*
- *"Ehi Aurora, scrivi a (tuo nome) che è una prova"* → *"La mando?"* → *"Sì"*

Poi **riavvia il computer** e controlla che si apra da solo.

---

## Come si usa
- Si dice **"Ehi Aurora…"** (o il nome scelto) oppure si **tocca** l'avatar.
- Quando l'assistente fa una domanda (*"La mando?"*) si risponde subito, senza ridire il nome.
- Toccare l'avatar mentre parla lo fa smettere.
- Se si chiude la finestra: doppio clic sull'icona **Assistente Aurora** sul desktop.
- Se compare *"Tocca qui per iniziare"*: un tocco (Edge a volte vuole un clic prima di poter parlare).
- Cartoncino da stampare con le frasi da dire: [`docs/cartoncino-mamma.html`](docs/cartoncino-mamma.html).

## Aggiornamenti automatici
Il programma installato controlla qui su GitHub (all'avvio e ogni 6 ore) se c'è una versione nuova:
se c'è, la scarica e si riavvia da solo, mai mentre si sta parlando. Le impostazioni restano.

## Se qualcosa non va
| Problema | Soluzione |
|---|---|
| "La chiave di Claude non funziona" / "credito finito" | console.anthropic.com → ricarica o nuova chiave → in basso a destra **impostazioni** |
| "Il collegamento all'abbonamento non funziona più" | Impostazioni → **Collega il mio account Claude** di nuovo e incolla il codice nuovo |
| "Per questo mese ho finito il credito dell'abbonamento" | Aspetta il mese dopo, oppure passa per un po' alla **Chiave API** nelle impostazioni |
| Non legge la posta | Rifai la password per app di Yahoo e rimettila nelle impostazioni |
| Non sente la voce | Microfono di Windows; in Edge: lucchetto accanto all'indirizzo → Microfono → Consenti |
| Non stampa | Stampante accesa e **predefinita** |
| Altro | Windows + R → `%APPDATA%\AssistenteClaude` → mandare il file `registro.txt` |

**Costo:** con l'abbonamento, niente in più finché si resta nel credito mensile compreso. Con la chiave API si paga
solo l'uso, stimato in **pochi euro al mese** con qualche richiesta al giorno (console.anthropic.com → Usage).

---

## Per chi sviluppa
- `npm install` · `npm test` (controlli) · `npm run avvia` (prova nel browser su http://127.0.0.1:7777, `?tema=robo`)
- `node scripts/costruisci.js` costruisce `uscita/AssistenteClaude.exe` (su Windows; altrove serve il `node.exe` di Windows).
- A ogni push su `main` GitHub Actions fa i controlli, costruisce l'.exe, **lo prova su Windows** e, se la
  `version` in `package.json` è nuova, pubblica una release: da lì si aggiornano i PC dove è installato.
  **Per pubblicare un aggiornamento: aumenta `version` in `package.json`.**
