# Transskribering

Et webbaseret system til at transskribere danske lydoptagelser på op til 2 timer.
Brugeren uploader en lydfil, starter transskriberingen med ét klik, følger
fremdriften, redigerer den færdige tekst og henter den som **Word, PDF, TXT
eller SRT**.

> Systemet ligger i en isoleret mappe under repoet (`transskribering/`) og
> påvirker ikke det eksisterende estimatværktøj eller dets deploy-workflow.

---

## Hvad systemet kan

- **Upload** af MP3, WAV, M4A, MP4, MPEG, MPGA, WebM, AAC og OGG (op til 2 timer).
- **Validering** af filtype, MIME (magic bytes), størrelse, varighed og at der findes et lydspor.
- **Automatisk konvertering** og **opdeling** af lange optagelser i bidder af ca. 15 min med 3 s overlap.
- **Dansk transskribering** via OpenAI Whisper API (kan udskiftes uden ændringer i resten af systemet).
- **Status-side** med fremdriftslinje, trinvisning og antal behandlede lyddele.
- **Resultatside** med redigerbar tekst, automatisk lagring, søg/erstat, kopiering og lydafspiller med klikbare tidskoder.
- **Eksport** til TXT, DOCX, PDF og SRT (SRT når der findes tidsstempler).
- **Historik** med liste over alle transskriberinger, åbn igen, omdøb, slet og prøv igen på fejlede jobs.
- **Sikkerhed**: API-nøgler i `.env`, sanitering af filnavne, magic-byte-validering, streaming til disk, UUID-baserede stier, automatisk sletning af originale lydfiler efter den valgte periode.

## Tech-stack

| Lag | Valg | Begrundelse |
|-----|------|-------------|
| Backend | **FastAPI** + SQLAlchemy + SQLite | Stabilt, typesikkert, let at køre lokalt — kan skifte til PostgreSQL via `DATABASE_URL`. |
| Jobkø | **Tråd-baseret in-process worker** | Ingen ekstra services kræves lokalt. Arkitekturen er klargjort til Celery/RQ — al jobtilstand ligger i databasen. |
| Transskribering | **OpenAI Whisper API** | Bedste danske præcision uden lokal GPU. Pluggable interface for senere udskiftning til lokal Whisper / Faster-Whisper / pyannote.audio. |
| Lydbehandling | **FFmpeg** | Probe, konvertering til mono/16 kHz/MP3, og opdeling i lyddele. |
| Frontend | **React 18 + TypeScript + Vite + Tailwind** | Hurtig dev-loop, modulær UI, samme stak som projektets eksisterende værktøj. |
| Eksport | python-docx + ReportLab | Klient-uafhængig DOCX/PDF-generering med korrekt visning af æ/ø/å. |

---

## Mappestruktur

```
transskribering/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI-app + lifespan + cleanup
│   │   ├── config.py                # Indstillinger (læser .env)
│   │   ├── database.py              # SQLAlchemy-setup
│   │   ├── models.py                # TranscriptionJob, AudioChunk, TranscriptionDocument
│   │   ├── schemas.py               # Pydantic-skemaer
│   │   ├── api/transcriptions.py    # REST-endpoints
│   │   └── services/
│   │       ├── audio.py             # FFmpeg-wrapping (probe/convert/chunk)
│   │       ├── validation.py        # Filtype/MIME/varighed/størrelse
│   │       ├── postprocess.py       # Rensning, overlap-dedup, afsnit, tidskoder
│   │       ├── jobs.py              # Baggrundsjob + retention-oprydning
│   │       ├── transcription/       # Pluggable transskriberingsmotorer
│   │       │   ├── base.py          # Fælles interface
│   │       │   ├── openai_engine.py
│   │       │   └── dummy_engine.py  # Lokal udvikling uden API
│   │       └── exports/
│   │           ├── txt_export.py
│   │           ├── docx_export.py
│   │           ├── pdf_export.py
│   │           └── srt_export.py
│   ├── tests/                       # 18 automatiserede tests inkl. E2E
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx                 # Router (HashRouter)
│   │   ├── components/              # AppShell, Dropzone, ProgressBar, StatusBadge
│   │   ├── pages/                   # Upload, Status, Resultat, Historik
│   │   └── lib/                     # API-klient, types, formattering
│   ├── package.json
│   ├── vite.config.ts               # /api proxy til backend
│   ├── tailwind.config.ts
│   ├── nginx.conf                   # Til Docker-build
│   └── Dockerfile
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Lokal installation uden Docker

### Forudsætninger

- **Python 3.11+**
- **Node.js 18+**
- **FFmpeg** (skal kunne findes som `ffmpeg` og `ffprobe` i `PATH`)

#### Installation af FFmpeg

- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt-get update && sudo apt-get install -y ffmpeg`
- **Windows**: hent fra <https://ffmpeg.org/download.html> og tilføj til `PATH`

