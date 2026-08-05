/*
 * green light · Dokumenttjek
 *
 * Selvstændigt værktøj der ensretter tilbud og ordrebekræftelser efter en
 * redigerbar tjekliste (se rules.js). Alt foregår lokalt i browseren:
 * .docx-filen pakkes ud med JSZip, teksten rettes direkte i dokumentets
 * XML (så al formatering, logo og layout bevares), og filen pakkes sammen
 * igen – intet sendes til nogen server.
 *
 * Arkitekturen er bevidst adskilt i:
 *   1) Regelmotor  – ren tekst-logik (buildRegex, applyRulesToSegments …)
 *   2) Docx-motor  – XML-håndtering pr. afsnit (processDocx …)
 *   3) UI          – faner, dropzone, rapport og regel-editor
 */
"use strict";

/* ════════════════════════════════════════════════════════════════════
 * 1) REGELMOTOR
 * ════════════════════════════════════════════════════════════════════ */

const WORD_CHAR = "[\\p{L}\\p{N}]";

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bygger det regulære udtryk for en regel. Kaster ved ugyldigt regex. */
function buildRegex(rule) {
  let source = rule.regex ? rule.find : escapeRegExp(rule.find);
  if (rule.wholeWord) {
    // \b forstår ikke æ/ø/å – brug unicode-sikre ord-grænser i stedet.
    source = `(?<!${WORD_CHAR})(?:${source})(?!${WORD_CHAR})`;
  }
  return new RegExp(source, rule.matchCase ? "gu" : "giu");
}

function safeRegex(rule) {
  try { return buildRegex(rule); } catch { return null; }
}

/** Løfter store/små bogstaver fra det matchede over på erstatningen. */
function liftCase(matched, replacement) {
  const letters = matched.match(/\p{L}/gu);
  if (!letters) return replacement;
  const isUpper = (c) => c === c.toUpperCase() && c !== c.toLowerCase();
  if (letters.length > 1 && letters.every(isUpper)) {
    return replacement.toUpperCase();
  }
  if (isUpper(letters[0])) {
    const i = replacement.search(/\p{L}/u);
    if (i === -1) return replacement;
    return replacement.slice(0, i) + replacement[i].toUpperCase() + replacement.slice(i + 1);
  }
  return replacement;
}

/** Beregner erstatningsteksten for ét match ($1–$9, $& og smart case). */
function computeReplacement(rule, match) {
  let rep = rule.replace;
  if (rule.regex) {
    rep = rep.replace(/\$(\$|&|\d)/g, (_, g) => {
      if (g === "$") return "$";
      if (g === "&") return match[0];
      const grp = match[Number(g)];
      return grp === undefined ? "" : grp;
    });
  }
  if (rule.smartCase && !rule.matchCase) rep = liftCase(match[0], rep);
  return rep;
}

function findMatches(re, text) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; } // undgå uendelig løkke
    out.push(m);
    if (out.length > 20000) break; // sikkerhedsbremse
  }
  return out;
}

/**
 * Erstatter intervallet [start; end) i en liste af tekst-segmenter.
 * Segmenterne svarer til dokumentets <w:t>-tekststykker – et match kan
 * sagtens gå hen over flere segmenter (Word deler ofte ord op).
 * Erstatningen lægges i det første berørte segment.
 */
function spliceSegments(segs, start, end, newText) {
  let offset = 0;
  let inserted = false;
  for (let i = 0; i < segs.length; i++) {
    const segStart = offset;
    const segEnd = offset + segs[i].length;
    offset = segEnd;
    if (segEnd <= start || segStart >= end) continue;
    const head = segs[i].slice(0, Math.max(0, start - segStart));
    const tail = segs[i].slice(Math.min(segs[i].length, end - segStart));
    segs[i] = head + (inserted ? "" : newText) + tail;
    inserted = true;
  }
}

/**
 * Kører alle aktive regler på et afsnits segmenter (muterer `segs`) og
 * returnerer en liste af ændringer til rapporten. `where` er en label
 * som "Brødtekst"/"Sidehoved".
 */
