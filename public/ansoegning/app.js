/* ============================================================================
   App-logik: rendering af indhold + ansøgnings-agenten.
   Du behøver normalt ikke ændre i denne fil – alt indhold ligger i content.js.
   ============================================================================ */

(function () {
  "use strict";

  var C = window.ANSOEGNING;
  if (!C) return;

  var reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /* Hjælpere                                                            */
  /* ------------------------------------------------------------------ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function isTodo(value) {
    return typeof value === "string" && value.indexOf("[UDFYLD") !== -1;
  }

  /* Konverterer svar-tekst til afsnit og punktlister.
     Afsnit adskilles med \n\n; linjer der starter med "• " bliver <li>. */
  function formatBlocks(text) {
    var blocks = [];
    text.split(/\n\n+/).forEach(function (raw) {
      var lines = raw.split("\n").filter(function (l) { return l.trim() !== ""; });
      if (lines.length === 0) return;
      var bullets = lines.filter(function (l) { return l.trim().indexOf("• ") === 0; });
      if (bullets.length === lines.length) {
        var ul = document.createElement("ul");
        lines.forEach(function (l) {
          ul.appendChild(el("li", null, l.trim().slice(2)));
        });
        blocks.push(ul);
      } else if (bullets.length > 0) {
        // Blandet blok: tekstlinjer som <p>, punktlinjer samlet i <ul>
        var ulMixed = null;
        lines.forEach(function (l) {
          if (l.trim().indexOf("• ") === 0) {
            if (!ulMixed) { ulMixed = document.createElement("ul"); blocks.push(ulMixed); }
            ulMixed.appendChild(el("li", null, l.trim().slice(2)));
          } else {
            ulMixed = null;
            blocks.push(el("p", null, l.trim()));
          }
        });
      } else {
        blocks.push(el("p", null, lines.join(" ")));
      }
    });
    return blocks;
  }

  /* ------------------------------------------------------------------ */
  /* Databinding af meta-oplysninger                                     */
  /* ------------------------------------------------------------------ */

  document.querySelectorAll("[data-bind]").forEach(function (node) {
    var key = node.getAttribute("data-bind");
    if (key === "phoneLabel") {
      node.textContent = (C.meta.phone && !isTodo(C.meta.phone)) ? "Ring " + C.meta.phone : "Ring op";
    } else if (C.meta[key] != null) {
      node.textContent = C.meta[key];
    }
  });

  var mailBtn = document.getElementById("contact-mail");
  if (mailBtn && !isTodo(C.meta.email)) {
    mailBtn.href =
      "mailto:" + C.meta.email +
      "?subject=" + encodeURIComponent(C.meta.mailSubject || "");
  }
  var phoneBtn = document.getElementById("contact-phone");
  if (phoneBtn) {
    if (C.meta.phone && !isTodo(C.meta.phone)) {
      phoneBtn.href = "tel:" + C.meta.phone.replace(/[^+\d]/g, "");
    } else {
      phoneBtn.style.display = "none";
    }
  }
  var liBtn = document.getElementById("contact-linkedin");
  if (liBtn) {
    if (isTodo(C.meta.linkedin)) liBtn.style.display = "none";
    else liBtn.href = C.meta.linkedin;
  }

  /* Kladde-banner: vises hvis draft = true, eller hvis der stadig er
     [UDFYLD …]-markeringer nogen steder i indholdet. */
  var hasTodos = JSON.stringify(C).indexOf("[UDFYLD") !== -1;
  if (C.meta.draft || hasTodos) {
    var banner = document.getElementById("draft-banner");
    if (banner) banner.hidden = false;
  }

  /* ------------------------------------------------------------------ */
  /* Match med rollen                                                    */
  /* ------------------------------------------------------------------ */

  var matchList = document.getElementById("match-list");
  if (matchList) {
    C.match.forEach(function (item) {
      var row = el("article", "match-item");

      var q = el("div", "match-quote");
      q.appendChild(el("span", "match-label", "Fra opslaget"));
      var bq = document.createElement("blockquote");
      bq.textContent = "“" + item.quote + "”";
      q.appendChild(bq);

      var a = el("div", "match-answer");
      a.appendChild(el("span", "match-label", "Mit svar"));
      a.appendChild(el("p", null, item.answer));

      row.appendChild(q);
      row.appendChild(a);
      matchList.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 100-dages plan                                                      */
  /* ------------------------------------------------------------------ */

  var timeline = document.getElementById("timeline");
  if (timeline) {
    C.plan.forEach(function (phase) {
      var card = el("article", "phase");
      card.appendChild(el("div", "phase-week", phase.week));
      card.appendChild(el("h3", null, phase.title));
      var ul = document.createElement("ul");
      phase.points.forEach(function (p) { ul.appendChild(el("li", null, p)); });
      card.appendChild(ul);
      var kpi = el("div", "phase-kpi");
      var parts = phase.kpi.split(":");
      var strong = el("strong", null, parts.shift() + ":");
      kpi.appendChild(strong);
      kpi.appendChild(document.createTextNode(parts.join(":")));
      card.appendChild(kpi);
      timeline.appendChild(card);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Om mig (personlig del)                                              */
  /* ------------------------------------------------------------------ */

  if (C.about) {
    var aTitle = document.getElementById("about-title");
    var aLead = document.getElementById("about-lead");
    if (aTitle) aTitle.textContent = C.about.title || "";
    if (aLead) aLead.textContent = C.about.lead || "";

    var aBody = document.getElementById("about-body");
    if (aBody && Array.isArray(C.about.paragraphs)) {
      C.about.paragraphs.forEach(function (p) { aBody.appendChild(el("p", null, p)); });
    }

    var aFacts = document.getElementById("about-facts");
    if (aFacts && Array.isArray(C.about.quickFacts)) {
      C.about.quickFacts.forEach(function (f) {
        aFacts.appendChild(el("dt", null, f.label));
        aFacts.appendChild(el("dd", null, f.value));
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Erhvervserfaring                                                    */
  /* ------------------------------------------------------------------ */

  if (C.experience) {
    var exp = C.experience;

    var expIntro = document.getElementById("exp-intro");
    if (expIntro) expIntro.textContent = exp.intro || "";

    var expRoles = document.getElementById("exp-roles");
    if (expRoles && Array.isArray(exp.roles)) {
      exp.roles.forEach(function (role) {
        var item = el("article", "exp-item");
        item.appendChild(el("div", "exp-period", role.period));
        var main = el("div", "exp-main");
        main.appendChild(el("h3", "exp-role", role.title));
        var org = el("p", "exp-org");
        org.appendChild(el("strong", null, role.org));
        if (role.note) org.appendChild(document.createTextNode(" · " + role.note));
        main.appendChild(org);
        if (Array.isArray(role.points) && role.points.length) {
          var ul = document.createElement("ul");
          role.points.forEach(function (p) { ul.appendChild(el("li", null, p)); });
          main.appendChild(ul);
        }
        item.appendChild(main);
        expRoles.appendChild(item);
      });
    }

    var expEdu = document.getElementById("exp-education");
    if (expEdu && Array.isArray(exp.education)) {
      exp.education.forEach(function (e) {
        var row = el("div", "edu-row");
        row.appendChild(el("span", "edu-period", e.period));
        var t = el("span", "edu-title");
        t.appendChild(el("strong", null, e.title));
        if (e.org) t.appendChild(document.createTextNode(" – " + e.org));
        row.appendChild(t);
        expEdu.appendChild(row);
      });
    }

    var expSkills = document.getElementById("exp-skills");
    if (expSkills) {
      (exp.skillsEvidenced || []).forEach(function (s) {
        expSkills.appendChild(el("span", "skill-tag", s));
      });
      if (exp.skillsTodo) {
        expSkills.appendChild(el("p", "skill-todo", exp.skillsTodo));
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* AI-værdiberegner                                                    */
  /* ------------------------------------------------------------------ */

  var nfDK = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

  if (C.calculator) {
    var calc = C.calculator;
    var calcTitle = document.getElementById("calc-title");
    var calcLead = document.getElementById("calc-lead");
    var calcNote = document.getElementById("calc-note");
    if (calcTitle) calcTitle.textContent = calc.title;
    if (calcLead) calcLead.textContent = calc.lead;
    if (calcNote) calcNote.textContent = calc.note;

    var calcState = {
      employees: calc.defaults.employees,
      hoursPerWeek: calc.defaults.hoursPerWeek,
      hourlyRate: calc.defaults.hourlyRate,
      weeksPerYear: calc.defaults.weeksPerYear,
    };
    var calcFields = [
      { key: "employees", label: "Antal medarbejdere", min: 10, max: 1000, step: 10, fmt: function (v) { return nfDK.format(v); } },
      { key: "hoursPerWeek", label: "Timer sparet pr. medarbejder/uge", min: 1, max: 8, step: 0.5, fmt: function (v) { return String(v).replace(".", ","); } },
      { key: "hourlyRate", label: "Gns. timepris", min: 200, max: 800, step: 25, fmt: function (v) { return nfDK.format(v) + " kr"; } },
      { key: "weeksPerYear", label: "Arbejdsuger pr. år", min: 40, max: 48, step: 1, fmt: function (v) { return String(v); } },
    ];

    var calcValueEl = document.getElementById("calc-value");
    var calcHoursEl = document.getElementById("calc-hours");
    var calcFteEl = document.getElementById("calc-fte");

    function calcRecompute() {
      var totalHours = calcState.employees * calcState.hoursPerWeek * calcState.weeksPerYear;
      var value = totalHours * calcState.hourlyRate;
      var fte = calcState.employees * calcState.hoursPerWeek / 37;
      if (calcValueEl) calcValueEl.textContent = nfDK.format(Math.round(value / 1000) * 1000) + " kr";
      if (calcHoursEl) calcHoursEl.textContent = nfDK.format(Math.round(totalHours));
      if (calcFteEl) calcFteEl.textContent = fte.toFixed(1).replace(".", ",");
    }

    var calcControls = document.getElementById("calc-controls");
    if (calcControls) {
      calcFields.forEach(function (f) {
        var row = el("div", "calc-row");
        var head = el("div", "calc-row-head");
        head.appendChild(el("label", null, f.label));
        var valSpan = el("span", "calc-row-val", f.fmt(calcState[f.key]));
        head.appendChild(valSpan);
        row.appendChild(head);
        var input = document.createElement("input");
        input.type = "range";
        input.min = f.min; input.max = f.max; input.step = f.step;
        input.value = calcState[f.key];
        input.addEventListener("input", function () {
          calcState[f.key] = parseFloat(input.value);
          valSpan.textContent = f.fmt(calcState[f.key]);
          calcRecompute();
        });
        row.appendChild(input);
        calcControls.appendChild(row);
      });
    }
    calcRecompute();
  }

  /* ------------------------------------------------------------------ */
  /* Live AI-demo (rigtig sprogmodel)                                    */
  /* ------------------------------------------------------------------ */

  if (C.aiDemo) {
    var ad = C.aiDemo;
    var adTitle = document.getElementById("aidemo-title");
    var adLead = document.getElementById("aidemo-lead");
    var adGov = document.getElementById("aidemo-governance");
    if (adTitle) adTitle.textContent = ad.title;
    if (adLead) adLead.textContent = ad.lead;
    if (adGov) adGov.textContent = ad.governance;

    var adInput = document.getElementById("aidemo-input");
    var adOutput = document.getElementById("aidemo-output");
    var adRun = document.getElementById("aidemo-run");
    var adExample = document.getElementById("aidemo-example");
    var adTabs = document.getElementById("aidemo-tabs");
    var adMain = adInput ? adInput.closest(".aidemo-main") : null;
    var adActive = (ad.presets && ad.presets[0]) || null;

    function adSelect(preset, btn) {
      adActive = preset;
      if (adInput) adInput.placeholder = preset.placeholder || "";
      if (adTabs) {
        Array.prototype.forEach.call(adTabs.children, function (c) { c.classList.remove("active"); });
      }
      if (btn) btn.classList.add("active");
    }

    if (adTabs && ad.presets) {
      ad.presets.forEach(function (preset, i) {
        var b = el("button", "aidemo-tab" + (i === 0 ? " active" : ""), preset.label);
        b.type = "button";
        b.addEventListener("click", function () { adSelect(preset, b); });
        adTabs.appendChild(b);
      });
    }
    if (adActive && adInput) adInput.placeholder = adActive.placeholder || "";

    function adShow(text, kind) {
      if (!adOutput) return;
      adOutput.className = "aidemo-output" + (kind ? " aidemo-" + kind : "");
      adOutput.innerHTML = "";
      String(text).split(/\n\n+/).forEach(function (para) {
        var p = document.createElement("p");
        para.split("\n").forEach(function (line, idx) {
          if (idx) p.appendChild(document.createElement("br"));
          p.appendChild(document.createTextNode(line));
        });
        adOutput.appendChild(p);
      });
    }

    function adRunRequest(preset, input) {
      if (ad.endpoint) {
        return fetch(ad.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ useCaseId: preset.id, input: input }),
        }).then(function (r) {
          return r.json().catch(function () { throw new Error("Uventet svar fra serveren (" + r.status + ")"); })
            .then(function (data) {
              if (!r.ok || data.error) throw new Error(data.error || ("Serverfejl " + r.status));
              return data.text;
            });
        });
      }
      if (window.__AIDEMO_KEY) {
        return fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": window.__AIDEMO_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: ad.model,
            max_tokens: 1500,
            system: preset.system,
            messages: [{ role: "user", content: input }],
          }),
        }).then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok) throw new Error((data.error && data.error.message) || ("Fejl " + r.status));
            if (data.stop_reason === "refusal") throw new Error("Modellen afviste forespørgslen.");
            var tb = (data.content || []).filter(function (b) { return b.type === "text"; })[0];
            return tb ? tb.text : "(tomt svar)";
          });
        });
      }
      return Promise.resolve(null); // ikke konfigureret
    }

    function adSetupNotice() {
      adShow(
        "Demoen er ikke aktiveret i denne version. Den går live, når Worker-endpointet " +
        "er sat op (tager ~5 min – se ai-backend/README.md). Vil du teste med det samme, " +
        "kan du bruge en lokal test med din egen nøgle nedenfor.",
        "muted"
      );
    }

    var adBusy = false;
    function adGenerate() {
      if (adBusy || !adActive || !adInput) return;
      var input = adInput.value.trim();
      if (!input) { adShow("Skriv et par stikord først – eller indsæt eksemplet.", "muted"); return; }
      if (input.length > (ad.maxChars || 4000)) {
        adShow("Teksten er for lang (maks " + (ad.maxChars || 4000) + " tegn).", "muted"); return;
      }
      adBusy = true;
      if (adRun) { adRun.disabled = true; adRun.textContent = "Claude skriver …"; }
      adShow("Claude skriver …", "muted");
      adRunRequest(adActive, input)
        .then(function (text) {
          if (text === null) adSetupNotice();
          else adShow(text, "result");
        })
        .catch(function (e) { adShow("Kunne ikke hente svar: " + e.message, "error"); })
        .finally(function () {
          adBusy = false;
          if (adRun) { adRun.disabled = false; adRun.textContent = "Generér udkast"; }
        });
    }

    if (adRun) adRun.addEventListener("click", adGenerate);
    if (adExample) adExample.addEventListener("click", function () {
      if (adActive && adInput) { adInput.value = adActive.example || ""; adInput.focus(); }
    });

    // Lokal test-mulighed (kun når der ikke er et endpoint)
    if (!ad.endpoint && adMain) {
      var details = document.createElement("details");
      details.className = "aidemo-local";
      var summary = el("summary", null, "Kør en lokal test med din egen API-nøgle");
      details.appendChild(summary);
      details.appendChild(el("p", null,
        "Kun til din egen test på denne maskine. Nøglen gemmes ikke og sendes kun " +
        "direkte til Anthropic. Brug den ALDRIG på den offentlige version – deploy i " +
        "stedet din Worker (se ai-backend/README.md)."));
      var keyInput = document.createElement("input");
      keyInput.type = "password";
      keyInput.placeholder = "sk-ant-…";
      keyInput.autocomplete = "off";
      details.appendChild(keyInput);
      var keyBtn = el("button", "btn btn-ghost btn-small", "Aktivér lokal test");
      keyBtn.type = "button";
      keyBtn.addEventListener("click", function () {
        if (keyInput.value.trim()) {
          window.__AIDEMO_KEY = keyInput.value.trim();
          adShow("Lokal test aktiveret. Klik “Generér udkast”.", "muted");
        }
      });
      details.appendChild(keyBtn);
      adMain.appendChild(details);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Agenten: matching mod vidensbasen                                   */
  /* ------------------------------------------------------------------ */

  var STOPWORDS = [
    "hvad", "hvordan", "hvorfor", "hvilke", "hvilken", "hvem", "hvor",
    "er", "var", "har", "kan", "skal", "vil", "blev", "bliver",
    "du", "din", "dine", "dit", "jeg", "vi", "i", "man", "den", "det", "de",
    "en", "et", "og", "på", "til", "af", "med", "som", "for", "ikke",
    "om", "at", "der", "her", "så", "lidt", "mere", "også", "noget", "din",
  ];

  function normalize(s) {
    return s
      .toLowerCase()
      .replace(/[“”"'’.,!?;:()\[\]\-–—\/]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokens(s) {
    return normalize(s).split(" ").filter(function (t) {
      return t.length > 1 && STOPWORDS.indexOf(t) === -1;
    });
  }

  function scoreEntry(entry, qNorm, qTokens) {
    var score = 0;
    entry.keywords.forEach(function (kwRaw) {
      var kw = normalize(kwRaw);
      if (kw.indexOf(" ") !== -1) {
        if (qNorm.indexOf(kw) !== -1) score += 5;
      } else if (qTokens.indexOf(kw) !== -1) {
        score += 3;
      } else if (kw.length >= 5) {
        // Delvist match: "prioritering" ~ "prioriterer" osv.
        for (var i = 0; i < qTokens.length; i++) {
          var t = qTokens[i];
          if (t.length >= 5 && (t.indexOf(kw.slice(0, 5)) === 0 && kw.indexOf(t.slice(0, 5)) === 0)) {
            score += 2;
            break;
          }
        }
      }
    });
    // Let bonus for overlap med selve spørgsmålsteksten
    var qWords = tokens(entry.q);
    qTokens.forEach(function (t) {
      if (qWords.indexOf(t) !== -1) score += 0.5;
    });
    return score;
  }

  function findAnswer(query) {
    var qNorm = normalize(query);
    var qTokens = tokens(query);

    if (/^(hej|hejsa|hello|hi|goddag|godmorgen|dav|halløj)\b/.test(qNorm) && qTokens.length <= 2) {
      return {
        entry: null,
        text: "Hej! Godt at møde jer. Stil mig et spørgsmål om kandidatens erfaring, " +
              "tilgang eller motivation – eller prøv et af forslagene nedenfor.",
        source: "småsnak",
      };
    }

    var best = null;
    var bestScore = 0;
    C.kb.forEach(function (entry) {
      var s = scoreEntry(entry, qNorm, qTokens);
      if (s > bestScore) { bestScore = s; best = entry; }
    });

    if (best && bestScore >= 3) {
      return { entry: best, text: best.a, source: "vidensbase · “" + best.q + "”" };
    }
    return { entry: null, text: C.fallback, source: "uden for vidensbasen – ærligt fallback-svar" };
  }

  /* ------------------------------------------------------------------ */
  /* Agenten: chat-UI                                                    */
  /* ------------------------------------------------------------------ */

  var log = document.getElementById("chat-log");
  var chipsWrap = document.getElementById("chat-chips");
  var form = document.getElementById("chat-form");
  var input = document.getElementById("chat-text");
  if (!log || !form || !input) return;

  var busy = false;

  function scrollLog() {
    log.scrollTop = log.scrollHeight;
  }

  function addUserMsg(text) {
    var m = el("div", "msg msg-user");
    m.appendChild(el("p", null, text));
    log.appendChild(m);
    scrollLog();
  }

  function addAgentMsg(text, sourceLabel, done) {
    var m = el("div", "msg msg-agent");
    log.appendChild(m);
    var blocks = formatBlocks(text);

    function finish() {
      if (sourceLabel) {
        m.appendChild(el("span", "msg-source", "Kilde: " + sourceLabel));
      }
      scrollLog();
      if (done) done();
    }

    if (reducedMotion) {
      blocks.forEach(function (b) { m.appendChild(b); });
      finish();
      return;
    }

    // Blokvis "skrive"-effekt
    var i = 0;
    (function next() {
      if (i >= blocks.length) { finish(); return; }
      var b = blocks[i++];
      b.classList.add("blk");
      m.appendChild(b);
      scrollLog();
      setTimeout(next, 240);
    })();
  }

  function addTypingIndicator() {
    var m = el("div", "msg msg-agent msg-typing", "agenten tænker …");
    log.appendChild(m);
    scrollLog();
    return m;
  }

  function ask(query, viaChip) {
    if (busy) return;
    var text = query.trim();
    if (!text) return;
    busy = true;
    addUserMsg(text);
    input.value = "";

    var typing = addTypingIndicator();
    var delay = reducedMotion ? 50 : 450 + Math.random() * 450;

    setTimeout(function () {
      typing.remove();
      var res = viaChip
        ? { entry: viaChip, text: viaChip.a, source: "vidensbase · “" + viaChip.q + "”" }
        : findAnswer(text);
      addAgentMsg(res.text, res.source, function () {
        busy = false;
      });
    }, delay);
  }

  /* Chips */
  if (chipsWrap) {
    C.kb.filter(function (e) { return e.chip; }).forEach(function (entry) {
      var chip = el("button", "chip", entry.q);
      chip.type = "button";
      chip.addEventListener("click", function () {
        chip.classList.add("chip-used");
        ask(entry.q, entry);
      });
      chipsWrap.appendChild(chip);
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ask(input.value, null);
  });

  /* Velkomst */
  addAgentMsg(C.greeting, null, null);
})();
