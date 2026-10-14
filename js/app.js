/* =========================================================
   Folio CV Builder – application
   Three screens, switched by the URL hash:
     #/            My CVs (library)
     #/edit/<id>   editor with live preview
     #/view/<id>   read-only view
   Depends on templates.js, store.js and export.js.
   ========================================================= */
(function () {
  "use strict";

  var T = window.CVTemplates, Store = window.CVStore, X = window.CVExport;
  var TEMPLATES = T.list, cvHTML = T.cvHTML;
  var esc = T.helpers.esc, items = T.helpers.items, exps = T.helpers.exps, edus = T.helpers.edus;
  var PAGE_W = X.PAGE_W;
  var SWATCHES = ["#2F49D1", "#0F766E", "#9F1239", "#B45309", "#1F2937", "#6D28D9"];

  /* =====================================================
     CV data
     ===================================================== */
  function blankExp() { return { role: "", company: "", location: "", start: "", end: "", current: false, bullets: "" }; }
  function blankEdu() { return { degree: "", school: "", location: "", start: "", end: "", details: "" }; }

  function emptyData() {
    return {
      template: "meridian", accent: SWATCHES[0],
      personal: { name: "", title: "", email: "", phone: "", location: "", website: "", linkedin: "", photo: "" },
      summary: "", experience: [blankExp()], education: [blankEdu()],
      skills: "", languages: "", certifications: "", isExample: false
    };
  }

  function exampleData() {
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

  // Fill in anything missing so older or imported data always has every field
  function normalise(d) {
    if (!d || typeof d !== "object" || !d.personal) return null;
    var out = Object.assign(emptyData(), d);
    out.personal = Object.assign(emptyData().personal, d.personal || {});
    out.experience = Array.isArray(d.experience) && d.experience.length ? d.experience.map(function (x) { return Object.assign(blankExp(), x); }) : [blankExp()];
    out.education = Array.isArray(d.education) && d.education.length ? d.education.map(function (x) { return Object.assign(blankEdu(), x); }) : [blankEdu()];
    if (!TEMPLATES.some(function (t) { return t.id === out.template; })) out.template = TEMPLATES[0].id;
    if (!/^#[0-9a-f]{6}$/i.test(out.accent)) out.accent = SWATCHES[0];
    ["summary", "skills", "languages", "certifications"].forEach(function (k) { out[k] = String(out[k] || ""); });
    delete out.cvName;
    return out;
  }

  function tplName(id) { return TEMPLATES.filter(function (x) { return x.id === id; })[0].name; }

  /* =====================================================
     Shared UI bits
     ===================================================== */
  var $ = function (id) { return document.getElementById(id); };
  var views = { library: $("libraryView"), editor: $("editorView"), viewer: $("viewerView") };
  function showView(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    closeMenus();
  }

  var toastEl = $("toast"), toastT = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.hidden = true; }, 3600);
  }

  var rtf = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;
  function ago(ts) {
    var s = (ts - Date.now()) / 1000;
    if (Math.abs(s) < 45) return "just now";
    var units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (var i = 0; i < units.length; i++) {
      if (Math.abs(s) >= units[i][1] || units[i][0] === "minute") {
        return rtf ? rtf.format(Math.round(s / units[i][1]), units[i][0]) : new Date(ts).toLocaleDateString();
      }
    }
  }

  // Scale every .thumb's inner page to the thumb's width
  function fitThumbs(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll(".thumb"), function (th) {
      if (th.firstChild && th.clientWidth) th.firstChild.style.transform = "scale(" + th.clientWidth / PAGE_W + ")";
    });
  }

  // Lay out a scaled A4 sheet with page-break markers
  function layoutSheet(pane, wrap, sheet, meta) {
    var s = Math.min(1, (pane.clientWidth - 32) / PAGE_W);
    var cv = sheet.querySelector(".cv");
    if (s <= 0 || !cv) return;
    sheet.style.transform = "scale(" + s + ")";
    Array.prototype.forEach.call(sheet.querySelectorAll(".pb"), function (n) { n.remove(); });
    var breaks = X.computeBreaks(cv, s);
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
    var tid = (cv.className.match(/t-(\w+)/) || [])[1];
    meta.innerHTML = "<span><strong>" + (tid ? tplName(tid) : "") + "</strong> template · A4</span><span>" +
      pages + (pages === 1 ? " page" : " pages") + " · " + Math.round(s * 100) + "% zoom</span>";
  }

  // Confirmation dialog -> Promise<boolean>
  var confirmDlg = $("confirmDialog");
  function confirmBox(title, msg, okLabel) {
    $("confirmTitle").textContent = title;
    $("confirmMsg").textContent = msg;
    $("confirmOk").textContent = okLabel || "Delete";
    confirmDlg.returnValue = "";
    confirmDlg.showModal();
    return new Promise(function (resolve) {
      confirmDlg.addEventListener("close", function onClose() {
        confirmDlg.removeEventListener("close", onClose);
        resolve(confirmDlg.returnValue === "ok");
      });
    });
  }

  function closeMenus(except) {
    Array.prototype.forEach.call(document.querySelectorAll("details.menu[open]"), function (m) { if (m !== except) m.open = false; });
  }
  document.addEventListener("click", function (e) {
    var m = e.target.closest("details.menu");
    closeMenus(m);
  });

  /* =====================================================
     Router
     ===================================================== */
  var current = { id: null, data: null };   // the CV open in the editor or viewer

  function route() {
    flushSave();
    var h = location.hash, m;
    if ((m = h.match(/^#\/edit\/([\w-]+)/))) return openEditor(m[1]);
    if ((m = h.match(/^#\/view\/([\w-]+)/))) return openViewer(m[1]);
    showLibrary();
  }
  window.addEventListener("hashchange", route);

  function go(hash) {
    if (location.hash === hash) route(); else location.hash = hash;
  }

  /* =====================================================
     Library (My CVs)
     ===================================================== */
  var grid = $("cvGrid");
  var ICON = {
    up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10l4-4 4 4"/></svg>',
    down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6l4 4 4-4"/></svg>',
    del: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M10.5 5V3.5A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5H5"/></svg>',
    trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4"/></svg>'
  };

  function showLibrary() {
    current = { id: null, data: null };
    state = null;
    document.title = "Folio CV Builder";
    var list = Store.list();
    $("libCount").textContent = list.length
      ? list.length + (list.length === 1 ? " saved CV" : " saved CVs")
      : "You haven't saved any CVs yet. Create one to get started.";

    var h = '<button type="button" class="new-card" data-act="new"><span class="plus" aria-hidden="true">+</span><b>Create new CV</b><small>Pick a template and start filling in</small></button>';
    list.forEach(function (r) {
      var d = normalise(r.data) || emptyData();
      var title = Store.displayTitle(r);
      h += '<article class="cv-card">' +
        '<a class="thumb-link" href="#/view/' + r.id + '" aria-label="View ' + esc(title) + '"><div class="thumb peek"><div class="thumb-inner">' + cvHTML(d) + "</div></div></a>" +
        '<div class="card-body"><h2 title="' + esc(title) + '">' + esc(title) + "</h2>" +
        '<p class="card-meta">' + tplName(d.template) + " · Edited " + ago(r.updatedAt) + "</p></div>" +
        '<div class="card-acts">' +
        '<a class="btn primary sm" href="#/edit/' + r.id + '">Edit</a>' +
        '<a class="btn sm" href="#/view/' + r.id + '">View</a>' +
        '<span class="spacer"></span>' +
        '<button type="button" class="icon-btn" data-act="dup" data-id="' + r.id + '" aria-label="Duplicate ' + esc(title) + '" title="Duplicate">' + ICON.copy + "</button>" +
        '<button type="button" class="icon-btn danger" data-act="del" data-id="' + r.id + '" aria-label="Delete ' + esc(title) + '" title="Delete">' + ICON.trash + "</button>" +
        "</div></article>";
    });
    grid.innerHTML = h;
    showView("library");
    requestAnimationFrame(function () { fitThumbs(grid); });
  }

  async function deleteCv(id, after) {
    var r = Store.get(id);
    if (!r) return;
    var ok = await confirmBox("Delete “" + Store.displayTitle(r) + "”?", "This removes the CV from this browser. It can't be undone.", "Delete CV");
    if (!ok) return;
    if (Store.remove(id)) { toast("Deleted " + Store.displayTitle(r)); after && after(); }
    else toast("Couldn't delete the CV. Your browser storage may be blocked.");
  }

  function duplicateCv(id) {
    var copy = Store.duplicate(id);
    if (!copy) { toast("Your browser storage is full. Delete a CV or remove photos, then try again."); return null; }
    toast("Created " + Store.displayTitle(copy));
    return copy;
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
    if (act === "new") openNewDialog();
    else if (act === "dup") { if (duplicateCv(id)) showLibrary(); }
    else if (act === "del") deleteCv(id, showLibrary);
    else if (act === "dup-current" && current.id) { var c = duplicateCv(current.id); if (c) go("#/edit/" + c.id); }
    else if (act === "delete-current" && current.id) deleteCv(current.id, function () { go("#/"); });
    else if (act === "close-dialog") $("newDialog").close();
  });

  /* ---------- Create new ---------- */
  var newDlg = $("newDialog"), newTpl = TEMPLATES[0].id;

  function openNewDialog() {
    $("newName").value = "";
    var latest = Store.list()[0];
    $("copyChoice").hidden = !latest;
    if (latest) $("copyChoiceName").textContent = Store.displayTitle(latest);
    newForm.querySelector('input[value="blank"]').checked = true;
    renderNewTpls();
    newDlg.showModal();
    requestAnimationFrame(function () { fitThumbs(newDlg); });
  }

  function renderNewTpls() {
    var sample = exampleData(), h = "";
    TEMPLATES.forEach(function (tp) {
      sample.template = tp.id;
      h += '<button type="button" class="tpl" role="radio" aria-checked="' + (newTpl === tp.id) + '" data-newtpl="' + tp.id + '">' +
        '<div class="thumb"><div class="thumb-inner">' + cvHTML(sample) + "</div></div>" +
        '<span class="name">' + tp.name + '</span><span class="desc">' + tp.desc + "</span></button>";
    });
    $("newTpls").innerHTML = h;
  }

  $("newTpls").addEventListener("click", function (e) {
    var b = e.target.closest("[data-newtpl]");
    if (!b) return;
    newTpl = b.getAttribute("data-newtpl");
    Array.prototype.forEach.call(this.querySelectorAll("[data-newtpl]"), function (x) {
      x.setAttribute("aria-checked", String(x === b));
    });
  });

  var newForm = $("newForm");
  newForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var start = newForm.querySelector('input[name="newStart"]:checked').value;
    var data;
    if (start === "example") data = exampleData();
    else if (start === "copy" && Store.list()[0]) { data = normalise(Store.list()[0].data); data.isExample = false; }
    else data = emptyData();
    data.template = newTpl;
    var r = Store.create(data, $("newName").value.trim());
    if (!r) { toast("Your browser storage is full. Delete a CV or remove photos, then try again."); return; }
    newDlg.close();
    openSections = { tpl: false, personal: true, summary: false, experience: false, education: false, skills: false };
    go("#/edit/" + r.id);
  });

  /* ---------- Import a data file ---------- */
  var jsonFile = $("jsonFile");
  $("importJson").addEventListener("click", function () { jsonFile.value = ""; jsonFile.click(); });
  jsonFile.addEventListener("change", function () {
    var f = jsonFile.files && jsonFile.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var raw, d;
      try { raw = JSON.parse(reader.result); d = normalise(raw); } catch (e) { d = null; }
      if (!d) { toast("That file isn't a Folio data file. Choose a .json saved with Download → Data file."); return; }
      d.isExample = false;
      var r = Store.create(d, (raw && raw.cvName) || "");
      if (!r) { toast("Your browser storage is full. Delete a CV or remove photos, then try again."); return; }
      toast("Imported " + Store.displayTitle(r));
      go("#/edit/" + r.id);
    };
    reader.readAsText(f);
  });

  /* =====================================================
     Viewer
     ===================================================== */
  var vPane = $("viewerPane"), vWrap = $("viewerWrap"), vSheet = $("viewerSheet"), vMeta = $("viewerMeta");

  function openViewer(id) {
    var r = Store.get(id);
    if (!r) { toast("That CV no longer exists."); return go("#/"); }
    current = { id: id, data: normalise(r.data) || emptyData() };
    $("viewerTitle").textContent = Store.displayTitle(r);
    $("viewerEdit").href = "#/edit/" + id;
    document.title = Store.displayTitle(r) + " · Folio";
    vSheet.innerHTML = cvHTML(current.data);
    showView("viewer");
    requestAnimationFrame(function () { layoutSheet(vPane, vWrap, vSheet, vMeta); });
  }

  /* =====================================================
     Editor
     ===================================================== */
  var ed = $("editorInner"), editorEl = $("editor");
  var pane = $("previewPane"), wrap = $("sheetWrap"), sheet = $("sheet"), meta = $("previewMeta");
  var titleInput = $("cvTitle"), statusEl = $("saveStatus");
  var openSections = { tpl: true, personal: true, summary: false, experience: false, education: false, skills: false };
  var state = null;   // the data being edited (same object as current.data)

  function openEditor(id) {
    var r = Store.get(id);
    if (!r) { toast("That CV no longer exists."); return go("#/"); }
    current = { id: id, data: normalise(r.data) || emptyData() };
    state = current.data;
    titleInput.value = r.title || "";
    titleInput.placeholder = state.personal.name || "Untitled CV";
    document.title = Store.displayTitle(r) + " · Folio";
    setStatus("Saved");
    editorEl.scrollTop = 0;
    showView("editor");
    setView("edit");
    renderEditor();
    renderPreview();
  }

  /* ---------- Saving ---------- */
  var saveTimer = null, dirty = { data: false, title: false };

  function setStatus(s) { statusEl.textContent = s; statusEl.classList.toggle("warn", /^Not saved/.test(s)); }

  function scheduleSave(kind) {
    dirty[kind] = true;
    setStatus("Saving…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 500);
  }

  function flushSave() {
    clearTimeout(saveTimer);
    if (!current.id || (!dirty.data && !dirty.title)) return true;
    var patch = {};
    if (dirty.data) patch.data = state;
    if (dirty.title) patch.title = titleInput.value.trim();
    var ok = Store.update(current.id, patch);
    if (ok) { dirty = { data: false, title: false }; setStatus("Saved"); }
    else setStatus("Not saved – storage full");
    return ok;
  }
  window.addEventListener("beforeunload", flushSave);
  window.addEventListener("pagehide", flushSave);

  $("saveBtn").addEventListener("click", function () {
    dirty.data = true; dirty.title = true;
    if (flushSave()) toast("Saved to My CVs");
    else toast("Your browser storage is full. Delete a CV or remove the photo, then save again.");
  });

  titleInput.addEventListener("input", function () { scheduleSave("title"); });

  function update() {
    scheduleSave("data");
    titleInput.placeholder = state.personal.name || "Untitled CV";
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(renderPreview);
    scheduleThumbs();
  }
  var raf = 0;

  /* ---------- Form ---------- */
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
      h += '<div class="notice"><p>This CV starts with <b>example content</b> so you can see how it looks. Replace it with your own details, or clear the form.</p>' +
        '<div class="row" id="blankRow"><button type="button" class="btn" data-action="ask-blank">Clear form</button>' +
        '<button type="button" class="btn ghost" data-action="keep-example">Hide this note</button></div></div>';
    }

    // 1. Template
    var t = '<div class="tpls" role="radiogroup" aria-label="Template">';
    TEMPLATES.forEach(function (tp) {
      t += '<button type="button" class="tpl" role="radio" aria-checked="' + (d.template === tp.id) + '" data-action="template" data-id="' + tp.id + '">' +
        '<div class="thumb"><div class="thumb-inner" data-thumb="' + tp.id + '"></div></div>' +
        '<span class="name">' + tp.name + '</span><span class="desc">' + tp.desc + "</span></button>";
    });
    t += "</div>";
    t += '<div class="field"><span class="label">Accent colour</span><div class="swatches" role="radiogroup" aria-label="Accent colour">';
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

  function renderThumbs() {
    Array.prototype.forEach.call(ed.querySelectorAll("[data-thumb]"), function (el) {
      el.innerHTML = cvHTML(state, el.getAttribute("data-thumb"));
    });
    fitThumbs(ed);
  }
  var thumbTimer = null;
  function scheduleThumbs() { clearTimeout(thumbTimer); thumbTimer = setTimeout(renderThumbs, 350); }

  function renderPreview() {
    sheet.innerHTML = cvHTML(state);
    layoutSheet(pane, wrap, sheet, meta);
  }

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
      if (d.getAttribute("data-sec") === "tpl" && d.open) fitThumbs(ed);
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
        $("accentCustom").value = state.accent;
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
        $("photoInput").click();
        break;
      case "photo-remove":
        state.personal.photo = "";
        renderEditor(); update();
        break;
      case "ask-blank":
        $("blankRow").innerHTML = '<span style="font-weight:600">Clear the whole form?</span>' +
          '<button type="button" class="btn danger" data-action="do-blank">Yes, clear it</button>' +
          '<button type="button" class="btn ghost" data-action="cancel-blank">Cancel</button>';
        break;
      case "cancel-blank":
        renderEditor();
        break;
      case "do-blank":
        var keep = { template: state.template, accent: state.accent };
        Object.keys(state).forEach(function (k) { delete state[k]; });
        Object.assign(state, emptyData(), keep);
        openSections.personal = true;
        renderEditor(); update();
        var first = $("f-personal-name");
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

  /* ---------- Phone view switch ---------- */
  function setView(v) {
    views.editor.setAttribute("data-view", v);
    $("viewEdit").setAttribute("aria-pressed", String(v === "edit"));
    $("viewPreview").setAttribute("aria-pressed", String(v === "preview"));
    requestAnimationFrame(function () {
      if (v === "preview") layoutSheet(pane, wrap, sheet, meta); else fitThumbs(ed);
    });
  }
  $("viewEdit").addEventListener("click", function () { setView("edit"); });
  $("viewPreview").addEventListener("click", function () { setView("preview"); });

  /* =====================================================
     Downloads (editor and viewer)
     ===================================================== */
  document.addEventListener("click", async function (e) {
    var b = e.target.closest("[data-export]");
    if (!b || !current.data) return;
    closeMenus();
    var kind = b.getAttribute("data-export");
    var r = Store.get(current.id);
    try {
      if (kind === "print") { X.print(current.data); return; }
      if (kind === "pdf") toast("Preparing PDF…");
      var file = kind === "pdf" ? await X.pdf(current.data)
        : kind === "html" ? await X.html(current.data)
        : X.json(current.data, r ? r.title : "");
      X.download(file);
      toast("Downloaded " + file.filename);
    } catch (err) {
      toast(err && err.message ? err.message : "The file couldn't be created.");
    }
  });

  /* =====================================================
     Boot
     ===================================================== */
  if (window.ResizeObserver) {
    new ResizeObserver(function () { if (!views.editor.hidden && state) layoutSheet(pane, wrap, sheet, meta); }).observe(pane);
    new ResizeObserver(function () { fitThumbs(ed); }).observe(editorEl);
    new ResizeObserver(function () { if (!views.viewer.hidden) layoutSheet(vPane, vWrap, vSheet, vMeta); }).observe(vPane);
    new ResizeObserver(function () { if (!views.library.hidden) fitThumbs(grid); }).observe(grid);
  } else {
    window.addEventListener("resize", function () { route(); });
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      if (!views.editor.hidden && state) layoutSheet(pane, wrap, sheet, meta);
      if (!views.viewer.hidden) layoutSheet(vPane, vWrap, vSheet, vMeta);
    });
  }

  // First visit: give people one example CV to explore
  try {
    if (!localStorage.getItem("folio-seeded") && !Store.list().length) {
      var ex = exampleData();
      Store.create(ex, "Example CV");
      localStorage.setItem("folio-seeded", "1");
    }
  } catch (e) { /* storage blocked – the app still works for this visit */ }

  route();
})();
