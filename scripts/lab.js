(function () {
  "use strict";

  var projects = window.GISLAB_LAB_PROJECTS || [];

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (typeof text === "string") {
      element.textContent = text;
    }

    return element;
  }

  function appendTextList(parent, items, className) {
    if (!items || items.length === 0) {
      return;
    }

    var list = createElement("ul", className);

    items.forEach(function (item) {
      list.appendChild(createElement("li", "", item));
    });

    parent.appendChild(list);
  }

  function findProject(id) {
    return projects.find(function (project) {
      return project.id === id;
    });
  }

  function setMeta(selector, value) {
    var element = document.querySelector(selector);

    if (element && value) {
      element.setAttribute("content", value);
    }
  }

  function renderProjectCards() {
    var container = document.querySelector("[data-lab-projects]");

    if (!container) {
      return;
    }

    container.textContent = "";

    projects.forEach(function (project) {
      var card = createElement("a", "project-card lab-card");
      var meta = createElement("div", "lab-card-meta");
      var label = createElement("p", "card-label", project.category);
      var status = createElement("span", "status-pill", project.status);
      var title = createElement("h3", "", project.title);
      var summary = createElement("p", "", project.summary);

      card.href = "project.html?id=" + encodeURIComponent(project.id);
      card.setAttribute("aria-label", project.title + " i Labbet");

      meta.appendChild(label);
      meta.appendChild(status);
      card.appendChild(meta);
      card.appendChild(title);
      card.appendChild(summary);

      if (project.subtopics && project.subtopics.length > 0) {
        appendTextList(card, project.subtopics, "lab-subtopics");
      }

      card.appendChild(createElement("span", "text-link lab-card-link", "Öppna projektet"));
      container.appendChild(card);
    });
  }

  function renderMissingProject(container) {
    container.textContent = "";

    var panel = createElement("article", "lab-panel");
    panel.appendChild(createElement("p", "card-label", "Labbet"));
    panel.appendChild(createElement("h2", "", "Projektet hittades inte."));
    panel.appendChild(createElement("p", "", "Gå tillbaka till Labbet och välj ett av korten där."));

    var link = createElement("a", "text-link", "Till Labbet");
    link.href = "/lab/";
    panel.appendChild(link);

    container.appendChild(panel);
  }

  function renderProjectDetail() {
    var container = document.querySelector("[data-project-content]");

    if (!container) {
      return;
    }

    var params = new URLSearchParams(window.location.search);
    var project = findProject(params.get("id"));

    if (!project) {
      renderMissingProject(container);
      return;
    }

    document.title = project.title + " | Labbet | GISLab";
    setMeta("meta[name='description']", project.summary);
    setMeta("meta[property='og:title']", project.title + " | Labbet | GISLab");
    setMeta("meta[property='og:description']", project.summary);
    setMeta("meta[name='twitter:title']", project.title + " | Labbet | GISLab");
    setMeta("meta[name='twitter:description']", project.summary);

    var canonical = document.querySelector("link[rel='canonical']");
    var url = "https://gislab.se/lab/project.html?id=" + encodeURIComponent(project.id);

    if (canonical) {
      canonical.href = url;
    }

    setMeta("meta[property='og:url']", url);

    var category = document.querySelector("[data-project-category]");
    var title = document.querySelector("[data-project-title]");
    var summary = document.querySelector("[data-project-summary]");
    var tags = document.querySelector("[data-project-tags]");

    if (category) {
      category.textContent = "Labbet / " + project.category;
    }

    if (title) {
      title.textContent = project.title + ".";
    }

    if (summary) {
      summary.textContent = project.summary;
    }

    if (tags) {
      tags.textContent = "";
      tags.appendChild(createElement("li", "", project.status));
      (project.tags || []).forEach(function (tag) {
        tags.appendChild(createElement("li", "", tag));
      });
    }

    container.textContent = "";

    var mainPanel = createElement("article", "lab-panel");
    var sidePanel = createElement("aside", "lab-panel lab-side");

    mainPanel.appendChild(createElement("p", "card-label", project.status));
    mainPanel.appendChild(createElement("h2", "", "Det här projektet är ännu bara en idé i Labbet."));
    mainPanel.appendChild(createElement("p", "", project.emptyMessage));
    mainPanel.appendChild(createElement("p", "", "När innehåll finns kan den här sidan rymma en enkel analys, karta, app, visualisering eller länk till ett externt verktyg."));

    sidePanel.appendChild(createElement("p", "card-label", "Möjliga frågor"));
    sidePanel.appendChild(createElement("h3", "", "Att undersöka"));
    appendTextList(sidePanel, project.questions, "lab-question-list");

    if (project.subtopics && project.subtopics.length > 0) {
      sidePanel.appendChild(createElement("p", "card-label lab-side-label", "Underämnen"));
      appendTextList(sidePanel, project.subtopics, "lab-subtopics lab-subtopics-large");
    }

    container.appendChild(mainPanel);
    container.appendChild(sidePanel);
  }

  renderProjectCards();
  renderProjectDetail();
})();
