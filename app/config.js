/* ============================================================
   config.js — Miljøkonfiguration
   ------------------------------------------------------------
   Udfyld de to nøgler nedenfor for at slå DELT CLOUD-mode til
   (fælles database + per-bruger login via Supabase).

   Lader du dem stå tomme, kører appen i LOKAL DEMO-mode, hvor
   data kun gemmes i den enkelte browser (localStorage).

   Nøglerne findes i Supabase:
     Project Settings → API
       - Project URL          → SUPABASE_URL
       - Project API keys: anon/public → SUPABASE_ANON_KEY

   Den anonyme nøgle er beregnet til at ligge i frontend-kode
   (den er offentlig). Adgang styres af Row Level Security i
   databasen + login.
   ============================================================ */

window.GL_CONFIG = {
  SUPABASE_URL: 'https://czogeolinlguilkzpsyf.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_rM1GZ1Ohg1hiDQ7ex3aqBQ_K9LFt8Pp',
  APP_NAME: 'green light tidstracking'
};

// Cloud-mode er aktiv når begge nøgler er udfyldt.
window.GL_CLOUD = !!(window.GL_CONFIG.SUPABASE_URL && window.GL_CONFIG.SUPABASE_ANON_KEY);
