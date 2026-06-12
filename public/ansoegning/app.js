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
      node.textContent = isTodo(C.meta.phone) ? "Ring op" : "Ring " + C.meta.phone;
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
  if (phoneBtn && !isTodo(C.meta.phone)) {
    phoneBtn.href = "tel:" + C.meta.phone.replace(/[^+\d]/g, "");
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
