(function () {
  "use strict";

  // Shared by the published maps and their source distributions.
  // Increase informationVersion when the purpose, recipients or disclosure changes.
  var informationVersion = 1;
  var lifetime = 180 * 24 * 60 * 60 * 1000;
  var providers = {
    osm: { name: "OpenStreetMap Foundation", hosts: "tile.openstreetmap.org" },
    esri: { name: "Esri", hosts: "server.arcgisonline.com och clarity.maptiles.arcgis.com" }
  };

  function mapChoice(options, applyBackground) {
    var tool = document.body.dataset.mapTool;
    var name = document.body.dataset.mapName;
    if (!tool || !name || !options.length || document.querySelector("[data-map-privacy]")) return;
    var host = document.createElement("dialog");
    if (typeof host.showModal !== "function") return; // Fail closed.
    host.id = "map-privacy-dialog";
    host.className = "map-consent";
    host.setAttribute("data-map-privacy", "");
    host.setAttribute("aria-labelledby", "map-privacy-title");
    host.setAttribute("aria-describedby", "map-privacy-intro");
    host.innerHTML = '<button class="map-consent-close" type="button" data-map-close aria-label="Stäng utan att ändra kartbakgrunden">×</button>' +
      '<p class="map-consent-eyebrow"></p><h2 id="map-privacy-title" tabindex="-1" autofocus>Vill du visa kartbakgrunden?</h2>' +
      '<p id="map-privacy-intro" class="map-consent-intro">Med en karta eller satellitbild som bakgrund blir det lättare att hitta.</p>' +
      '<div data-map-selector><label for="map-background-choice">Välj kartbakgrund</label><select id="map-background-choice" data-map-background></select></div>' +
      '<div class="map-consent-info"><h3>Det här delas när bakgrunden visas</h3><p data-map-provider></p></div>' +
      '<p>Du kan använda kartans övriga innehåll även utan bakgrund.</p>' +
      '<div class="map-consent-actions"><button type="button" data-map-enable>Visa kartbakgrund</button><button type="button" data-map-disable>Fortsätt utan</button></div>' +
      '<p class="map-consent-note" data-map-storage-note></p><p class="map-consent-link"><a href="/integritet/#kartor">Om kartor och personuppgifter</a></p>';
    var toolbar = document.createElement("div");
    toolbar.className = "map-consent-toolbar";
    toolbar.innerHTML = '<button class="map-background-settings" type="button" data-map-settings aria-haspopup="dialog" aria-controls="map-privacy-dialog">Kartinställningar <span data-map-status>Bakgrund av</span></button>' +
      '<a href="/integritet/">Integritet och kakor</a><span class="map-storage-status" role="status" data-map-storage-status></span>';
    // Put Agroforestry's controls in document flow, above the map on small screens.
    var header = tool === "agroforestry" && document.querySelector("header");
    if (header) header.insertAdjacentElement("afterend", toolbar);
    else document.body.appendChild(toolbar);
    document.body.appendChild(host);
    // Keep both choices visible while the explanation scrolls on small screens.
    var content = document.createElement("div");
    content.className = "map-consent-content";
    var actions = host.querySelector(".map-consent-actions");
    Array.from(host.children).forEach(function (element) {
      if (element !== actions && !element.matches(".map-consent-close, .map-consent-eyebrow, h2")) content.appendChild(element);
    });
    host.appendChild(content);
    host.appendChild(actions);
    document.querySelectorAll(".privacy-shortcut").forEach(function (link) { link.remove(); });
    host.querySelector(".map-consent-eyebrow").textContent = "Välkommen till " + name;
    var select = host.querySelector("[data-map-background]");
    options.forEach(function (option) {
      var element = document.createElement("option");
      element.value = option.id;
      element.textContent = option.label;
      select.appendChild(element);
    });
    host.querySelector("[data-map-selector]").hidden = options.length === 1;
    var settings = toolbar.querySelector("button");
    var status = toolbar.querySelector("[data-map-status]");
    var note = host.querySelector("[data-map-storage-note]");
    var storageStatus = toolbar.querySelector("[data-map-storage-status]");
    var storageKey = "gislab:" + tool + ":map-background";
    var choice = null;
    var enabled = false;
    var storageBlocked = false;
    function optionFor(id) { return options.find(function (item) { return item.id === id; }); }
    function valid(saved) {
      var now = Date.now();
      var option = saved && optionFor(saved.background);
      return option && providers[option.provider] && saved.version === informationVersion &&
        saved.tool === tool && Array.isArray(saved.providers) && saved.providers.length === 1 &&
        saved.providers[0] === option.provider && typeof saved.enabled === "boolean" &&
        Number.isSafeInteger(saved.savedAt) && saved.savedAt > 0 && saved.savedAt <= now &&
        Number.isSafeInteger(saved.expiresAt) && saved.expiresAt > now &&
        saved.expiresAt - saved.savedAt === lifetime;
    }
    try {
      var raw = localStorage.getItem(storageKey);
      var saved;
      try { saved = JSON.parse(raw); } catch (_) { saved = null; }
      if (valid(saved)) choice = saved;
      else if (raw !== null) localStorage.removeItem(storageKey);
    } catch (_) { storageBlocked = true; }

    function describe() {
      var provider = providers[optionFor(select.value).provider];
      host.querySelector("[data-map-provider]").textContent = "Kartbilderna hämtas från " + provider.name +
        ". Då skickas din IP-adress, webbläsarinformation, webbplatsens ursprung och det visade kartutsnittet dit. Din egen plats hämtas inte automatiskt.";
      note.textContent = storageBlocked ? "Webbläsaren kan inte spara ditt val. Det gäller under det här besöket. Du kan ändra det via Kartinställningar." :
        "Ditt ja eller nej sparas på enheten i 180 dagar, bara för " + name +
        " och " + provider.name + ". Du kan ändra eller återkalla valet via Kartinställningar.";
    }
    function apply(value) {
      enabled = value;
      applyBackground(value ? choice.background : null);
      status.textContent = enabled ? "Bakgrund på" : "Bakgrund av";
      settings.setAttribute("aria-label", "Kartinställningar, " + status.textContent.toLowerCase());
    }
    function open(background) {
      select.value = background || (choice && choice.background) || options[0].id;
      describe();
      if (!host.open) host.showModal();
      host.querySelector("h2").focus({ preventScroll: true });
    }
    function dismiss() {
      host.close();
      settings.focus({ preventScroll: true });
    }
    function choose(value) {
      var now = Date.now();
      choice = { version: informationVersion, tool: tool, providers: [optionFor(select.value).provider],
        background: select.value, enabled: value, savedAt: now, expiresAt: now + lifetime };
      try {
        localStorage.setItem(storageKey, JSON.stringify(choice));
        storageBlocked = false;
      } catch (_) {
        storageBlocked = true;
        // A failed write must not leave an older yes behind if removal is possible.
        try { localStorage.removeItem(storageKey); } catch (_) {}
      }
      storageStatus.textContent = storageBlocked ? "Valet gäller bara under detta besök." : "";
      apply(value);
      dismiss();
    }
    select.addEventListener("change", describe); // Merely selecting a provider sends nothing.
    settings.addEventListener("click", function () { open(); });
    host.querySelector("[data-map-enable]").addEventListener("click", function () { choose(true); });
    host.querySelector("[data-map-disable]").addEventListener("click", function () { choose(false); });
    host.querySelector("[data-map-close]").addEventListener("click", dismiss);
    host.addEventListener("cancel", function (event) { event.preventDefault(); dismiss(); });
    // Do not trigger the map's global keyboard shortcuts while its modal is open.
    host.addEventListener("keydown", function (event) {
      event.stopPropagation();
      if (event.key !== "Tab") return;
      var targets = Array.from(host.querySelectorAll("button, select, a[href]")).filter(function (element) {
        return !element.disabled && element.getClientRects().length;
      });
      var first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === host.querySelector("h2"))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
    if (choice) apply(choice.enabled);
    else { apply(false); open(); }
    return {
      request: function (background) {
        if (!background || background === "none") {
          select.value = (choice && choice.background) || options[0].id;
          choose(false);
        } else if (optionFor(background)) open(background);
      }
    };
  }

  window.GISLabPrivacy = {
    bindLeafletChoices: function (map, select, applyBackground) {
      var current = "none";
      var providerFor = { osm: "osm", imagery: "esri", clarity: "esri", topo: "esri", streets: "esri", gray: "esri" };
      var options = Array.from(select.options).filter(function (option) { return Object.hasOwn(providerFor, option.value); }).map(function (option) {
        return { id: option.value, label: option.textContent, provider: providerFor[option.value] };
      });
      var control = mapChoice(options, function (id) {
        current = id || "none";
        select.value = current;
        applyBackground(id);
      });
      select.addEventListener("change", function () {
        var requested = select.value;
        select.value = current; // Keep the committed selection on cancel/Escape.
        if (control) control.request(requested);
      });
    },
    bindMapLibre: function (map, paint) {
      function ready() {
        mapChoice([{ id: "osm", label: "OpenStreetMap", provider: "osm" }], function (background) {
          if (background) {
            if (map.getSource("basemap")) return;
            map.addSource("basemap", { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
            var before = map.getStyle().layers.find(function (layer) { return layer.type !== "background"; });
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
