window.utils = window.utils || {};

utils.showLoader = function () {
  var loader = document.getElementById("loader-container");
  if (loader) loader.classList.remove("-hidden");
};

utils.hideLoader = function () {
  var loader = document.getElementById("loader-container");
  if (loader) loader.classList.add("-hidden");
};
utils.debounce = function(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};
utils.showContextLoader = function () {
  var loader = document.getElementById("contextsLoader");
  if (loader) {
    loader.classList.remove("hidden");
    loader.style.display = "flex";
  }
};
utils.hideContextLoader = function () {
  var loader = document.getElementById("contextsLoader");
  if (loader) {
    loader.classList.add("hidden");
    loader.style.display = "none";
  }
};
utils.showSnackbar = function (message, type = "success", duration = 1500) {
  var snackbar = document.getElementById("snackbar");

  if (!snackbar) {
    snackbar = document.createElement("div");
    snackbar.id = "snackbar";
    document.body.appendChild(snackbar);
  }

  snackbar.className = "";
  snackbar.classList.add("show", type);
  snackbar.textContent = message;

  clearTimeout(utils.snackbarTimer);

  utils.snackbarTimer = setTimeout(function () {
    snackbar.classList.remove("show");
  }, duration);
};

utils.createItemFields = function (CloudDRI, Name, Fields, Callback) {
  if (!CloudDRI || !Name) {
    utils.showSnackbar("Invalid create data", "error");
    return;
  }
  var payload = {Fields: Array.isArray(Fields) ? Fields : []};
  var url = CloudDRI + "/CreateItem.do?Name=" + encodeURIComponent(Name) + "&FieldObject=" + encodeURIComponent(JSON.stringify(payload));
  utils.showLoader();
  useFetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.Success || data.Result) {
      utils.showSnackbar("Created successfully", "success");
      Callback && Callback(data);
      return;
    }
    utils.showSnackbar(data.Message || "Create failed", "error");
  })
  .catch(() => {
    utils.showSnackbar("Something went wrong while creating", "error");
  })
  .finally(() => {
    utils.hideLoader();
  });
};
utils.getCloudDetails = function (url) {
  return Clouds[url] && Clouds[url].CloudDetails ? Clouds[url].CloudDetails : null;
};
utils.getCloudItemsDetails = function (url) {
  return Clouds[url] && Clouds[url].ItemsDetails ? Clouds[url].ItemsDetails : null;
};
utils.setCloudDetails = function (url, details) {
  Clouds[url] = Clouds[url] || {};
  Clouds[url].CloudDetails = details;
};
utils.setCloudItemsDetails = function(url, items) {
  Clouds[url] = Clouds[url] || {};
  Clouds[url].ItemsDetails = items; 
};
utils.getCloud = function (dri, cloudName) {
  var url = dri + "/UseCloud.json?Name=" + encodeURIComponent(cloudName);
  var cached = utils.getCloudDetails(url);
  if (cached && cached.DRI) {
    return Promise.resolve(cached);
  }
  return useFetch(url)
  .then(function (res) {
    if (!res.ok) {
      throw new Error("UseCloud request failed.\n" +"Status : " + res.status + "\n" +"URL : " + url);
    }
    return res.text();
  })
  .then(function (text) {
    var data;
    try {
      data = JSON.parse(text);
    }
    catch (e) {
      console.error(text);
      throw new Error("Server returned HTML instead of JSON.");
    }
    if (!data || !data.Results) {
      return null;
    }
    utils.setCloudDetails(url, data.Results);
    return data.Results;
  });
};
utils.getItems = function (dri, fields, refresh, pageNumber, ResultCount) {
  var page = pageNumber || 1;
  var resultCount = ResultCount || 100;
  var cacheKey = dri + "_page_" + page;

  // Only cache first page
  if (!refresh && page === 1 && utils.getCloudItemsDetails(cacheKey)) {
    return Promise.resolve(utils.getCloudItemsDetails(cacheKey));
  }
  var url = dri + "/GetItems.json?Fields=" + fields + "&PageNumber=" + page + "&ResultCount=" + resultCount;
  return useFetch(url)
  .then(res => res.json())
  .then(data => {
    utils.setCloudItemsDetails(cacheKey, data);
    return data;
  });
};
utils.removeItems = function (CloudDRI, ItemId, Confirmed, Callback) {
  Confirmed = Confirmed == "N" || Confirmed == "undefined" ? false : (Confirmed === "Y" || Confirmed === true ? true : false);
  if (!CloudDRI || !ItemId) {
    return;
  }
  var url = CloudDRI +"/RemoveItem.do?ItemId=" + ItemId + (Confirmed ? "&Confirmed=Y" : "");
  if (Confirmed) {
    utils.showLoader();
  }
  useFetch(url)
  .then(res => res.json())
  .then(data => {
    if (data && data["Confirmation Required"] === "Y" && !Confirmed) {
      if (confirm(data.Message || "Are you sure you want to remove this item?")) {
        utils.removeItems(CloudDRI, ItemId, true, Callback);
      }
      return;
    }
    if (data.Success === true) {
      utils.hideLoader();
      utils.showSnackbar(data.Message || "Item removed successfully", "success");
      if (typeof Callback === "function") {
        Callback();
      }
      return;
    }
    utils.hideLoader();
    utils.showSnackbar(data.Message || "Remove failed", "error");
  })
  .catch(err => {
    utils.hideLoader();
    utils.showSnackbar("Something went wrong while removing item", "error");
  });
};
var drawTable = function (O) {
  this.container = O.container;
  this.data = O.data || [];
  this.fields = O.fields || [];
  this.emptyText = O.emptyText || "No Items Found";
  this.onRowClick = O.onRowClick || null;
  this.getRowClass = O.getRowClass || null;

  if (!this.container)return;
  this.init();
};