function applyRulesToSegments(segs, rules, where) {
  const changes = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const re = safeRegex(rule);
    if (!re) continue; // ugyldigt regex – markeres i regel-listen
    const combined = segs.join("");
    const matches = findMatches(re, combined);
    if (!matches.length) continue;
    const planned = [];
    for (const m of matches) {
      const after = computeReplacement(rule, m);
      if (after === m[0]) continue; // allerede korrekt
      planned.push({ m, after });
      changes.push({
        rule,
        before: m[0],
        after,
        pre: combined.slice(Math.max(0, m.index - 34), m.index),
        post: combined.slice(m.index + m[0].length, m.index + m[0].length + 34),
        where,
      });
    }
    // Bagfra, så de tidligere matches' positioner forbliver gyldige.
    for (let i = planned.length - 1; i >= 0; i--) {
      const { m, after } = planned[i];
      spliceSegments(segs, m.index, m.index + m[0].length, after);
    }
  }
  return changes;
}

/** Retter en almindelig tekst (tekst-fanen og .txt-filer). */
function applyRulesToText(text, rules, where = "Tekst") {
  const paragraphChanges = [];
  // Kør pr. linje-uafhængigt er unødvendigt – reglerne krydser ikke linjeskift.
  const segs = [text];
  const changes = applyRulesToSegments(segs, rules, where);
  paragraphChanges.push(...changes);
  return { text: segs.join(""), changes: paragraphChanges };
}

/* ════════════════════════════════════════════════════════════════════
 * 2) DOCX-MOTOR
 * ════════════════════════════════════════════════════════════════════ */

const XML_NS = "http://www.w3.org/XML/1998/namespace";
const PART_RE = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

function whereLabel(path) {
  if (/header/.test(path)) return "Sidehoved";
  if (/footer/.test(path)) return "Sidefod";
  if (/footnotes/.test(path)) return "Fodnoter";
  if (/endnotes/.test(path)) return "Slutnoter";
  return "Brødtekst";
}

function partOrder(a, b) {
  const rank = (p) => (/document/.test(p) ? 0 : /header/.test(p) ? 1 : /footer/.test(p) ? 2 : 3);
  return rank(a) - rank(b) || a.localeCompare(b);
}

function nearestParagraph(node, ns) {
  let cur = node.parentNode;
  while (cur && cur.nodeType === 1) {
    if (cur.localName === "p" && cur.namespaceURI === ns) return cur;
    cur = cur.parentNode;
  }
  return null;
}

/**
 * Retter én XML-del (document.xml, header1.xml …). Teksten samles pr.
 * afsnit (<w:p>) hen over alle dets <w:t>-stykker, så regler også rammer
 * ord, som Word har delt over flere "runs". Kun tekstindholdet ændres –
 * al øvrig XML (formatering, felter, billeder) står urørt.
 */
function processXmlPart(xmlText, rules, where) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return null;
  const ns = doc.documentElement.namespaceURI;
  const changes = [];
  let mutated = false;

  for (const p of Array.from(doc.getElementsByTagNameNS(ns, "p"))) {
    // Kun tekst der hører til NETOP dette afsnit (tekstbokse har egne <w:p>).
    const tNodes = Array.from(p.getElementsByTagNameNS(ns, "t")).filter(
      (t) => nearestParagraph(t, ns) === p,
    );
    if (!tNodes.length) continue;

    const segs = tNodes.map((t) => t.textContent);
    const before = segs.slice();
    const pChanges = applyRulesToSegments(segs, rules, where);
    if (!pChanges.length) continue;

    mutated = true;
    changes.push(...pChanges);
    tNodes.forEach((t, i) => {
      if (segs[i] !== before[i]) t.textContent = segs[i];
      // Word kræver xml:space="preserve" for at bevare kant-mellemrum.
      if (/^\s|\s$/.test(segs[i])) t.setAttributeNS(XML_NS, "xml:space", "preserve");
    });
  }

  if (!mutated) return { mutated: false, changes: [], xml: xmlText };
  let out = new XMLSerializer().serializeToString(doc);
  if (/^\s*<\?xml/.test(xmlText) && !/^\s*<\?xml/.test(out)) {
    out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + out;
  }
  return { mutated: true, changes, xml: out };
}

