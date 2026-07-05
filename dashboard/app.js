(function () {
  "use strict";

  var STORAGE_KEY = "nexbanner-dashboard-v1";
  var state = loadState();
  state.demand = state.demand || [];
  state.displayTags = state.displayTags || [];

  var els = {
    publisherId: document.getElementById("publisherId"),
    placementId: document.getElementById("placementId"),
    width: document.getElementById("width"),
    height: document.getElementById("height"),
    cdnScript: document.getElementById("cdnScript"),
    apiBase: document.getElementById("apiBase"),
    demandForm: document.getElementById("demandForm"),
    demandName: document.getElementById("demandName"),
    demandType: document.getElementById("demandType"),
    demandEndpoint: document.getElementById("demandEndpoint"),
    floorCpm: document.getElementById("floorCpm"),
    timeoutMs: document.getElementById("timeoutMs"),
    demandList: document.getElementById("demandList"),
    displayTagForm: document.getElementById("displayTagForm"),
    displayTagName: document.getElementById("displayTagName"),
    displayTagUrl: document.getElementById("displayTagUrl"),
    displayTagFloor: document.getElementById("displayTagFloor"),
    displayTagTimeout: document.getElementById("displayTagTimeout"),
    displayTagList: document.getElementById("displayTagList"),
    tagOutput: document.getElementById("tagOutput"),
    generateTag: document.getElementById("generateTag"),
    copyTag: document.getElementById("copyTag"),
    exportConfig: document.getElementById("exportConfig")
  };

  hydrate();
  renderDemand();
  renderDisplayTags();
  generateTag();

  els.demandForm.addEventListener("submit", function (event) {
    event.preventDefault();
    state.demand.push({
      id: String(Date.now()) + Math.floor(Math.random() * 10000),
      name: els.demandName.value.trim(),
      type: els.demandType.value,
      endpoint: els.demandEndpoint.value.trim(),
      floorCpm: els.floorCpm.value.trim(),
      timeoutMs: els.timeoutMs.value.trim()
    });
    els.demandForm.reset();
    els.floorCpm.value = "0.10";
    els.timeoutMs.value = "800";
    saveFromForm();
    renderDemand();
    generateTag();
  });

  els.displayTagForm.addEventListener("submit", function (event) {
    event.preventDefault();
    state.displayTags.push({
      id: String(Date.now()) + Math.floor(Math.random() * 10000),
      name: els.displayTagName.value.trim(),
      endpoint: els.displayTagUrl.value.trim(),
      floorCpm: els.displayTagFloor.value.trim(),
      timeoutMs: els.displayTagTimeout.value.trim()
    });
    els.displayTagForm.reset();
    els.displayTagFloor.value = "0.10";
    els.displayTagTimeout.value = "800";
    saveFromForm();
    renderDisplayTags();
    generateTag();
  });

  [
    els.publisherId,
    els.placementId,
    els.width,
    els.height,
    els.cdnScript,
    els.apiBase
  ].forEach(function (input) {
    input.addEventListener("input", function () {
      saveFromForm();
      generateTag();
    });
  });

  els.generateTag.addEventListener("click", generateTag);

  els.copyTag.addEventListener("click", function () {
    els.tagOutput.select();
    document.execCommand("copy");
    els.copyTag.textContent = "Copied";
    setTimeout(function () {
      els.copyTag.textContent = "Copy Tag";
    }, 1200);
  });

  els.exportConfig.addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(buildConfig(), null, 2)], {
      type: "application/json"
    });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "nexbanner-demand-config.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  function hydrate() {
    if (!state.setup) return;
    Object.keys(state.setup).forEach(function (key) {
      if (els[key]) els[key].value = state.setup[key];
    });
  }

  function renderDemand() {
    els.demandList.innerHTML = "";

    if (!state.demand.length) {
      var empty = document.createElement("p");
      empty.textContent = "No demand endpoints added yet.";
      empty.style.color = "#607083";
      els.demandList.appendChild(empty);
      return;
    }

    state.demand.forEach(function (item) {
      var node = document.createElement("div");
      node.className = "demand-item";
      node.innerHTML = [
        "<header>",
        "<div><strong>" + escapeHtml(item.name) + "</strong><div class=\"badge\">" + labelFor(item.type) + "</div></div>",
        "<button class=\"remove\" data-id=\"" + item.id + "\">Remove</button>",
        "</header>",
        "<code>" + escapeHtml(item.endpoint) + "</code>",
        "<small>Floor $" + escapeHtml(item.floorCpm || "0") + " CPM, timeout " + escapeHtml(item.timeoutMs || "800") + "ms</small>"
      ].join("");

      node.querySelector(".remove").addEventListener("click", function () {
        state.demand = state.demand.filter(function (existing) {
          return existing.id !== item.id;
        });
        saveFromForm();
        renderDemand();
        generateTag();
      });

      els.demandList.appendChild(node);
    });
  }

  function renderDisplayTags() {
    els.displayTagList.innerHTML = "";

    if (!state.displayTags.length) {
      var empty = document.createElement("p");
      empty.textContent = "No display JS tags added yet.";
      empty.style.color = "#607083";
      els.displayTagList.appendChild(empty);
      return;
    }

    state.displayTags.forEach(function (item) {
      var node = document.createElement("div");
      node.className = "demand-item";
      node.innerHTML = [
        "<header>",
        "<div><strong>" + escapeHtml(item.name) + "</strong><div class=\"badge\">Display JS Tag</div></div>",
        "<button class=\"remove\" data-id=\"" + item.id + "\">Remove</button>",
        "</header>",
        "<code>" + escapeHtml(item.endpoint) + "</code>",
        "<small>Floor $" + escapeHtml(item.floorCpm || "0") + " CPM, timeout " + escapeHtml(item.timeoutMs || "800") + "ms</small>"
      ].join("");

      node.querySelector(".remove").addEventListener("click", function () {
        state.displayTags = state.displayTags.filter(function (existing) {
          return existing.id !== item.id;
        });
        saveFromForm();
        renderDisplayTags();
        generateTag();
      });

      els.displayTagList.appendChild(node);
    });
  }

  function generateTag() {
    var config = buildConfig();
    var vast = firstEndpoint("vast");
    var display = firstEndpoint("display");
    var displayJs = firstDisplayTag();
    var ortb = firstEndpoint("ortb");
    var apiBase = trimSlash(config.setup.apiBase);

    var lines = [
      '<div id="nexbanner-slot-%%CACHEBUSTER%%"></div>',
      "<script",
      '  src="' + config.setup.cdnScript + '"',
      '  data-target="nexbanner-slot-%%CACHEBUSTER%%"',
      '  data-publisher-id="' + config.setup.publisherId + '"',
      '  data-placement-id="' + config.setup.placementId + '"',
      '  data-width="' + config.setup.width + '"',
      '  data-height="' + config.setup.height + '"',
      '  data-mode="video-first"',
      '  data-vast-url="' + (vast ? vast.endpoint : apiBase + "/api/v1/vast") + '"',
      '  data-auction-endpoint="' + apiBase + "/api/v1/auction" + '"',
      '  data-track-url="' + apiBase + "/api/v1/track" + '"',
      displayJs ? '  data-display-script-url="' + displayJs.endpoint + '"' : "",
      display ? '  data-display-endpoint="' + display.endpoint + '"' : "",
      ortb ? '  data-ortb-endpoint="' + ortb.endpoint + '"' : "",
      '  data-logo-text="N"',
      '  data-click-url="https://nexbid.uk">',
      "</script>"
    ].filter(Boolean);

    els.tagOutput.value = lines.join("\n");
  }

  function buildConfig() {
    return {
      setup: {
        publisherId: els.publisherId.value.trim(),
        placementId: els.placementId.value.trim(),
        width: els.width.value.trim(),
        height: els.height.value.trim(),
        cdnScript: els.cdnScript.value.trim(),
        apiBase: els.apiBase.value.trim()
      },
      demand: state.demand,
      displayTags: state.displayTags
    };
  }

  function saveFromForm() {
    state.setup = buildConfig().setup;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState();
    } catch (_) {
      return defaultState();
    }
  }

  function defaultState() {
    return {
      setup: {},
      demand: [],
      displayTags: []
    };
  }

  function firstEndpoint(type) {
    return state.demand.find(function (item) {
      return item.type === type;
    });
  }

  function firstDisplayTag() {
    return state.displayTags[0] || null;
  }

  function labelFor(type) {
    if (type === "vast") return "VAST Video";
    if (type === "ortb") return "ORTB Fallback";
    return "Display JSON";
  }

  function trimSlash(value) {
    return (value || "").replace(/\/+$/, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
