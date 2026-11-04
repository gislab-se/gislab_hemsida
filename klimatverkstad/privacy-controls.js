(function () {
  "use strict";

  // Only Klimatverkstad's map preference is stored; no visitor identifier.
  // Bump the version if the provider, purpose or information changes.
  var storageKey = "gislab:klimatverkstad:map-background";
  var choiceVersion = 1;
  var lifetime = 180 * 24 * 60 * 60 * 1000;

  function mapChoice(setEnabled) {
    var host = document.querySelector("[data-map-privacy]");
    var settings = document.querySelector("[data-map-settings]");
    if (!host || !settings || typeof host.showModal !== "function") return;
    var show = host.querySelector("[data-map-enable]");
    var hide = host.querySelector("[data-map-disable]");
    var close = host.querySelector("[data-map-close]");
    var title = host.querySelector("h2");
    var status = settings.querySelector("[data-map-status]");
    var note = host.querySelector("[data-map-storage-note]");
    if (!show || !hide || !close || !title || !status || !note) return;

    var enabled = false;
    var choice = null;
    try {
      var raw = localStorage.getItem(storageKey);
      var saved = raw ? JSON.parse(raw) : null;
      var now = Date.now();
      if (saved && saved.version === choiceVersion && typeof saved.enabled === "boolean" &&
          Number.isFinite(saved.savedAt) && saved.savedAt <= now &&
          Number.isFinite(saved.expiresAt) && saved.expiresAt > now &&
          saved.expiresAt - saved.savedAt === lifetime) {
        choice = saved;
      } else if (raw !== null) {
        localStorage.removeItem(storageKey);
      }
    } catch (_) {
      // Blocked storage or malformed data must never enable the background.
    }

    function apply(value) {
      enabled = value;
      setEnabled(enabled);
      status.textContent = enabled ? "Bakgrund på" : "Bakgrund av";
      settings.setAttribute("aria-label", "Kartinställningar, " + status.textContent.toLowerCase());
      hide.textContent = enabled ? "Dölj kartbakgrund" : "Fortsätt utan";
    }
    function dismiss() {
      host.close();
      settings.focus({ preventScroll: true });
    }
    function open() {
      host.showModal();
      title.focus({ preventScroll: true });
    }
    function choose(value) {
      var now = Date.now();
      choice = { version: choiceVersion, enabled: value, savedAt: now, expiresAt: now + lifetime };
      try {
        localStorage.setItem(storageKey, JSON.stringify(choice));
        note.textContent = "Vi kommer ihåg ditt val för Klimatverkstad på den här enheten i 180 dagar. Du kan när som helst ändra det via Kartinställningar.";
      } catch (_) {
        // Do not leave an older yes behind if saving a withdrawal fails.
        try { localStorage.removeItem(storageKey); } catch (_) {}
        note.textContent = "Webbläsaren kunde inte spara ditt val. Det gäller tills du lämnar sidan. Du kan ändra det via Kartinställningar.";
      }
      apply(value);
      dismiss();
    }
    show.addEventListener("click", function () { choose(true); });
    hide.addEventListener("click", function () { choose(false); });
    settings.addEventListener("click", open);
    close.addEventListener("click", dismiss);
    host.addEventListener("cancel", function (event) {
      event.preventDefault();
      dismiss();
    });
    settings.hidden = false;
    if (choice) apply(choice.enabled);
    else open();
  }

  window.GISLabPrivacy = {
    bindLeaflet: function (layer, map) {
      mapChoice(function (enabled) {
        if (enabled) layer.addTo(map);
        else map.removeLayer(layer);
      });
    },
    bindMapLibre: function (map, paint) {
      function ready() {
        mapChoice(function (enabled) {
          if (enabled) {
            if (map.getSource("basemap")) return;
            map.addSource("basemap", {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            });
            var before = map.getStyle().layers.find(function (layer) {
              return layer.type !== "background";
            });
            map.addLayer({ id: "basemap", type: "raster", source: "basemap", paint: paint }, before && before.id);
          } else {
            if (map.getLayer("basemap")) map.removeLayer("basemap");
            if (map.getSource("basemap")) map.removeSource("basemap");
            var warning = document.getElementById("tile-warning");
            if (warning) warning.hidden = true;
          }
        });
      }
      if (map.isStyleLoaded()) ready();
      else map.once("load", ready);
    }
  };
})();