/** Retter en hel .docx-fil og returnerer { blob, changes, warnings }. */
async function processDocx(arrayBuffer, rules) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  if (!zip.file("word/document.xml")) {
    throw new Error("Filen ligner ikke et Word-dokument (.docx).");
  }
  const changes = [];
  const warnings = [];
  const parts = Object.keys(zip.files).filter((p) => PART_RE.test(p)).sort(partOrder);

  for (const path of parts) {
    const xmlText = await zip.file(path).async("string");
    const result = processXmlPart(xmlText, rules, whereLabel(path));
    if (!result) {
      warnings.push(`Kunne ikke læse ${path} – den del af dokumentet er sprunget over.`);
      continue;
    }
    if (result.mutated) zip.file(path, result.xml);
    changes.push(...result.changes);
  }

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { blob, changes, warnings };
}

/* ════════════════════════════════════════════════════════════════════
 * 3) REGLER: indlæsning, normalisering og lagring
 * ════════════════════════════════════════════════════════════════════ */

const LS_RULES = "gl_dokumenttjek_rules_v1";
const LS_SETTINGS = "gl_dokumenttjek_settings_v1";

function uid() {
  return "user-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

function normalizeRule(r) {
  if (!r || typeof r !== "object" || typeof r.find !== "string" || r.find === "") return null;
  return {
    id: typeof r.id === "string" && r.id ? r.id : uid(),
    category: typeof r.category === "string" && r.category ? r.category : "Egne regler",
    find: r.find,
    replace: typeof r.replace === "string" ? r.replace : "",
    note: typeof r.note === "string" ? r.note : "",
    regex: !!r.regex,
    matchCase: !!r.matchCase,
    wholeWord: !!r.wholeWord,
    smartCase: r.smartCase === undefined ? !r.matchCase : !!r.smartCase,
    enabled: r.enabled === undefined ? true : !!r.enabled,
  };
}

function defaultRules() {
  return (window.GL_DEFAULT_RULES || []).map(normalizeRule).filter(Boolean);
}

function loadRules() {
  try {
    const raw = localStorage.getItem(LS_RULES);
    if (!raw) return defaultRules();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultRules();
    const rules = parsed.map(normalizeRule).filter(Boolean);
    return rules.length ? rules : defaultRules();
  } catch {
    return defaultRules();
  }
}

function saveRules() {
  try { localStorage.setItem(LS_RULES, JSON.stringify(state.rules)); } catch { /* fuld storage */ }
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}; } catch { return {}; }
}

function saveSettings() {
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings)); } catch { /* ignorér */ }
}

/* ════════════════════════════════════════════════════════════════════
 * 4) UI
 * ════════════════════════════════════════════════════════════════════ */

const state = {
  rules: loadRules(),
  settings: loadSettings(),
  results: [], // { name, outName, blob, changes, warnings } for "Hent alle"
  editingId: null,
};

const $ = (sel) => document.querySelector(sel);

/** Lille DOM-hjælper – al brugerdata indsættes som tekst (aldrig HTML). */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "hidden") node.hidden = !!v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function enabledRules() {
  return state.rules.filter((r) => r.enabled);
}

function showVisible(s) {
  // Gør mellemrums-rettelser synlige i rapporten.
  if (/^[  ]+$/.test(s)) return "␣".repeat(s.length);
  return s;
}

/* ── Faner ─────────────────────────────────────────────────────────── */

for (const btn of document.querySelectorAll("nav.tabs button")) {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === btn.dataset.panel));
  });
}

/* ── Dokument-fanen ────────────────────────────────────────────────── */

const dropzone = $("#dropzone");
const fileInput = $("#file-input");
const resultsBox = $("#results");

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag");
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => {
  handleFiles(fileInput.files);
  fileInput.value = "";
});

const keepNameBox = $("#keep-name");
keepNameBox.checked = !!state.settings.keepName;
keepNameBox.addEventListener("change", () => {
  state.settings.keepName = keepNameBox.checked;
  saveSettings();
});

function outName(name, ext) {
  if (state.settings.keepName) return name;
  const dot = name.toLowerCase().lastIndexOf(ext);
  const base = dot > 0 ? name.slice(0, dot) : name;
  // Almindelig bindestreg (ASCII) – specialtegn i filnavne kan strippes af browsere.
  return `${base.replace(/\s+$/, "")} - ensrettet${ext}`;
}

