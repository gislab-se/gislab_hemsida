(function () {
  "use strict";

  // Choices apply only to this page. No cookies or browser storage are used.
  function mapChoice(setEnabled) {
    var host = document.querySelector("[data-map-privacy]");
    if (!host) return; // Fail closed if the information and controls are missing.
    var show = host.querySelector("[data-map-enable]");
    var hide = host.querySelector("[data-map-disable]");
    var status = host.querySelector("[data-map-status]");
    function choose(enabled) {
      setEnabled(enabled);
      show.disabled = enabled;
      hide.disabled = !enabled;
      status.textContent = enabled ? "Extern bakgrund på" : "Extern bakgrund av";
    }
    show.addEventListener("click", function () { choose(true); });
    hide.addEventListener("click", function () { choose(false); });
    host.hidden = false;
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
