var settings = JSON.parse(localStorage.getItem("Settings") || '{}');
var isInsecure = settings.UseInsecureConnection === true;
var savedDomain = "livehrms.liveplatform.com";
var GlobalDomain = (isInsecure ? "http://" : "https://") +  savedDomain;
var UserData = JSON.parse(localStorage.getItem("GlobalUserData") || '{}');
var currentUserId = null;
var Clouds = {};
var electronPlugin = function () {
  this.init();
};
electronPlugin.prototype = {
  init: function () {
    this.fetchCurrentUserId();
  },
  fetchCurrentUserId: function () {
    useFetch("/GetSessionInfo.json")
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      currentUserId = UserData.ObjectCode; 
    })
  },
  compileScript: function(params, source, context) {
    params = params || [];
    return new Function(params.join(), source).bind(context);
  },
};
function useFetch(url, method, headers,body = null) {
  url = url.indexOf('.com') > -1 ? url : GlobalDomain + url;
  method = method || "GET"; 
  headers = headers || {};
  return fetch(url, {
    method : method,
    credentials : 'include',
    headers : headers,
    body: body
  });
};
new electronPlugin();