async function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".docx")) await processDocxFile(file);
    else if (lower.endsWith(".txt")) await processTxtFile(file);
    else addErrorCard(file.name, fileTypeMessage(lower));
  }
  updateResultButtons();
}

function fileTypeMessage(lower) {
  if (lower.endsWith(".doc")) {
    return "Gammelt Word-format (.doc) understøttes ikke. Åbn filen i Word og gem den som .docx – prøv så igen.";
  }
  if (lower.endsWith(".pdf")) {
    return "PDF-filer kan ikke rettes automatisk. Ret i Word-dokumentet (kilden) her i programmet, og lav derefter en ny PDF.";
  }
  return "Filtypen understøttes ikke. Brug Word-dokumenter (.docx) eller tekstfiler (.txt).";
}

async function processDocxFile(file) {
  const card = addPendingCard(file.name);
  try {
    const buf = await file.arrayBuffer();
    const { blob, changes, warnings } = await processDocx(buf, enabledRules());
    const name = outName(file.name, ".docx");
    state.results.push({ name: file.name, outName: name, blob, changes, warnings });
    renderFileResult(card, file.name, name, blob, changes, warnings);
  } catch (err) {
    card.replaceChildren();
    fillErrorCard(card, file.name, err && err.message ? err.message : "Filen kunne ikke læses.");
  }
}

async function processTxtFile(file) {
  const card = addPendingCard(file.name);
  try {
    const text = await file.text();
    const { text: fixed, changes } = applyRulesToText(text, enabledRules());
    const blob = new Blob([fixed], { type: "text/plain;charset=utf-8" });
    const name = outName(file.name, ".txt");
    state.results.push({ name: file.name, outName: name, blob, changes, warnings: [] });
    renderFileResult(card, file.name, name, blob, changes, []);
  } catch (err) {
    card.replaceChildren();
    fillErrorCard(card, file.name, err && err.message ? err.message : "Filen kunne ikke læses.");
  }
}

function addPendingCard(name) {
  const card = el("div", { class: "card file-card" },
    el("h3", {}, "📄 ", el("span", { class: "fname" }, name), " ", el("span", { class: "badge info" }, "Behandler …")),
  );
  resultsBox.prepend(card);
  return card;
}

function addErrorCard(name, message) {
  const card = el("div", { class: "card file-card" });
  fillErrorCard(card, name, message);
  resultsBox.prepend(card);
}

function fillErrorCard(card, name, message) {
  card.append(
    el("h3", {}, "📄 ", el("span", { class: "fname" }, name), " ", el("span", { class: "badge err" }, "Kunne ikke behandles")),
    el("p", { class: "muted", style: "margin:8px 0 0" }, message),
  );
}

function renderFileResult(card, origName, name, blob, changes, warnings) {
  card.replaceChildren();
  const n = changes.length;
  const badge = n
    ? el("span", { class: "badge info" }, `${n} ${n === 1 ? "rettelse" : "rettelser"}`)
    : el("span", { class: "badge ok" }, "✓ Følger tjeklisten");

  const header = el("div", { class: "row between" },
    el("h3", {}, "📄 ", el("span", { class: "fname" }, origName), " ", badge),
    el("button", {
      class: "btn btn-primary btn-sm",
      onclick: () => downloadBlob(blob, name),
    }, n ? "Hent rettet fil" : "Hent fil"),
  );
  card.append(header);

  for (const w of warnings) {
    card.append(el("p", {}, el("span", { class: "badge warn" }, "⚠ " + w)));
  }

  if (!n) return;

  // Opsummering pr. regel
  const perRule = new Map();
  for (const c of changes) {
    const key = c.rule.id;
    if (!perRule.has(key)) perRule.set(key, { rule: c.rule, count: 0, sample: c });
    perRule.get(key).count++;
  }
  const ul = el("ul", { class: "rule-summary" });
  for (const { rule, count, sample } of perRule.values()) {
    ul.append(el("li", {},
      el("del", {}, showVisible(sample.before)), " → ", el("ins", {}, showVisible(sample.after)),
      el("span", { class: "cnt" }, `  × ${count}`),
      rule.note ? el("span", { class: "muted" }, `  ·  ${rule.note}`) : null,
    ));
  }
  card.append(ul);

  // Fuld liste med kontekst
  const details = el("details", { class: "changes" },
    el("summary", {}, "Vis alle rettelser med sammenhæng"),
    renderChangeList(changes),
  );
  card.append(details);
}

