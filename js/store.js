/* =========================================================
   Folio CV Builder – saved CVs
   Keeps every CV the user creates in localStorage:
     { id, title, createdAt, updatedAt, data }
   To move to a real backend later, replace the read/persist
   functions with API calls; the rest of the app only uses
   the CVStore methods below.
   ========================================================= */
(function () {
  "use strict";

  var KEY = "folio-cvs-v1";
  var OLD_DRAFT_KEY = "folio-cv-draft-v1";   // single draft saved by earlier versions
  var cache = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function make(data, title) {
    var now = Date.now();
    return { id: uid(), title: title || "", createdAt: now, updatedAt: now, data: clone(data) };
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); return true; }
    catch (e) { return false; }   // storage full or blocked
  }

  function read() {
    if (cache) return cache;
    try { cache = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { cache = null; }
    if (!Array.isArray(cache)) {
      cache = [];
      // Bring over the single draft from earlier versions of the app
      try {
        var old = JSON.parse(localStorage.getItem(OLD_DRAFT_KEY) || "null");
        if (old && old.personal) {
          old.isExample = false;
          cache.push(make(old, ""));
          if (persist()) localStorage.removeItem(OLD_DRAFT_KEY);
        }
      } catch (e) { /* ignore */ }
    }
    return cache;
  }

  function find(id) {
    var list = read();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  window.CVStore = {
    /** All CVs, most recently edited first. */
    list: function () {
      return read().slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    },
    get: function (id) { return find(id); },

    /** Returns the new record, or null if storage is full. */
    create: function (data, title) {
      var r = make(data, title);
      read().unshift(r);
      if (!persist()) { cache.shift(); return null; }
      return r;
    },

    /** patch: { data?, title? }. Returns false if it couldn't be written to storage. */
    update: function (id, patch) {
      var r = find(id);
      if (!r) return false;
      if ("data" in patch) r.data = clone(patch.data);
      if ("title" in patch) r.title = patch.title;
      r.updatedAt = Date.now();
      return persist();
    },

    remove: function (id) {
      var list = read();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) { list.splice(i, 1); return persist(); }
      }
      return false;
    },

    duplicate: function (id) {
      var r = find(id);
      return r ? this.create(r.data, this.displayTitle(r) + " (copy)") : null;
    },

    /** The name shown for a CV: its own name, else the person's name. */
    displayTitle: function (r) {
      return (r.title || "").trim() || ((r.data && r.data.personal && r.data.personal.name) || "").trim() || "Untitled CV";
    }
  };
})();
