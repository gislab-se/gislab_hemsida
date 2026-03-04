(function () {
  "use strict";

  var lang = ((document.body && document.body.dataset.lang) || document.documentElement.lang || "sv")
    .toLowerCase()
    .indexOf("sv") === 0 ? "sv" : "en";

  var labels = {
    loading: {
      sv: "Laddar projekt...",
      en: "Loading projects..."
    },
    empty: {
      sv: "Inga projekt hittades.",
      en: "No projects found."
    },
    error: {
      sv: "Kunde inte ladda projekt just nu.",
      en: "Could not load projects right now."
    },
    sendEmail: {
      sv: "Skicka e-post",
      en: "Send email"
    }
  };

  var projectList = document.querySelector("[data-project-list]");
  var emailLink = document.querySelector("[data-email-link]");
  var obfuscatedEmail = document.querySelector("[data-email-obfuscated]");

  function t(key) {
    return labels[key] && labels[key][lang] ? labels[key][lang] : "";
  }

  function pickText(value) {
    if (!value) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "object") {
      return value[lang] || value.en || value.sv || "";
    }

    return "";
  }

  function setListMessage(message) {
    if (!projectList) {
      return;
    }

    projectList.innerHTML = "";
    var li = document.createElement("li");
    li.className = "project-state";
    li.textContent = message;
    projectList.appendChild(li);
  }

  function createProjectItem(project) {
    var title = pickText(project.title);
    var description = pickText(project.description);
    var url = typeof project.url === "string" ? project.url : "";

    if (!title || !description || !url) {
      return null;
    }

    var li = document.createElement("li");
    var a = document.createElement("a");
    var p = document.createElement("p");

    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = title;

    p.textContent = description;

    li.appendChild(a);
    li.appendChild(p);

    return li;
  }

  function renderProjects(projects) {
    if (!projectList) {
      return;
    }

    projectList.innerHTML = "";

    if (!Array.isArray(projects) || projects.length === 0) {
      setListMessage(t("empty"));
      return;
    }

    var rendered = 0;
    projects.forEach(function (project) {
      var item = createProjectItem(project);
      if (item) {
        projectList.appendChild(item);
        rendered += 1;
      }
    });

    if (rendered === 0) {
      setListMessage(t("empty"));
    }
  }

  function formatObfuscatedAddress(user, domain) {
    return user + " [at] " + domain.replace(/\./g, " [dot] ");
  }

  function setupEmail(emailConfig) {
    if (!emailLink && !obfuscatedEmail) {
      return;
    }

    var config = (emailConfig && typeof emailConfig === "object") ? emailConfig : {};
    var dataset = emailLink ? emailLink.dataset : {};
    var user = (config.user || dataset.user || "").trim();
    var domain = (config.domain || dataset.domain || "").trim();

    if (!user || !domain) {
      return;
    }

    var address = user + "@" + domain;
    var subject = lang === "sv"
      ? (config.subject_sv || dataset.subjectSv || "Kontakt via gislab.se")
      : (config.subject_en || dataset.subjectEn || "Contact via gislab.se");

    if (emailLink) {
      emailLink.href = "mailto:" + address + "?subject=" + encodeURIComponent(subject);
      emailLink.textContent = t("sendEmail");
      emailLink.setAttribute("rel", "nofollow");
      emailLink.setAttribute("aria-label", t("sendEmail") + ": " + address);
    }

    if (obfuscatedEmail) {
      obfuscatedEmail.textContent = formatObfuscatedAddress(user, domain);
    }
  }

  function loadData() {
    var candidates = ["/data/projects.json", "../data/projects.json", "data/projects.json"];
    var index = 0;

    function tryNext() {
      if (index >= candidates.length) {
        return Promise.reject(new Error("No data source available"));
      }

      var url = candidates[index];
      index += 1;

      return fetch(url, { cache: "no-store" })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Data request failed for " + url);
          }
          return response.json();
        })
        .catch(function () {
          return tryNext();
        });
    }

    return tryNext();
  }

  if (projectList) {
    setListMessage(t("loading"));
  }

  loadData()
    .then(function (data) {
      renderProjects(data.projects);
      setupEmail(data.email);
    })
    .catch(function () {
      if (projectList) {
        setListMessage(t("error"));
      }
      setupEmail(null);
    });
})();