function renderChangeList(changes) {
  const ul = el("ul", { class: "change-list" });
  for (const c of changes) {
    ul.append(el("li", {},
      el("span", { class: "badge where" }, c.where), " ",
      el("span", { class: "ctx" }, (c.pre.length === 34 ? "…" : "") + c.pre),
      el("del", {}, showVisible(c.before)),
      el("ins", {}, showVisible(c.after)),
      el("span", { class: "ctx" }, c.post + (c.post.length === 34 ? "…" : "")),
    ));
  }
  return ul;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function updateResultButtons() {
  const has = state.results.length > 0;
  $("#download-all").hidden = state.results.length < 2;
  $("#clear-results").hidden = !has;
}

$("#download-all").addEventListener("click", async () => {
  const zip = new JSZip();
  const used = new Set();
  for (const r of state.results) {
    let name = r.outName;
    let i = 2;
    while (used.has(name)) {
      const dot = name.lastIndexOf(".");
      name = dot > 0 ? `${r.outName.slice(0, dot)} (${i})${r.outName.slice(dot)}` : `${r.outName} (${i})`;
      i++;
    }
    used.add(name);
    zip.file(name, r.blob);
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  downloadBlob(blob, "rettede-dokumenter.zip");
});

$("#clear-results").addEventListener("click", () => {
  state.results = [];
  resultsBox.replaceChildren();
  updateResultButtons();
});

/* ── Tekst-fanen ───────────────────────────────────────────────────── */

const EXAMPLE_TEXT = `Tilbud fra Greenlight

Hej Peter

Tak for din henvendelse.  Hermed fremsendes tilbudet ihht. vores aftale.

Vi tilbyder 120 stk. LED-armaturer (140 lm/w) til jeres lager på 2.400 m2.
Prisen er 245.000 kr excl. moms, inkl montering jvf. bilag 1.
Forventet besparelse: 45.000 kwh og 18 ton co2 pr. år.
Betaling: 14 dage netto. Ordrebekræftigelse fremsendes pr. email.

Se mere på www.green-light.dk eller skriv til info@green-light.dk.

Mvh
Michael`;

$("#insert-example").addEventListener("click", () => {
  $("#text-in").value = EXAMPLE_TEXT;
  $("#text-status").textContent = "";
});

$("#fix-text").addEventListener("click", () => {
  const input = $("#text-in").value;
  if (!input.trim()) {
    $("#text-status").textContent = "Indsæt først noget tekst.";
    return;
  }
  const { text, changes } = applyRulesToText(input, enabledRules());
  $("#text-out").value = text;
  $("#text-out-card").hidden = false;
  $("#text-status").textContent = changes.length
    ? `${changes.length} ${changes.length === 1 ? "rettelse" : "rettelser"} foretaget.`
    : "Ingen rettelser – teksten følger tjeklisten ✓";
  const box = $("#text-changes");
  box.replaceChildren();
  if (changes.length) {
    box.append(
      el("details", { class: "changes", open: "" },
        el("summary", {}, "Rettelser med sammenhæng"),
        renderChangeList(changes),
      ),
    );
  }
});

$("#copy-text").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#text-out").value);
    $("#copy-text").textContent = "Kopieret ✓";
  } catch {
    $("#text-out").select();
    document.execCommand("copy");
    $("#copy-text").textContent = "Kopieret ✓";
  }
  setTimeout(() => { $("#copy-text").textContent = "Kopiér"; }, 1600);
});

$("#download-text").addEventListener("click", () => {
  const blob = new Blob([$("#text-out").value], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, "rettet-tekst.txt");
});

/* ── Tjeklisten (regel-editor) ─────────────────────────────────────── */

const rulesList = $("#rules-list");

