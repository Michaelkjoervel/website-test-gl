# green light tidstracking — opsætning & deployment

Værktøjet kan køre i to tilstande:

| Mode | Data | Login | Brug |
|------|------|-------|------|
| **Lokal demo** | Kun i din egen browser (localStorage) | Initialer | Test af brugerflade |
| **Delt cloud** | Fælles database (Supabase) | Email + adgangskode | Produktion for alle medarbejdere |

Appen vælger automatisk mode ud fra om der er udfyldt Supabase-nøgler i `app/config.js`.

---

## A. Kør lokalt (demo)

1. Hent koden (download ZIP fra GitHub eller `git clone`)
2. Start en lille webserver i projektmappen:
   - Windows: `py -m http.server 8000`
   - Mac/Linux: `python3 -m http.server 8000`
3. Åbn `http://localhost:8000/app.html`
4. Log ind med initialer (fx `MKJ` for admin)

Demo-data oprettes automatisk. Data ligger kun i din browser.

---

## B. Gør det live og delt (Supabase + per-bruger login)

### Trin 1 — Opret Supabase-projekt
1. Gå til https://supabase.com → log ind / opret gratis konto
2. **New project** → giv det navn (fx `greenlight-tid`), vælg region **EU (Frankfurt)**, sæt et database-password (gem det)
3. Vent ~2 min mens projektet oprettes

### Trin 2 — Opret tabeller + brugere
1. I Supabase: **SQL Editor** → **New query**
2. Åbn filen `supabase/schema.sql` her i projektet, kopiér ALT indhold
3. Indsæt i SQL Editor → tryk **Run**
4. Du bør se "Success". Tjek **Table Editor** — der ligger nu `users`, `cases`, m.fl.

### Trin 3 — Opret login-konti for medarbejderne
Profilerne findes nu, men hver medarbejder skal også have en login-konto:
1. **Authentication** → **Users** → **Add user** → **Create new user**
2. Email = samme som i profilen (fx `mkj@green-light.dk`), sæt en adgangskode, og slå **Auto Confirm User** til
3. Gentag for alle 11 medarbejdere

> Genvej: Du kan også slå "Email signup" til og lade folk selv oprette sig — men så skal deres email matche en profil i `users`-tabellen.

### Trin 4 — Indsæt nøgler i appen
1. I Supabase: **Project Settings** → **API**
2. Kopiér **Project URL** og **anon public** nøglen
3. Åbn `app/config.js` og indsæt:
   ```js
   window.GL_CONFIG = {
     SUPABASE_URL: 'https://ditprojekt.supabase.co',
     SUPABASE_ANON_KEY: 'eyJhbGciOi...',
     APP_NAME: 'green light tidstracking'
   };
   ```
4. Gem, commit og push.

### Trin 5 — Læg appen online (hosting)
Vælg én:

**GitHub Pages (nemmest — I har allerede repoet):**
1. Repo → **Settings** → **Pages**
2. Source: *Deploy from a branch*, Branch: jeres branch + `/(root)` → **Save**
3. URL bliver `https://<bruger>.github.io/website-test-gl/app.html`

**Netlify / Vercel (nemmest custom domæne):**
1. Opret konto, **Import** repoet (ingen build-kommando nødvendig — det er rene statiske filer)
2. Få en URL med det samme

### Trin 6 — (Valgfrit) Eget domæne
1. Køb domæne (Simply.com, One.com, Cloudflare, Namecheap …)
2. Tilføj domænet i din hosting (Pages/Netlify/Vercel) under "Custom domain"
3. Opret den CNAME/A-record hostingen beder om hos din domæneudbyder
4. HTTPS sættes automatisk op

---

## Adgangskontrol & roller
- Login kræves (Supabase Auth). Uden konto kommer man ikke ind.
- **MKJ** har rollen `admin` og ser Admin-menuen.
- RLS er slået til: kun indloggede brugere kan læse/skrive. Rolle-regler (kun admin sletter sager osv.) håndhæves i app'en — kan strammes til på databaseniveau senere.

## Nulstil / ryd data (cloud)
Kør i Supabase SQL Editor:
```sql
truncate public.time_entries, public.activity_log, public.comments, public.cases cascade;
```
(Brugere bevares.)

## Skift admin / tilføj bruger
- Via app'en: Admin-siden (husk også at oprette login-kontoen i Supabase).
- Via SQL: `update public.users set role = 'admin' where initials = 'XXX';`
