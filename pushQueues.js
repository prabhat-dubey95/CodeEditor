  //var draggedCloudLi = null;
  var LIVEHRMS_USER_DATA = null;
  var pushQueuesContent = function () {
    this.useCloudName = "Push Queues";
    this.mainCloudDRI = null;
    this.cloudDRI = null;
    this.activeTab = null;

    this.selectedClouds = new Map();
    this.isMultiSelectMode = false;
    this.selectedItems = new Map();

    this.queueGroupsCache = null;
    this.queueGroupsDRI = null;

    this.cloudPage = 1;
    this.hasMoreClouds = true;
    this.isLoadingClouds = false;
    this.selectedGroup = "All";
    this.initialized = false;
    this.initPromise = null;
    // Push Queue list cache
    this.pushQueueClouds = [];
    // Selected Push Queue
    this.tableItems = [];
    this.selectedCloud = null;
    this.selectedCloudName = "";
    this.selectedCloudDRI = null;
    this.isDataLoaded = false;
    this.isLoading = false;
    this.lastLoadedTableDRI = null;
    this.tableCache = new Map();
    this.tableLoadingPromises = new Map();
    this.isTableLoading = false;

    this.init();
  };
  pushQueuesContent.prototype = {
    init: async function () {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async function () {
            try {
                codeEditor.activeLeftPanelTab = "pushQueues";
                utils.showContextLoader();
                await this.loginToLiveHRMS();
                await this.loadMainCloud();
                this.attachEvents();
                this.initialized = true;
            } catch (err) {
                console.error("PushQueues Init Error:", err);
            } finally {
                utils.hideContextLoader();
            }
        }).call(this);
        return this.initPromise;
    },
    attachEvents: function () {
        this.attachClickEvents();
        this.attachSubmitEvents();
        document.onclick = function () {
            var menu = document.getElementById("editContextMenu");
            if (menu) {
                menu.style.display = "none";
            }
        };
    },
    attachClickEvents: function () {
        var self = this;

        var addItemBtn = document.getElementById("addItemsBtn");
        var editItemRightBtn = document.getElementById("addItemsRightBtn");
        var cancelItemBtn = document.getElementById("cancelItemBtn");
        var itemPopup = document.getElementById("itemPopup");
        var contextPopup = document.getElementById("contextPopup");
        var cancelContextBtn = document.getElementById("cancelContextBtn");

        var pushQABtn = document.getElementById("pushToQABtn");
        var pushPrereleaseBtn = document.getElementById("pushToPreBtn");
        var pushLiveBtn = document.getElementById("pushToLiveBtn");

        if (cancelContextBtn && contextPopup) {
            cancelContextBtn.onclick = function () {
                contextPopup.style.display = "none";
            };
        }

        if (addItemBtn && itemPopup) {
            addItemBtn.onclick = function () {
                itemPopup.style.display = "flex";
            };
        }

        if (cancelItemBtn && itemPopup) {
            cancelItemBtn.onclick = function () {
                itemPopup.style.display = "none";
            };
        }

        // PUSH QUEUE RIGHT BUTTON
        if (editItemRightBtn && contextPopup) {
            editItemRightBtn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                contextPopup.style.display = "flex";
            };
        }

        if (contextPopup) {
            contextPopup.onclick = function (event) {
                if (event.target === contextPopup) {
                    contextPopup.style.display = "none";
                }
            };
        }

        // PUSH TO QA
        if (pushQABtn) {
            pushQABtn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (!self.cloudDRI) {
                    utils.showSnackbar("Please select a cloud from left side first!");
                    return;
                }
                self.pushQueueAction("QA",self.cloudDRI,true);
            };
        }

        // PUSH TO PRERELEASE
        if (pushPrereleaseBtn) {
            pushPrereleaseBtn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (!self.cloudDRI) {
                    utils.showSnackbar("Please select a cloud from left side first!");
                    return;
                }
                self.pushQueueAction("Prerelease",self.cloudDRI,true);
            };
        }

        // PUSH TO LIVE
        if (pushLiveBtn) {
            pushLiveBtn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (!self.cloudDRI) {
                    utils.showSnackbar("Please select a cloud from left side first");
                    return;
                }
                var confirmed = confirm("Are you sure, you wish to push this queue to live?");
                if (!confirmed) {
                    return;
                }
                self.pushQueueAction("Live",self.cloudDRI,true);
            };
        }
    },
    loginToLiveHRMS : async function() {
      var _url = GlobalDomain + "/Login.do";
      var username = localStorage.getItem("loginUserName");
      var password = localStorage.getItem("loginPassword");
      var response = await useFetch(_url, 
        "POST",
        null,
        new URLSearchParams({
          username: username,
          password: password
        })
      );
      var data = await response.json();
      LIVEHRMS_USER_DATA = data.Result || {};
    },
    loadMainCloud: async function (refresh) {
        var self = this;
        if (self.isDataLoaded && !refresh) {
            console.log("Push Queue list already loaded - using cache");
            self.restoreSelectedQueue();
            return;
        }
        if (self.isLoading) {
            console.log("Push Queue list is already loading");
            return;
        }

        self.isLoading = true;
        var cloudList = document.getElementById("cloudList");
        utils.showContextLoader();

        try {
            var userDRI = LIVEHRMS_USER_DATA &&LIVEHRMS_USER_DATA["Direct Resource Identifier"];
            if (!userDRI) {
                console.warn("User DRI not found.");
                if (cloudList) {
                    cloudList.innerHTML = "<div class='no-items'>User DRI Not Found</div>";
                }
                return;
            }
            var cloud = await utils.getCloud(userDRI,self.useCloudName);
            if (!cloud || !cloud.DRI) {
                if (cloudList) {
                    cloudList.innerHTML = "<div class='no-items'>No Push Queues Found</div>";
                }
                return;
            }
            self.mainCloudDRI = cloud.DRI;
            var data = await utils.getItems(cloud.DRI,"Name||Description||Created By||Created On||Last Pushed To||Last Pushed On||Push Queue Group",true,1,9999);
            var clouds = data && data.Results? data.Results: [];
            self.pushQueueClouds = clouds;
            self.isDataLoaded = true;

            self.initializeGroupDropdown();
            self.setupCloudSearch();

        } catch (err) {
            console.error("Push Queue load error:",err);
            if (cloudList) {
                cloudList.innerHTML = "<div class='no-items'>Failed to load Push Queues</div>";
            }

        } finally {
            self.isLoading = false;
            utils.hideContextLoader();
        }
    },
    restoreSelectedQueue: function () {
        var self = this;
        var queues = self.pushQueueClouds || [];

        if (!queues.length) {
            return;
        }

        var savedDRI = localStorage.getItem("activePushQueue");
        var selectedItem = null;

        if (savedDRI) {
            selectedItem = queues.find(function (item) {
                return (item.DRI === savedDRI ||item["Direct Resource Identifier"] === savedDRI);
            });
        }

        if (!selectedItem && self.selectedCloudDRI) {
            selectedItem = queues.find(function (item) {
                return (item.DRI === self.selectedCloudDRI ||item["Direct Resource Identifier"] === self.selectedCloudDRI);
            });
        }

        if (!selectedItem) {
            selectedItem = queues[0];
        }
        var selectedDRI = selectedItem.DRI ||selectedItem["Direct Resource Identifier"];

        if (!selectedDRI) {
            return;
        }

        self.selectedCloud = selectedItem;
        self.selectedCloudName = selectedItem.Name || "Unnamed";

        self.selectedCloudDRI = selectedDRI;
        self.cloudDRI = selectedDRI;
        var commonLabel = document.getElementById("commonSourceLabel");

        if (commonLabel) {
            var label = self.selectedCloudName;
            if (self.selectedGroupName) {
                label +=" (Group : " +self.selectedGroupName +")";
            }
            commonLabel.textContent = label;
        }
        self.drawCloudList(queues, true);
    },
    drawCloudList: async function (items) {
        var cloudList = document.getElementById("cloudList");
        if (!cloudList) {
            return;
        }
        cloudList.innerHTML = "";
        var self = this;
        var savedDRI = localStorage.getItem("activePushQueue");

        var selectedDRI = self.selectedCloudDRI ||self.cloudDRI ||savedDRI;
        var selectedRow = null;
        var selectedItem = null;
        (items || []).forEach(function (item) {
            var row = document.createElement("div");
            row.className = "tree-node -cloud-item";
            var name = item.Name || "Unnamed";
            var groupName = item["Push Queue Group"] || "";
            var cloudDRI = item.DRI ||item["Direct Resource Identifier"] || "";
            

            row.innerHTML = `
                <div class="queue-name">${name}</div>
                ${
                    groupName? `<div class="queue-group">Group: ${groupName}</div>`: ""
                }
            `;

            if (selectedDRI && cloudDRI === selectedDRI) {
                row.classList.add("selected");
                row.classList.add("active-item");
                selectedRow = row;
                selectedItem = item;
            }

            row.onclick = async function () {
                cloudList.querySelectorAll(".-cloud-item").forEach(function (x) {
                    x.classList.remove("selected");
                    x.classList.remove("active-item");
                });

                row.classList.add("selected");
                row.classList.add("active-item");

                self.selectedCloud = item;
                self.selectedCloudName = name;
                self.selectedCloudDRI = cloudDRI;
                self.cloudDRI = cloudDRI;

                localStorage.setItem("activePushQueue",cloudDRI);
                if (!cloudDRI) {
                    return;
                }

                if (self.lastLoadedTableDRI !== cloudDRI) {
                    await self.loadTable(cloudDRI);
                } else {
                    self.renderTable(self.tableItems || []);
                    self.setupTableSearch();
                }
            };
            cloudList.appendChild(row);
        });

        if (selectedRow && selectedItem && selectedDRI) {

            self.selectedCloud = selectedItem;
            self.selectedCloudName = selectedItem.Name ||"Unnamed";
            self.selectedCloudDRI = selectedDRI;
            self.cloudDRI = selectedDRI;

            if (self.lastLoadedTableDRI !== selectedDRI) {
                await self.loadTable(selectedDRI);
            } else {
                self.renderTable(self.tableItems || []);
                self.setupTableSearch();
            }
            return;
        }
        if (!selectedRow && items && items.length) {
            var firstItem = items[0];
            var firstDRI = firstItem.DRI ||firstItem["Direct Resource Identifier"];
            var firstRow = cloudList.querySelector(".-cloud-item");

            if (firstRow && firstDRI) {
                firstRow.classList.add("selected");
                firstRow.classList.add("active-item");

                self.selectedCloud = firstItem;
                self.selectedCloudName = firstItem.Name ||"Unnamed";
                self.selectedCloudDRI = firstDRI;

                self.cloudDRI = firstDRI;
                localStorage.setItem("activePushQueue",firstDRI);

                await self.loadTable(firstDRI);
            }
        }
    },
    loadTable: async function (cloudDRI, refresh = false) {
        if (!cloudDRI) {
            console.warn("Queue DRI missing");
            return;
        }

        var self = this;
        var box = document.getElementById("commonContextBox");
        var commonLabel = document.getElementById("commonSourceLabel");
        var tableContainer = document.getElementById("commonTableContainer");

        if (box) {
            box.style.display = "block";
        }

        if (!box || !tableContainer) {
            console.warn("commonContextBox/commonTableContainer not found");
            return;
        }

        self.cloudDRI = cloudDRI;

        // Restore selected queue name when coming back from another tab
        if (!self.selectedCloudName && Array.isArray(self.pushQueueClouds)) {
            var selectedQueue = self.pushQueueClouds.find(function (item) {
                var dri = item.DRI || item["Direct Resource Identifier"] || "";
                return String(dri) === String(cloudDRI);
            });

            if (selectedQueue) {
                self.selectedCloud = selectedQueue;
                self.selectedCloudName = selectedQueue.Name || "Unnamed";
                self.selectedCloudDRI = cloudDRI;
            }
        }

        // Restore Common Source Label
        if (commonLabel) {
            var label = self.selectedCloudName || (self.selectedCloud && self.selectedCloud.Name) ||"Push Queue";
            if (self.selectedGroupName) {
                label += " (Group : " + self.selectedGroupName + ")";
            }
            commonLabel.textContent = label;
        }

        // Only refresh button should clear cache
        if (refresh) {
            if (self.tableCache) {
                self.tableCache.delete(cloudDRI);
            }
            self.tableItems = [];
            self.lastLoadedTableDRI = null;
        }

        // Use current table cache
        if (!refresh && self.lastLoadedTableDRI === cloudDRI &&Array.isArray(self.tableItems)) {

            box.style.display = "block";
            self.renderTable(self.tableItems);
            self.setupTableSearch();
            self.loadLastPushInfo(cloudDRI);
            return;
        }

        // Use Map cache
        if (!refresh && self.tableCache && self.tableCache.has(cloudDRI)) {

            self.tableItems = self.tableCache.get(cloudDRI);
            self.lastLoadedTableDRI = cloudDRI;

            box.style.display = "block";
            self.renderTable(self.tableItems);
            self.setupTableSearch();
            self.loadLastPushInfo(cloudDRI);
            return;
        }

        // Prevent duplicate API request
        if (self.tableLoadingPromises &&self.tableLoadingPromises.has(cloudDRI)) {
            return self.tableLoadingPromises.get(cloudDRI);
        }
        var loadPromise = (async function () {
            tableContainer.innerHTML = "";
            utils.showContextLoader();

            try {
                var data = await utils.getItems(cloudDRI,"Name||Created By||Created On",true,1,9999);
                var items = data && data.Results? data.Results: [];
                self.tableItems = items;
                self.lastLoadedTableDRI = cloudDRI;

                if (!self.tableCache) {
                    self.tableCache = new Map();
                }

                self.tableCache.set(cloudDRI, items);

                box.style.display = "block";
                self.renderTable(items);
                self.setupTableSearch();
                self.loadLastPushInfo(cloudDRI);

            } catch (err) {
                console.error("Push Queue table load error:",err);
                self.tableItems = [];
                self.renderTable([]);

            } finally {
                utils.hideContextLoader();
                self.tableLoadingPromises.delete(cloudDRI);
            }
        })();
        self.tableLoadingPromises.set(cloudDRI, loadPromise);
        return loadPromise;
    },
    resetCommonContextBox: function () {
        var box = document.getElementById("commonContextBox");
        var label = document.getElementById("commonSourceLabel");
        var search = document.getElementById("commonSearchInput");
        var headerActions = document.getElementById("commonHeaderActions");
        var searchActions = document.getElementById("commonSearchActions");
        var container = document.getElementById("commonTableContainer");
        var addItemsRightBtn = document.getElementById("addItemsRightBtn");

        if (!box) return;

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
    renderTable: function (items) {
        var self = this;
        var container = document.getElementById("commonTableContainer");
        if (!container) {
            console.warn("commonTableContainer not found.");
            return;
        }
        this.currentTableItems = items || [];
        new drawTable({
            container: container,
            data: this.currentTableItems,

            fields: [
                {
                    label: "Name",
                    field: "Name"
                },
                {
                    label: "Created By",
                    render: function (item) {
                        return item["Created By"] || item.CreatedBy || "";
                    }
                },
                {
                    label: "Created On",
                    render: function (item) {
                        return item["Created On"] || item.CreatedOn || "";
                    }
                }
            ],
            emptyText: "No Items Found",
            onRowClick: function (item, row) {
                var contextId = item["Object Id"] ||item.ObjectId ||(item.Object && item.Object.Id) ||item.Id;
                container.querySelectorAll("tbody tr").forEach(function (x) {
                    x.classList.remove("selected");
                });

                row.classList.add("selected");
                self.selectedTableItem = item;

                if (contextId) {
                    window.editorInstance.openContextInEditor(contextId, item.Name);
                }
            }
        });
    },
    createItems: function (selectedCloudDRI, name, desc) {
      var self = this;
      var fieldsArray = [];
      // Description field
      if (desc) {
        fieldsArray.push({
          Key: "Description",
          Value: desc
        });
      }
      var activeGroup = (self.activeTab || "").trim().toLowerCase();
      if (activeGroup && activeGroup !== "all" && activeGroup !== "archived" && activeGroup !== "shared") {
        fieldsArray.push({
          Key: "Push Queue Group",
          Value: self.activeTab
        });
      }
      utils.createItemFields(selectedCloudDRI, name, fieldsArray, function (resp) {
        if (!resp.Success || !resp.Results || !resp.Results.length) {
          console.error("Invalid create response", resp);
          return;
        }
        var newDRI = resp.Results[0].DRI;
        self.lastActiveCloud = newDRI;
        self.cloudDRI = newDRI;

        var key = "activePushQueue_" + self.activeTab;
        localStorage.setItem(key, newDRI);
        self.loadMainCloud(true);
      });
    },
    attachSubmitEvents: function () {
      var itemPopupForm = document.querySelector("#itemPopup form");
      var itemPopup = document.getElementById("itemPopup");
      var contextPopupForm = document.querySelector("#contextPopup form");
      var editContextMenu = document.getElementById("editContextMenu");
      itemPopupForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var itemName = document.getElementById("itemName").value.trim();
        var itemDescription = document.getElementById("itemDesc").value.trim();
        var parentDRI = this.selectedCloudDRI || this.mainCloudDRI;
        if (!parentDRI) {
          utils.showSnackbar("Parent cloud not found!");
          return;
        }
        this.createItems(parentDRI, itemName, itemDescription);
        itemPopup.style.display = "none";
        itemPopupForm.reset();
      }.bind(this));

      contextPopupForm.addEventListener("submit", function (e) {
        e.preventDefault();
        this.multipleLinkUrl();
      }.bind(this));
      
      editContextMenu.addEventListener("click", function (e) {
        var action = e.target.getAttribute("data-action");
        if (!action) return;
        var targetDri = editContextMenu.dataset.targetDri;
        var targetId = editContextMenu.dataset.targetId;
        var targetName = editContextMenu.dataset.targetName;
        var targetDesc = editContextMenu.dataset.targetDescription;
        editContextMenu.style.display = "none";
        if (action === "remove") {
            this.removeItem(targetDri, targetId, "left");
        }

        if (action === "edit") {
            var editName = document.getElementById("editItemName");
            var editItemDesc = document.getElementById("editItemDesc");
            var editPopup = document.getElementById("editPopup");
            var saveEditBtn = document.getElementById("saveEditBtn");

            editName.value = targetName || "";
            editItemDesc.value = targetDesc || "";
            editPopup.style.display = "flex";

            saveEditBtn.onclick = function () {
                var newName = editName.value.trim();
                var newDesc = editItemDesc.value.trim();
                this.lastActiveCloud = targetDri;
                this.editItem(targetDri, newName, newDesc);
                editPopup.style.display = "none";
            }.bind(this);
        }
      }.bind(this));
    },
    pushQueueAction: function (mode, selectedItem, isLeft) {
        utils.showLoader();
        var domain = "";
        switch (mode) {
            case "QA":
                domain = "https://livehrms.dev.liveplatform.com";
                break;

            case "Prerelease":
                domain = "https://livehrms.qa.liveplatform.com";
                break;

            case "Live":
                domain = "https://livehrms.prerelease.liveplatform.com";
                break;
        }

        var url;

        if (isLeft) {
            url = domain + selectedItem + "/PushContexts.do?Mode=" + encodeURIComponent(mode);
        } else {
            url = domain + "/ActionPush.do?Mode=" + encodeURIComponent(mode) + "&ContextId=" + encodeURIComponent(selectedItem);
        }
        useFetch(url)
        .then(function (res) {
            return res.json();
        })
        .then(async function (data) {
            try {
                var pushInfo = await useFetch(pushQueuesPlugin.cloudDRI +"/GetFieldValues.json?Fields=Last Pushed To||Last Pushed On").then(function (r) {
                    return r.json();
                });
            } catch (e) {
                console.error("GetFieldValues Error:", e);
            }
            utils.showSnackbar("Pushed successfully!");
        })
        .catch(function (err) {
            console.error("Push Error:", err);
        })
        .finally(function () {
            utils.hideLoader();
        });
    },
    multipleLinkUrl: function () {
        var contextIds = document.getElementById("contextIdsInput").value.trim();
        if (!contextIds) return;
        var cloudDRI = pushQueuesPlugin.cloudDRI;
        if (!cloudDRI) return;
        utils.showLoader();
        var linkUrl = cloudDRI + "/LinkMultiple.do?ItemIds=" + encodeURIComponent(contextIds);
        useFetch(linkUrl)
        .then((res) => res.json())
        .then(() => {
        //pushQueuesPlugin.loadTable(cloudDRI, true);
        pushQueuesPlugin.loadTable(cloudDRI);
        })
        .catch((err) => console.error("Error linking Context IDs:", err))
        .finally(() => {
            utils.hideLoader();
            document.getElementById("contextPopup").style.display = "none";
            document.getElementById("contextIdsInput").value = "";
        });
    },
    setupCloudSearch: function () {
        var self = this;
        var searchInput = document.getElementById("cloudSearchInput");
        var clearBtn = document.getElementById("cloudSearchClear");
        if (!searchInput) {
            return;
        }
        function applyFilters() {
            var query = searchInput.value.trim().toLowerCase();
            var filtered = self.pushQueueClouds || [];
            // GROUP FILTER
            if (self.selectedGroup && self.selectedGroup !== "All") {
                filtered = filtered.filter(function (item) {
                    return (item["Push Queue Group"] || "") === self.selectedGroup;
                });
            }

            // SEARCH FILTER
            if (query) {
                filtered = filtered.filter(function (item) {
                    var name = item.Name || "";
                    var description = item.Description || "";

                    try {
                        name =  decodeURIComponent(name);
                    } catch (e) {}

                    try {
                        description = decodeURIComponent(description);
                    } catch (e) {}

                    name = name.toLowerCase();
                    description = description.toLowerCase();
                    return (name.includes(query) || description.includes(query));
                });
            }
            self.drawCloudList(filtered,true);
            if (clearBtn) {
                clearBtn.style.display = query? "inline" : "none";
            }
        }
        searchInput.oninput = applyFilters;
        if (clearBtn) {
            clearBtn.onclick = function () {
                searchInput.value = "";
                clearBtn.style.display = "none";
                applyFilters();
                searchInput.focus();
            };
        }
        applyFilters();
    },
    setupTableSearch: function () {
        var self = this;
        var input = document.getElementById("commonSearchInput");

        if (!input) {
            return;
        }
        input.value = "";
        input.onclick = function (e) {
            e.stopPropagation();
        };

        input.onmousedown = function (e) {
            e.stopPropagation();
        };

        input.oninput = function (e) {
            e.stopPropagation();
            var query = this.value.trim().toLowerCase();
            if (!query) {
                self.renderTable(self.tableItems || []);
                return;
            }
            var filtered = (self.tableItems || []).filter(function (item) {
                var name = String(item.Name || "").toLowerCase();
                var createdBy = String(item["Created By"] || item.CreatedBy || "").toLowerCase();
                var createdOn = String(item["Created On"] || item.CreatedOn || "").toLowerCase();

                return (name.includes(query) || createdBy.includes(query) || createdOn.includes(query));
            });
            self.renderTable(filtered);
        };
    },
    removeItem: function (cloudDRI, itemId, source) {
        var self = this;
        utils.removeItems(cloudDRI, itemId, true, function () {
            self.loadMainCloud(true);
        });
    },
    editItem: function (itemDRI, newName, newDesc) {
        var self = this;
        var fieldsArray = [
            {
                Key: "Description",
                Value: newDesc
            }
        ];
        utils.editItemFields(itemDRI, newName, fieldsArray, function () {
            self.loadMainCloud(true);
        });
    },
    loadLastPushInfo: function (cloudDRI) {
        if (!cloudDRI) {
            return;
        }
        var pushQueueInfo = document.getElementById("pushQueueInfo");
        var lastPushedTo = document.getElementById("lastPushedTo");
        var lastPushedOn = document.getElementById("lastPushedOn");
        // Initially hide only the info section
        if (pushQueueInfo) {
            pushQueueInfo.style.display = "none";
        }

        if (lastPushedTo) {
            lastPushedTo.textContent = "-";
        }

        if (lastPushedOn) {
            lastPushedOn.textContent = "-";
        }

        var url = cloudDRI +"/GetFieldValues.json?Fields=Last Pushed To||Last Pushed On";
        useFetch(url).then(function (res) {
            return res.json();
        })
        .then(function (data) {
            var pushedTo = data && data["Last Pushed To"] ? String(data["Last Pushed To"]).trim() : "";
            var pushedOn = data && data["Last Pushed On"]? String(data["Last Pushed On"]).trim(): "";
            if (lastPushedTo) {
                lastPushedTo.textContent = pushedTo || "-";
            }

            if (lastPushedOn) {
                var formattedDate = pushedOn;
                if (pushedOn) {
                    var parsedDate = new Date(pushedOn);

                    if (!isNaN(parsedDate.getTime())) {
                        formattedDate = parsedDate.toLocaleString("en-IN",{
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true
                        });
                    }
                }
                lastPushedOn.textContent = formattedDate || "-";
            }
            var hasPushedTo = pushedTo && pushedTo !== "-" && pushedTo.toLowerCase() !== "null" && pushedTo.toLowerCase() !== "undefined";
            var hasPushedOn = pushedOn && pushedOn !== "-" && pushedOn.toLowerCase() !== "null" && pushedOn.toLowerCase() !== "undefined";

            // ONLY pushQueueInfo show/hide
            if (pushQueueInfo) {
                pushQueueInfo.style.display = (hasPushedTo || hasPushedOn) ? "block" : "none";
            }
        })
        .catch(function (err) {
            console.error("Last Push Info Error:",err);
            // Only hide info, never hide push buttons
            if (pushQueueInfo) {
                pushQueueInfo.style.display = "none";
            }
        });
    },
    filterPushQueuesByGroup: function () {
        var self = this;
        var queues = self.pushQueueClouds || [];
        if (!self.selectedGroup ||self.selectedGroup === "All") {
            self.drawCloudList(queues);
            return;
        }
        var filtered = queues.filter(function (item) {
            return (item["Push Queue Group"] || "") === self.selectedGroup;
        });
        self.drawCloudList(filtered);
    },
    initializeGroupDropdown: function () {
        var self = this;
        var input = document.getElementById("groupInput");
        var dropdown = document.getElementById("groupDropdown");
        var selectedText = input.querySelector(".selected-text");
        var search = document.getElementById("groupSearch");
        var options = document.getElementById("groupOptions");
        var noResult = document.getElementById("groupNoResult");

        if (!input || !dropdown || !selectedText || !search || !options || !noResult) {
            return;
        }

        // Build unique groups
        var groups = [];
        var groupMap = {};
        groupMap["all"] = "All";
        (self.pushQueueClouds || []).forEach(function (item) {
            var group = (item["Push Queue Group"] || "").trim()
            if (!group) {
                return;
            }
            var key = group.toLowerCase();
            if (!groupMap[key]) {
                groupMap[key] = group.charAt(0).toUpperCase() + group.slice(1).toLowerCase();
            }
        });
        groups = Object.values(groupMap);
        function render(list) {
            options.innerHTML = "";
            if (!list.length) {
                noResult.style.display = "block";
                return;
            }
            noResult.style.display = "none";
            list.forEach(function (groupName) {
                var div = document.createElement("div");
                div.className = "dropdown-option";
                div.textContent = groupName;
                div.onclick = function (e) {
                    e.stopPropagation();
                    self.selectedGroup = groupName;
                    selectedText.textContent = groupName;
                    dropdown.style.display = "none";

                    self.setupCloudSearch();
                };
                options.appendChild(div);
            });
        }
        render(groups);
        search.value = "";
        search.oninput = function () {
            var value = this.value.trim().toLowerCase();
            render(groups.filter(function (g) {
                return g.toLowerCase().includes(value);
            })
            );
        };
        input.onclick = function (e) {
            e.stopPropagation();
            search.value = "";
            render(groups);
            dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
        };

        dropdown.onclick = function (e) {
            e.stopPropagation();
        };
        document.onclick = function () {
            dropdown.style.display = "none";
        };
    },
  };
//  window.pushQueuesPlugin = new pushQueuesContent();