### Backend

```bash
cd transskribering/backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Åbn .env og indsæt din OPENAI_API_KEY

uvicorn app.main:app --reload --port 8000
```

Health-check: <http://localhost:8000/api/health> · Swagger: <http://localhost:8000/docs>

Databasen oprettes automatisk i `backend/data/transskribering.db` ved første kald.

### Frontend

```bash
cd transskribering/frontend
npm install
npm run dev       # http://localhost:5173
```

Vite proxyer automatisk `/api`-kald til backend på port 8000.

### Tests

```bash
cd transskribering/backend
.venv/bin/python -m pytest
```

---

## Miljøvariabler

Alle indstillinger ligger i `backend/.env` (kopiér `.env.example`).

| Variabel | Standard | Forklaring |
|----------|----------|-----------|
| `OPENAI_API_KEY` | _(tom)_ | Din OpenAI-nøgle. Påkrævet når `TRANSCRIPTION_ENGINE=openai`. |
| `TRANSCRIPTION_ENGINE` | `openai` | `openai` eller `dummy` (lokal udvikling uden API). |
| `OPENAI_TRANSCRIPTION_MODEL` | `whisper-1` | Whisper-modellen der bruges. |
| `DATABASE_URL` | `sqlite:///./data/transskribering.db` | Skift til Postgres via `postgresql://user:pwd@host/db`. |
| `UPLOAD_DIRECTORY` | `./data/uploads` | Hvor originale uploads gemmes. |
| `TEMP_DIRECTORY` | `./data/temp` | Hvor konverterede filer og lyddele gemmes midlertidigt. |
| `MAX_AUDIO_DURATION_SECONDS` | `7200` | 2 timer. |
| `MAX_UPLOAD_SIZE_MB` | `500` | Maks. filstørrelse. |
| `CHUNK_DURATION_SECONDS` | `900` | Længde på hver lyddel (15 min). |
| `CHUNK_OVERLAP_SECONDS` | `3` | Overlap mellem lyddele for at undgå mistede sætninger. |
| `AUDIO_RETENTION` | `24h` | `immediate`, `24h`, `7d` eller `never`. |
| `DEFAULT_LANGUAGE` | `da` | Sproget der sendes til transskriberingsmotoren. |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Kommasepareret liste. |

---

## API-endpoints

| Metode | Sti | Funktion |
|--------|-----|----------|
| `POST` | `/api/transcriptions/upload` | Upload lydfil og opret job (multipart) |
| `POST` | `/api/transcriptions/{id}/start` | Start transskribering |
| `GET`  | `/api/transcriptions` | List alle jobs |
| `GET`  | `/api/transcriptions/{id}` | Hent ét job med tekst og chunks |
| `GET`  | `/api/transcriptions/{id}/status` | Hent kun status (let polling) |
| `PATCH` | `/api/transcriptions/{id}` | Opdater titel og/eller redigeret tekst |
| `DELETE` | `/api/transcriptions/{id}` | Slet job + tilhørende filer permanent |
| `GET`  | `/api/transcriptions/{id}/audio` | Stream den originale lydfil |
| `GET`  | `/api/transcriptions/{id}/export/{txt,docx,pdf,srt}` | Eksport |
| `GET`  | `/api/health` | Sundhedstjek + aktuelle indstillinger |

Hele OpenAPI-dokumentationen findes på `/docs` (Swagger UI).

---

## Sådan håndteres lange lydoptagelser

1. Filen modtages med **streaming-skrivning** til disk (ingen RAM-spids).
2. **FFprobe** måler varighed, lydspor og codec. Filer over 2 timer afvises.
3. Filen **konverteres** til mono 16 kHz MP3 — et stabilt og lille format til Whisper.
4. Den konverterede fil **opdeles** i bidder på 15 minutter med 3 sekunders overlap.
5. Hver lyddel sendes til motoren med **maks. 3 genforsøg** og **eksponentiel back-off** ved rate limits og 5xx-fejl.
6. Resultaterne **samles** med en `SequenceMatcher`-baseret de-dup, der fjerner overlap-fragmenter.
7. Den samlede tekst får **læsevenlige afsnit** og — hvis valgt — tidskoder ved hvert afsnit eller hvert minut.
8. **Originalen slettes** automatisk efter `AUDIO_RETENTION`, ellers kan brugeren slette manuelt på resultat- og historikside.

