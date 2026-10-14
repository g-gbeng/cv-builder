/* =========================================================
   Folio CV Builder – templates
   Each template is a function that takes the CV data and
   returns HTML. To add a template:
     1. add an entry to TEMPLATES
     2. add a render function with the same id
     3. add its styles to css/templates.css under .t-<id>
   ========================================================= */
(function () {
  "use strict";

  var TEMPLATES = [
    { id: "meridian", name: "Meridian", desc: "Classic serif, centred header" },
    { id: "ledger",   name: "Ledger",   desc: "Colour sidebar with photo" },
    { id: "signal",   name: "Signal",   desc: "Bold modern, date gutter" },
    { id: "plain",    name: "Plain",    desc: "Simple, ATS-friendly" }
  ];

  /* ---------- Helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Text area -> list of lines, stripping any bullet characters people type
  function lines(s) {
    return String(s || "").split("\n")
      .map(function (l) { return l.replace(/^\s*[-•*·]\s*/, "").trim(); })
      .filter(Boolean);
  }
  // Comma or newline separated -> list
  function items(s) {
    return String(s || "").split(/[,\n]/).map(function (t) { return t.trim(); }).filter(Boolean);
  }
  function dates(a, b, current) { return [a, current ? "Present" : b].filter(Boolean).join(" – "); }
  function ul(arr) {
    return arr.length ? "<ul>" + arr.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" : "";
  }
  function initials(name) {
    return String(name || "").trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
  }
  function contacts(p) {
    return [["Email", p.email], ["Phone", p.phone], ["Location", p.location], ["Website", p.website], ["LinkedIn", p.linkedin]]
      .filter(function (c) { return String(c[1] || "").trim(); });
  }
  function exps(d) { return d.experience.filter(function (x) { return x.role || x.company || x.bullets; }); }
  function edus(d) { return d.education.filter(function (x) { return x.degree || x.school; }); }
  function join2(a, b, sep) { return [a, b].filter(Boolean).map(esc).join(sep); }

  /* ---------- Render functions ---------- */
  var render = {
    meridian: function (d) {
      var p = d.personal, h = "";
      h += '<header class="keep"><h1>' + esc(p.name || "Your Name") + "</h1>";
      if (p.title) h += '<p class="role">' + esc(p.title) + "</p>";
      var c = contacts(p);
      if (c.length) h += '<p class="contact">' + c.map(function (x) { return "<span>" + esc(x[1]) + "</span>"; }).join("") + "</p>";
      h += "</header>";

      if (d.summary.trim()) h += '<section><h2>Profile</h2><p class="keep">' + esc(d.summary) + "</p></section>";

      var E = exps(d);
      if (E.length) {
        h += "<section><h2>Experience</h2>";
        E.forEach(function (x) {
          h += '<div class="entry keep"><div class="row"><b>' + esc(x.role) + '</b><span class="when">' + esc(dates(x.start, x.end, x.current)) + "</span></div>";
          h += '<div class="sub">' + join2(x.company, x.location, ", ") + "</div>" + ul(lines(x.bullets)) + "</div>";
        });
        h += "</section>";
      }

      var Ed = edus(d);
      if (Ed.length) {
        h += "<section><h2>Education</h2>";
        Ed.forEach(function (x) {
          h += '<div class="entry keep"><div class="row"><b>' + esc(x.degree) + '</b><span class="when">' + esc(dates(x.start, x.end)) + "</span></div>";
          h += '<div class="sub">' + join2(x.school, x.location, ", ") + "</div>" + (x.details ? "<p>" + esc(x.details) + "</p>" : "") + "</div>";
        });
        h += "</section>";
      }

      var S = items(d.skills);
      if (S.length) h += '<section class="keep"><h2>Skills</h2><ul class="skills">' + S.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></section>";
      var L = items(d.languages);
      if (L.length) h += '<section class="keep"><h2>Languages</h2><p class="inline-list">' + L.map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("") + "</p></section>";
      var C = lines(d.certifications);
      if (C.length) h += '<section class="keep"><h2>Certifications</h2>' + ul(C) + "</section>";
      return h;
    },

    ledger: function (d) {
      var p = d.personal, a = "", m = "";
      var photo = p.photo ? ' style="background-image:url(' + esc(p.photo) + ')"' : "";
      a += '<div class="avatar"' + photo + ">" + (p.photo ? "" : esc(initials(p.name) || "CV")) + "</div>";
      var c = contacts(p);
      if (c.length) a += "<div><h2>Contact</h2>" + c.map(function (x) { return '<div class="ci"><small>' + x[0] + "</small><span>" + esc(x[1]) + "</span></div>"; }).join("") + "</div>";
      var S = items(d.skills);
      if (S.length) a += "<div><h2>Skills</h2><ul>" + S.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></div>";
      var L = items(d.languages);
      if (L.length) a += "<div><h2>Languages</h2><ul>" + L.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></div>";
      var C = lines(d.certifications);
      if (C.length) a += "<div><h2>Certifications</h2><ul>" + C.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></div>";

      m += '<div class="keep"><h1>' + esc(p.name || "Your Name") + "</h1>" + (p.title ? '<p class="role">' + esc(p.title) + "</p>" : "") + "</div>";
      if (d.summary.trim()) m += '<section><h2>Profile</h2><p class="keep">' + esc(d.summary) + "</p></section>";
      var E = exps(d);
      if (E.length) {
        m += "<section><h2>Experience</h2>";
        E.forEach(function (x) {
          m += '<div class="entry keep"><b>' + esc(x.role) + '</b><div class="meta"><span>' + join2(x.company, x.location, " · ") +
            '</span><span class="when">' + esc(dates(x.start, x.end, x.current)) + "</span></div>" + ul(lines(x.bullets)) + "</div>";
        });
        m += "</section>";
      }
      var Ed = edus(d);
      if (Ed.length) {
        m += "<section><h2>Education</h2>";
        Ed.forEach(function (x) {
          m += '<div class="entry keep"><b>' + esc(x.degree) + '</b><div class="meta"><span>' + join2(x.school, x.location, " · ") +
            '</span><span class="when">' + esc(dates(x.start, x.end)) + "</span></div>" + (x.details ? "<p>" + esc(x.details) + "</p>" : "") + "</div>";
        });
        m += "</section>";
      }
      return "<aside>" + a + "</aside><main>" + m + "</main>";
    },

    signal: function (d) {
      var p = d.personal, h = "";
      var c = contacts(p);
      h += '<header class="keep"><div><h1>' + esc(p.name || "Your Name") + "</h1>" + (p.title ? '<p class="role">' + esc(p.title) + "</p>" : "") + "</div>";
      h += '<div class="contact">' + c.map(function (x) { return "<span>" + esc(x[1]) + "</span>"; }).join("") + "</div></header>";
      if (d.summary.trim()) h += '<section class="keep"><h2>Profile</h2><p>' + esc(d.summary) + "</p></section>";
      var E = exps(d);
      if (E.length) {
        h += "<section><h2>Experience</h2><div>";
        E.forEach(function (x) {
          h += '<div class="entry keep"><div><b>' + esc(x.role) + '</b><div class="org">' + join2(x.company, x.location, ", ") +
            '</div></div><span class="when">' + esc(dates(x.start, x.end, x.current)) + "</span>" + ul(lines(x.bullets)) + "</div>";
        });
        h += "</div></section>";
      }
      var Ed = edus(d);
      if (Ed.length) {
        h += "<section><h2>Education</h2><div>";
        Ed.forEach(function (x) {
          h += '<div class="entry keep"><div><b>' + esc(x.degree) + '</b><div class="org">' + join2(x.school, x.location, ", ") +
            '</div></div><span class="when">' + esc(dates(x.start, x.end)) + "</span>" + (x.details ? '<p class="d">' + esc(x.details) + "</p>" : "") + "</div>";
        });
        h += "</div></section>";
      }
      var S = items(d.skills);
      if (S.length) h += '<section class="keep"><h2>Skills</h2><div class="chips">' + S.map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("") + "</div></section>";
      var L = items(d.languages);
      if (L.length) h += '<section class="keep"><h2>Languages</h2><p>' + L.map(esc).join(", ") + "</p></section>";
      var C = lines(d.certifications);
      if (C.length) h += '<section class="keep"><h2>Certifications</h2><div>' + ul(C) + "</div></section>";
      return h;
    },

    plain: function (d) {
      var p = d.personal, h = "";
      var c = contacts(p);
      h += '<header class="keep"><h1>' + esc(p.name || "Your Name") + "</h1>" + (p.title ? '<p class="role">' + esc(p.title) + "</p>" : "");
      if (c.length) h += '<p class="contact">' + c.map(function (x) { return "<span>" + esc(x[1]) + "</span>"; }).join("") + "</p>";
      h += "</header>";
      if (d.summary.trim()) h += '<section><h2>Summary</h2><p class="keep">' + esc(d.summary) + "</p></section>";
      var E = exps(d);
      if (E.length) {
        h += "<section><h2>Work Experience</h2>";
        E.forEach(function (x) {
          h += '<div class="entry keep"><div class="row"><span><b>' + esc(x.role) + "</b>" + (x.company ? ", " + esc(x.company) : "") +
            (x.location ? ", " + esc(x.location) : "") + '</span><span class="when">' + esc(dates(x.start, x.end, x.current)) + "</span></div>" + ul(lines(x.bullets)) + "</div>";
        });
        h += "</section>";
      }
      var Ed = edus(d);
      if (Ed.length) {
        h += "<section><h2>Education</h2>";
        Ed.forEach(function (x) {
          h += '<div class="entry keep"><div class="row"><span><b>' + esc(x.degree) + "</b>" + (x.school ? ", " + esc(x.school) : "") +
            (x.location ? ", " + esc(x.location) : "") + '</span><span class="when">' + esc(dates(x.start, x.end)) + "</span></div>" +
            (x.details ? "<p>" + esc(x.details) + "</p>" : "") + "</div>";
        });
        h += "</section>";
      }
      var S = items(d.skills);
      if (S.length) h += '<section class="keep"><h2>Skills</h2><p>' + S.map(esc).join(", ") + "</p></section>";
      var L = items(d.languages);
      if (L.length) h += '<section class="keep"><h2>Languages</h2><p>' + L.map(esc).join(", ") + "</p></section>";
      var C = lines(d.certifications);
      if (C.length) h += '<section class="keep"><h2>Certifications</h2>' + ul(C) + "</section>";
      return h;
    }
  };

  /** Build the full CV markup for data `d`, optionally forcing a template id. */
  function cvHTML(d, tplId) {
    var id = tplId || d.template;
    if (!render[id]) id = TEMPLATES[0].id;
    return '<div class="cv t-' + id + '" style="--cv-accent:' + esc(d.accent) + '">' + render[id](d) + "</div>";
  }

  window.CVTemplates = {
    list: TEMPLATES,
    cvHTML: cvHTML,
    helpers: { esc: esc, lines: lines, items: items, exps: exps, edus: edus }
  };
})();