drawTable.prototype = {
  init: function () {
    this.render();
  },
  render: function () {
    if (!this.container)return;
    this.container.innerHTML = "";
    var table = document.createElement("table");
    table.className = "contexts-table";
    table.appendChild(this.drawHeader());
    table.appendChild(this.drawBody());
    this.container.appendChild(table);
  },
  drawHeader: function () {
    var thead = document.createElement("thead");
    var tr = document.createElement("tr");
    this.fields.forEach(function (field) {
      var th = document.createElement("th");
      th.textContent = field.label || "";
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    return thead;
  },
  drawBody: function () {
    var self = this;
    var tbody = document.createElement("tbody");

    if (!this.data.length) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = this.fields.length;
      td.className = "table-empty";
      td.textContent = this.emptyText;
      tr.appendChild(td);
      tbody.appendChild(tr);
      return tbody;
    }
    this.data.forEach(function (item, index) {
      var tr = document.createElement("tr");
      tr.dataset.index = index;
      // Store Context Id for all modules
      var contextId =item.Id ||item.ContextId ||item["Context Id"] ||item["Direct Resource Identifier"] ||item.DRI;
      if (contextId) {
        tr.dataset.contextId = contextId;
        tr.dataset.id = contextId;
      }

      if (self.getRowClass) {
        var rowClass = self.getRowClass(item);
        if (rowClass) {
          tr.classList.add(rowClass);
        }
      }
      self.fields.forEach(function (field) {
        var td = document.createElement("td");
        var value;
        if (field.render) {
          value = field.render(item, index);
        } else {
          value = item[field.field];
          if ((value === undefined || value === null) && item.Fields) {
            value = item.Fields[field.field];
          }
        }
        td.textContent = (value === undefined || value === null) ? "" : value;
        tr.appendChild(td);
      });

      if (self.onRowClick) {
        tr.addEventListener("click", function (event) {
          self.onRowClick(item, tr, event);
        });
      }
      tbody.appendChild(tr);
    });
    return tbody;
  },
  
};