function renderRules() {
  // Fane-tæller + banner
  $("#rule-count").textContent = String(state.rules.length);
  const active = enabledRules().length;
  $("#rules-meta").textContent = `${active} af ${state.rules.length} regler slået til`;
  $("#no-rules-banner").hidden = active > 0;

  // Kategorier i den rækkefølge de optræder
  const categories = [];
  for (const r of state.rules) {
    if (!categories.includes(r.category)) categories.push(r.category);
  }
  $("#category-list").replaceChildren(...categories.map((c) => el("option", { value: c })));

  rulesList.replaceChildren();
  for (const cat of categories) {
    rulesList.append(el("div", { class: "cat-title" }, cat));
    for (const rule of state.rules.filter((r) => r.category === cat)) {
      rulesList.append(renderRuleRow(rule));
    }
  }
}

function renderRuleRow(rule) {
  const invalid = rule.enabled && !safeRegex(rule);

  const toggle = el("label", { class: "switch", title: rule.enabled ? "Slå fra" : "Slå til" },
    el("input", {
      type: "checkbox",
      ...(rule.enabled ? { checked: "" } : {}),
      onchange: (e) => {
        rule.enabled = e.target.checked;
        saveRules();
        renderRules();
      },
    }),
    el("span", { class: "slider" }),
  );

  const flags = el("div", { class: "rule-flags" },
    rule.wholeWord ? el("span", { class: "flag" }, "hele ord") : null,
    rule.matchCase ? el("span", { class: "flag" }, "store/små") : null,
    rule.smartCase && !rule.matchCase ? el("span", { class: "flag" }, "smart case") : null,
    rule.regex ? el("span", { class: "flag" }, "regex") : null,
    invalid ? el("span", { class: "badge err" }, "Ugyldigt regex – reglen springes over") : null,
  );

  const main = el("div", { class: "rule-main" },
    el("div", { class: "rule-line" },
      el("code", {}, rule.find),
      el("span", { class: "arrow" }, "→"),
      el("code", {}, rule.replace === "" ? "(fjernes)" : rule.replace),
    ),
    rule.note ? el("div", { class: "rule-note" }, rule.note) : null,
    flags,
  );

  const idx = state.rules.indexOf(rule);
  const catRules = state.rules.filter((r) => r.category === rule.category);
  const posInCat = catRules.indexOf(rule);

  const actions = el("div", { class: "rule-actions" },
    el("button", {
      class: "icon-btn", title: "Flyt op", ...(posInCat === 0 ? { disabled: "" } : {}),
      onclick: () => moveRule(idx, -1),
    }, "↑"),
    el("button", {
      class: "icon-btn", title: "Flyt ned", ...(posInCat === catRules.length - 1 ? { disabled: "" } : {}),
      onclick: () => moveRule(idx, 1),
    }, "↓"),
    el("button", { class: "icon-btn", title: "Redigér", onclick: () => openDialog(rule) }, "✎"),
    el("button", {
      class: "icon-btn danger", title: "Slet",
      onclick: () => {
        if (confirm(`Slet reglen »${rule.find} → ${rule.replace}«?`)) {
          state.rules.splice(state.rules.indexOf(rule), 1);
          saveRules();
          renderRules();
        }
      },
    }, "🗑"),
  );

  const row = el("div", { class: "rule-row" + (rule.enabled ? "" : " disabled") }, toggle, main, actions);
  return row;
}

function moveRule(idx, dir) {
  const rule = state.rules[idx];
  // Byt kun plads inden for samme kategori, så visningen forbliver logisk.
  let j = idx + dir;
  while (j >= 0 && j < state.rules.length && state.rules[j].category !== rule.category) j += dir;
  if (j < 0 || j >= state.rules.length) return;
  [state.rules[idx], state.rules[j]] = [state.rules[j], state.rules[idx]];
  saveRules();
  renderRules();
}

/* ── Regel-dialog ──────────────────────────────────────────────────── */

const dialog = $("#rule-dialog");
const form = $("#rule-form");

function openDialog(rule) {
  state.editingId = rule ? rule.id : null;
  $("#dialog-title").textContent = rule ? "Redigér regel" : "Ny regel";
  $("#f-find").value = rule ? rule.find : "";
  $("#f-replace").value = rule ? rule.replace : "";
  $("#f-note").value = rule ? rule.note : "";
  $("#f-category").value = rule ? rule.category : "Egne regler";
  $("#f-wholeword").checked = rule ? rule.wholeWord : true;
  $("#f-matchcase").checked = rule ? rule.matchCase : false;
  $("#f-smartcase").checked = rule ? rule.smartCase : true;
  $("#f-regex").checked = rule ? rule.regex : false;
  $("#f-test").value = "";
  $("#f-test-out").textContent = "";
  $("#f-find-err").hidden = true;
  dialog.showModal();
}

