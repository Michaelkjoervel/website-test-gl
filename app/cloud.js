/* ============================================================
   cloud.js — Supabase backend (delt cloud-mode)
   ------------------------------------------------------------
   Aktiveres kun når window.GL_CLOUD er true (se config.js).
   Eksponerer window.Cloud med:
     - auth: signIn / signOut / getSession / onProfile
     - data: fetchAll / upsert / remove
     - flush: afventer at igangværende skrivninger er gemt
   ============================================================ */

(function () {
  if (!window.GL_CLOUD) {
    // Local demo-mode: ingen cloud.
    window.Cloud = null;
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase-biblioteket blev ikke indlæst. Tjek <script>-tagget i app.html.');
    window.Cloud = null;
    return;
  }

  const client = window.supabase.createClient(
    window.GL_CONFIG.SUPABASE_URL,
    window.GL_CONFIG.SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true } }
  );

  const TABLES = ['users', 'cases', 'time_entries', 'activity_log', 'comments'];

  // Serialiseret skrivekø.
  // Skrivninger udføres i PRÆCIS den rækkefølge de udstedes, så
  // afhængige rækker (fx en activity_log-linje der peger på en sag)
  // aldrig rammer databasen før deres parent-række er gemt. Uden
  // dette kan to samtidige requests ankomme i forkert rækkefølge og
  // udløse en foreign key-fejl.
  const pending = new Set();
  let writeChain = Promise.resolve();

  function enqueue(task) {
    // Kæd opgaven på halen af køen. En fejl i én skrivning må ikke
    // blokere de efterfølgende, så vi sluger fejlen for selve kæden.
    const p = writeChain.then(task, task);
    writeChain = p.catch(() => {});
    pending.add(p);
    p.finally(() => pending.delete(p));
    return p;
  }

  const Cloud = {
    client,

    /* ---------- Auth ---------- */
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(oversaetAuthFejl(error.message));
      return data;
    },
    async signOut() {
      await client.auth.signOut();
    },
    async getSession() {
      const { data } = await client.auth.getSession();
      return data.session || null;
    },
    async getAuthEmail() {
      const { data } = await client.auth.getUser();
      return data.user ? data.user.email : null;
    },

    /* ---------- Data ---------- */
    async fetchAll() {
      const store = {
        users: [], cases: [], time_entries: [],
        activity_log: [], comments: [],
        meta: { version: 1, cloud: true, seeded: true }
      };
      const results = await Promise.all(
        TABLES.map(t => client.from(t).select('*'))
      );
      TABLES.forEach((t, i) => {
        const { data, error } = results[i];
        if (error) throw new Error(`Kunne ikke hente ${t}: ${error.message}`);
        store[t] = data || [];
      });
      return store;
    },

    upsert(table, row) {
      return enqueue(async () => {
        const { error } = await client.from(table).upsert(row);
        if (error) {
          console.error(`Upsert-fejl (${table}):`, error.message);
          window.dispatchEvent(new CustomEvent('gl-cloud-error', { detail: error.message }));
        }
      });
    },

    remove(table, id) {
      return enqueue(async () => {
        const { error } = await client.from(table).delete().eq('id', id);
        if (error) {
          console.error(`Slet-fejl (${table}):`, error.message);
          window.dispatchEvent(new CustomEvent('gl-cloud-error', { detail: error.message }));
        }
      });
    },

    // Afvent at alle igangværende skrivninger er færdige.
    async flush() {
      await Promise.allSettled([...pending]);
    }
  };

  function oversaetAuthFejl(msg) {
    if (/invalid login credentials/i.test(msg)) return 'Forkert email eller adgangskode.';
    if (/email not confirmed/i.test(msg)) return 'Email er ikke bekræftet endnu.';
    return msg;
  }

  window.Cloud = Cloud;
})();
