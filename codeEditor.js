var codeEditor = function () {
  this.versions = {};
  this.projectFiles = [];
  this.init();
};
codeEditor.prototype = {
  topLevelCategory: 944825057,
  topLevelCloudType: 944823551,

    liveWebsiteFilesLoaded: false,
  liveWebsiteFilesLoading: false,
  liveWebsiteFilesCache: new Map(),

  init: async function () {
    var savedUserData = localStorage.getItem("userData");
    if (savedUserData) {
      window.UserData = JSON.parse(savedUserData);
    }
    // FIRST THING
    if (localStorage.getItem("isLoggedIn") === "true") {
      document.body.classList.add("logged-in");
    } else {
      document.body.classList.remove("logged-in");
      document.body.classList.add("no-scroll");
    }
    document.body.classList.add("app-ready");
    //document.getElementById("contextControls").style.display = "block";
    var commonContextBox = document.getElementById("commonContextBox");

    if (commonContextBox) {
      commonContextBox.style.display = "none";
    }
    this.nodeCache = {
      OT: {},
      Category: {},
      CloudType: {}
    };
    this.contextCache = {
      ObjectType: {},
      Category: {},
      CloudType: {}
    };
    this.contextLoading = {};
    this.BaseOT = "IOGLO00001";
    // Restore saved Script URL
    this.scriptDomain = localStorage.getItem("scriptUrl") || "";

    var scriptUrlInput = document.getElementById("scriptUrlInput");
    if (scriptUrlInput) {
      scriptUrlInput.value = this.scriptDomain;
    }

    await this.loadVersions();
    this.restoreLiveWebsiteSelection();
    this.allContexts = [];
    this.currentContextId = null;
    this.monacoEditor = null;

    this.lastContextSource = null;
    this.restoreLastContextSource();
    this.activeLeftPanelTab = "liveActions";

    // IMPORTANT: load saved project FIRST
    this.pendingCloseTabId = null;
    this.initializeSaveModal();
    this.initializePushQueuesPanel();
    await this.loadProjects();
    this.initializeProjects();
    this.initializeProjectsToggle();
    this.initializeLeftPanelTabs();
    this.initializeLiveWebsiteDropdowns();
    var refreshContextsBtn = document.getElementById("refreshContextsBtn");
    if (refreshContextsBtn) {
      refreshContextsBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.refreshCommonSection();
      };
    }
    document.getElementById("modeDropdown").addEventListener("change", async (e) => {
      this.nodeCache = {
        OT: {},
        Category: {},
        CloudType: {}
      };

      this.contextCache = {
        ObjectType: {},
        Category: {},
        CloudType: {}
      };

      this.mode = e.target.value;

      await this.rebuildLeftPanel();

      var commonContextBox = document.getElementById("commonContextBox");

      switch (this.activeTabType) {
        case "pushQueues":
          this.openPushQueuesTab(true);
          break;

        case "liveWebsite":
          this.openLiveWebsiteTab(true);
          break;

        case "projects":
          if (this.selectedProjectFolderData) {
            this.showProjectFolderFiles(
              this.selectedProjectFolderData,
              true
            );
          }
          break;

        default:
          await this.refreshCommonSection();

          if (commonContextBox) {
            commonContextBox.style.display = "block";
          }
          break;
      }
    });

    document.addEventListener("keydown", async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        var currentTab = this.allContexts.find(t => t.id === this.currentContextId);
        if (!currentTab) return;
        // Context Save
        if (currentTab.contextId) {
          await this.saveContext(currentTab.contextId);
          return;
        }
        // Local File Save
        await this.saveCurrentFile();
      }
    });

    document.getElementById("tabsContainer").addEventListener("dblclick", () => {
      this.createUntitledTab();
    });

    document.getElementById("contextIdentifier").addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      var contextId = e.target.value.trim();
      if (!contextId) return;
      await this.openContextById(contextId);
    });

    document.addEventListener("keydown", async (e) => {
      if (e.key === "F5") {
        e.preventDefault(); 
        await this.runCustomScriptOnF5();
      }
    });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        this.toggleAIPanel();
      }
    });

    var pushQueuesTab = document.getElementById("pushQueuesExpand");
    var liveWebsiteTab = document.getElementById("liveWebsite");
    if (pushQueuesTab) {
      pushQueuesTab.addEventListener("click", () => {
        this.openPushQueuesTab();
      });
    }
    if (liveWebsiteTab) {
      liveWebsiteTab.addEventListener("click", () => {
        this.openLiveWebsiteTab();
      });
    }
    this.initializeMonacoEditor();
    // AI Panel Close Button
    var closeBtn = document.getElementById("closeAiPanel");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.toggleAIPanel();
      });
    }
    this.initializeAIPanel();
    // render AFTER loadProjectState
    this.renderProjectFiles();
    this.initializeSectionToggle("projectToggle", "projectPanel");
    this.initializeSectionToggle("liveWebsiteToggle", "liveWebsitePanel");
    this.initializeContextMenu();
    this.initializeLoginScreen();
    this.initializeScriptLogin();
    document.addEventListener("keydown", (e) => {
      if (e.key === "F6") {
        e.preventDefault();
        this.toggleExecutionPanel();
      }
    });
    document.body.classList.add("app-ready");
  },
  showMiniLoader: function (element) {
    if (!element) return;
    // Already exists
    if (element.querySelector(".mini-loader")) return;

    // Tree node
    var toggle = element.querySelector(":scope > .toggle");
    if (toggle) {
      toggle.innerHTML = '<span class="mini-loader"></span>';
      return;
    }

    // Tab
    var loader = document.createElement("span");
    loader.className = "mini-loader";
    loader.style.marginLeft = "3px";

    var title = element.querySelector(".tab-title");

    if (title) {
      element.insertBefore(loader, title);
    } else {
      element.appendChild(loader);
    }
  },

  hideMiniLoader: function (element) {
    if (!element) return;
    // Tree node
    var toggle = element.querySelector(":scope > .toggle");
    if (toggle && toggle.querySelector(".mini-loader")) {
      toggle.textContent = "[+] ";
      return;
    }
    // Tab
    var loader = element.querySelector(".mini-loader");
    if (loader) {
      loader.remove();
    }
  },
  setToggleState: function (node, isOpen) {
    var toggle = node.querySelector(":scope > .toggle");
    if (toggle) {
      toggle.innerText = isOpen ? "[-] " : "[+] ";
    }
  },
  initializeMonacoEditor: function () {
    require.config({
      paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs"
      }
    });
    require(["vs/editor/editor.main"], () => {
      this.monacoEditor = monaco.editor.create(document.getElementById("monacoEditor"),{
        value: "",
        language: "html",
        theme: "vs-dark",
        automaticLayout: true,
        // Enable Ctrl + Mouse Wheel Zoom
        mouseWheelZoom: true,
        minimap: {
          enabled: false
        }
      });
      // Default tab
      this.createUntitledTab();
    });
  },
  initializeLeftPanelTabs: function () {
    var buttons = document.querySelectorAll(".left-panel-tab-button");
    var panels = document.querySelectorAll(".left-panel-tab-panel");

    if (!buttons.length || !panels.length) {
      return;
    }
    var addItemsRightBtn = document.getElementById("addItemsRightBtn");

    var panelMap = {
      liveActions: "leftPanelLiveActions",
      projects: "leftPanelProjects",
      liveWebsite: "leftPanelLiveWebsite",
      pushQueues: "leftPanelPushQueues"
    };
    this.activeLeftPanelTab = "liveActions";

    if (addItemsRightBtn) {
      addItemsRightBtn.style.display = "none";
      addItemsRightBtn.onclick = null;
    }
    buttons.forEach((button) => {
      button.addEventListener("click", async () => {
        var targetPanel = button.getAttribute("data-panel");
        var targetPanelId = panelMap[targetPanel];

        if (!targetPanelId) {
          return;
        }
        
        if (this.activeLeftPanelTab === targetPanel) {
          return;
        }
        this.activeLeftPanelTab = targetPanel;
        this.resetCommonContextBox();

        var pushQueueSection = document.getElementById("pushQueueSection");
        if (pushQueueSection) {
          pushQueueSection.style.display = targetPanel === "pushQueues" ? "block": "none";
        }
        if (addItemsRightBtn) {
          if (targetPanel === "pushQueues") {
            addItemsRightBtn.style.display = "flex";
          } else {
            addItemsRightBtn.style.display = "none";
            addItemsRightBtn.onclick = null;
          }
        }
        buttons.forEach((btn) => {
          btn.classList.toggle("active", btn === button);
        });
        panels.forEach((panel) => {
          panel.classList.toggle("active",panel.id === targetPanelId);
        });
        if (targetPanel === "liveActions") {
          await this.restoreLiveActionsContext();
          if (this.monacoEditor) {
            this.monacoEditor.layout();
          }
          return;
        }
        if (targetPanel === "pushQueues") {
          this.openPushQueuesTab(true);
          if (this.monacoEditor) {
            this.monacoEditor.layout();
          }
          return;
        }
        if (targetPanel === "projects") {
          var projectHeader = document.querySelector(".project-header");
          if (projectHeader && projectHeader.classList.contains("tree-selected")) {
            var rootFolder = {
              name: "Projects",
              path: this.projectRoot,
              children: this.projectTreeItems || []
            };

            this.selectedProjectFolder = rootFolder.path;
            this.selectedProjectFolderData = rootFolder;
            this.showProjectFolderFiles(rootFolder,true);
          } else {
            var projectsLabel = document.getElementById("projectsLabel");
            if (projectsLabel) {
              projectsLabel.click();
            }
          }

          if (this.monacoEditor) {
            this.monacoEditor.layout();
          }
          return;
        }
        if (targetPanel === "liveWebsite") {
          await this.openLiveWebsiteTab(false);

          if (this.monacoEditor) {
            this.monacoEditor.layout();
          }
          return;
        }
        if (this.monacoEditor) {
          this.monacoEditor.layout();
        }
      });
    });
  },
  restoreLiveActionsContext: async function () {
    var source = this.lastContextSource;
    if (!source) {
      console.log("No previous LiveActions selection.");
      return;
    }
    if (!source.action || !source.id) {
      console.warn("Invalid LiveActions source:",source);
      return;
    }
    var box = document.getElementById("commonContextBox");
    var label = document.getElementById("commonSourceLabel");
    var container = document.getElementById("commonTableContainer");
    if (box) {
    box.style.display = "block";
    }

    if (label) {
      this.setContextSourceLabel(source.action,source.name || "");
    }

    if (container) {
      container.innerHTML = "";
    }

    try {
      switch (source.action) {
        case "ObjectType":
          await this.loadContexts(source.id,"ObjectType");
          break;
        case "Category":
          await this.loadCategoryContexts(source.id);
          break;

        case "CloudType":
          await this.loadCloudTypeContexts(source.id);
          break;

        default:
          console.warn("Unknown context source:",source.action);
      }

    } catch (error) {
      console.error("Failed to restore LiveActions context:",error);
    }
  },
  restoreSelectedHierarchyNode: function () {
    var source = this.lastContextSource;

    if (!source || !source.id) {
      return;
    }

    document.querySelectorAll(".tree-selected").forEach(function (el) {
      el.classList.remove("tree-selected");
    });

    var selector = "";

    if (source.action === "ObjectType") {
      selector ='#OT [data-context-id="' + source.id + '"]';
    }

    if (source.action === "Category") {
      selector = '#Cat [data-context-id="' +source.id +'"]';
    }

    if (source.action === "CloudType") {
      selector = '#Cat [data-context-id="' + source.id +'"]';
    }

    if (!selector) {
      return;
    }

    var label = document.querySelector(selector);
    if (label) {
      var node = label.parentElement;
      if (node) {
        node.classList.add("tree-selected");
      }
    }
  },
  resetCommonContextBox: function () {
    var box = document.getElementById("commonContextBox");
    var label = document.getElementById("commonSourceLabel");
    var search = document.getElementById("commonSearchInput");
    var headerActions = document.getElementById("commonHeaderActions");
    var searchActions = document.getElementById("commonSearchActions");
    var container = document.getElementById("commonTableContainer");
    var addItemsRightBtn = document.getElementById("addItemsRightBtn");

    if (!box) {
      return;
    }

    box.style.display = "none";
    if (label) {
      label.textContent = "";
    }

    if (search) {
      search.value = "";
      search.placeholder = "Search";
      search.oninput = null;
    }

    if (headerActions) {
      headerActions.innerHTML = "";
    }

    if (searchActions) {
      searchActions.innerHTML = "";
    }

    if (container) {
      container.innerHTML = "";
    }

    if (addItemsRightBtn) {
      addItemsRightBtn.style.display = "none";
      addItemsRightBtn.onclick = null;
    }
  },

  showCommonContextBox: function (options) {
    options = options || {};

    var box = document.getElementById("commonContextBox");
    var label = document.getElementById("commonSourceLabel");
    var search = document.getElementById("commonSearchInput");
    var headerActions = document.getElementById("commonHeaderActions");
    var searchActions = document.getElementById("commonSearchActions");
    var container = document.getElementById("commonTableContainer");

    if (!box || !label || !search || !container) {
      return null;
    }
    box.style.display = "block";

    // Do not overwrite existing source label
    if (options.label) {
      label.textContent = options.label;
    }
    else if (!label.textContent) {
      label.textContent = "Available Contexts";
    }
    search.value = "";
    search.placeholder = options.placeholder || "Search";
    search.oninput = null;
    if (headerActions) {
      headerActions.innerHTML = "";
    }
    if (searchActions) {
      searchActions.innerHTML = "";
    }
    container.innerHTML = "";
    return {
      box: box,
      label: label,
      search: search,
      headerActions: headerActions,
      searchActions: searchActions,
      container: container
    };
  },
  initializeLoginScreen: function () {
    if (localStorage.getItem("isLoggedIn") === "true") {
      document.body.classList.add("logged-in");
      document.body.classList.remove("no-scroll");
      return;
    }

    var loginSubmit = document.getElementById("loginSubmit");
    var loginEmail = document.getElementById("loginEmail");
    var loginPassword = document.getElementById("loginPassword");

    if (!loginSubmit || !loginEmail || !loginPassword) {
      return;
    }

    // Make both fields required
    loginEmail.required = true;
    loginPassword.required = true;

    document.body.classList.add("no-scroll");

    loginSubmit.addEventListener("click", () => this.handleLogin());

    loginPassword.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleLogin();
      }
    });

    loginEmail.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleLogin();
      }
    });
  },
  handleLogin: async function () {
    var loginEmail = document.getElementById("loginEmail");
    var loginPassword = document.getElementById("loginPassword");
    var error = document.getElementById("loginError");
    var loginSubmit = document.getElementById("loginSubmit");

    var email = loginEmail.value.trim();
    var password = loginPassword.value;

    // Clear previous validation
    loginEmail.setCustomValidity("");
    loginPassword.setCustomValidity("");
    error.textContent = "";

    // Email required
    if (!email) {
      loginEmail.setCustomValidity("Email is required.");
      loginEmail.reportValidity();
      loginEmail.focus();
      return;
    }

    // Password required
    if (!password.trim()) {
      loginPassword.setCustomValidity("Password is required.");
      loginPassword.reportValidity();
      loginPassword.focus();
      return;
    }

    loginSubmit.disabled = true;
    loginSubmit.textContent = "Signing in...";

    async function loginToServer(domain) {
      var response = await fetch(domain + "/LoginADUser.do", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          UserName: email,
          Password: password
        })
      });

      var data = await response.json();

      if (!data || !data.Result || data.Result === false) {
        throw new Error("Login failed : " + domain);
      }

      return data;
    }

    try {
      // Main Login (Current Environment)
      var loginDomain = this.getLoginDomain();
      var data = await loginToServer(loginDomain);

      this.userData = data.Result;
      this.userDRI = data.Result["Direct Resource Identifier"] || "";
      window.UserData = data.Result;

      // Save login
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userData", JSON.stringify(data.Result));
      localStorage.setItem("loginUserName", email);
      localStorage.setItem("loginPassword", password);

      if (loginDomain.toLowerCase().indexOf("prerelease") === -1) {
        try {
          await loginToServer("http://prerelease.liveplatform.com");
        } catch (e) {
          console.warn("Prerelease login skipped", e);
        }
      }

      if (loginDomain.toLowerCase().indexOf("dev") === -1) {
        try {
          await loginToServer("http://dev.liveplatform.com");
        } catch (e) {
          console.warn("Dev login skipped", e);
        }
      }

      document.body.classList.add("logged-in");
      document.body.classList.remove("no-scroll");
    }
    catch (err) {
      console.error(err);
      error.textContent = "Invalid email or password.";
    }
    finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = "Sign In";
    }
  },
  createUntitledTab: function () {
    var id = "tab_" + Date.now();
    var model = monaco.editor.createModel("", "html");

    var tab = {
      id: id,
      name: "Untitled",
      model: model,
      aiMessages: [], 
      lastAIResult: null,
    };
    this.allContexts.push(tab);
    this.currentContextId = id;
    this.renderTabs();
    this.monacoEditor.setModel(model);
    this.monacoEditor.focus();
    this.renderAiMessages(tab);
  },

  renderTabs: function () {
    var container = document.getElementById("tabsContainer");
    container.innerHTML = "";
    this.allContexts.forEach(tab => {
      var div = document.createElement("div");
      div.className = "tab " + (tab.id === this.currentContextId ? "active" : "");

      var title = document.createElement("span");
      title.className = "tab-title";
      title.innerText = tab.name;
      title.onclick = () => this.switchContext(tab.id);

      var closeBtn = document.createElement("span");
      closeBtn.className = "tab-close";
      closeBtn.innerHTML = "X";
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.confirmCloseTab(tab.id);
      };

      div.appendChild(title);
      div.appendChild(closeBtn);

      container.appendChild(div);
    });

    var aiBtn = document.createElement("div");
    aiBtn.id = "aiTabButton";
    aiBtn.className = "ai-tab";
    aiBtn.innerHTML = `
      <svg class="icon -large -fill">
        <use href="#AI"></use>
      </svg>
    `;

    aiBtn.onclick = () => {
      this.toggleAIPanel();
    };
    container.appendChild(aiBtn);
  },
  switchContext: function (id) {
    this.activeTabType = "editor";

    var container = document.getElementById("pushQueuesContainer");
    var liveWebsiteContainer = document.getElementById("liveWebsiteContainer");
    var editor = document.getElementById("monacoEditor");

    var pushQueuesTab = document.getElementById("pushQueuesTab");
    var liveWebsiteTab = document.getElementById("liveWebsite");
    if (container && this.activeLeftPanelTab === "pushQueues") {
      container.style.display = "block";
    }
    if (liveWebsiteContainer) {
      liveWebsiteContainer.style.display = "none";
    }

    if (editor) {
      editor.style.display = "block";
    }
    if (pushQueuesTab) {
      pushQueuesTab.classList.add("active");
    }

    if (liveWebsiteTab) {
      liveWebsiteTab.classList.remove("active");
    }
    var tab = this.allContexts.find(function (t) {
      return t.id === id;
    });

    if (!tab) {
      console.warn("Context tab not found:", id);
      return;
    }
    this.currentContextId = id;
    if (tab.model && this.monacoEditor) {
      this.monacoEditor.setModel(tab.model);

      requestAnimationFrame(() => {
        if (!this.monacoEditor) return;
        this.monacoEditor.layout();
        this.monacoEditor.focus();
      });
    }
    this.renderTabs();
    this.renderProjectFiles();
    this.renderAiMessages(tab);
    var aiBtn = document.getElementById("aiTabButton");

    if (aiBtn) {
      aiBtn.disabled = false;
    }
  },
  loadVersions: async function () {
    try {
      var response = await fetch("http://prerelease.liveplatform.com/system/versions");
      if (!response.ok) {
        throw new Error("HTTP Error: " + response.status);
      }
      var data = await response.json();
      if (!data || !Array.isArray(data.Results)) {
        return;
      }
      var modeDropdown = document.getElementById("modeDropdown");
      if (!modeDropdown) {
        return;
      }
      modeDropdown.innerHTML = "";
      this.versions = {};

      data.Results.filter(item =>item.Release !== "Debug" &&item.Release !== "Test").forEach(item => {
        this.versions[item.Release] = {
          version: item.Version,
          release: item.Release,
          domain: item.Domain || item.Server || item.HostName || ""
        };

        var option = document.createElement("option");
        option.value = item.Release;
        option.textContent = item.Release + " - " + item.Version;
        modeDropdown.appendChild(option);
      });

      // Default mode selection
      if (this.versions["Dev"]) {
        this.mode = "Dev";
      } else {
        var releases = Object.keys(this.versions);
        if (releases.length > 0) {
          this.mode = releases[0];
        }
      }

      if (this.mode) {
        modeDropdown.value = this.mode;
        this.selectedMode = this.versions[this.mode];
      }

      if (typeof this.loadEnterprises === "function") {
        await this.loadEnterprises();
      }
    } catch (err) {
      console.error("Failed to load versions:", err);
    }
  },
  loadEnterprises: async function () {
    try {
      var response = await fetch("http://prerelease.liveplatform.com/GetEnterprises.json?SortBy=Formatted Name"); 
      var data = await response.json();

      this.enterprises = data.Results || [];

      var input = document.getElementById("enterpriseInput");
      var dropdown = document.getElementById("enterpriseDropdown");
      var search = document.getElementById("enterpriseSearch");
      var options = document.getElementById("enterpriseOptions");
      var noResult = document.getElementById("enterpriseNoResult");

      var renderOptions = (filter = "") => {
        options.innerHTML = "";

        var filtered = this.enterprises.filter(item => {
          var name = String(item["Formatted Name"] || item.FormattedName || item.Name || "");
          return name.toLowerCase().includes((filter || "").toLowerCase());
        });
        noResult.style.display = filtered.length ? "none" : "block";

        filtered.forEach(item => {
          var option = document.createElement("div");
          option.className = "option";
          option.textContent = item["Formatted Name"] || item.FormattedName || item.Name;

          option.onclick = async () => {
            this.selectedEnterprise = item;
            input.querySelector(".selected-text").textContent = option.textContent;
            dropdown.style.display = "none";
            search.value = "";
            this.clearCaches();

            document.querySelector(".-context-input-box").style.display = "flex";
            var wrapper = document.getElementById("contextsWrapper");
            if (wrapper) wrapper.style.display = "flex";
            this.toggleContexts(true);
            var tbody = document.getElementById("contextsBody");
            if (tbody) tbody.innerHTML = "";
            document.getElementById("Cat").innerHTML = "";
            await this.getAndLoadTopLevelCategoryAndCloudType();
          };
          options.appendChild(option);
        });
      };
      // Default Enterprise
      var defaultEnterprise = this.enterprises.find(item =>(item["Formatted Name"] || item.FormattedName || item.Name).toLowerCase() === "liveplatform");
      if (!defaultEnterprise && this.enterprises.length) {
        defaultEnterprise = this.enterprises[0];
      }

      this.selectedEnterprise = defaultEnterprise;
      input.querySelector(".selected-text").textContent = defaultEnterprise["Formatted Name"] || defaultEnterprise.FormattedName || defaultEnterprise.Name;
      renderOptions();
      input.onclick = (e) => {
        e.stopPropagation();
        // Close Brand dropdown
        var brandDropdown = document.getElementById("liveWebsiteBrandDropdown");
        if (brandDropdown) {
          brandDropdown.style.display = "none";
        }
        // Toggle Enterprise dropdown
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
      };

      search.oninput = () => {
        renderOptions(search.value);
      };

      document.addEventListener("click", (e) => {
        if (!input.parentElement.contains(e.target)) {
          dropdown.style.display = "none";
        }
      });

      this.getAndLoadOTs();
      this.getAndLoadTopLevelCategoryAndCloudType();
      this.initializeLiveWebsiteTab();

    } catch (error) {
      console.error("Failed to load enterprises:", error);
    }
  },
  getAndLoadOTs: async function () {
    try {
      var node = this.BaseOT;
      var version = this.versions[this.mode].version;
      var domain = this.getCurrentDomain();
      var url = "http://" + domain + "/Node:" + node + ".GetObjectsAsJSON?aCountSubNodes=Y&aUse=Owned&aSubnodeCount=Y" +"&aSort_List=JSON%3A%5B%7BOrderType%3AString%2COrderDirection%3AAscending%2CDataType%3ADisplayName%7D%5D" +
        "&aDataTypeList=DisplayName,HierarchyPosition" +"&fVersion=" + version + "&fLivePlatformVersion=" + version;

      var response = await fetch(url);
      var data = await response.json();
      var otDiv = document.getElementById("OT");
      otDiv.innerHTML = "";

      data.forEach(item => {
        var div = document.createElement("div");
        div.dataset.id = item.Id;                  
        div.dataset.hpos = item.HierarchyPosition;
        div.innerHTML = `
          <span class="toggle">[+] </span>
          <span class="label">${item.DisplayName}</span>
        `;
        div.style.cursor = "pointer";
        div.dataset.open = "false";
        // Expand tree
        div.querySelector(".toggle").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(div);
          await this.loadChildNodes(div, item.HierarchyPosition);
        });
        div.querySelector(".label").setAttribute("data-context-id", item.Id);

        div.querySelector(".label").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(div);
          this.setContextSourceLabel("ObjectType",item.DisplayName || item.Name);
          this.lastContextSource = {
              action: "ObjectType",
              id: item.Id,
              name: item.DisplayName || item.Name || ""
          };

          this.saveLastContextSource();
          await this.loadContexts(item.Id, "ObjectType");
        });
        otDiv.appendChild(div);
      });
    } catch (err) {
      console.error("OT error:", err);
    }
  },
  getAndLoadTopLevelCategoryAndCloudType: async function () {
    try {
      var enterpriseId = this.selectedEnterprise.Id;
      var domain = this.getSelectedEnterpriseDomain();
      var url = "http://" + domain + "/GetTopLevelCategories.json?EnterpriseId=" + enterpriseId;
      var response = await fetch(url);
      var data = await response.json();
      var catDiv = document.getElementById("Cat");

      if (!catDiv) {
        console.error("Cat div not found");
        return;
      }
      catDiv.innerHTML = "";

      (data.Results || data).forEach(item => {
        var name = item["Formatted Name"];
        var div = document.createElement("div");
        div.style.cursor = "pointer";

        div.innerHTML = `
          <span class="toggle">[+] </span>
          <span class="label">${name}</span>
        `;

        div.dataset.type = name;
        div.dataset.hpos = item.HierarchyPosition;
        
        // Expand / Collapse
        div.querySelector(".toggle").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(div);
          if (name === "Categories") {
            await this.loadCategories(item, div);
            return;
          }

          if (name === "Cloud Types") {
            await this.loadCloudTypes(item, div);
            return;
          }
        });
        // Context Load
        div.querySelector(".label").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(div);
          if (name === "Categories") {
            this.setContextSourceLabel("Category","Categories");

            this.lastContextSource = {
                action: "Category",
                id: this.topLevelCategory,
                name: "Categories"
            };
            this.saveLastContextSource();
            await this.loadCategoryContexts(this.topLevelCategory);
            return;
          }

          if (name === "Cloud Types") {
            this.setContextSourceLabel("CloudType","Cloud Types");
            this.lastContextSource = {
              action: "CloudType",
              id: this.topLevelCloudType,
              name: "Cloud Types"
            };

            this.saveLastContextSource();
            await this.loadCloudTypeContexts(this.topLevelCloudType);
            return;
          }
          var objectId = item.Id || item.HierarchyPosition;
          await this.loadContexts(objectId);
        });
        catDiv.appendChild(div);
      });
    } catch (err) {
      console.error("TopLevel Error:", err);
    }
  },
  loadCategories: async function (item, parentDiv) {
    try {
      if (parentDiv.dataset.open === "true") {
        parentDiv.querySelector(".children").remove();
        parentDiv.dataset.open = "false";

        this.setToggleState(parentDiv, false);
        return;
      }
      // CACHE CHECK
      if (this.nodeCache.Category[item.HierarchyPosition]) {
        this.renderTreeFromCache(parentDiv,this.nodeCache.Category[item.HierarchyPosition],"Category");
        return;
      }

      // Show loader
      this.showMiniLoader(parentDiv);

      var version = this.versions[this.mode].version;
      var domain = this.getCurrentDomain();

      var url ="http://" + domain +"/Node:" + item.HierarchyPosition +".GetObjectsAsJSON" + "?aUse=Relationship&aCategory=Item&aCountSubNodes=Y&aSubnodeCount=Y" +"&aSort_List=JSON%3A%5B%7BOrderType%3AString%2COrderDirection%3AAscending%2CDataType%3AFormatted%20Name%7D%5D" +
        "&aDataTypeList=Id,Formatted Name,HierarchyPosition,SubNodeCount" +"&fVersion=" + version +"&fLivePlatformVersion=" + version;

      var response = await fetch(url);
      var data = await response.json();

      var list = data.Results || data || [];
      this.nodeCache.Category[item.HierarchyPosition] = list;

      var container = document.createElement("div");
      container.className = "children";
      container.style.marginLeft = "20px";
      list.forEach(child => {
        //NO toggle icon here anymore
        var div = document.createElement("div");
        div.innerHTML = `
          <span class="toggle">[+] </span>
          <span class="label">${child["Formatted Name"]}</span>
        `;
        div.dataset.open = "false";

        div.querySelector(".toggle").addEventListener("click", async (e) => {
          e.stopPropagation();
          await this.loadChildNodes(div, child.HierarchyPosition);
        });
        div.querySelector(".label").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(div);
          this.setContextSourceLabel("Category",child["Formatted Name"]);

          this.lastContextSource = {
              action: "Category",
              id: child.Id || child.HierarchyPosition,
              name: child["Formatted Name"] || ""
          };

          this.saveLastContextSource();
          await this.loadCategoryContexts(child.Id || child.HierarchyPosition);
        });
        container.appendChild(div);
      });
      parentDiv.appendChild(container);
      parentDiv.dataset.open = "true";
      this.setToggleState(parentDiv, true);
    } catch (err) {
      console.error(err);
      this.setToggleState(parentDiv, false);
    }
  },
  loadCloudTypes: async function (item, parentDiv) {
    try {
      if (parentDiv.dataset.open === "true") {
        parentDiv.querySelector(".children")?.remove();
        parentDiv.dataset.open = "false";

        this.setToggleState(parentDiv, false);
        return;
      }
      if (this.nodeCache.CloudType[item.HierarchyPosition]) {
        this.renderTreeFromCache(parentDiv,this.nodeCache.CloudType[item.HierarchyPosition],"CloudType");
        return;
      }

      this.showMiniLoader(parentDiv);

      var version = this.versions[this.mode].version;
      var domain = this.getCurrentDomain();

      var url = "http://" + domain + "/Node:" + item.HierarchyPosition + ".GetObjectsAsJSON" + "?aUse=Relationship&aCategory=Item&aCountSubNodes=Y&aSubnodeCount=Y" +
        "&aSort_List=JSON%3A%5B%7BOrderType%3AString%2COrderDirection%3AAscending%2CDataType%3AFormatted%20Name%7D%5D" +
        "&aDataTypeList=Id,Formatted%20Name,HierarchyPosition,SubNodeCount" +
        "&fVersion=" + version +
        "&fLivePlatformVersion=" + version;

      var response = await fetch(url);
      var data = await response.json();
      //var list = data.Results || data || [];

      var list = this.getApiResults(data);

      // Remove duplicates
      var seen = new Set();
      var filtered = list.filter(child => {
        var name = child["Formatted Name"];
        if (!name) return false;
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
      // IMPORTANT: SAVE CACHE (FIX)
      this.nodeCache.CloudType[item.HierarchyPosition] = filtered;

      var container = document.createElement("div");
      container.className = "children";
      container.style.marginLeft = "20px";

      filtered.forEach(child => {
        var div = document.createElement("div");
        div.innerHTML = `
          <span class="toggle">[+] </span>
          <span class="label">${child["Formatted Name"]}</span>
        `;
        div.dataset.open = "false";
        div.querySelector(".toggle").addEventListener("click", async (e) => {
          e.stopPropagation();
          await this.loadChildNodes(div, child.HierarchyPosition);
        });

        div.querySelector(".label").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(div);
          this.setContextSourceLabel("CloudType",child["Formatted Name"] ||child.DisplayName ||child.Name);
          this.lastContextSource = {
            action: "CloudType",
            id: child.Id || child.HierarchyPosition,
            name: child["Formatted Name"] || child.Name || ""
          };

          this.saveLastContextSource();
          await this.loadCloudTypeContexts(child.Id || child.HierarchyPosition);
        });
        container.appendChild(div);
      });
      parentDiv.appendChild(container);
      parentDiv.dataset.open = "true";
      this.setToggleState(parentDiv, true);

    } catch (err) {
      this.setToggleState(parentDiv, false);
    }
  },
  saveLastContextSource: function () {
    if (!this.lastContextSource) {
      localStorage.removeItem("lastContextSource");
      return;
    }

    try {
      localStorage.setItem("lastContextSource",JSON.stringify(this.lastContextSource));
    } catch (error) {
      console.warn("Failed to save last context source:",error);
    }
  },
  restoreLastContextSource: function () {
    try {
      var saved = localStorage.getItem("lastContextSource");
      if (!saved) {
        this.lastContextSource = null;
        return;
      }
      var parsed = JSON.parse(saved);

      if (!parsed ||!parsed.action ||!parsed.id) {
        this.lastContextSource = null;
        return;
      }
      this.lastContextSource = parsed;
    } catch (error) {
      console.warn("Failed to restore last context source:",error);
      this.lastContextSource = null;
    }
  },
  loadChildNodes: async function (parentDiv, hpos) {
    try {
      // Close node
      if (parentDiv.dataset.open === "true") {
        parentDiv.querySelector(".children")?.remove();
        parentDiv.dataset.open = "false";

        this.setToggleState(parentDiv, false);
        return;
      }

      // Show mini loader
      this.showMiniLoader(parentDiv);
      var version = this.versions[this.mode].version;
      var domain = this.getCurrentDomain();

      var url = "http://" + domain +"/Node:" + hpos +".GetObjectsAsJSON" +"?aCountSubNodes=Y" + "&aUse=Owned" +"&aSubnodeCount=Y" +"&aSort_List=JSON%3A%5B%7BOrderType%3AString%2COrderDirection%3AAscending%2CDataType%3ADisplayName%7D%5D" +
        "&aDataTypeList=DisplayName,HierarchyPosition,SubNodeCount" +"&fVersion=" + version +"&fLivePlatformVersion=" + version;

      var response = await fetch(url);
      var data = await response.json();

      //var list = data.Results || data || [];
      var list = this.getApiResults(data);
      this.nodeCache.OT[hpos] = list;

      if (!list.length) {
        parentDiv.dataset.open = "true";
        this.setToggleState(parentDiv, true);
        return;
      }

      var container = document.createElement("div");
      container.className = "children";
      container.style.marginLeft = "20px";

      list.forEach(child => {
        var childDiv = document.createElement("div");
        childDiv.innerHTML = `
          <span class="toggle">[+] </span>
          <span class="label">${child.DisplayName || child["Formatted Name"] || "Unnamed"}</span>
        `;
        
        childDiv.dataset.open = "false";
        childDiv.dataset.hpos = child.HierarchyPosition;
        childDiv.dataset.id = child.Id;

        // Expand child node
        childDiv.querySelector(".toggle").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(childDiv);
          await this.loadChildNodes(childDiv, child.HierarchyPosition);
        });

        // Open context
        childDiv.querySelector(".label").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(childDiv);
          this.setContextSourceLabel("ObjectType",child.DisplayName || child["Formatted Name"]);
          this.lastContextSource = {
            action: "ObjectType",
            id: child.Id
          };
          await this.loadContexts(child.Id, "ObjectType");
        });
        container.appendChild(childDiv);
      });

      parentDiv.appendChild(container);
      parentDiv.dataset.open = "true";
      // Change loader to [-]
      this.setToggleState(parentDiv, true);

    } catch (error) {
      // Restore [+] on error
      this.setToggleState(parentDiv, false);
    }
  },
  getApiResults: function (data) {
    if (!data) {
      return [];
    }
    if (Array.isArray(data.Results)) {
      return data.Results;
    }

    if (Array.isArray(data)) {
      return data;
    }
    return [];
  },
  getCurrentDomain: function () {
    var domain = "";
    switch ((this.mode || "").toLowerCase()) {
      case "dev":
        domain = "lsv1.dev.liveplatform.com";
        break;
      case "qa":
        domain = "lsv1.qa.liveplatform.com";
        break;
      case "prerelease":
        domain =  "lsv1.prerelease.liveplatform.com";
        break;
      case "live":
        domain = "lsv1.liveplatform.com";
        break;

      default:
        domain = "lsv1.dev.liveplatform.com";
        break;
    }
    return domain;
  },
  getLoginDomain: function () {
    return "http://" + this.getCurrentDomain().replace(/^lsv1\./, "");
  },
  loadContexts: async function (objectId, type = "ObjectType") {
    this.toggleContexts(true);
    var cacheKey;
    try {
      type = (type || "").trim();
      cacheKey = (this.selectedEnterprise?.Id || "default") + "_" + this.mode + "_" + type + "_" + objectId;
      if (this.contextLoading[cacheKey]) {
        return;
      }
      this.contextLoading[cacheKey] = true;
      utils.showContextLoader();
      if (!this.contextCache[type]) {
        this.contextCache[type] = {};
      }
      if (this.contextCache[type][cacheKey]) {
        this.renderContextsFromCache(this.contextCache[type][cacheKey]);
        return;
      }
      document.querySelector(".-context-input-box").style.display = "flex";
      var wrapper = document.getElementById("contextsWrapper");
      if (wrapper) {
        wrapper.style.display = "block";
      }
      this.showContextsLoading();
      var domain = this.getSelectedEnterpriseDomain();
      var url = "http://" + domain + "/GetContexts.json?Type=" + type +"&Fields=Last%20Edited%20On||Last%20Edited%20By" +"&ResultCount=3000" +"&ObjectType=" + objectId;
      var response = await fetch(url);
      var data = await response.json();
      var list = this.getApiResults(data);

      this.contextCache[type][objectId] = list;
      this.contextCache[type][cacheKey] = list;
      this.renderContextsFromCache(list);
    }
    catch (err) {
      this.showContextsError();
    }
    finally {
      utils.hideContextLoader();

      if (cacheKey) {
        delete this.contextLoading[cacheKey];
      }
    }
  },
  getSelectedEnterpriseDomain: function () {  
    var enterprise = this.selectedEnterprise;
    var mode = (this.mode || "").toLowerCase();
    if (!enterprise || !enterprise.Versions) {
      return null;
    }
    // find matching version object
    var match = enterprise.Versions.find(v =>
      (v.Release || "").toLowerCase() === mode);
    if (match?.Domain) {
      return match.Domain;
    }
    return null;
  },
  rebuildLeftPanel: async function () {
    try {
      document.querySelector(".-context-input-box").style.display = "none";
      // Left panel reset
      document.getElementById("OT").innerHTML = "";
      document.getElementById("Cat").innerHTML = "";

      // Right panel reset (IMPORTANT)
      var wrapper = document.getElementById("contextsWrapper");
      if (wrapper) {
        wrapper.style.display = "flex";
      }

      var tbody = document.getElementById("contextsBody");
      if (tbody) {
        tbody.innerHTML = "";
      }

      // Optional: selected object clear
      this.selectedObject = null;

      // Rebuild using new mode/domain
      await this.getAndLoadOTs();
      await this.getAndLoadTopLevelCategoryAndCloudType();

    } catch (err) {
      console.error("Rebuild error:", err);
    }
  },
  loadCategoryContexts: async function (objectId) {
    this.toggleContexts(true);
    var type = "Category";
    var cacheKey;

    try {
      cacheKey = (this.selectedEnterprise?.Id || "default") + "_" + this.mode + "_" + type + "_" + objectId;
      if (this.contextLoading[cacheKey]) {
        return;
      }
      this.contextLoading[cacheKey] = true;

      if (!this.contextCache[type]) {
        this.contextCache[type] = {};
      }

      if (this.contextCache[type][cacheKey]) {
        this.renderContextsFromCache(this.contextCache[type][cacheKey]);
        return;
      }

      utils.showContextLoader();
      var contextInputBox = document.querySelector(".-context-input-box");

      if (contextInputBox) {
        contextInputBox.style.display = "flex";
      }
      var wrapper = document.getElementById("contextsWrapper");

      if (wrapper) {
        wrapper.style.display = "flex";
      }

      this.showContextsLoading();
      var domain = this.getSelectedEnterpriseDomain();
      var url = "http://" + domain +"/GetContexts.json?Type=OnCategory" +"&Fields=Last%20Edited%20On||Last%20Edited%20By" +"&ResultCount=3000" +"&ObjectType=" +objectId;

      var response = await fetch(url);
      var data = await response.json();
      var list = this.getApiResults(data);

      this.contextCache[type][objectId] = list;
      this.contextCache[type][cacheKey] = list;
      this.renderContextsFromCache(list);
    }
    catch (err) {
      console.error("Category context error:", err);
      this.showContextsError();
    }
    finally {
      utils.hideContextLoader();

      if (cacheKey) {
        delete this.contextLoading[cacheKey];
      }
    }
  },
  loadCloudTypeContexts: async function (objectId) {
    this.toggleContexts(true);
    try {
      var cacheKey = (this.selectedEnterprise?.Id || "default") +"_" +this.mode +"_" +objectId;

      if (this.contextCache.CloudType && this.contextCache.CloudType[cacheKey]) {
        this.renderContextsFromCache(this.contextCache.CloudType[cacheKey]);
        return;
      }
      utils.showContextLoader();

      var wrapper = document.getElementById("contextsWrapper");
      var tbody = document.getElementById("contextsBody");

      // wrapper.style.display = "block";
      // tbody.innerHTML = "<tr><td colspan='3'>Loading...</td></tr>";
      this.showContextsLoading();

      var domain = this.getSelectedEnterpriseDomain();
      var url ="http://" + domain + "/GetContexts.json?Type=OnCategory" +"&Fields=Last%20Edited%20On||Last%20Edited%20By" +"&ResultCount=3000" +"&ObjectType=" + objectId;
      var response = await fetch(url);
      var data = await response.json();
      var list = data.Results || [];
      // SAVE CACHE
      //this.contextCache.CloudType[objectId] = list;
      this.contextCache.CloudType[cacheKey] = list;
      // SINGLE RENDER FUNCTION
      this.renderContextsFromCache(list);
    } catch (err) {
      document.getElementById("contextsBody").innerHTML ="<tr><td colspan='3'>Failed</td></tr>";

    } finally {
      utils.hideContextLoader();
    }
  },
  saveCurrentFile: async function () {
    if (!this.monacoEditor)return false;
    try {
      var currentTab = this.allContexts.find(x => x.id === this.currentContextId);
      if (!currentTab)
      return false;
      var content = this.monacoEditor.getValue();
      var result = await window.electronAPI.saveFile({
        filePath: currentTab.filePath,
        defaultName: currentTab.savedFileName || currentTab.name || "untitled.js",
        content: content
      });
      //if (result.canceled)return false;
      if (result.canceled) {
        return false;
      }
      if (!result.success)throw new Error(result.error);

      currentTab.filePath = result.filePath;
      currentTab.savedFileName = result.fileName;
      currentTab.name = result.fileName;

      var existing = this.projectFiles.find(x => x.contextId === currentTab.id);
      if (!existing) {
        this.projectFiles.push({
          name: result.fileName,
          filePath: result.filePath,
          contextId: currentTab.id,
          content: content
        });
      } else {
        existing.name = result.fileName;
        existing.content = content;
        existing.filePath = result.filePath;
      }
      this.saveProjectState();
      this.renderTabs();
      this.renderProjectFiles();
      utils.showSnackbar("File saved successfully.");
      return true;
    }
    catch (err) {
      utils.showSnackbar("Failed to save file.","error");
      return false;
    }
  },
  closeTab: async function (id) {
    var index = this.allContexts.findIndex(t => t.id === id);
    if (index === -1) return;
    var tab = this.allContexts[index];
    if (tab.model) {
      tab.model.dispose();
    }
    this.allContexts.splice(index, 1);
    if (this.currentContextId === id) {
      var newTab = this.allContexts[index] || this.allContexts[index - 1];

      if (newTab) {
        this.currentContextId = newTab.id;
        this.monacoEditor.setModel(newTab.model);
      } else {
        this.currentContextId = null;
        this.monacoEditor.setValue("");
      }
    }
    this.renderTabs();
  },
  renderProjectFiles: function () {
    var self = this;
    new drawTable({
      container: document.getElementById("projectFilesTableContainer"),
      data:
        this.projectFiles,
      fields: [
        {
          label: "Name",
          render: function (file) {
            return "📄 " + file.name;
          }
        },
        {
          label: "Last Modified",
          field: "lastModified"
        },
        {
          label: "Last Edited By",
          field: "lastEditedBy"
        }
      ],

      emptyText:
        "Your project is currently empty",

      onRowClick: function (file) {
        self.openProjectFile(file);
      }
    });
  },
  saveProjectState: function () {
    this.projectFiles.forEach(file => {
      var tab = this.allContexts.find(t => t.id === file.contextId);
      if (tab && tab.model) {
        file.content = tab.model.getValue();
      }
    });
    localStorage.setItem("codeEditorProjectFiles",JSON.stringify(this.projectFiles));
  },
  loadProjects: async function () {
    try {
      var result = await window.electronAPI.getProjects();
      if (!result || !result.success) {
        return;
      }

      this.projectRoot = result.root;
      this.projectTreeItems = result.items || [];

      this.renderProjectTree(this.projectTreeItems);
      if (this.selectedProjectFolderData) {
        var folder = this.findProjectFolderByPath(this.projectTreeItems,this.selectedProjectFolder);
        if (folder) {
          this.selectedProjectFolderData = folder;
        }
      }
    }
    catch (error) {
      console.error("Load projects error:", error);
    }
  },
  loadSourceCodeInEditor: async function (contextId,tabId) {
    try {
      if (!contextId) {
        console.error("Missing contextId");
        return;
      }
      var url ="http://prerelease.liveplatform.com/GetSourceCode.do?ContextId=" + contextId +"&Mode=" +this.mode;
      var response = await fetch(url);
      if (!response.ok) {
        return;
      }
      var data = await response.json();
      var sourceObj = data.find(item => item && item["Source Code"]);
      if (!sourceObj) {
        return;
      }
      var code = decodeURIComponent(sourceObj["Source Code"]);
      //var tab = this.allContexts.find(t => t.id === this.currentContextId);
      var tab = this.allContexts.find(t => t.id === tabId);

      if (!tab) {
        console.error("Current tab not found");
        return;
      }

      var fileName = tab.name || "";
      var language = this.getMonacoLanguage(fileName);
      // Create model only once per tab
      if (!tab.model) {
        tab.model = monaco.editor.createModel(code,language);
      } else {
        monaco.editor.setModelLanguage(tab.model,language);
        tab.model.setValue(code);
      }
      this.monacoEditor.setModel(tab.model);
      this.monacoEditor.focus();
      //tab.originalContent = tab.model.getValue();
      if (tab.model) {
        tab.originalContent = tab.model.getValue();
      }
    } catch (err) {
      console.error("Source load error:",err);
    }
  },