function ruleFromForm() {
  return normalizeRule({
    id: state.editingId || undefined,
    category: $("#f-category").value.trim() || "Egne regler",
    find: $("#f-find").value,
    replace: $("#f-replace").value,
    note: $("#f-note").value.trim(),
    regex: $("#f-regex").checked,
    matchCase: $("#f-matchcase").checked,
    wholeWord: $("#f-wholeword").checked,
    smartCase: $("#f-smartcase").checked,
    enabled: true,
  });
}

function validateForm() {
  const rule = ruleFromForm();
  const errBox = $("#f-find-err");
  if (!rule) {
    errBox.textContent = "Udfyld hvad der skal findes.";
    errBox.hidden = false;
    return null;
  }
  try {
    buildRegex(rule);
  } catch (e) {
    errBox.textContent = "Ugyldigt regulært udtryk: " + e.message;
    errBox.hidden = false;
    return null;
  }
  errBox.hidden = true;
  return rule;
}

function updateDialogTest() {
  const out = $("#f-test-out");
  const sample = $("#f-test").value;
  if (!sample) { out.textContent = ""; return; }
  const rule = validateForm();
  if (!rule) { out.textContent = ""; return; }
  const { text, changes } = applyRulesToText(sample, [rule]);
  out.replaceChildren(
    changes.length
      ? el("span", {}, "Resultat: ", el("ins", {}, text))
      : el("span", { class: "muted" }, "Ingen match i prøveteksten."),
  );
}

for (const id of ["f-find", "f-replace", "f-test", "f-regex", "f-matchcase", "f-wholeword", "f-smartcase"]) {
  $("#" + id).addEventListener("input", updateDialogTest);
}

form.addEventListener("submit", (e) => {
  const submitter = e.submitter;
  if (!submitter || submitter.value !== "save") return; // Annuller
  const rule = validateForm();
  if (!rule) { e.preventDefault(); return; }
  if (state.editingId) {
    const i = state.rules.findIndex((r) => r.id === state.editingId);
    if (i !== -1) {
      rule.enabled = state.rules[i].enabled;
      state.rules[i] = rule;
    }
  } else {
    state.rules.push(rule);
  }
  saveRules();
  renderRules();
});

$("#add-rule").addEventListener("click", () => openDialog(null));

/* ── Import / eksport / gendan ─────────────────────────────────────── */

$("#export-rules").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.rules, null, 2)], { type: "application/json" });
  downloadBlob(blob, "dokumenttjek-regler.json");
});

$("#import-rules").addEventListener("click", () => $("#import-input").click());
$("#import-input").addEventListener("change", async () => {
  const file = $("#import-input").files[0];
  $("#import-input").value = "";
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) throw new Error("ikke en liste");
    const rules = parsed.map(normalizeRule).filter(Boolean);
    if (!rules.length) throw new Error("ingen gyldige regler");
    if (!confirm(`Importér ${rules.length} regler fra »${file.name}«?\n\nDe ERSTATTER den nuværende tjekliste (${state.rules.length} regler).`)) return;
    state.rules = rules;
    saveRules();
    renderRules();
  } catch {
    alert("Filen kunne ikke læses som en regel-liste. Brug en fil oprettet med »Eksportér«.");
  }
});

$("#reset-rules").addEventListener("click", () => {
  if (!confirm("Gendan standardreglerne?\n\nDine egne ændringer og tilføjelser i tjeklisten overskrives.")) return;
  state.rules = defaultRules();
  saveRules();
  renderRules();
});

/* ── Init ──────────────────────────────────────────────────────────── */

renderRules();
updateResultButtons();

// Test-krog (bruges af automatiske tests – ikke af UI'et)
window.__dokumenttjek = {
  buildRegex,
  applyRulesToText,
  applyRulesToSegments,
  processXmlPart,
  processDocx,
  normalizeRule,
  defaultRules,
};
