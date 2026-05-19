/* ============================================================
   seed.js — Demo data
   ============================================================ */

(function seedIfNeeded() {
  if (DB.Admin.isSeeded() && DB.Users.list().length > 0) {
    // ensure all required users exist (in case a new initial was added)
    ensureUsers();
    return;
  }
  ensureUsers();
  seedDemoCasesAndTime();
  DB.Admin.setSeeded();
})();

function ensureUsers() {
  const desired = [
    { initials: 'JMD', name: 'JMD', department: 'Ledelse',          role: 'user'  },
    { initials: 'JAS', name: 'JAS', department: 'Salg',             role: 'user'  },
    { initials: 'MKJ', name: 'MKJ', department: 'Ledelse',          role: 'admin' },
    { initials: 'SHA', name: 'SHA', department: 'Salg',             role: 'user'  },
    { initials: 'BFA', name: 'BFA', department: 'Teknisk afdeling', role: 'user'  },
    { initials: 'KHA', name: 'KHA', department: 'Teknisk afdeling', role: 'user'  },
    { initials: 'CAN', name: 'CAN', department: 'Administration',   role: 'user'  },
    { initials: 'JEP', name: 'JEP', department: 'Salg',             role: 'user'  },
    { initials: 'MDA', name: 'MDA', department: 'Marketing',        role: 'user'  },
    { initials: 'KMA', name: 'KMA', department: 'Lager',            role: 'user'  },
    { initials: 'ALH', name: 'ALH', department: 'Administration',   role: 'user'  }
  ];
  desired.forEach(d => {
    if (!DB.Users.getByInitials(d.initials)) {
      DB.Users.create(d);
    }
  });
}

