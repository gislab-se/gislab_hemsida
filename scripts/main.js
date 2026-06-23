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

  setupEmail();
})();
