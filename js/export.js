/* =========================================================
   Folio CV Builder – page breaks and exports
   PDF (html2canvas + jsPDF), print, standalone HTML, JSON.
   Each export returns { filename, blob } for the app to save.
   ========================================================= */
(function () {
  "use strict";

  var PAGE_W = 794, PAGE_H = 1123, MARGIN = 44;   // A4 in CSS px at 96dpi
  var cvHTML = window.CVTemplates.cvHTML, esc = window.CVTemplates.helpers.esc;

  function slug(s) {
    return (String(s || "my").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my") + "-cv";
  }

  /* Page breaks, in unscaled CSS px. Pages after the first get a top margin,
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

  async function pdf(data) {
    if (!window.html2canvas || !window.jspdf) throw new Error("The PDF tools didn't load. Check your internet connection and reload the page.");
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    var host = document.createElement("div");
    host.className = "export-host";
    host.innerHTML = cvHTML(data);
    document.body.appendChild(host);
    try {
      var cv = host.firstChild;
      var breaks = computeBreaks(cv, 1);
      var SCALE = 2;
      var canvas = await window.html2canvas(cv, {
        scale: SCALE, backgroundColor: "#ffffff", useCORS: true, logging: false, width: PAGE_W, windowWidth: PAGE_W
      });
      var doc = new window.jspdf.jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
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
        if (i > 0) doc.addPage();
        doc.addImage(page.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 210, 297);
      }
      return { filename: slug(data.personal.name) + ".pdf", blob: doc.output("blob") };
    } finally {
      host.remove();
    }
  }

  // The browser's print dialog gives a PDF with selectable text
  function print(data) {
    var host = document.getElementById("printHost");
    host.innerHTML = cvHTML(data);
    var title = document.title;
    document.title = slug(data.personal.name);   // suggested PDF filename
    window.print();
    document.title = title;
  }
  window.addEventListener("afterprint", function () {
    var host = document.getElementById("printHost");
    if (host) host.innerHTML = "";
  });

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

  async function html(data) {
    var css;
    try { css = await templateCss(); }
    catch (e) { throw new Error("Couldn't read the template styles. Open the app through a web server (see README) and try again."); }
    var name = data.personal.name || "CV";
    var doc = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<title>" + esc(name) + " – CV</title>" +
      '<link rel="stylesheet" href="' + document.getElementById("font-link").href + '">' +
      "<style>body{margin:0;background:#e6e8ee;display:flex;justify-content:center;padding:24px 0}" +
      "@page{size:A4;margin:12mm 0}@page :first{margin-top:0}" +
      "@media print{body{background:#fff;padding:0;display:block}.cv{box-shadow:none;min-height:296mm}}" +
      ".cv{box-shadow:0 8px 30px rgba(0,0,0,.15)}\n" + css + "</style></head><body>" +
      cvHTML(data) + "</body></html>";
    return { filename: slug(name) + ".html", blob: new Blob([doc], { type: "text/html" }) };
  }

  function json(data, title) {
    var copy = JSON.parse(JSON.stringify(data));
    delete copy.isExample;
    copy.cvName = title || "";
    return {
      filename: slug(data.personal.name) + "-data.json",
      blob: new Blob([JSON.stringify(copy, null, 2)], { type: "application/json" })
    };
  }

  function download(file) {
    var url = URL.createObjectURL(file.blob);
    var a = document.createElement("a");
    a.href = url; a.download = file.filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  window.CVExport = {
    PAGE_W: PAGE_W, PAGE_H: PAGE_H, MARGIN: MARGIN,
    computeBreaks: computeBreaks,
    pdf: pdf, print: print, html: html, json: json, download: download
  };
})();