function seedDemoCasesAndTime() {
  const byInit = (i) => DB.Users.getByInitials(i);
  const mkj = byInit('MKJ');
  const jas = byInit('JAS');
  const sha = byInit('SHA');
  const bfa = byInit('BFA');
  const kha = byInit('KHA');
  const can = byInit('CAN');
  const jep = byInit('JEP');
  const mda = byInit('MDA');
  const kma = byInit('KMA');
  const alh = byInit('ALH');
  const jmd = byInit('JMD');

  // Helper: create a case with a backdated created_at
  function mkCase(opts, createdDaysAgo) {
    const c = DB.Cases.create(opts);
    const t = new Date();
    t.setDate(t.getDate() - createdDaysAgo);
    c.created_at = t.toISOString();
    return c;
  }

  function mkTime(caseId, user, daysAgo, hours, phase, description, deptOverride = null) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    DB.TimeEntries.create({
      case_id: caseId,
      user_id: user.id,
      department: deptOverride || user.department,
      phase,
      entry_date: d.toISOString().slice(0, 10),
      hours,
      description
    });
  }

  // Case 1: Kontorbelysning til administrationsbygning — Vundet
  const c1 = mkCase({
    title: 'Kontorbelysning til administrationsbygning',
    customer_name: 'Nordvest Ejendomme A/S',
    description: 'Renovering af belysning i hovedkontor over 3 etager med DALI-styring.',
    created_by_user_id: jas.id,
    responsible_user_id: jas.id,
    primary_department: 'Salg',
    phase: 'Eksekveringsfase',
    estimated_value: 480000,
    notes: 'Kunden ønsker præsenneuformer og DALI broadcast styring.'
  }, 64);
  mkTime(c1.id, jas, 60, 2.5, 'Opstartsfase', 'Indledende kundemøde og behovsafdækning');
  mkTime(c1.id, jas, 55, 1.5, 'Opstartsfase', 'Opfølgende møde');
  mkTime(c1.id, bfa, 50, 4,   'Tilbudsfase', 'Lysberegning og produktvalg');
  mkTime(c1.id, jas, 48, 3,   'Tilbudsfase', 'Udarbejdelse af tilbud');
  mkTime(c1.id, mda, 40, 1,   'Præsentationsfase', 'Visualiseringer og brochuremateriale');
  mkTime(c1.id, jas, 38, 2,   'Præsentationsfase', 'Præsentation hos kunden');
  mkTime(c1.id, bfa, 35, 1.5, 'Beslutningsfase', 'Teknisk afklaring');
  mkTime(c1.id, can, 20, 0.5, 'Eksekveringsfase', 'Ordrebekræftelse og fakturering');
  mkTime(c1.id, kma, 15, 2,   'Eksekveringsfase', 'Pakning og levering af armaturer');
  mkTime(c1.id, kha, 10, 6,   'Eksekveringsfase', 'Montagesupport on-site');
  DB.Cases.setWon(c1.id, { po_date: isoDate(30) }, jas.id);

  // Case 2: Industribelysning til lagerhal — Aktiv, eksekvering
  const c2 = mkCase({
    title: 'Industribelysning til lagerhal',
    customer_name: 'Skagen Logistik ApS',
    description: 'LED highbay til 8000 m² lager med sensorstyring.',
    created_by_user_id: sha.id,
    responsible_user_id: sha.id,
    primary_department: 'Salg',
    phase: 'Tilbudsfase',
    estimated_value: 720000,
    notes: 'Stor energibesparelse forventet — bør indgå i materiale.'
  }, 22);
  mkTime(c2.id, sha, 21, 1.5, 'Opstartsfase', 'Site survey');
  mkTime(c2.id, kha, 18, 3,   'Tilbudsfase', 'Lysberegning DIALux');
  mkTime(c2.id, sha, 15, 2,   'Tilbudsfase', 'Udarbejdelse af tilbud');
  mkTime(c2.id, bfa, 14, 1,   'Tilbudsfase', 'Teknisk gennemgang');
  mkTime(c2.id, mkj, 7,  0.5, 'Tilbudsfase', 'Internal sparring', 'Ledelse');

  // Case 3: ATEX belysning til produktionsområde — Aktiv, præsentation
  const c3 = mkCase({
    title: 'ATEX belysning til produktionsområde',
    customer_name: 'Esbjerg Kemi A/S',
    description: 'ATEX zone 1 belysning til kemisk produktion. Kræver dokumentation og spec.',
    created_by_user_id: jep.id,
    responsible_user_id: jep.id,
    primary_department: 'Salg',
    phase: 'Præsentationsfase',
    estimated_value: 1250000,
    notes: 'Mulighed for serviceaftale efter installation.'
  }, 41);
  mkTime(c3.id, jep, 40, 2,   'Opstartsfase', 'Indledende møde og krav');
  mkTime(c3.id, bfa, 36, 5,   'Tilbudsfase', 'ATEX produktudvælgelse og dokumentation');
  mkTime(c3.id, kha, 34, 3.5, 'Tilbudsfase', 'Beregning og teknisk dokumentation');
  mkTime(c3.id, jep, 28, 3,   'Tilbudsfase', 'Tilbud udarbejdet');
  mkTime(c3.id, mda, 22, 1.5, 'Præsentationsfase', 'Kundepræsentation klargjort');
  mkTime(c3.id, jep, 20, 2,   'Præsentationsfase', 'Præsentationsmøde');
  mkTime(c3.id, bfa, 8,  1,   'Præsentationsfase', 'Teknisk afklaring efter møde');

  // Case 4: Lysrenovering med MasterConnect — Tabt
  const c4 = mkCase({
    title: 'Lysrenovering med MasterConnect',
    customer_name: 'Mølleparkens Hotel',
    description: 'Udskiftning af eksisterende lyskilder med MasterConnect på 4 fløje.',
    created_by_user_id: sha.id,
    responsible_user_id: sha.id,
    primary_department: 'Salg',
    phase: 'Beslutningsfase',
    estimated_value: 220000,
    notes: 'Kunden var prisfølsom.'
  }, 90);
  mkTime(c4.id, sha, 85, 2,   'Opstartsfase', 'Kundemøde');
  mkTime(c4.id, kha, 82, 2.5, 'Tilbudsfase', 'Produktudvalg');
  mkTime(c4.id, sha, 78, 2,   'Tilbudsfase', 'Tilbud');
  mkTime(c4.id, mda, 72, 0.5, 'Præsentationsfase', 'Materiale');
  mkTime(c4.id, sha, 70, 1,   'Præsentationsfase', 'Præsentation');
  DB.Cases.setLost(c4.id, { lost_reason: 'Kunden valgte billigere konkurrent uden styring' }, sha.id);

  // Case 5: Belysning til fællesområder — Aktiv, opstart
  const c5 = mkCase({
    title: 'Belysning til fællesområder',
    customer_name: 'Boligselskabet Vestervang',
    description: 'Trapper, gange og udeområder. Behov for tilstandsstyring.',
    created_by_user_id: jas.id,
    responsible_user_id: jep.id,
    primary_department: 'Salg',
    phase: 'Opstartsfase',
    estimated_value: 340000,
    notes: ''
  }, 6);
  mkTime(c5.id, jas, 5, 1, 'Opstartsfase', 'Første kontakt');
  mkTime(c5.id, jep, 2, 1.5, 'Opstartsfase', 'Site visit booket og forberedt');
  mkTime(c5.id, mda, 1, 0.25, 'Opstartsfase', 'Forberedelse af præsentationsmateriale');

  // Case 6: DALI-opgradering i erhvervsbygning — Vundet
  const c6 = mkCase({
    title: 'DALI-opgradering i erhvervsbygning',
    customer_name: 'Kontorhuset Vesterport',
    description: 'Opgradering af eksisterende DALI 1 til DALI-2 med ny styrekomponent.',
    created_by_user_id: jas.id,
    responsible_user_id: bfa.id,
    primary_department: 'Teknisk afdeling',
    phase: 'Afslutningsfase',
    estimated_value: 165000,
    notes: 'Hurtig leverance ønsket.'
  }, 110);
  mkTime(c6.id, jas, 108, 1.5, 'Opstartsfase', 'Behovsafdækning');
  mkTime(c6.id, bfa, 105, 3, 'Tilbudsfase', 'Teknisk specifikation');
  mkTime(c6.id, jas, 100, 1.5, 'Tilbudsfase', 'Tilbud');
  mkTime(c6.id, bfa, 92, 2.5, 'Eksekveringsfase', 'Konfiguration');
  mkTime(c6.id, kha, 90, 4, 'Eksekveringsfase', 'Idriftsættelse on-site');
  mkTime(c6.id, kma, 88, 1.5, 'Eksekveringsfase', 'Forsendelse');
  mkTime(c6.id, can, 65, 0.5, 'Afslutningsfase', 'Afsluttende fakturering');
  DB.Cases.setWon(c6.id, { po_date: isoDate(80) }, jas.id);
  DB.Cases.close(c6.id, mkj.id);

  // A couple of recent quick entries spread across departments
  mkTime(c2.id, alh, 0, 0.5, 'Tilbudsfase', 'Administrativ opfølgning');
  mkTime(c3.id, jmd, 1, 0.75, 'Præsentationsfase', 'Strategisk vurdering', 'Ledelse');
  mkTime(c5.id, mda, 0, 0.25, 'Opstartsfase', 'SoMe-research om kunden');
}

function isoDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