openContextInEditor: async function (contextId, contextName) {
  try {
    if (!contextId) {
      console.error("Invalid contextId");
      return;
    }

    var pushQueuesContainer =
      document.getElementById("pushQueuesContainer");

    var liveWebsiteContainer =
      document.getElementById("liveWebsiteContainer");

    var editor =
      document.getElementById("monacoEditor");

    if (liveWebsiteContainer) {
      liveWebsiteContainer.style.display = "none";
    }

    if (editor) {
      editor.style.display = "block";
    }

    var existingTab = this.allContexts.find(function (t) {
      return String(t.contextId) === String(contextId);
    });

    if (existingTab) {

      this.currentContextId = existingTab.id;
      this.activeTabType = "editor";

      if (existingTab.model && this.monacoEditor) {
        this.monacoEditor.setModel(existingTab.model);

        requestAnimationFrame(() => {
          if (!this.monacoEditor) return;

          this.monacoEditor.layout();
          this.monacoEditor.focus();
        });
      }

      this.renderTabs();
      this.renderProjectFiles();
      this.renderAiMessages(existingTab);

      utils.showSnackbar("Context opened");
      return;
    }

    var tabId = "ctx_" + contextId;

    var tab = {
      id: tabId,
      name: contextName || ("Context_" + contextId),
      contextId: contextId,
      isContext: true,
      model: null,
      aiMessages: [],
      originalContent: ""
    };

    this.allContexts.push(tab);
    this.currentContextId = tabId;
    this.activeTabType = "editor";

    if (liveWebsiteContainer) {
      liveWebsiteContainer.style.display = "none";
    }

    if (editor) {
      editor.style.display = "block";
    }

    this.renderTabs();
    this.renderAiMessages(tab);

    await this.loadSourceCodeInEditor(contextId, tabId);

    if (tab.model && this.monacoEditor) {
      this.monacoEditor.setModel(tab.model);
      tab.originalContent = tab.model.getValue();

      requestAnimationFrame(() => {
        if (!this.monacoEditor) return;

        this.monacoEditor.setModel(tab.model);
        this.monacoEditor.layout();
        this.monacoEditor.focus();
      });
    }

    this.renderTabs();
    this.renderProjectFiles();
    this.renderAiMessages(tab);

    utils.showSnackbar("Context opened");

  } catch (err) {
    console.error("openContextInEditor error:", err);
    utils.showSnackbar("Failed to open context", "error");
  }
},
  initializeContextMenu: function () {
    var wrapper = document.getElementById("commonContextWrapper");
    var menu = document.getElementById("contextMenu");
    var copyBtn = document.getElementById("copyContextId");

    if (!wrapper || !menu || !copyBtn) return;
    wrapper.addEventListener("contextmenu", function (e) {
      var row = e.target.closest("tr");
      if (!row) {
        menu.style.display = "none";
        return;
      }
      e.preventDefault();
      var contextId = row.dataset.contextId;
      if (!contextId) {
        menu.style.display = "none";
        return;
      }

      menu.dataset.contextId = contextId;
      menu.style.left = e.pageX + "px";
      menu.style.top = e.pageY + "px";
      menu.style.display = "block";
    });

    document.addEventListener("click", function () {
      menu.style.display = "none";
    });

    copyBtn.onclick = function () {
      var contextId = menu.dataset.contextId || "";
      navigator.clipboard.writeText(contextId);
      menu.style.display = "none";
      if (utils && utils.showSnackbar) {
        utils.showSnackbar("Context Id copied");
      }
    };
  },
  openContextById: async function (contextId) {
    if (!contextId) {
      console.error("Invalid Context Id");
      return;
    }
    var contextName = "Context_" + contextId;
    var list = [];
    if (this.lastContextSource) {
      var source = this.lastContextSource;
      var cacheKey = (this.selectedEnterprise?.Id || "default") + "_" + this.mode + "_" + source.action +"_" + source.id;
      list = this.contextCache[source.action]?.[cacheKey] ||this.contextCache[source.action]?.[source.id] ||[];
    }

    var context = list.find(function (item) {
      return item.Object && String(item.Object.Id) === String(contextId);
    });

    if (context) {
      contextName = context.Object?.Name || context.Tag || contextName;
    }

    await this.openContextInEditor(contextId, contextName);
  },
  setSelectedNode: function(node) {
    document.querySelectorAll(".tree-selected").forEach(el => el.classList.remove("tree-selected"));
    node.classList.add("tree-selected");
  },
  getMonacoLanguage: function(fileName) {
    if (!fileName || fileName.indexOf(".") === -1) {
      return "html";
    }
    var ext = fileName.split(".").pop().toLowerCase();
    var map = {
      js: "javascript",
      ts: "typescript",
      html: "html",
      htm: "html",
      css: "css",
      json: "json",
      xml: "xml",
      sql: "sql",
      java: "java",
      cs: "csharp",
      py: "python",
      php: "php"
    };
    return map[ext] || "html";
  },
  setContextSourceLabel: function(type, name) {
    var label = document.getElementById("commonSourceLabel");
    if (!label) return;
    if (type === "Category") {
      label.textContent = "Available Contexts From Cat : " + (name || "");
    }
    else if (type === "ObjectType") {
      label.textContent = "Contexts From OT : " + (name || "");
    }
    else if (type === "CloudType") {
      label.textContent = "Available Contexts From Cloud Type : " + (name || "");
    }
    else {
      label.textContent = "Available Contexts";
    }
  },
  refreshContexts: async function () {
    if (!this.lastContextSource) {
      return;
    }

    var source = this.lastContextSource;
    var cacheKey = (this.selectedEnterprise?.Id || "default") + "_" + this.mode + "_" + source.action + "_" + source.id;

    if (this.contextCache[source.action]) {
      delete this.contextCache[source.action][cacheKey];
      delete this.contextCache[source.action][source.id];
    }

    utils.showContextLoader();

    try {
      switch (source.action) {
        case "ObjectType":
          await this.loadContexts(source.id, "ObjectType");
          break;

        case "Category":
          await this.loadCategoryContexts(source.id);
          break;

        case "CloudType":
          await this.loadCloudTypeContexts(source.id);
          break;

        default:
          break;
      }
    }
    finally {
      utils.hideContextLoader();
    }
  },
  refreshCommonSection: async function () {
    switch (this.activeLeftPanelTab) {
      case "liveActions":
        await this.refreshContexts();
        break;

      case "projects":
        await this.loadProjects();

        if (this.selectedProjectFolderData) {
          this.showProjectFolderFiles(this.selectedProjectFolderData);
        }
        break;

      case "liveWebsite":
        if (this.selectedLiveWebsite) {
          await this.loadLiveWebsiteFiles(this.selectedLiveWebsite,true);
        }
        break;

      case "pushQueues":
        if (window.pushQueuesPlugin?.cloudDRI) {
          await window.pushQueuesPlugin.loadTable(window.pushQueuesPlugin.cloudDRI,true);
        }
        break;
    }
  },
  renderContextsFromCache: function (list) {
    var common = this.showCommonContextBox({
      placeholder: "Search Contexts",
      showRefresh: true
    });

    if (!common) return;

    var container = common.container;
    var search = common.search;
    var self = this;

    new drawTable({
      container: container,
      data: list || [],
      fields: [
        {
          label: "Name",
          render: function (item) {
            return item.Object ? item.Object.Name || "" : "";
          }
        },
        {
          label: "Last Edited On",
          render: function (item) {
            return item["Last Edited On"] || "";
          }
        },
        {
          label: "Last Edited By",
          render: function (item) {
            return item["Last Edited By"] || "";
          }
        }
      ],
      emptyText: "No Contexts Found",
      onRowClick: function (context) {
        var contextObject = context.Object;
        if (!contextObject) return;

        var contextControl = contextObject["Context Control__699483795"];
        if (contextControl === "Inherited") {
          return;
        }
        self.openContextInEditor(contextObject.Id, contextObject.Name);
      }
    });

    // IMPORTANT : Set ContextId on every row
    setTimeout(function () {
      var rows = container.querySelectorAll("tbody tr");
      rows.forEach(function (row, index) {
        var item = (list || [])[index];
        if (item && item.Object) {
          row.dataset.contextId = item.Object.Id;
        }
      });
    }, 0);
    search.oninput = function () {
      var text = this.value.toLowerCase();
      container.querySelectorAll("tbody tr").forEach(function (row) {
        row.style.display = row.textContent.toLowerCase().includes(text)? "": "none";
      });
    };
  },
  renderTreeFromCache: function(parentDiv, list, type) {

    var container = document.createElement("div");
    container.className = "children";
    container.style.marginLeft = "20px";
    list.forEach(child => {
      var div = document.createElement("div");
      div.innerHTML = `
        <span class="toggle">[+] </span>
        <span class="label">${child["Formatted Name"]}</span>
      `;
      div.dataset.open = "false";
      div.querySelector(".toggle").addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.loadChildNodes(div, child.HierarchyPosition);
      });
      div.querySelector(".label").addEventListener("click", async (e) => {
        e.stopPropagation();
        this.setSelectedNode(div);
        if (type === "Category") {
          this.setContextSourceLabel("Category",child["Formatted Name"]);

          this.lastContextSource = {
            action: "Category",
            id: child.Id || child.HierarchyPosition
          };
          await this.loadCategoryContexts(child.Id || child.HierarchyPosition);
        } else {
          this.setContextSourceLabel("CloudType",child["Formatted Name"]);

          this.lastContextSource = {
            action: "CloudType",
            id: child.Id || child.HierarchyPosition
          };
          await this.loadCloudTypeContexts(child.Id || child.HierarchyPosition);
        }
      });
      container.appendChild(div);
    });

    parentDiv.appendChild(container);
    parentDiv.dataset.open = "true";
    this.setToggleState(parentDiv, true);
  },
  saveContext: async function (contextId) {
    try {
      var url = "http://prerelease.liveplatform.com/SetSourceCode.do" +"?ContextId=" + contextId +"&Mode=" + this.mode;
      var code = this.monacoEditor.getValue();

      var response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "SourceCode=" + encodeURIComponent(code)
      });
      var text = await response.text();
      var tab = this.allContexts.find(t => t.contextId == contextId);
      if (tab && tab.model) {
        tab.originalContent = tab.model.getValue();
      }
    } catch (err) {
      console.error(err);
      utils.showSnackbar("Failed to save context.", "error");
    }
  },
  initializeSaveModal: function () { 
    var modal = document.getElementById("saveModal");
    document.getElementById("saveBtn").addEventListener("click", async () => {
      var tabId = this.pendingCloseTabId;
      if (!tabId) return;
      var tab = this.allContexts.find(t => t.id === tabId);
      var saved = true;
      if (tab?.contextId) {
        await this.saveContext(tab.contextId);
      } else {
        saved = await this.saveCurrentFile();

        // User clicked Cancel or closed Save dialog
        if (!saved) {
          modal.style.display = "none";
          this.pendingCloseTabId = null;
          return;
        }
      }
      modal.style.display = "none";
      this.closeTab(tabId);
      this.pendingCloseTabId = null;
    });
    document.getElementById("dontSaveBtn").addEventListener("click", () => {
      var tabId = this.pendingCloseTabId;
      modal.style.display = "none";
      if (tabId) {
        this.closeTab(tabId);
      }
      this.pendingCloseTabId = null;
    });
    document.getElementById("cancelBtn").addEventListener("click", () => {
      modal.style.display = "none";
      this.pendingCloseTabId = null;
    });
  },
  confirmCloseTab: function (tabId) {
    var tab = this.allContexts.find(t => t.id === tabId);
    if (!tab) return;
    var isDirty = false;

    if (tab.model && typeof tab.originalContent === "string") {

      var original = tab.originalContent.replace(/\r\n/g, "\n");
      var current = tab.model.getValue().replace(/\r\n/g, "\n");
      isDirty = original !== current;
    }
    if (!isDirty) {
      this.closeTab(tabId);
      return;
    }
    this.pendingCloseTabId = tabId;
    var modal = document.getElementById("saveModal");
    modal.style.display = "flex";
  },
  toggleContexts: function(show) {
    var box = document.getElementById("commonContextBox");
    if (box) {
      box.style.display = show ? "block" : "none";
    }
  },
  showContextsLoading: function () {
    this.toggleContexts(true);
    new drawTable({
      container: document.getElementById("commonTableContainer"),
      data: [],
      fields: [
        {
          label: "Name",
          field: "Name"
        },
        {
          label: "Last Modified",
          field: "Last Edited On"
        },
        {
          label: "Last Edited By",
          field: "Last Edited By"
        }
      ],
      emptyText: "Loading..."
    });
  },

  showContextsError: function () {
    new drawTable({
      container: document.getElementById("commonTableContainer"),
      data: [],
      fields: [
        {
          label: "Name",
          field: "Name"
        },
        {
          label: "Last Modified",
          field: "Last Edited On"
        },
        {
          label: "Last Edited By",
          field: "Last Edited By"
        }
      ],
      emptyText: "Failed to load contexts"
    });
  },
  showContextControls: function () {
    var box = document.getElementById("commonContextBox");
    if (!box) return;
    box.style.display = "block";
  },
  initializeScriptLogin: function () {
    var button = document.getElementById("loadScriptButton");
    var urlInput = document.getElementById("scriptUrlInput");
    var checkbox = document.getElementById("showHiddenFiles");
    if (!button || !urlInput)return;

    var savedUrl = localStorage.getItem("scriptUrl");
    if (savedUrl) {
      urlInput.value = savedUrl;
      this.scriptDomain = savedUrl;
    }
    button.addEventListener("click", async () => {
      var domain = urlInput.value.trim();
      if (!domain) {
        utils.showSnackbar("Unable to login to this script URL, please ensure the URL is valid.","error");
        return;
      }

      domain = domain.replace(/\/+$/, "");
      this.scriptDomain = domain;
      localStorage.setItem("scriptUrl", domain);

      var username = localStorage.getItem("loginUserName");
      var password = localStorage.getItem("loginPassword");

      if (!username || !password) {
        utils.showSnackbar("Please login first.");
        return;
      }

      try {
        button.disabled = true;
        button.textContent = "Processing...";

        var loginResp = await fetch(domain + "/login.do", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            UserName: username,
            Password: password
          })
        });
        var loginData = await loginResp.json();
        if (!loginData || loginData.Result === false) {
          throw new Error("Script login failed.");
        }

        if (checkbox && checkbox.checked) {
          await fetch(domain + "/ExecuteCustomCode.htm?ShowDebug=all", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: "ShowDebug=all"
          });
        }
        utils.showSnackbar("Script login successful.");
      }
      catch (e) {
        utils.showSnackbar("Script login failed.", "error");
      }
      finally {
        button.disabled = false;
        button.textContent = "Login";
      }
    });
  },
  runCustomScriptOnF5: async function () {
    var activeTab = document.querySelector("#tabsContainer .tab.active");
    try {
      this.showMiniLoader(activeTab);
      var domain = this.scriptDomain || localStorage.getItem("scriptUrl");
      if (!domain) {
        throw new Error("Script URL missing.");
      }

      var checkbox = document.getElementById("showHiddenFiles");

      var url = domain + "/ExecuteCustomCode.htm";
      if (checkbox && checkbox.checked) {
        url += "?ShowDebug=all";
      }

      var response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: checkbox && checkbox.checked ? "ShowDebug=all" : ""
      });

      var text = await response.text();

      if (!response.ok) {
        throw new Error(text || "Script execution failed.");
      }

      document.getElementById("executionPanel").classList.remove("hidden");
      document.getElementById("executionOutput").textContent = text;

      utils.showSnackbar("Script executed successfully.", "success");
    }
    catch (err) {
      document.getElementById("executionPanel").classList.remove("hidden");
      document.getElementById("executionOutput").textContent = err.message;
      utils.showSnackbar(err.message, "error");
    }
    finally {
      this.hideMiniLoader(activeTab);
    }
  },
  showScriptOutput: function (text) {
    var box = document.getElementById("scriptOutputBox");

    if (!box) {
      box = document.createElement("div");
      box.id = "scriptOutputBox";
      document.body.appendChild(box);
    }
    box.innerText = text;
  },
  showExecutionPanel: function (message) {
    var panel = document.getElementById("executionPanel");
    var loader = document.getElementById("executionLoader");
    var output = document.getElementById("executionOutput");
    var status = document.getElementById("executionStatus");
    var msg = document.getElementById("executionMessage");

    if (!panel || !loader || !output || !status || !msg) {
      return;
    }
    panel.classList.remove("hidden");
    loader.classList.remove("hidden");

    output.textContent = "";
    status.textContent = "Running...";
    msg.textContent = message || "Running script...";
  },
  updateExecutionOutput: function (text) {
    document.getElementById("scriptOutput").textContent = text || "";
  },
  finishExecutionPanel: function (text) {
    var loader = document.getElementById("executionLoader");
    var output = document.getElementById("executionOutput");
    var status = document.getElementById("executionStatus");
    if (!loader || !output || !status) {
      return;
    }
    loader.classList.add("hidden");
    status.textContent = "Completed";
    output.textContent = text || "";
  },
  hideExecutionPanel: function () {
    document.getElementById("executionPanel").classList.add("hidden");
  },
  toggleExecutionPanel: function () {
    document.getElementById("executionPanel").classList.toggle("hidden");
  },
  showExecutionResult: function (text) {
    document.getElementById("executionPanel").classList.remove("hidden");
    document.getElementById("executionOutput").textContent = text;
  },
  initializeAIPanel: function () {
    var sendBtn = document.getElementById("sendAiPrompt");
    var promptInput = document.getElementById("aiPrompt");

    if (!sendBtn || !promptInput) return;

    sendBtn.addEventListener("click", () => this.sendAiPrompt());
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendAiPrompt();
      }
    });
  },
  addAiMessage: function (text, role, isSystem, saveHistory = true) {
    var messages = document.getElementById("aiMessages");
    if (!messages) return;

    var entry = document.createElement("div");
    entry.className = "ai-message " + (role || "assistant");

    if (isSystem) {
      entry.classList.add("system");
    }

    entry.textContent = text || "";

    messages.appendChild(entry);
    messages.scrollTop = messages.scrollHeight;

    if (!saveHistory) return;

    var activeTab = this.allContexts.find(t => t.id === this.currentContextId);

    if (!activeTab) return;

    // Always keep aiMessages as Array
    if (!Array.isArray(activeTab.aiMessages)) {
      activeTab.aiMessages = [];
    }

    activeTab.aiMessages.push({
      role: role,
      text: text,
      isSystem: !!isSystem
    });
  },
  extractAiReply: function (payload) {
    if (payload === null || payload === undefined) {
      return "";
    }

    if (typeof payload === "string") {
      return payload.trim();
    }

    if (Array.isArray(payload)) {
      for (var i = 0; i < payload.length; i++) {
        var nested = this.extractAiReply(payload[i]);
        if (nested) {
          return nested;
        }
      }
      return "";
    }

    if (typeof payload === "object") {
      var keys = ["response","result","message","output","text","content","reply","answer","code","data","candidates","parts"];
      // First check known AI response fields
      for (var key in payload) {

        if (!Object.prototype.hasOwnProperty.call(payload, key)) {
          continue;
        }

        var lowerKey = key.toLowerCase();
        if (keys.indexOf(lowerKey) !== -1) {
          var value = this.extractAiReply(payload[key]);
          if (value) {
            return value;
          }
        }
      }

      // Fallback: recursively search other properties
      for (var prop in payload) {
        if (!Object.prototype.hasOwnProperty.call(payload, prop)) {
          continue;
        }
        var result = this.extractAiReply(payload[prop]);
        if (result) {
          return result;
        }
      }
    }
    return "";
  },
  sendAiPrompt: async function () {
    var promptInput = document.getElementById("aiPrompt");
    var sendBtn = document.getElementById("sendAiPrompt");

    if (!promptInput || !sendBtn) return;

    var activeTab = this.allContexts.find(
      t => t.id === this.currentContextId
    );

    if (!activeTab) {
      utils.showSnackbar("No file is open.", "warning");
      return;
    }

    if (!Array.isArray(activeTab.aiMessages)) {
      activeTab.aiMessages = [];
    }

    var prompt = promptInput.value.trim();

    if (!prompt) {
      utils.showSnackbar("Enter a prompt.", "warning");
      return;
    }

    // Save user message
    this.addAiMessage(prompt, "user");

    promptInput.value = "";
    sendBtn.disabled = true;

    // Loading message
    this.addAiMessage("Generating code...", "assistant", true);

    var messages = document.getElementById("aiMessages");
    var loadingNode = messages ? messages.lastElementChild : null;

    try {
      var domain = this.getSelectedEnterpriseDomain();
      var selectedCode = "";
      if (this.monacoEditor && this.monacoEditor.getSelection()) {
        var selection = this.monacoEditor.getSelection();

        if (selection) {
          selectedCode = this.monacoEditor.getModel().getValueInRange(selection);
        }
      }

      var payload = {
        prompt: prompt,
        selectedCode: selectedCode,
        fileCode: this.monacoEditor? this.monacoEditor.getValue() : ""
      };

      console.log("AI Request:", payload);

      var response = await fetch("http://" +domain +"/GetAICode.json?RenderItem=" +activeTab.contextId,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload)
        });
      console.log("AI HTTP Status:", response.status);
      if (!response.ok) {
        throw new Error("AI API returned HTTP " + response.status);
      }
      var data = await response.json();

      console.log("AI API Response:", data);

      // Remove loading UI
      if (loadingNode && loadingNode.parentNode) {
        loadingNode.parentNode.removeChild(loadingNode);
      }

      // Remove loading history
      activeTab.aiMessages = activeTab.aiMessages.filter(function (m) {
        return !(m.isSystem && m.text === "Generating code...");
      });

      var aiCode = "";

      if (data && typeof data.Code === "string" && data.Code.trim()) {
        aiCode = data.Code.trim();
      }

      if (!aiCode) {
        aiCode = this.extractAiReply(data);
      }

      if (!aiCode) {
        console.warn("AI response did not contain code/reply:",data);
        this.addAiMessage("No code returned from AI.","assistant",true);
        return;
      }
      this.renderAIResult(aiCode, activeTab);
    } catch (err) {

      console.error("AI request error:",err);

      if (loadingNode && loadingNode.parentNode) {
        loadingNode.parentNode.removeChild(loadingNode);
      }

      if (Array.isArray(activeTab.aiMessages)) {
        activeTab.aiMessages = activeTab.aiMessages.filter(function (m) {
          return !(m.isSystem && m.text === "Generating code...");
        });
      }
      this.addAiMessage("AI request failed.","assistant",true);
      utils.showSnackbar("AI request failed.","error");

    } finally {
      sendBtn.disabled = false;
      promptInput.focus();
    }
  },
  toggleAIPanel: function () {
    if (this.activeTabType === "pushQueues") {
      utils.showSnackbar("AI is not available in Push Queues.");
      return;
    }

    var panel = document.getElementById("aiPanel");
    panel.classList.toggle("hidden");

    if (!panel.classList.contains("hidden")) {
      document.getElementById("aiPrompt").focus();
    }
  },
  renderAIResult: function (code) {
    var messages = document.getElementById("aiMessages");
    if (!messages) return;

    var wrapper = document.createElement("div");
    wrapper.className = "ai-message assistant";

    var pre = document.createElement("pre");
    pre.className = "ai-code";
    pre.textContent = code;

    var applyBtn = document.createElement("button");
    applyBtn.className = "apply-ai-btn";
    applyBtn.textContent = "Apply";

    applyBtn.onclick = () => {
      if (!this.monacoEditor) return;

      this.monacoEditor.setValue(code);
      utils.showSnackbar("Code applied successfully.");
    };

    wrapper.appendChild(pre);
    wrapper.appendChild(applyBtn);
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  },
  renderAiMessages: function (tab) {
    var messages = document.getElementById("aiMessages");
    if (!messages) return;
    messages.innerHTML = "";

    if (!tab || !Array.isArray(tab.aiMessages)) {
      return;
    }
    tab.aiMessages.forEach(msg => {
      // Skip temporary loading message
      if (msg.isSystem && msg.text === "Generating code...") {
        return;
      }
      if (msg.code) {
        this.renderAIResult(msg.code, null);
      } else {
        // Don't save again while restoring
        this.addAiMessage(msg.text, msg.role, msg.isSystem, false);
      }
    });
    messages.scrollTop = messages.scrollHeight;
  },
  openPushQueuesTab: function (forceReload = false) {
    if (!forceReload && this.activeTabType === "liveWebsite") {
      return;
    }
    if (!forceReload && this.activeTabType === "pushQueues") {
      return;
    }
    this.activeTabType = "liveWebsite";
    this.activeTabType = "pushQueues";
    var container = document.getElementById("pushQueuesContainer");
    var editor = document.getElementById("monacoEditor");
    var liveWebsiteContainer = document.getElementById("liveWebsiteContainer");
    var pushQueuesTab = document.getElementById("pushQueuesTab");
    var liveWebsiteTab = document.getElementById("liveWebsite");

    if (!container) {
      return;
    }
    container.style.display = "flex";
    var pushQueueSection = document.getElementById("pushQueueSection");
    if (pushQueueSection) {
      pushQueueSection.style.display = "block";
    }
    if (editor) {
      editor.style.display = "none";
    }

    if (liveWebsiteContainer) {
      liveWebsiteContainer.style.display = "none";
    }
    if (pushQueuesTab) {
      pushQueuesTab.classList.add("active");
    }

    if (liveWebsiteTab) {
      liveWebsiteTab.classList.remove("active");
    }
    var aiBtn = document.getElementById("aiTabButton");

    if (aiBtn) {
      aiBtn.disabled = true;
    }
    if (!window.pushQueuesPlugin) {
      // First time only
      window.pushQueuesPlugin = new pushQueuesContent();
    } else {
      var pushQueue = window.pushQueuesPlugin;
      var commonContextBox = document.getElementById("commonContextBox");
      if (commonContextBox) {
        commonContextBox.style.display = "block";
      }
      if (pushQueue.pushQueueClouds && pushQueue.pushQueueClouds.length) {
        pushQueue.setupCloudSearch();
        pushQueue.restoreSelectedQueue();

      } else {
        pushQueue.loadMainCloud();
      }
    }
    if (this.monacoEditor) {
      this.monacoEditor.layout();
    }
  },
  openLiveWebsiteTab: async function (forceReload = false) {
    if (!forceReload && this.activeTabType === "liveWebsite") {
      return;
    }

    this.activeTabType = "liveWebsite";

    var container = document.getElementById("liveWebsitePanel");
    var editor = document.getElementById("monacoEditor");

    if (!container || !editor) {
      return;
    }

    container.style.display = "block";
    editor.style.display = "none";
    var pushQueuesContainer = document.getElementById("pushQueuesContainer");

    if (pushQueuesContainer) {
      pushQueuesContainer.style.display = "none";
    }

    var pushQueueSection = document.getElementById("pushQueueSection");

    if (pushQueueSection) {
      pushQueueSection.style.display = "none";
    }

    var pushQueuesTab = document.getElementById("pushQueuesTab");
    var liveWebsiteTab = document.getElementById("liveWebsite");

    if (liveWebsiteTab) {
      liveWebsiteTab.classList.add("active");
    }

    if (pushQueuesTab) {
      pushQueuesTab.classList.remove("active");
    }

    var aiBtn = document.getElementById("aiTabButton");

    if (aiBtn) {
      aiBtn.disabled = true;
    }
    if (!this.liveWebsiteInitialized) {
      this.liveWebsiteInitialized = true;
      await this.initializeLiveWebsiteTab();
    }

    var selectedWebsite = this.selectedLiveWebsite;
    if (!selectedWebsite) {
      var savedWebsite = localStorage.getItem("selectedLiveWebsite");
      if (savedWebsite) {
        try {
          selectedWebsite = JSON.parse(savedWebsite);
          this.selectedLiveWebsite = selectedWebsite;
          this.currentLiveWebsiteId = selectedWebsite.Id;

        } catch (e) {
          console.error("Invalid saved LiveWebsite:",e);
          selectedWebsite = null;
        }
      }
    }

    if (selectedWebsite) {
      this.renderLiveWebsiteLibrary();
      await this.loadLiveWebsiteFiles(selectedWebsite);
    }
    if (this.monacoEditor) {
      this.monacoEditor.layout();
    }
  },
  restoreLiveWebsiteSelection: function () {
    var enterprise = localStorage.getItem("selectedLiveWebsiteEnterprise");
    var brand = localStorage.getItem("selectedLiveWebsiteBrand");
    var website = localStorage.getItem("selectedLiveWebsite");

    try {
      this.selectedLiveWebsiteEnterprise = enterprise? JSON.parse(enterprise) : null;
    } catch (e) {
      this.selectedLiveWebsiteEnterprise = null;
    }

    try {
      this.selectedBrand = brand? JSON.parse(brand) : null;
    } catch (e) {
      this.selectedBrand = null;
    }

    try {
      this.selectedLiveWebsite = website? JSON.parse(website): null;
    } catch (e) {
      this.selectedLiveWebsite = null;
    }
  },
  initializeLiveWebsiteTab: async function () {
    this.restoreLiveWebsiteSelection();

    var input = document.getElementById("liveWebsiteEnterpriseInput");
    var dropdown = document.getElementById("liveWebsiteEnterpriseDropdown");

    if (!input || !dropdown) {
      return;
    }

    var selectedText = input.querySelector(".selected-text");
    var search = dropdown.querySelector(".search");
    var options = dropdown.querySelector(".options");
    var noResult = dropdown.querySelector(".no-result");

    if (!selectedText || !options) {
      return;
    }
    var self = this;
    function getEnterpriseName(enterprise) {
      return enterprise? (enterprise["Formatted Name"] ||enterprise.FormattedName ||enterprise.Name ||"Unnamed"): "Unnamed";
    }

    function renderEnterprises(list) {
      options.innerHTML = "";

      if (!list || !list.length) {
        if (noResult) {
          noResult.style.display = "block";
        }
        return;
      }
      if (noResult) {
        noResult.style.display = "none";
      }

      list.forEach(function (enterprise) {
        var option = document.createElement("div");
        option.className = "dropdown-option";
        option.textContent = getEnterpriseName(enterprise);
        option.dataset.id = enterprise.Id || "";

        option.onclick = async function (e) {
          e.stopPropagation();
          selectedText.textContent = getEnterpriseName(enterprise);
          self.selectedLiveWebsiteEnterprise = enterprise;
          localStorage.setItem("selectedLiveWebsiteEnterprise",JSON.stringify(enterprise));

          dropdown.style.display = "none";

          // Enterprise changed,
          // therefore old brand/website selection is no longer valid.
          self.selectedBrand = null;
          self.selectedLiveWebsite = null;
          self.currentBrandId = null;
          self.currentLiveWebsiteId = null;
          self.brands = [];
          self.liveWebsiteLibraries = [];

          localStorage.removeItem("selectedLiveWebsiteBrand");
          localStorage.removeItem("selectedLiveWebsite");

          var brandSection = document.getElementById("brandSection");

          if (brandSection) {
            brandSection.style.display = "block";
          }

          await self.loadBrands(enterprise);
        };
        options.appendChild(option);
      });
    }
    // Initial enterprise list
    renderEnterprises(this.enterprises || []);
    // Enterprise search
    if (search) {
      search.oninput = function (e) {
        e.stopPropagation();
        var value = this.value.trim().toLowerCase();
        var filtered = (self.enterprises || []).filter(function (enterprise) {
          return getEnterpriseName(enterprise).toLowerCase().includes(value);
        });
        renderEnterprises(filtered);
      };
    }

    // Enterprise dropdown toggle
    input.onclick = function (e) {
      e.stopPropagation();
      var brandDropdown = document.getElementById("liveWebsiteBrandDropdown");
      if (brandDropdown) {
        brandDropdown.style.display = "none";
      }
      dropdown.style.display = dropdown.style.display === "block" ? "none": "block";
    };

    dropdown.onclick = function (e) {
      e.stopPropagation();
    };

    // Restore saved enterprise
    var enterpriseToLoad = null;

    if (this.selectedLiveWebsiteEnterprise) {
      enterpriseToLoad = (this.enterprises || []).find(function (enterprise) {
        return enterprise.Id == self.selectedLiveWebsiteEnterprise.Id;
      });
    }

    // Default enterprise
    if (!enterpriseToLoad) {
      enterpriseToLoad = (this.enterprises || []).find(function (enterprise) {
        return getEnterpriseName(enterprise).toLowerCase() === "liveplatform";
      });
    }

    if (!enterpriseToLoad) {
      return;
    }
    selectedText.textContent = getEnterpriseName(enterpriseToLoad);
    this.selectedLiveWebsiteEnterprise = enterpriseToLoad;
    localStorage.setItem("selectedLiveWebsiteEnterprise",JSON.stringify(enterpriseToLoad));

    var brandSection = document.getElementById("brandSection");
    if (brandSection) {
      brandSection.style.display = "block";
    }
    // Load brands only when required
    if (this.currentEnterpriseId !== enterpriseToLoad.Id ||!Array.isArray(this.brands) ||!this.brands.length) {
      this.currentEnterpriseId = enterpriseToLoad.Id;
      await this.loadBrands(enterpriseToLoad);
    }
  },
  loadBrands: async function (enterprise) {
    var brandInput = document.getElementById("liveWebsiteBrandInput");
    var brandDropdown = document.getElementById("liveWebsiteBrandDropdown");

    if (!brandInput || !brandDropdown || !enterprise) {
      return;
    }

    var selectedText = brandInput.querySelector(".selected-text");
    var search = brandDropdown.querySelector(".search");
    var options = brandDropdown.querySelector(".options");
    var noResult = brandDropdown.querySelector(".no-result");

    if (!selectedText || !options) {
      return;
    }

    var self = this;
    function getBrandName(brand) {
      if (!brand) {
        return "Unnamed Brand";
      }
      return (brand.Name ||brand.name ||(brand.Fields && brand.Fields.Name) ||"Unnamed Brand");
    }

    // Already loaded
    if (this.currentEnterpriseId === enterprise.Id && Array.isArray(this.brands) && this.brands.length) {
      if (this.selectedBrand) {
        selectedText.textContent = getBrandName(this.selectedBrand);
      }

      brandInput.classList.remove("disabled");
      brandInput.classList.remove("loading");

      return;
    }

    brandInput.classList.add("disabled");
    brandInput.classList.add("loading");

    selectedText.textContent = "";

    var oldDomain = GlobalDomain;
    GlobalDomain = "https://liveplatform.com";

    try {
      utils.showContextLoader();
      var cloudName = "[" + enterprise.Id + "]Brands";
      var brandCloud = await utils.getCloud(enterprise["Direct Resource Identifier"],cloudName);
      if (!brandCloud || !brandCloud.DRI) {
        selectedText.textContent = "No Brands Found";
        this.brands = [];
        return;
      }

      this.brandCloudDRI = brandCloud.DRI;
      var data = await utils.getItems(brandCloud.DRI,"Name",true,1,9999);

      if (Array.isArray(data.Results)) {
        this.brands = data.Results;
      } else if (Array.isArray(data.Items)) {
        this.brands = data.Items;
      } else {
        this.brands = [];
      }


      function renderBrands(list) {
        options.innerHTML = "";

        if (!list || !list.length) {
          if (noResult) {
            noResult.style.display = "block";
          }
          return;
        }
        if (noResult) {
            noResult.style.display = "none";
        }

        list.forEach(function (brand) {
          var option = document.createElement("div");
          option.className = "dropdown-option";
          option.textContent = getBrandName(brand);
          option.addEventListener("click", async function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("BRAND SELECTED:", brand);
            selectedText.textContent = getBrandName(brand);
            self.selectedBrand = brand;
            localStorage.setItem("selectedLiveWebsiteBrand",JSON.stringify(brand));

            brandDropdown.style.display = "none";

            // Reset old website
            self.selectedLiveWebsite = null;
            self.currentLiveWebsiteId = null;

            localStorage.removeItem("selectedLiveWebsite");

            try {
              utils.showContextLoader("liveWebsiteTree");
              await self.loadLiveWebsiteLibrary(enterprise,brand);
            }
            catch (error) {
              console.error("Load LiveWebsite Library Error:",error);
            }
            finally {
              utils.hideContextLoader("liveWebsiteTree");
            }
          });
          options.appendChild(option);
        });
      }
      renderBrands(this.brands);
      // Restore previously selected brand
      if (this.selectedBrand) {
        var savedBrand = this.brands.find(function (brand) {
          return (brand.Id === self.selectedBrand.Id ||getBrandName(brand) === getBrandName(self.selectedBrand));
        });

        if (savedBrand) {
          selectedText.textContent = getBrandName(savedBrand);
          this.selectedBrand = savedBrand;
          localStorage.setItem("selectedLiveWebsiteBrand",JSON.stringify(savedBrand));
          await this.loadLiveWebsiteLibrary(enterprise,savedBrand);
        }
      }

      // Search
      if (search) {
        search.oninput = function (e) {
          e.stopPropagation();
          var value = this.value.trim().toLowerCase();
          var filtered = (self.brands || []).filter(function (brand) {
            return getBrandName(brand).toLowerCase().includes(value);
          });

          renderBrands(filtered);
        };
      }
      brandInput.onclick = function (e) {
        e.stopPropagation();
        if (brandInput.classList.contains("disabled")) {
          return;
        }
        var enterpriseDropdown = document.getElementById("liveWebsiteEnterpriseDropdown");

        if (enterpriseDropdown) {
          enterpriseDropdown.style.display = "none";
        }
        brandDropdown.style.display = brandDropdown.style.display === "block"? "none": "block";
      };

      brandDropdown.onclick = function (e) {
        e.stopPropagation();
      };
    }
    catch (error) {
      console.error("Load brands error:", error);
      selectedText.textContent = "Failed to load brands";
      this.brands = [];
    }
    finally {
      brandInput.classList.remove("loading");
      brandInput.classList.remove("disabled");
      utils.hideContextLoader();
      GlobalDomain = oldDomain;
    }
  },
  loadLiveWebsiteLibrary: async function (enterprise, brand) {
    if (!enterprise || !brand) {
      return;
    }

    var self = this;

    // Same brand already loaded
    if (this.currentBrandId === brand.Id && Array.isArray(this.liveWebsiteLibraries) && this.liveWebsiteLibraries.length) {
      this.renderLiveWebsiteLibrary();
      // Restore selected website
      if (this.selectedLiveWebsite) {
        var selectedWebsite = this.liveWebsiteLibraries.find(function (website) {
          return (website.Id === self.selectedLiveWebsite.Id ||website.Name === self.selectedLiveWebsite.Name);
        });

        if (selectedWebsite) {
          self.selectedLiveWebsite = selectedWebsite;
          self.currentLiveWebsiteId = selectedWebsite.Id;

          self.renderLiveWebsiteLibrary();
          await self.loadLiveWebsiteFiles(selectedWebsite);
        }
      }
      return;
    }
    this.currentBrandId = brand.Id;

    var oldDomain = GlobalDomain;
    GlobalDomain = "https://liveplatform.com";

    try {
      var brandDRI = brand["Direct Resource Identifier"] ||brand.DRI;
      var brandId = brand.Id;
      if (!brandDRI || !brandId) {
        console.warn("Brand DRI or ID missing.");
        return;
      }

      var cloudName = "[" + brandId + "]LiveWebsite Library";

      var libraryCloud = await utils.getCloud(brandDRI,cloudName);
      if (!libraryCloud || !libraryCloud.DRI) {
        console.warn("LiveWebsite Library cloud not found.");
        return;
      }
      this.libraryCloudDRI = libraryCloud.DRI;
      var data = await utils.getItems(libraryCloud.DRI,"Name",true,1,9999);
      this.liveWebsiteLibraries = Array.isArray(data.Results) ? data.Results : Array.isArray(data.Items) ? data.Items: [];

      this.renderLiveWebsiteLibrary();

      // Restore website
      if (this.selectedLiveWebsite) {
        var restored = this.liveWebsiteLibraries.find(function (website) {
          return (website.Id === self.selectedLiveWebsite.Id ||website.Name === self.selectedLiveWebsite.Name);
        });
        if (restored) {
          this.selectedLiveWebsite = restored;
          this.currentLiveWebsiteId = restored.Id;
          this.renderLiveWebsiteLibrary();
          if (this.activeTabType === "liveWebsite") {
            await this.loadLiveWebsiteFiles(restored);
          }
        }
      }
    }
    catch (error) {
      console.error("LiveWebsite Library Load Error:",error);
    }
    finally {
      GlobalDomain = oldDomain;
    }
  },
  renderLiveWebsiteLibrary: function () {
    var tree = document.getElementById("liveWebsiteTree");

    if (!tree) {
      return;
    }

    tree.innerHTML = "";
    var self = this;
    var libraries = Array.isArray(this.liveWebsiteLibraries)? this.liveWebsiteLibraries: [];

    libraries.forEach(function (website) {
      var item = document.createElement("span");
      item.className = "livewebsite-item";
      item.textContent = website.Name ||website.name ||"Unnamed";

      if (self.selectedLiveWebsite &&(self.selectedLiveWebsite.Id === website.Id ||self.selectedLiveWebsite.Name === website.Name)) {
        item.classList.add("selected");
      }
      item.onclick = async function (e) {
        e.stopPropagation();
        tree.querySelectorAll(".livewebsite-item").forEach(function (x) {
          x.classList.remove("selected");
        });

        item.classList.add("selected");

        self.selectedLiveWebsite = website;
        self.currentLiveWebsiteId = website.Id;
        localStorage.setItem("selectedLiveWebsite",JSON.stringify(website));

        utils.showContextLoader("commonTableContainer");
        try {
          await self.loadLiveWebsiteFiles(website);
        } finally {
          utils.hideContextLoader("commonTableContainer");
        }
      };
      tree.appendChild(item);
    });
  },
  getLiveWebsiteFiles: async function (library) {
    if (!library) {
      console.warn("LiveWebsite library missing.");
      return [];
    }
    var oldDomain = GlobalDomain;
    GlobalDomain = "https://liveplatform.com";
    try {
      var libraryDRI = library["Direct Resource Identifier"] || library.DRI;
      var libraryId = library.Id;

      if (!libraryDRI || !libraryId) {
        console.warn("Library DRI or ID missing.");
        return [];
      }

      var cloudName = "[" + libraryId + "]Files";
      var filesCloud = await utils.getCloud(libraryDRI,cloudName);

      if (!filesCloud || !filesCloud.DRI) {
        console.warn("Files cloud not found:",cloudName);
        return [];
      }
      this.liveWebsiteFilesCloudDRI = filesCloud.DRI;
      var data = await utils.getItems(filesCloud.DRI,"Name||Created By||Created On",true,1,9999);

      return Array.isArray(data.Results) ? data.Results : Array.isArray(data.Items)? data.Items: [];
    }
    catch (error) {
      console.error("Get LiveWebsite Files Error:",error);
      return [];
    }
    finally {
      GlobalDomain = oldDomain;
    }
  },
  loadLiveWebsiteFiles: async function (library, refresh = false) {
    if (!library) {
      return;
    }
    this.selectedLiveWebsite = library;
    this.currentLiveWebsiteId = library.Id;
    localStorage.setItem("selectedLiveWebsite",JSON.stringify(library));

    var self = this;

    var common = this.showCommonContextBox({
      label: library.Name || "Live Website",
      placeholder: "Search Website Files",
      showRefresh: false
    });

    if (!common) {
      return;
    }

    var container = common.container;
    var search = common.search;
    utils.showContextLoader("commonTableContainer");

    try {
      var cacheKey = library["Direct Resource Identifier"] ||library.DRI ||library.Id ||library.Name;
      var files;

      if (!this.liveWebsiteFilesCache) {
        this.liveWebsiteFilesCache = new Map();
      }

      if (refresh) {
        console.log("LiveWebsite refresh - clearing cache:",cacheKey);
        this.liveWebsiteFilesCache.delete(cacheKey);
      }
      // Already loaded
      if (!refresh && this.liveWebsiteFilesCache.has(cacheKey)) {
        var cached = this.liveWebsiteFilesCache.get(cacheKey);

        // Promise still running
        if (cached && typeof cached.then === "function") {
          files = await cached;
        } else {
          files = cached;
        }

      } else {
        var request = this.getLiveWebsiteFiles(library);
        this.liveWebsiteFilesCache.set(cacheKey, request);
        try {
          files = await request;
          this.liveWebsiteFilesCache.set(cacheKey, files);

        } catch (error) {
          this.liveWebsiteFilesCache.delete(cacheKey);
          throw error;
        }
      }

      new drawTable({
        container: container,
        data: files,
        fields: [
          {
            label: "Name",
            field: "Name"
          },
          {
            label: "Created By",
            field: "Created By"
          },
          {
            label: "Created On",
            field: "Created On"
          }
        ],
        emptyText: "No Files Found",

        onRowClick: function (file) {
          self.openLiveWebsiteFile(file);
        }
      });

      if (search) {
        search.oninput = function () {
          var text = this.value.toLowerCase().trim();
          container.querySelectorAll("tbody tr").forEach(function (row) {
            row.style.display = row.textContent.toLowerCase().includes(text) ? "": "none";
          });
        };
      }
    } catch (error) {
      console.error("Load LiveWebsite Files Error:",error);

    } finally {
      utils.hideContextLoader("commonTableContainer");
    }
  },
  getLiveWebsiteFileName: function (file) {
    if (!file) return "untitled.txt";
    return file.Name || file.name || file["File Name"] || file["fileName"] || "untitled.txt";
  },
  getLiveWebsiteFileContent: function (file) {
    if (!file) return "";
    if (typeof file.Content === "string") return file.Content;
    if (typeof file.content === "string") return file.content;
    if (typeof file.Text === "string") return file.Text;
    if (typeof file.text === "string") return file.text;
    if (typeof file.Code === "string") return file.Code;
    if (typeof file.code === "string") return file.code;
    return this.getDefaultLiveWebsiteFileContent(this.getLiveWebsiteFileName(file));
  },
  getDefaultLiveWebsiteFileContent: function (fileName) {
    var ext = (fileName || "").split(".").pop().toLowerCase();
    switch (ext) {
      case "html":
      case "htm":
        return "<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Hello from LiveWebsite</h1>\n  </body>\n</html>";
      case "css":
        return "body {\n  font-family: Arial, sans-serif;\n  color: #333;\n}";
      case "js":
        return "console.log('Hello from LiveWebsite');";
      case "xml":
        return "<root>\n  <message>Hello</message>\n</root>";
      case "frm":
        return "<!-- Form template -->\n<form>\n  <input type=\"text\" />\n</form>";
      case "json":
        return "{\n  \"name\": \"livewebsite\"\n}";
      default:
        return "";
    }
  },
  isAllowedLiveWebsiteFile: function (fileName) {
    if (!fileName) return false;
    var ext = fileName.split(".").pop().toLowerCase();
    return ["html", "css", "js", "xml", "htm", "frm", "json"].includes(ext);
  },
  openLiveWebsiteFile: function (file) {
    if (!file) {
      return;
    }
    var fileName = this.getLiveWebsiteFileName(file);
    var editor = document.getElementById("monacoEditor");
    if (!editor || !this.monacoEditor) {
      return;
    }
    // Show Monaco
    editor.style.display = "block";

    // Keep LiveWebsite panel visible
    var liveWebsitePanel = document.getElementById("liveWebsitePanel");

    if (liveWebsitePanel) {
      liveWebsitePanel.style.display = "block";
    }
    // Hide Push Queues
    var pushQueuesContainer = document.getElementById("pushQueuesContainer");

    if (pushQueuesContainer) {
      pushQueuesContainer.style.display = "none";
    }

    // File type validation
    if (!this.isAllowedLiveWebsiteFile(fileName)) {
      utils.showSnackbar("This file type is not allowed for editing.","warning");
      var messageModel = monaco.editor.createModel("File type not allowed for editing.","plaintext");

      this.monacoEditor.setModel(messageModel);
      this.monacoEditor.focus();
      return;
    }

    // Check existing tab
    var existing = this.allContexts.find(function (tab) {

      return (tab.type === "LiveWebsite" && tab.fileName === fileName);
    });

    if (existing) {
      this.currentContextId = existing.id;
      this.monacoEditor.setModel(existing.model);
      this.renderTabs();
      this.renderAiMessages(existing);
      this.monacoEditor.focus();
      return;
    }
    var content = this.getLiveWebsiteFileContent(file);
    var language = this.getMonacoLanguage(fileName);
    var model = monaco.editor.createModel(content,language);
    var tab = {
      id: "website_" + Date.now(),
      name: fileName,
      fileName: fileName,
      type: "LiveWebsite",
      model: model,
      originalContent:
        model.getValue(),
      liveWebsiteFile: file,
      aiMessages: [],
      lastAIResult: null
    };
    this.allContexts.push(tab);
    this.currentContextId = tab.id;
    this.monacoEditor.setModel(model);
    this.renderTabs();
    this.renderAiMessages(tab);
    this.monacoEditor.layout();
    this.monacoEditor.focus();
  },
  getFileIcon: function (fileName) {
    if (!fileName) return "";
    var ext = fileName.split(".").pop().toLowerCase();
    var icons = {
      html: "",
      css: "",
      js: "",
      json: "",
      png: "",
      jpg: "",
      jpeg: "",
      gif: "",
      svg: "",
      txt: ""
    };
    return icons[ext] || "";
  },
  createNewLiveWebsite: function () {
    var name = prompt("Enter LiveWebsite name:");
    if (!name) return;
    utils.showSnackbar("Creating new LiveWebsite: " + name + "...", "info");
  },
  addFileToLiveWebsite: function () {
    var fileName = prompt("Enter file name:");
    if (!fileName) return;
    utils.showSnackbar("Adding file: " + fileName + "...", "info");
  },
  initializeSectionToggle: function (buttonId, panelId) {
    var button = document.getElementById(buttonId);
    var panel = document.getElementById(panelId);

    if (!button || !panel) return;
    button.onclick = () => {
      if (panel.style.display === "none") {
        panel.style.display = "block";
        button.innerHTML = "▼";
      } else {
        panel.style.display = "none";
        button.innerHTML = "▲";
      }
      if (this.monacoEditor) {
        this.monacoEditor.layout();
      }
    };
  },
  initializePushQueuesPanel: function () {
    var panel = document.getElementById("pushQueuesPanel");
    var toggle = document.getElementById("pushQueuesToggle");
    var expand = document.getElementById("pushQueuesExpand");

    if (!panel) {
      return;
    }
    var layoutEditor = () => {
      requestAnimationFrame(() => {
        this.monacoEditor.layout();
      });
    };
    if (toggle) {
      toggle.onclick = () => {
        panel.classList.add("collapsed");
      };
    }

    if (expand) {
      expand.onclick = () => {
        panel.classList.remove("collapsed");
      };
    }
    panel.addEventListener("transitionend", () => {
      layoutEditor();
    });
  }, 
  loadProjects: async function () {
    try {
      var result = await window.electronAPI.getProjects();
      if (!result || !result.success) {
        return;
      }

      this.projectRoot = result.root;
      this.projectTreeItems = result.items || [];

      // Always refresh the project tree
      this.renderProjectTree(this.projectTreeItems);
    }
    catch (error) {
      console.error("Load projects error:", error);
    }
  },
  initializeProjectsToggle: function () {
    var toggle = document.getElementById("projectsToggle");
    var label = document.getElementById("projectsLabel");
    var panel = document.getElementById("projectExplorerPanel");
    var filesSection = document.getElementById("filesSection");

    if (!toggle || !panel) {
      return;
    }
    toggle.onclick = () => {
      var isOpen = panel.style.display === "block";
      if (isOpen) {
        panel.style.display = "none";
        toggle.textContent = "[+]";

        if (filesSection) {
            filesSection.style.display = "none";
        }
        return;
      }
      panel.style.display = "block";
      toggle.textContent = "[-]";
      this.renderProjectTree(this.projectTreeItems || []);
    };
    if (label) {
      label.onclick = (e) => {
        e.stopPropagation();
        if (!this.projectRoot) {
          return;
        }
        // remove old selection
        document.querySelectorAll(".project-item, .project-header").forEach(function (item) {
          item.classList.remove("tree-selected");
        });
        // select Projects header
        var projectHeader = document.querySelector(".project-header");

        if (projectHeader) {
          projectHeader.classList.add("tree-selected");
        }
        var rootFolder = {
          name: "Projects",
          path: this.projectRoot,
          children: this.projectTreeItems || []
        };
        this.selectedProjectFolder = rootFolder.path;
        this.selectedProjectFolderData = rootFolder;
        this.showProjectFolderFiles(rootFolder,true);
      };
    }
  },
  initializeProjects: function () {
    var newProjectBtn = document.getElementById("newProjectBtn");
    if (newProjectBtn) {
      newProjectBtn.onclick = () => {
        this.showCreateProjectMenu();
      };
    }

    var projectPlusBtn = document.getElementById("projectPlusBtn");
    if (projectPlusBtn) {
      projectPlusBtn.onclick = () => {
        this.showCreateProjectPopup();
      };
    }
    this.loadProjects();
  },
  showCreateProjectMenu: function () {
    var type = prompt("Enter:\nproject\nfolder\nfile");
    if (!type) return;
    if (type === "project") {
      this.createProject();
    }
    else if (type === "folder") {
      this.createFolder();
    }
    else if (type === "file") {
      this.createFile();
    }
  },
  createProject: async function () {
    var name = prompt("Project Name");
    if (!name) return;
    await window.electronAPI.createProjectFolder(this.projectRoot + "\\" + name);
    this.loadProjects();
  },
  createFolder: async function () {
    if (!this.selectedProjectFolder) {
      utils.showSnackbar("Select Folder");
      return;
    }
    var name = prompt("Folder Name");
    if (!name) return;
    await window.electronAPI.createProjectFolder(this.selectedProjectFolder + "\\" + name);
    this.loadProjects();
  },
  createFile: async function () {
    if (!this.selectedProjectFolder) {
      utils.showSnackbar("Select Folder");
      return;
    }
    var name = prompt("File Name");
    if (!name) return;
    await window.electronAPI.createProjectFile(this.selectedProjectFolder + "\\" + name);
    this.loadProjects();
  },
  renderProjectTree: function (items) {
    this.expandedFolders = this.expandedFolders || {};
    var body = document.getElementById("projectExplorerPanel");
    if (!body) return;
    body.innerHTML = "";
    var self = this;
    function renderFolders(list,parent,level) {
      level = level || 0;
      var folders = (list || []).filter(function (item) {
        return item.type === "folder";
      });
      folders.forEach(function (folder) {
        var row = document.createElement("div");
        row.className = "project-item";
        row.style.paddingLeft = (level * 18) + "px";

        var hasFolders = (folder.children || []).some(function (item) {
          return item.type === "folder";
        });

        row.innerHTML = `
            <span class="toggle">${hasFolders ? "[+]" : ""}</span>
            <span class="project-folder-label">${folder.name}</span>
        `;

        parent.appendChild(row);

        var children = document.createElement("div");
        children.className = "children";
        children.style.display = "none";
        parent.appendChild(children);

        var folderToggle = row.querySelector(".toggle");
        if (self.expandedFolders && self.expandedFolders[folder.path]) {
          children.style.display = "block";
          folderToggle.textContent = "[-]";

          renderFolders(folder.children || [], children, level + 1);
          children.dataset.loaded = "true";
        }

        folderToggle.onclick = function (e) {
          e.stopPropagation();
          if (!hasFolders) return;
          var isOpen = children.style.display === "block";

          if (isOpen) {
            children.style.display = "none";
            folderToggle.textContent = "[+]";
            self.expandedFolders[folder.path] = false;
            return;
          }

          children.style.display = "block";
          folderToggle.textContent = "[-]";
          self.expandedFolders[folder.path] = true;

          if (children.dataset.loaded !== "true") {
            renderFolders(folder.children || [], children, level + 1);
            children.dataset.loaded = "true";
          }
        };

        var folderLabel = row.querySelector(".project-folder-label");

        folderLabel.onclick = function (e) {
          e.stopPropagation();
          document.querySelectorAll(".project-item, .project-header").forEach(function (item) {
            item.classList.remove("tree-selected");
          });
          row.classList.add("tree-selected");
          var latestFolder = self.findProjectFolderByPath(self.projectTreeItems,folder.path);
          if (!latestFolder) {
            return;
          }
          self.selectedProjectFolder = latestFolder.path;
          self.selectedProjectFolderData = latestFolder;
          self.showProjectFolderFiles(latestFolder, true);
        };
      });
    }
    renderFolders(items || [], body,0);
  },
  showProjectFolderFiles: function (folder, forceReload = false) {
    if (!folder) return;
    // Prevent reload if same folder is already active
    if (!forceReload &&this.activeTabType === "projects" &&this.selectedProjectFolder === folder.path) {
      return;
    }

    this.activeTabType = "projects";
    this.selectedProjectFolder = folder.path;
    this.selectedProjectFolderData = folder;

    var common = this.showCommonContextBox({
      label: "Files From : " + folder.name,
      placeholder: "Search Project Files",
      showRefresh: false
    });

    if (!common) return;

    var container = common.container;
    var search = common.search;
    var addItemsRightBtn = document.getElementById("addItemsRightBtn");

    if (addItemsRightBtn) {
      addItemsRightBtn.style.display = "flex";

      addItemsRightBtn.onclick = () => {
        this.showCreateProjectFilePopup(folder);
      };
    }
    var files = (folder.children || []).filter(function (item) {
      return item.type !== "folder";
    });

    var self = this;

    new drawTable({
      container: container,
      data: files,
      fields: [
        {
          label: "Name",
          field: "name"
        },
        {
          label: "Modified On",
          field: "modifiedOn"
        },
        {
          label: "Source",
          render: function () {
            return "Local";
          }
        }
      ],

      emptyText: "No Files Found",

      onRowClick: async function (file) {
        await self.openProjectFile(file);
      },

      onRowContextMenu: function (file, event) {
        self.showProjectFileContextMenu(file, event);
      }
    });
    container.querySelectorAll("tbody tr").forEach(function (row, index) {

      var file = files[index];

      row.addEventListener("contextmenu", function (e) {
        self.showProjectFileContextMenu(file, e);
      });

    });

    search.oninput = function () {
      var text = this.value.toLowerCase();
      container.querySelectorAll("tbody tr").forEach(function (row) {
        row.style.display = row.textContent.toLowerCase().includes(text)? "": "none";
      });
    };
  },
  findProjectFolderByPath: function (items, path) {
    items = items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.type === "folder") {
        if (item.path === path) {
          return item;
        }
        var found = this.findProjectFolderByPath(item.children || [], path);
        if (found) {
          return found;
        }
      }
    }
    return null;
  },
  openProjectFile: async function (file) {
    try {
      var result = await window.electronAPI.readProjectFile(file.path);
      if (!result || !result.success) {
        return;
      }

      var existing = this.allContexts.find(function (tab) {
        return (tab.filePath ===file.path);
      });
      if (existing) {
        this.switchContext(existing.id);
        return;
      }
      var model = monaco.editor.createModel(result.content || "",this.getMonacoLanguage(file.name));
      var tab = {
        id: "file_" + Date.now(),
        name:file.name,
        filePath:file.path,
        savedFileName:file.name,
        type: "Project",  
        model:model,
        aiMessages:[],
        lastAIResult:null
      };
      tab.originalContent = model.getValue();
      this.allContexts.push(tab);
      this.currentContextId = tab.id;
      this.monacoEditor.setModel(model);

      this.renderTabs();
      this.renderAiMessages(tab);
      this.monacoEditor.layout();
      this.monacoEditor.focus();
    }
    catch (error) {
      console.error("Open project file error:",error);
    }
  },
  showCreateProjectPopup: function () {

    if (!this.selectedProjectFolder) {
      this.selectedProjectFolder = this.projectRoot;
    }

    var modal = document.getElementById("projectCreateModal");
    var name = document.getElementById("projectCreateName");
    var type = document.getElementById("projectCreateType");
    var form = document.getElementById("projectCreateForm");

    name.value = "";
    type.value = "folder";
    type.disabled = false;
    type.parentElement.style.display = "block";

    modal.style.display = "flex";

    document.getElementById("projectCreateOk").onclick = async (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var fileName = name.value.trim();

      if (type.value === "folder") {
        await window.electronAPI.createProjectFolder(this.selectedProjectFolder + "\\" + fileName);
      } else {
        await window.electronAPI.createProjectFile(this.selectedProjectFolder + "\\" + fileName);
      }

      modal.style.display = "none";
      await this.loadProjects();
      var folder = this.findProjectFolderByPath(this.projectTreeItems,this.selectedProjectFolder);

      if (folder) {
        this.selectedProjectFolder = folder.path;
        this.selectedProjectFolderData = folder;
        this.showProjectFolderFiles(folder, true);
      } else {
        var rootFolder = {
          name: "Projects",
          path: this.projectRoot,
          children: this.projectTreeItems || []
        };

        this.selectedProjectFolder = rootFolder.path;
        this.selectedProjectFolderData = rootFolder;
        this.showProjectFolderFiles(rootFolder, true);
      }
    };

    document.getElementById("projectCreateCancel").onclick = () => {
      modal.style.display = "none";
      form.reset();
      type.value = "folder";
      type.disabled = false;
      type.parentElement.style.display = "block";
    };
  },
  showCreateProjectFilePopup: function (folder) {

    var modal = document.getElementById("projectCreateModal");
    var name = document.getElementById("projectCreateName");
    var type = document.getElementById("projectCreateType");
    var form = document.getElementById("projectCreateForm");

    name.value = "";
    type.value = "file";
    type.disabled = true;
    type.parentElement.style.display = "none";

    modal.style.display = "flex";

    document.getElementById("projectCreateOk").onclick = async (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var fileName = name.value.trim();

      await window.electronAPI.createProjectFile(
        folder.path + "\\" + fileName
      );

      modal.style.display = "none";
      await this.loadProjects();
      var updatedFolder = this.findProjectFolderByPath(this.projectTreeItems,folder.path);
      if (updatedFolder) {
        this.selectedProjectFolder = updatedFolder.path;
        this.selectedProjectFolderData = updatedFolder;

        this.renderProjectTree(this.projectTreeItems);
        this.showProjectFolderFiles(updatedFolder);
      }
    };

    document.getElementById("projectCreateCancel").onclick = () => {
      modal.style.display = "none";
      type.disabled = false;
      type.parentElement.style.display = "block";
    };
  },
  initializeLiveWebsiteDropdowns: function () {
    var enterpriseInput = document.getElementById("liveWebsiteEnterpriseInput");
    var enterpriseDropdown = document.getElementById("liveWebsiteEnterpriseDropdown");
    var brandInput = document.getElementById("liveWebsiteBrandInput");
    var brandDropdown = document.getElementById("liveWebsiteBrandDropdown");
    // Enterprise
    if (enterpriseInput && enterpriseDropdown) {
      enterpriseInput.onclick = function (e) {
        e.stopPropagation();
        if (brandDropdown) {
          brandDropdown.style.display = "none";
        }
        enterpriseDropdown.style.display = enterpriseDropdown.style.display === "block"? "none": "block";
      };

      enterpriseDropdown.onclick = function (e) {
        e.stopPropagation();
      };
    }

    // Brand
    if (brandInput && brandDropdown) {
      brandInput.onclick = function (e) {
        e.stopPropagation();
        if (enterpriseDropdown) {
          enterpriseDropdown.style.display = "none";
        }
        brandDropdown.style.display = brandDropdown.style.display === "block"? "none": "block";
      };

      brandDropdown.onclick = function (e) {
        e.stopPropagation();
      };
    }

    // Outside click
    document.addEventListener("click",function (e) {
      if (enterpriseInput && enterpriseDropdown &&!enterpriseInput.contains(e.target) && !enterpriseDropdown.contains(e.target)) {
        enterpriseDropdown.style.display = "none";
      }
      if (brandInput && brandDropdown && !brandInput.contains(e.target) && !brandDropdown.contains(e.target)) {
        brandDropdown.style.display = "none";
      }
    });
  },

  getApiResults: function (data) {
    if (!data) {
      return [];
    }
    if (Array.isArray(data.Results)) {
      return data.Results;
    }
    if (Array.isArray(data.Items)) {
      return data.Items;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  },
  clearCaches: function () {
    this.nodeCache = {
      OT: {},
      Category: {},
      CloudType: {}
    };
    this.contextCache = {
      ObjectType: {},
      Category: {},
      CloudType: {}
    };

    this.contextLoading = {};
  },
  showProjectFileContextMenu: function (file, event) {
    event.preventDefault();
    event.stopPropagation();

    // Remove old context menu
    var oldMenu = document.getElementById("projectFileContextMenu");
    if (oldMenu) {
      oldMenu.remove();
    }

    var menu = document.createElement("div");
    menu.id = "projectFileContextMenu";

    menu.innerHTML = `
      <div class="project-context-menu-item" data-action="remove">
        Remove
      </div>
    `;

    menu.style.position = "fixed";
    menu.style.left = event.clientX + "px";
    menu.style.top = event.clientY + "px";
    menu.style.zIndex = "99999";

    document.body.appendChild(menu);

    // Remove action
    menu.querySelector('[data-action="remove"]').onclick = async () => {
      menu.remove();

      await this.removeProjectFile(file);
    };

    // Outside click
    setTimeout(() => {
      document.addEventListener("click", function closeMenu(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener("click", closeMenu);
        }
      });
    }, 0);
  },
  removeProjectFile: async function (file) {
    if (!file || !file.path) {
      return;
    }
    var fileName = file.name || file.path;

    var confirmed = confirm('Are you sure you want to remove "' + fileName + '"?');

    if (!confirmed) {
      return;
    }

    try {
      if (!window.electronAPI ||typeof window.electronAPI.deleteProjectFile !== "function") {
        console.error("deleteProjectFile is not available in electronAPI");
        utils.showSnackbar("Delete Project File API is not available.","error");
        return;
      }

      var result = await window.electronAPI.deleteProjectFile(file.path);

      if (!result || !result.success) {
        utils.showSnackbar(result && result.error? result.error: "Failed to remove project file.","error");
        return;
      }

      // Refresh project data
      await this.loadProjects();

      // Find currently selected folder again
      var folder = this.findProjectFolderByPath(this.projectTreeItems,this.selectedProjectFolder);

      if (folder) {
        this.selectedProjectFolder = folder.path;
        this.selectedProjectFolderData = folder;

        this.renderProjectTree(this.projectTreeItems);
        this.showProjectFolderFiles(folder, true);
      } else {
        var rootFolder = {
          name: "Projects",
          path: this.projectRoot,
          children: this.projectTreeItems || []
        };

        this.selectedProjectFolder = rootFolder.path;
        this.selectedProjectFolderData = rootFolder;

        this.renderProjectTree(this.projectTreeItems);
        this.showProjectFolderFiles(rootFolder, true);
      }

      utils.showSnackbar("Project file removed successfully.", "success");
    }
    catch (error) {
      console.error("Remove project file error:", error);
      utils.showSnackbar("Failed to remove project file.", "error");
    }
  },
  onModeChanged: async function (release) {
    try {
      if (!release || !this.versions || !this.versions[release]) {
        console.warn("Invalid mode:", release);
        return;
      }

      this.mode = release;
      this.selectedMode = this.versions[release];

      // Update custom dropdown selected text
      var modeInput = document.getElementById("modeInput");
      var modeDropdown = document.getElementById("modeDropdown");
      var modeOptions = document.getElementById("modeOptions");

      if (modeInput) {
        var selectedText = modeInput.querySelector(".selected-text");
        if (selectedText) {
          selectedText.textContent = this.selectedMode.release +" - " +this.selectedMode.version;
        }
        modeInput.dataset.value = release;
      }

      // Highlight selected option
      if (modeOptions) {
        modeOptions.querySelectorAll(".mode-option").forEach(function (option) {
          option.classList.remove("selected");
        });
        var selectedOption = modeOptions.querySelector('[data-value="' + release + '"]');
        if (selectedOption) {
          selectedOption.classList.add("selected");
        }
      }

      // Close dropdown
      if (modeDropdown) {
        modeDropdown.style.display = "none";
      }

      // Clear environment dependent caches
      this.nodeCache = {
        OT: {},
        Category: {},
        CloudType: {}
      };

      this.contextCache = {
        ObjectType: {},
        Category: {},
        CloudType: {}
      };

      this.contextLoading = {};
      // Rebuild LiveActions
      await this.rebuildLeftPanel();
      var commonContextBox = document.getElementById("commonContextBox");

      // Restore current panel
      switch (this.activeLeftPanelTab) {
        case "pushQueues":
          await this.openPushQueuesTab(false);
          break;

        case "liveWebsite":
          await this.openLiveWebsiteTab(false);
          break;

        case "projects":
          if (this.selectedProjectFolderData) {
            this.showProjectFolderFiles(this.selectedProjectFolderData,true);
          }
          break;

        default:
          await this.refreshCommonSection();

          if (commonContextBox) {
            commonContextBox.style.display = "block";
          }
          break;
      }

    } catch (err) {
      console.error("onModeChanged error:", err);

      if (typeof utils !== "undefined" && typeof utils.showSnackbar === "function"
      ) {
        utils.showSnackbar("Failed to change version","error");
      }
    }
  },
};
window.editorInstance = new codeEditor();