// =============================================================================
// appConfig
// -----------------------------------------------------------------------------
// Offentlig klient-konfiguration for green light-visualiseringen.
// INGEN hemmeligheder her: kun værdier der alligevel ender i den JavaScript,
// browseren henter (Supabase projekt-URL + anon/publishable nøgle, samt den
// offentlige proxy-URL). Den rigtige hemmelighed – OpenAI-nøglen – lever kun i
// proxyens servermiljø (Vercel), aldrig her.
//
// Build-env (VITE_*) vinder over disse værdier, hvis den er sat.
// =============================================================================

export const appConfig = {
  // Supabase (login) – basis projekt-URL, IKKE /rest/v1/-endpointet.
  supabaseUrl: "https://czogeolinlguilkzpsyf.supabase.co",
  supabaseAnonKey: "sb_publishable_rM1GZ1Ohg1hiDQ7ex3aqBQ_K9LFt8Pp",

  // Live AI-proxyen (holder OpenAI-nøglen skjult server-side).
  visualizationEndpoint: "https://website-test-gl.vercel.app/api/visualize",
};
