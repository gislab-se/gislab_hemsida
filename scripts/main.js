(function () {
  "use strict";

  var lang = ((document.body && document.body.dataset.lang) || document.documentElement.lang || "sv")
    .toLowerCase()
    .indexOf("sv") === 0 ? "sv" : "en";

  var labels = {
    sendEmail: {
      sv: "Skicka e-post",
      en: "Send email"
    }
  };

  var emailLinks = Array.prototype.slice.call(document.querySelectorAll("[data-email-link]"));
  var obfuscatedEmails = Array.prototype.slice.call(document.querySelectorAll("[data-email-obfuscated]"));

  function t(key) {
    return labels[key] && labels[key][lang] ? labels[key][lang] : "";
  }

  function formatObfuscatedAddress(user, domain) {
    return user + " [at] " + domain.replace(/\./g, " [dot] ");
  }

  function setupEmail() {
    if (emailLinks.length === 0 && obfuscatedEmails.length === 0) {
      return;
    }

    var source = emailLinks[0];
    var dataset = source ? source.dataset : {};
    var user = (dataset.user || "").trim();
    var domain = (dataset.domain || "").trim();

    if (!user || !domain) {
      return;
    }

    var address = user + "@" + domain;
    var subject = lang === "sv"
      ? (dataset.subjectSv || "Kontakt via gislab.se")
      : (dataset.subjectEn || "Contact via gislab.se");

    emailLinks.forEach(function (emailLink) {
      var label = emailLink.textContent.trim() || t("sendEmail");
      emailLink.href = "mailto:" + address + "?subject=" + encodeURIComponent(subject);
      emailLink.textContent = label;
      emailLink.setAttribute("rel", "nofollow");
      emailLink.setAttribute("aria-label", label + ": " + address);
    });

    obfuscatedEmails.forEach(function (obfuscatedEmail) {
      obfuscatedEmail.textContent = formatObfuscatedAddress(user, domain);
    });
  }

  function setupMagneticCards() {
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-magnetic-card]"));
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var frame = null;
    var pointer = null;
    var activationRadius = 150;

    if (cards.length === 0 || reduceMotion || !finePointer) {
      return;
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function setCardMotion(card, rect, x, y, strength) {
      var localX = x - rect.left;
      var localY = y - rect.top;
      var centerX = localX - rect.width / 2;
      var centerY = localY - rect.height / 2;
      var normalizedX = clamp(centerX / (rect.width / 2), -1, 1);
      var normalizedY = clamp(centerY / (rect.height / 2), -1, 1);
      var pullX = normalizedX * 8 * strength;
      var pullY = normalizedY * 8 * strength;
      var tiltX = normalizedY * -4 * strength;
      var tiltY = normalizedX * 4.5 * strength;
      var thumbX = normalizedX * -5 * strength;
      var thumbY = normalizedY * -4 * strength;

      card.classList.add("is-magnetic");
      card.style.setProperty("--magnetic-x", pullX.toFixed(2) + "px");
      card.style.setProperty("--magnetic-y", pullY.toFixed(2) + "px");
      card.style.setProperty("--tilt-x", tiltX.toFixed(2) + "deg");
      card.style.setProperty("--tilt-y", tiltY.toFixed(2) + "deg");
      card.style.setProperty("--shine-x", clamp(localX / rect.width * 100, 0, 100).toFixed(1) + "%");
      card.style.setProperty("--shine-y", clamp(localY / rect.height * 100, 0, 100).toFixed(1) + "%");
      card.style.setProperty("--thumb-x", thumbX.toFixed(2) + "px");
      card.style.setProperty("--thumb-y", thumbY.toFixed(2) + "px");
    }

    function resetCard(card) {
      card.classList.remove("is-magnetic");
      card.style.setProperty("--magnetic-x", "0px");
      card.style.setProperty("--magnetic-y", "0px");
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
      card.style.setProperty("--shine-x", "50%");
      card.style.setProperty("--shine-y", "50%");
      card.style.setProperty("--thumb-x", "0px");
      card.style.setProperty("--thumb-y", "0px");
    }

    function updateCards() {
      frame = null;

      if (!pointer) {
        cards.forEach(resetCard);
        return;
      }

      cards.forEach(function (card) {
        var rect = card.getBoundingClientRect();
        var closestX = clamp(pointer.x, rect.left, rect.right);
        var closestY = clamp(pointer.y, rect.top, rect.bottom);
        var distanceX = pointer.x - closestX;
        var distanceY = pointer.y - closestY;
        var distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

        if (distance > activationRadius) {
          resetCard(card);
          return;
        }

        setCardMotion(card, rect, pointer.x, pointer.y, 1 - distance / activationRadius);
      });
    }

    function requestUpdate() {
      if (!frame) {
        frame = window.requestAnimationFrame(updateCards);
      }
    }

    window.addEventListener("pointermove", function (event) {
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") {
        return;
      }

      pointer = {
        x: event.clientX,
        y: event.clientY
      };
      requestUpdate();
    }, { passive: true });

    window.addEventListener("pointerleave", function () {
      pointer = null;
      requestUpdate();
    });

    window.addEventListener("blur", function () {
      pointer = null;
      requestUpdate();
    });
  }

  setupEmail();
  setupMagneticCards();
})();