Jobstatus skrives løbende til databasen, så et **browser-reload** ikke afbryder noget — frontenden poller `/status`-endpoint og samler trådene op.

---

## Sikkerhed og GDPR

- API-nøgler kommer kun fra `.env`. `.env` er i `.gitignore`.
- Uploadede filnavne saniteres og lagres med UUID-baserede stier — directory traversal er ikke muligt.
- Filers reelle MIME-type bekræftes via **magic bytes**, ikke kun filendelsen.
- Maksimum 500 MB pr. upload (kan ændres). Filen afvises tidligt i streaming-fasen, hvis grænsen overskrides.
- Lydindhold og fuld tekst logges **ikke** i serverloggen.
- Originale lydfiler slettes automatisk efter `AUDIO_RETENTION` (standard: 24 timer).
- Brugeren kan **slette job og tilhørende filer permanent** fra både resultat- og historiksiden.
- En tekst ved upload-området informerer om dataflowet på dansk.

---

## Docker

```bash
cd transskribering
# Sæt din nøgle (eller put i en .env i samme mappe)
export OPENAI_API_KEY=sk-...
docker compose up --build
```

- Frontend: <http://localhost:8080>
- Backend (Swagger): <http://localhost:8000/docs>

Backenden bruger et navngivet Docker-volume til at bevare database og uploads
mellem genstarter.

---

## Hvordan transskriberingsmotoren udskiftes

Alle motorer arver fra `TranscriptionEngine` i
`backend/app/services/transcription/base.py`:

```python
class TranscriptionEngine(ABC):
    def transcribe(self, audio_path: Path, language: str = "da") -> TranscriptionResult: ...
```

For at tilføje en ny motor (fx lokal Faster-Whisper eller AssemblyAI):

1. Opret en ny fil, fx `services/transcription/faster_whisper_engine.py`, og implementér `transcribe`.
2. Tilføj engine til `get_engine()` i `services/transcription/__init__.py`.
3. Sæt `TRANSCRIPTION_ENGINE` i `.env`.

Ingen andre filer skal røres — `services/jobs.py` kalder kun det fælles interface.

---

## Hvor uploadede filer ligger

- **Original**: `backend/data/uploads/{uuid}.{ext}` indtil retention udløber.
- **Konverteret**: `backend/data/temp/{uuid}_converted.mp3` — slettes automatisk efter transskribering.
- **Lyddele**: `backend/data/temp/{uuid}_chunk_NNN.mp3` — slettes efter hver succesfuld chunk-transskribering.
- **Database**: `backend/data/transskribering.db`.

---

## Hosting senere

- Skift `DATABASE_URL` til en managed PostgreSQL.
- Brug et persistent volume eller objektlager (S3) til `UPLOAD_DIRECTORY` — `services/audio.py` arbejder kun via `Path` og kan abstraheres til et storage-interface.
- Skift `services/jobs.py` til en rigtig kø (Celery + Redis eller RQ) — al jobtilstand ligger i databasen, så det er en mekanisk udskiftning.
- Sæt en reverse proxy (Caddy/Nginx) foran og frem tjenesterne på et HTTPS-domæne.

---

## Acceptkriterier — status

| Krav | Status |
|------|--------|
| Upload af dansk lydoptagelse | ✅ |
| Afviser optagelser over 2 timer | ✅ |
| Håndterer optagelse op til 2 timer uden at gå ned | ✅ (chunking + tråd-worker) |
| Automatisk opdeling af lange optagelser | ✅ |
| Dansk transskribering af alle lyddele | ✅ |
| Tekst samles i rigtig rækkefølge | ✅ (overlap-dedup) |
| Følge fremdrift | ✅ (status-polling, trin, %) |
| Redigere teksten | ✅ |
| Ændringer gemmes (automatisk) | ✅ |
| Hent som TXT, DOCX, PDF | ✅ |
| Tidligere transskriberinger kan åbnes igen | ✅ |
| Slet lydfil og tekst | ✅ |
| Midlertidige filer ryddes op | ✅ |
| API-nøgler ikke eksponeret | ✅ (`.env` + `.gitignore`) |
| Forståelige fejlbeskeder på dansk | ✅ |
| Desktop og mobil | ✅ (responsivt Tailwind) |
| Kan startes via README | ✅ |

Fase 3 (klargjort til senere): tidskoder og klikbare tidskoder er allerede implementeret. SRT-eksport bygger på struktureret segment-data. Automatisk taleropdeling er forberedt via det pluggable engine-interface — kan tilføjes med `pyannote.audio` uden at røre UI eller jobpipeline.
