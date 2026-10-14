/* =========================================================
   Folio CV Builder – application logic
   State -> editor form + live preview + exports.
   Depends on js/templates.js (window.CVTemplates).
   ========================================================= */
(function () {
  "use strict";

  var T = window.CVTemplates;
  var TEMPLATES = T.list, cvHTML = T.cvHTML;
  var esc = T.helpers.esc, items = T.helpers.items, exps = T.helpers.exps, edus = T.helpers.edus;

  /* ---------- Constants ---------- */
  var PAGE_W = 794, PAGE_H = 1123, MARGIN = 44;   // A4 in CSS px at 96dpi
  var STORE_KEY = "folio-cv-draft-v1";
  var SWATCHES = ["#2F49D1", "#0F766E", "#9F1239", "#B45309", "#1F2937", "#6D28D9"];

  function blankExp() { return { role: "", company: "", location: "", start: "", end: "", current: false, bullets: "" }; }
  function blankEdu() { return { degree: "", school: "", location: "", start: "", end: "", details: "" }; }

  function emptyState() {
    return {
      template: "meridian", accent: SWATCHES[0],
      personal: { name: "", title: "", email: "", phone: "", location: "", website: "", linkedin: "", photo: "" },
      summary: "", experience: [blankExp()], education: [blankEdu()],
      skills: "", languages: "", certifications: "", isExample: false
    };
  }

  function exampleState() {
    return {
      template: "meridian", accent: SWATCHES[0], isExample: true,
      personal: {
        name: "Amara Okoye", title: "Senior Product Designer",
        email: "amara.okoye@example.com", phone: "+44 7700 900123", location: "London, UK",
        website: "amaraokoye.design", linkedin: "linkedin.com/in/amaraokoye", photo: ""
      },
      summary: "Product designer with 8 years of experience shaping fintech and health products used by millions. I turn messy research into clear flows, build design systems teams actually adopt, and work closely with engineering to ship and measure.",
      experience: [
        { role: "Senior Product Designer", company: "Brightpay", location: "London", start: "Mar 2022", end: "", current: true,
          bullets: "Led redesign of the onboarding flow, lifting completion from 61% to 84%\nBuilt and maintained the Pulse design system across 4 product squads\nMentored 3 mid-level designers through their first lead projects" },
        { role: "Product Designer", company: "Medlink Health", location: "Manchester", start: "Jun 2019", end: "Feb 2022", current: false,
          bullets: "Designed the appointment booking app, rated 4.7 on the App Store\nRan 40+ usability sessions with patients and clinic staff\nCut support tickets by 30% by reworking prescription reminders" },
        { role: "UX Designer", company: "Northbeam Studio", location: "Leeds", start: "Aug 2017", end: "May 2019", current: false,
          bullets: "Delivered web and mobile projects for 12 clients in retail and education" }
      ],
      education: [
        { degree: "BA (Hons) Graphic Communication", school: "University of Leeds", location: "Leeds", start: "2014", end: "2017", details: "First Class Honours" }
      ],
      skills: "Product strategy, Interaction design, Design systems, Prototyping, User research, Figma, Accessibility (WCAG 2.2), HTML & CSS, Workshop facilitation",
      languages: "English (native), French (professional), Yoruba (conversational)",
      certifications: "Google UX Design Certificate, 2021\nNN/g UX Certification, 2020"
    };
  }

  /* ---------- State & persistence ---------- */
  var state = loadDraft() || exampleState();
  var openSections = { tpl: true, personal: true, summary: false, experience: false, education: false, skills: false };

  function normalise(d) {
    if (!d || typeof d !== "object") return null;
    var out = Object.assign(emptyState(), d);
    out.personal = Object.assign(emptyState().personal, d.personal || {});
    out.experience = Array.isArray(d.experience) && d.experience.length ? d.experience.map(function (x) { return Object.assign(blankExp(), x); }) : [blankExp()];
    out.education = Array.isArray(d.education) && d.education.length ? d.education.map(function (x) { return Object.assign(blankEdu(), x); }) : [blankEdu()];
    if (!TEMPLATES.some(function (t) { return t.id === out.template; })) out.template = TEMPLATES[0].id;
    if (!/^#[0-9a-f]{6}$/i.test(out.accent)) out.accent = SWATCHES[0];
    ["summary", "skills", "languages", "certifications"].forEach(function (k) { out[k] = String(out[k] || ""); });
    return out;
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? normalise(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  var saveTimer = null;
  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
      catch (e) { /* storage full or blocked – the app still works */ }
    }, 400);
  }

  function slug(s) {
    return (String(s || "my").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my") + "-cv";
  }
  function tplName(id) { return TEMPLATES.filter(function (x) { return x.id === id; })[0].name; }

  /* ---------- Page breaks ----------
     Measured in unscaled CSS px. Pages after the first get a top margin,
     every page keeps a bottom margin. A break never cuts through a .keep
     block or leaves a heading stranded at the foot of a page. */
  function computeBreaks(cvEl, scale) {
    var root = cvEl.getBoundingClientRect();
    var total = root.height / scale;
    function rel(el) {
      var r = el.getBoundingClientRect();
      return { top: (r.top - root.top) / scale, bottom: (r.bottom - root.top) / scale };
    }
    var keeps = Array.prototype.map.call(cvEl.querySelectorAll(".keep"), rel);
    var heads = Array.prototype.map.call(cvEl.querySelectorAll("h2"), rel);
    var breaks = [0], y = 0, page = 0, guard = 0;
    while (guard++ < 40) {
      var usable = PAGE_H - MARGIN - (page > 0 ? MARGIN : 0);
      if (total - y <= usable + (page === 0 ? MARGIN : 0)) break;
      var b = y + usable;
      keeps.forEach(function (k) { if (k.top < b && k.bottom > b && k.top > y + 80) b = Math.min(b, k.top); });
      heads.forEach(function (k) { if (k.top < b && k.bottom > b - 70 && k.top > y + 80) b = Math.min(b, k.top); });
      breaks.push(b); y = b; page++;
    }
    breaks.push(total);
    return breaks;
  }

  /* ---------- Editor ---------- */
  var ed = document.getElementById("editorInner");
  var editorEl = document.getElementById("editor");
  var ICON = {
    up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10l4-4 4 4"/></svg>',
    down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6l4 4 4-4"/></svg>',
    del: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>'
  };

  function field(path, label, value, opts) {
    opts = opts || {};
    var id = "f-" + path.replace(/\./g, "-");
    var ctl = opts.area
      ? '<textarea id="' + id + '" data-path="' + path + '" rows="' + (opts.rows || 4) + '" placeholder="' + esc(opts.ph || "") + '">' + esc(value) + "</textarea>"
      : '<input type="' + (opts.type || "text") + '" id="' + id + '" data-path="' + path + '" value="' + esc(value) + '" placeholder="' + esc(opts.ph || "") + '" autocomplete="off">';
    return '<div class="field' + (opts.full ? " full" : "") + '"><label for="' + id + '">' + label + "</label>" + ctl +
      (opts.help ? '<span class="help">' + opts.help + "</span>" : "") + "</div>";
  }

  function section(key, num, title, hint, body) {
    return '<details class="sec" data-sec="' + key + '"' + (openSections[key] ? " open" : "") + ">" +
      '<summary><span class="num">' + num + "</span><h2>" + title + '</h2><span class="hint">' + hint + "</span></summary>" +
      '<div class="sec-body">' + body + "</div></details>";
  }

  function entryHead(list, i, n, label) {
    function btn(action, icon, aria, disabled) {
      return '<button type="button" class="icon-btn" data-action="' + action + '" data-list="' + list + '" data-i="' + i + '" aria-label="' + aria + '"' + (disabled ? " disabled" : "") + ">" + icon + "</button>";
    }
    return '<div class="entry-head"><span class="t">' + esc(label) + "</span>" +
      btn("up", ICON.up, "Move up", i === 0) + btn("down", ICON.down, "Move down", i === n - 1) + btn("remove", ICON.del, "Remove", false) + "</div>";
  }

  function renderEditor() {
    var d = state, p = d.personal, h = "";

    if (d.isExample) {
      h += '<div class="notice"><p>The form is filled with an <b>example CV</b> so you can see how the templates look. Replace it with your own details or start from a blank form.</p>' +
        '<div class="row" id="blankRow"><button type="button" class="btn" data-action="ask-blank">Start blank</button>' +
        '<button type="button" class="btn ghost" data-action="keep-example">Keep editing this</button></div></div>';
    }

    // 1. Template
    var t = '<div class="tpls" role="radiogroup" aria-label="Template">';
    TEMPLATES.forEach(function (tp) {
      t += '<button type="button" class="tpl" role="radio" aria-checked="' + (d.template === tp.id) + '" data-action="template" data-id="' + tp.id + '">' +
        '<div class="thumb"><div class="thumb-inner" data-thumb="' + tp.id + '"></div></div>' +
        '<span class="name">' + tp.name + '</span><span class="desc">' + tp.desc + "</span></button>";
    });
    t += "</div>";
    t += '<div class="field"><label>Accent colour</label><div class="swatches" role="radiogroup" aria-label="Accent colour">';
    SWATCHES.forEach(function (c) {
      t += '<button type="button" class="swatch" role="radio" aria-label="' + c + '" aria-checked="' + (d.accent.toLowerCase() === c.toLowerCase()) +
        '" data-action="accent" data-c="' + c + '" style="background:' + c + '"></button>';
    });
    t += '<label class="custom-color">Custom <input type="color" id="accentCustom" value="' + esc(d.accent) + '"></label></div></div>';
    h += section("tpl", 1, "Template", tplName(d.template), t);

    // 2. Personal details
    var pp = '<div class="grid2">' +
      field("personal.name", "Full name", p.name, { full: true, ph: "e.g. Amara Okoye" }) +
      field("personal.title", "Job title", p.title, { full: true, ph: "e.g. Senior Product Designer" }) +
      field("personal.email", "Email", p.email, { type: "email" }) +
      field("personal.phone", "Phone", p.phone, { type: "tel" }) +
      field("personal.location", "Location", p.location, { ph: "City, Country" }) +
      field("personal.website", "Website", p.website) +
      field("personal.linkedin", "LinkedIn", p.linkedin, { full: true, ph: "linkedin.com/in/…" }) + "</div>";
    pp += '<div class="field"><label for="photoInput">Photo <span style="font-weight:400">(optional, shown on Ledger)</span></label><div class="photo-row">' +
      '<div class="photo-prev"' + (p.photo ? ' style="background-image:url(' + esc(p.photo) + ')"' : "") + ">" + (p.photo ? "" : "None") + "</div>" +
      '<input type="file" id="photoInput" accept="image/*" hidden>' +
      '<button type="button" class="btn" data-action="photo">' + (p.photo ? "Change photo" : "Upload photo") + "</button>" +
      (p.photo ? '<button type="button" class="btn ghost danger" data-action="photo-remove">Remove</button>' : "") + "</div></div>";
    h += section("personal", 2, "Personal details", "", pp);

    // 3. Summary
    h += section("summary", 3, "Profile summary", d.summary.trim() ? d.summary.trim().split(/\s+/).length + " words" : "",
      field("summary", "A few sentences about you", d.summary, { area: true, rows: 5, help: "Aim for 40–80 words: who you are, what you're good at, what you want next." }));

    // 4. Experience
    var ex = "";
    d.experience.forEach(function (x, i) {
      ex += '<div class="entry-card">' + entryHead("experience", i, d.experience.length, x.role || x.company || "New position") +
        '<div class="grid2">' +
        field("experience." + i + ".role", "Job title", x.role) +
        field("experience." + i + ".company", "Employer", x.company) +
        field("experience." + i + ".location", "Location", x.location, { full: true }) +
        field("experience." + i + ".start", "Start", x.start, { ph: "e.g. Mar 2021" }) +
        (x.current
          ? '<div class="field"><label for="f-exp-end-' + i + '">End</label><input type="text" id="f-exp-end-' + i + '" value="Present" disabled></div>'
          : field("experience." + i + ".end", "End", x.end, { ph: "e.g. Jun 2023" })) +
        '<label class="check full"><input type="checkbox" data-path="experience.' + i + '.current" id="f-exp-cur-' + i + '"' + (x.current ? " checked" : "") + "> I currently work here</label>" +
        field("experience." + i + ".bullets", "Achievements", x.bullets, { area: true, full: true, rows: 4, help: "One per line. Start with a verb and add numbers where you can." }) +
        "</div></div>";
    });
    ex += '<button type="button" class="add-btn" data-action="add" data-list="experience">+ Add position</button>';
    var ne = exps(d).length;
    h += section("experience", 4, "Experience", ne + (ne === 1 ? " position" : " positions"), ex);

    // 5. Education
    var eu = "";
    d.education.forEach(function (x, i) {
      eu += '<div class="entry-card">' + entryHead("education", i, d.education.length, x.degree || x.school || "New qualification") +
        '<div class="grid2">' +
        field("education." + i + ".degree", "Qualification", x.degree, { full: true, ph: "e.g. BSc Computer Science" }) +
        field("education." + i + ".school", "School", x.school) +
        field("education." + i + ".location", "Location", x.location) +
        field("education." + i + ".start", "Start", x.start, { ph: "e.g. 2016" }) +
        field("education." + i + ".end", "End", x.end, { ph: "e.g. 2020" }) +
        field("education." + i + ".details", "Details", x.details, { full: true, ph: "Grade, thesis, awards" }) +
        "</div></div>";
    });
    eu += '<button type="button" class="add-btn" data-action="add" data-list="education">+ Add qualification</button>';
    var nd = edus(d).length;
    h += section("education", 5, "Education", nd + (nd === 1 ? " entry" : " entries"), eu);

    // 6. Skills & extras
    h += section("skills", 6, "Skills & extras", items(d.skills).length + " skills",
      field("skills", "Skills", d.skills, { area: true, rows: 3, help: "Separate with commas." }) +
      field("languages", "Languages", d.languages, { ph: "English (native), French (B2)", help: "Separate with commas." }) +
      field("certifications", "Certifications", d.certifications, { area: true, rows: 3, help: "One per line." }));

    var scroll = editorEl.scrollTop;
    ed.innerHTML = h;
    editorEl.scrollTop = scroll;
    renderThumbs();
  }

  /* ---------- Thumbnails ---------- */
  function renderThumbs() {
    Array.prototype.forEach.call(ed.querySelectorAll("[data-thumb]"), function (el) {
      el.innerHTML = cvHTML(state, el.getAttribute("data-thumb"));
    });
    fitThumbs();
  }
  function fitThumbs() {
    Array.prototype.forEach.call(ed.querySelectorAll(".thumb"), function (th) {
      th.firstChild.style.transform = "scale(" + th.clientWidth / PAGE_W + ")";
    });
  }
  var thumbTimer = null;
  function scheduleThumbs() { clearTimeout(thumbTimer); thumbTimer = setTimeout(renderThumbs, 350); }

  /* ---------- Live preview ---------- */
  var sheet = document.getElementById("sheet");
  var wrap = document.getElementById("sheetWrap");
  var pane = document.getElementById("previewPane");
  var meta = document.getElementById("previewMeta");

  function renderPreview() {
    sheet.innerHTML = cvHTML(state);
    layoutPreview();
  }
  function layoutPreview() {
    var s = Math.min(1, (pane.clientWidth - 32) / PAGE_W);
    if (s <= 0) return;
    sheet.style.transform = "scale(" + s + ")";
    var cv = sheet.querySelector(".cv");
    if (!cv) return;
    Array.prototype.forEach.call(sheet.querySelectorAll(".pb"), function (n) { n.remove(); });
    var breaks = computeBreaks(cv, s);
    var total = breaks[breaks.length - 1];
    wrap.style.width = PAGE_W * s + "px";
    wrap.style.height = total * s + "px";
    for (var i = 1; i < breaks.length - 1; i++) {
      var m = document.createElement("div");
      m.className = "pb";
      m.style.top = breaks[i] + "px";
      m.innerHTML = "<span>Page " + (i + 1) + "</span>";
      sheet.appendChild(m);
    }
    var pages = breaks.length - 1;
    meta.innerHTML = "<span><strong>" + tplName(state.template) + "</strong> template · A4</span><span>" +
      pages + (pages === 1 ? " page" : " pages") + " · " + Math.round(s * 100) + "% zoom</span>";
  }

  var raf = 0;
  function update() {
    saveDraft();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(renderPreview);
    scheduleThumbs();
  }

  /* ---------- Form events ---------- */
  function setPath(path, value) {
    var parts = path.split("."), o = state;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }

  ed.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "accentCustom") { state.accent = t.value; refreshSwatches(); update(); return; }
    var path = t.getAttribute("data-path");
    if (!path || t.type === "checkbox") return;
    setPath(path, t.value);
    // Keep the entry card's title in sync without re-rendering the form
    var card = t.closest(".entry-card");
    if (card && /\.(role|company|degree|school)$/.test(path)) {
      var parts = path.split("."), x = state[parts[0]][+parts[1]];
      card.querySelector(".entry-head .t").textContent =
        (x.role || x.degree || x.company || x.school) || (parts[0] === "experience" ? "New position" : "New qualification");
    }
    update();
  });

  ed.addEventListener("change", function (e) {
    var t = e.target;
    if (t.type === "checkbox" && t.getAttribute("data-path")) {
      setPath(t.getAttribute("data-path"), t.checked);
      renderEditor(); update();
    }
    if (t.id === "photoInput" && t.files && t.files[0]) {
      var f = t.files[0];
      if (!/^image\//.test(f.type)) { toast("Choose an image file (JPG, PNG or WebP)."); return; }
      shrinkImage(f, function (url) {
        state.personal.photo = url;
        renderEditor(); update();
        if (state.template !== "ledger") toast("Photo added. Pick the Ledger template to show it.");
      });
    }
  });

  ed.addEventListener("toggle", function (e) {
    var d = e.target;
    if (d.classList && d.classList.contains("sec")) {
      openSections[d.getAttribute("data-sec")] = d.open;
      if (d.getAttribute("data-sec") === "tpl" && d.open) fitThumbs();
    }
  }, true);

  ed.addEventListener("click", function (e) {
    var b = e.target.closest("[data-action]");
    if (!b) return;
    var a = b.getAttribute("data-action"), list = b.getAttribute("data-list"), i = +b.getAttribute("data-i");

    switch (a) {
      case "template":
        state.template = b.getAttribute("data-id");
        renderEditor(); update();
        if (window.innerWidth <= 900) toast(tplName(state.template) + " selected");
        break;
      case "accent":
        state.accent = b.getAttribute("data-c");
        document.getElementById("accentCustom").value = state.accent;
        refreshSwatches(); update();
        break;
      case "add":
        state[list].push(list === "experience" ? blankExp() : blankEdu());
        openSections[list] = true;
        renderEditor(); update();
        var cards = ed.querySelectorAll('[data-sec="' + list + '"] .entry-card');
        var last = cards[cards.length - 1];
        if (last) { last.scrollIntoView({ block: "nearest" }); var inp = last.querySelector("input"); if (inp) inp.focus(); }
        break;
      case "remove":
        state[list].splice(i, 1);
        if (!state[list].length) state[list].push(list === "experience" ? blankExp() : blankEdu());
        renderEditor(); update();
        break;
      case "up":
      case "down":
        var j = a === "up" ? i - 1 : i + 1, arr = state[list];
        if (j < 0 || j >= arr.length) return;
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        renderEditor(); update();
        break;
      case "photo":
        document.getElementById("photoInput").click();
        break;
      case "photo-remove":
        state.personal.photo = "";
        renderEditor(); update();
        break;
      case "ask-blank":
        document.getElementById("blankRow").innerHTML = '<span style="font-weight:600">Clear the whole form?</span>' +
          '<button type="button" class="btn danger" data-action="do-blank">Yes, clear it</button>' +
          '<button type="button" class="btn ghost" data-action="cancel-blank">Cancel</button>';
        break;
      case "cancel-blank":
        renderEditor();
        break;
      case "do-blank":
        state = Object.assign(emptyState(), { template: state.template, accent: state.accent });
        openSections.personal = true;
        renderEditor(); update();
        var first = document.getElementById("f-personal-name");
        if (first) first.focus();
        break;
      case "keep-example":
        state.isExample = false;
        renderEditor(); update();
        break;
    }
  });

  function refreshSwatches() {
    Array.prototype.forEach.call(ed.querySelectorAll(".swatch"), function (s) {
      s.setAttribute("aria-checked", String(s.getAttribute("data-c").toLowerCase() === state.accent.toLowerCase()));
    });
  }

  // Crop to a square and shrink so the photo stays small in storage and exports
  function shrinkImage(file, done) {
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () {
        var size = 360, c = document.createElement("canvas");
        c.width = size; c.height = size;
        var sMin = Math.min(img.width, img.height);
        c.getContext("2d").drawImage(img, (img.width - sMin) / 2, (img.height - sMin) / 2, sMin, sMin, 0, 0, size, size);
        done(c.toDataURL("image/jpeg", 0.88));
      };
      img.onerror = function () { toast("That image couldn't be read. Try a JPG or PNG."); };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }

  /* ---------- Exports ---------- */
  function downloadFile(filename, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type || "application/octet-stream" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast("Downloaded " + filename);
  }

  // PDF: renders the CV to an image per A4 page using html2canvas + jsPDF
  async function buildPdf() {
    if (!window.html2canvas || !window.jspdf) throw new Error("The PDF tools didn't load. Check your internet connection and reload the page.");
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    var host = document.createElement("div");
    host.className = "export-host";
    host.innerHTML = cvHTML(state);
    document.body.appendChild(host);
    try {
      var cv = host.firstChild;
      var breaks = computeBreaks(cv, 1);
      var SCALE = 2;
      var canvas = await window.html2canvas(cv, {
        scale: SCALE, backgroundColor: "#ffffff", useCORS: true, logging: false, width: PAGE_W, windowWidth: PAGE_W
      });
      var pdf = new window.jspdf.jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
      var pw = PAGE_W * SCALE, ph = PAGE_H * SCALE;
      for (var i = 0; i < breaks.length - 1; i++) {
        var y0 = Math.round(breaks[i] * SCALE);
        var y1 = Math.min(Math.round(breaks[i + 1] * SCALE), canvas.height);
        var top = i === 0 ? 0 : MARGIN * SCALE;
        var h = Math.min(y1 - y0, ph - top);
        var page = document.createElement("canvas");
        page.width = pw; page.height = ph;
        var ctx = page.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, pw, ph);
        // Stretch the first and last pixel rows into the margins so sidebars
        // and coloured backgrounds run edge to edge on every page
        if (top > 0) ctx.drawImage(canvas, 0, y0, pw, 1, 0, 0, pw, top);
        ctx.drawImage(canvas, 0, y0, pw, h, 0, top, pw, h);
        var lastRow = Math.min(canvas.height - 1, i === breaks.length - 2 ? canvas.height - 1 : y0 + h - 1);
        if (top + h < ph) ctx.drawImage(canvas, 0, lastRow, pw, 1, 0, top + h, pw, ph - top - h);
        if (i > 0) pdf.addPage();
        pdf.addImage(page.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 210, 297);
      }
      return pdf.output("blob");
    } finally {
      host.remove();
    }
  }

  var pdfBtn = document.getElementById("dlPdf");
  pdfBtn.addEventListener("click", async function () {
    var label = pdfBtn.textContent;
    pdfBtn.disabled = true; pdfBtn.textContent = "Preparing PDF…";
    try {
      downloadFile(slug(state.personal.name) + ".pdf", await buildPdf());
    } catch (err) {
      toast(err && err.message ? err.message : "The PDF couldn't be created.");
    } finally {
      pdfBtn.disabled = false; pdfBtn.textContent = label;
    }
  });

  // Print: the browser's own print dialog gives a PDF with selectable text
  var printHost = document.getElementById("printHost");
  document.getElementById("printPdf").addEventListener("click", function () {
    printHost.innerHTML = cvHTML(state);
    var title = document.title;
    document.title = slug(state.personal.name);   // suggested PDF filename
    window.print();
    document.title = title;
  });
  window.addEventListener("afterprint", function () { printHost.innerHTML = ""; });

  // Read the template CSS so the exported HTML file is self-contained
  async function templateCss() {
    var link = document.getElementById("cv-styles");
    try {
      var rules = link.sheet && link.sheet.cssRules;
      if (rules && rules.length) return Array.prototype.map.call(rules, function (r) { return r.cssText; }).join("\n");
    } catch (e) { /* some browsers block this for file:// pages */ }
    var res = await fetch(link.href);
    if (!res.ok) throw new Error();
    return await res.text();
  }

  document.getElementById("dlHtml").addEventListener("click", async function () {
    var css;
    try { css = await templateCss(); }
    catch (e) { toast("Couldn't read the template styles. Open the app through a web server (see README) and try again."); return; }
    var name = state.personal.name || "CV";
    var doc = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<title>" + esc(name) + " – CV</title>" +
      '<link rel="stylesheet" href="' + document.getElementById("font-link").href + '">' +
      "<style>body{margin:0;background:#e6e8ee;display:flex;justify-content:center;padding:24px 0}" +
      "@page{size:A4;margin:12mm 0}@page :first{margin-top:0}" +
      "@media print{body{background:#fff;padding:0;display:block}.cv{box-shadow:none;min-height:0}}" +
      ".cv{box-shadow:0 8px 30px rgba(0,0,0,.15)}\n" + css + "</style></head><body>" +
      cvHTML(state) + "</body></html>";
    downloadFile(slug(name) + ".html", doc, "text/html");
  });

  // Save / load data as JSON
  document.getElementById("saveJson").addEventListener("click", function () {
    var copy = JSON.parse(JSON.stringify(state));
    delete copy.isExample;
    downloadFile(slug(state.personal.name) + "-data.json", JSON.stringify(copy, null, 2), "application/json");
  });
  var jsonFile = document.getElementById("jsonFile");
  document.getElementById("loadJson").addEventListener("click", function () { jsonFile.value = ""; jsonFile.click(); });
  jsonFile.addEventListener("change", function () {
    var f = jsonFile.files && jsonFile.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = normalise(JSON.parse(r.result));
        if (!d) throw new Error();
        d.isExample = false;
        state = d;
        renderEditor(); update();
        toast("Loaded details from " + f.name);
      } catch (e) {
        toast("That file isn't a Folio data file. Choose a .json saved with Save data.");
      }
    };
    r.readAsText(f);
  });

  /* ---------- Phone view switch ---------- */
  var app = document.getElementById("app");
  function setView(v) {
    app.setAttribute("data-view", v);
    document.getElementById("viewEdit").setAttribute("aria-pressed", String(v === "edit"));
    document.getElementById("viewPreview").setAttribute("aria-pressed", String(v === "preview"));
    requestAnimationFrame(v === "preview" ? layoutPreview : fitThumbs);
  }
  document.getElementById("viewEdit").addEventListener("click", function () { setView("edit"); });
  document.getElementById("viewPreview").addEventListener("click", function () { setView("preview"); });

  /* ---------- Toast ---------- */
  var toastEl = document.getElementById("toast"), toastT = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.hidden = true; }, 3600);
  }

  /* ---------- Boot ---------- */
  renderEditor();
  renderPreview();
  if (window.ResizeObserver) {
    new ResizeObserver(layoutPreview).observe(pane);
    new ResizeObserver(fitThumbs).observe(editorEl);
  } else {
    window.addEventListener("resize", function () { layoutPreview(); fitThumbs(); });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutPreview);
})();
