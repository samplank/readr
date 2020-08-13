var isAuth = false;
var startSignIn = false;
var inProgress = false;
var isLoggedIn = false;
var signOutComplete = false;
var isPaid = true;
var currentSite;
var signOutTab;

var config = {
  apiKey: 'AIzaSyABp4MFCQRKq_rUFX4y2oUIMhpthxvIzH0',
  databaseURL: 'https://readr-d9acb.firebaseio.com',
  storageBucket: 'readr-d9acb.appspot.com'
};
firebase.initializeApp(config);

chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
  var credential = firebase.auth.GoogleAuthProvider.credential(null, token);
  firebase.auth().signInWithCredential(credential);
  if (token) {
    console.log(token);
    isAuth = true;
    console.log(isAuth);
  }
});

//--------------------------//
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.sync.set({credits: 4});
});

// click on the icon which will click the appropriate login button
chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.storage.sync.get(['credits'], function(result) {
      chrome.runtime.sendMessage({num_credits: result.credits});
    });
});

chrome.tabs.onUpdated.addListener(
  function(tabId, changeInfo, tab) {

    chrome.storage.sync.get(['credits'], function(result) {
      chrome.runtime.sendMessage({num_credits: result.credits});
    });

    // send message to active tab to begin sign in process, once it has loaded (for WaPo and Atlantic)
    if ((currentSite == 'wapo' || currentSite == 'atlantic' || currentSite == 'newyorker') && changeInfo.status == "complete" && startSignIn == true) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id, {"message": "start_sign_in"});
        isPaid = false;
      });
    }

    // logout in a background tab
    if (changeInfo.status == "complete" && isLoggedIn == true) {
      
      isLoggedIn = false;
      
      if (currentSite == 'nyt') {
        chrome.tabs.create({url: 'https://myaccount.nytimes.com/auth/logout', active: false}, function(tab) {
          signOutTab = tab.id;
        });
      }

      if (currentSite == 'wapo') {
        chrome.tabs.create({url: 'https://www.washingtonpost.com/subscribe/signin/?action=signout', active: false}, function(tab){
            signOutTab = tab.id;
        });
      }

      if (currentSite == 'atlantic') {
        chrome.tabs.create({url: 'https://accounts.theatlantic.com/accounts/details/', active: false}, function(tab){
          signOutTab = tab.id;
        });
      }

      if (currentSite == 'newyorker') {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          var activeTab = tabs[0];
          console.log(activeTab.id);
          console.log(activeTab);          
          chrome.tabs.sendMessage(activeTab.id, {"message": "signOutNewYorker"});
        });        
      }
    } 

    // sign out of the Atlantic in the new tab
    if (changeInfo.status == "complete" && signOutTab == tabId) {
      if (currentSite == "nyt") {
        chrome.tabs.sendMessage(signOutTab, {"message": "signOutNYT"});
      }

      if (currentSite == "wapo") {
        chrome.tabs.sendMessage(signOutTab, {"message": "signOutWaPo"});
      }

      if (currentSite == "atlantic") {
        chrome.tabs.sendMessage(signOutTab, {"message": "signOutAtlantic"});
      }

    }
  }
);

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    //start signin listener (from popup)
    if(request.message === 'popupButtonClicked') {

      chrome.browserAction.setIcon({path: "icon_reading.png"});

      currentSite = request.site;

      // NYT doesn't load a new page, so send start_sign_in here
      if (currentSite == 'nyt') {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          var activeTab = tabs[0];
          chrome.tabs.sendMessage(activeTab.id, {"message": "start_sign_in"});
          isPaid = false;
        });
      } else if (currentSite == 'wapo' || currentSite == 'atlantic' || currentSite == 'newyorker') {
        startSignIn = true;
      }

    }

    if(request.message === "popupRequestCredits") {
      chrome.storage.sync.get(['credits'], function(result) {
        chrome.runtime.sendMessage({num_credits: result.credits});
      });
    }

    if(request.message === "loginRequestCredits") {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var activeTab = tabs[0];
        chrome.storage.sync.get(['credits'], function(result) {
          chrome.tabs.sendMessage(activeTab.id, {num_credits: result.credits, is_read: true});
        });
      });
    }

    if(request.message === "getMoreCredits") {
      chrome.storage.sync.get(['credits'], function(result) {
        chrome.storage.sync.set({credits: result.credits + 5});
        chrome.runtime.sendMessage({num_credits: result.credits + 5});
      });
    }

    // logout listeners
    if(request.site === "nytimesLogin") {
      isLoggedIn = true;
      currentSite = 'nyt';
    }
    if(request.site === "wapoLogin") {
      isLoggedIn = true;
      currentSite = 'wapo';
    }
    if(request.site === "atlanticLogin") {
      console.log('request.site ' + isLoggedIn);
      isLoggedIn = true;
      currentSite = 'atlantic';
    }
    if(request.site === "newyorkerLogin") {
      console.log('request.site ' + isLoggedIn);
      isLoggedIn = true;
      currentSite = 'newyorker';
    }
    if (isPaid == false && (request.site === "nytimesLogin" || request.site === "wapoLogin" || request.site === "atlanticLogin" || request.site === "newyorkerLogin")){
      chrome.storage.sync.get(['credits'], function(result) {
        chrome.storage.sync.set({credits: result.credits - 1});
        isPaid = true;
      });
    }
    if(request.logout === "success") {
      console.log('request logout success');
      if (currentSite === 'nyt' || currentSite === 'wapo' || currentSite === 'atlantic') {
        chrome.tabs.remove(signOutTab, function() {
          signOutTab = null;
          startSignIn = false;
          chrome.browserAction.setIcon({path: "icon_background.png"});
        });
      } else if (currentSite === 'newyorker') {
        signOutTab = null;
        startSignIn = false;
        chrome.browserAction.setIcon({path: "icon_background.png"});        
      }
    }

  }
);