/* ================================================================
   AUTHENTIFICATION — WRAPPER signIn (chargé en head, avant MSAL)
   ================================================================ */
var signIn = function() {
  var btn = document.getElementById('btn-login');
  if (btn) { btn.disabled = true; btn.textContent = 'Connexion...'; }
  var t = 0;
  var check = setInterval(function() {
    t++;
    if (window.__msalReady && window.__doSignIn) {
      clearInterval(check);
      window.__doSignIn();
    } else if (t > 50) {
      clearInterval(check);
      if (btn) { btn.disabled = false; btn.textContent = 'Se connecter avec Microsoft'; }
      alert('Erreur : MSAL non chargé. Rechargez la page.');
    }
  }, 100);
};

/* ================================================================
   1. MSAL — AUTHENTIFICATION MICROSOFT
   ================================================================ */
let msalInstance = null;
let currentAccount = null;
let graphToken = null;
let spSiteId = null;
let isLiveData = false;

const SCOPES = ["Sites.ReadWrite.All", "User.Read"];
const IS_ELECTRON = window.__isElectronApp === true;
const IS_LOCALHOST = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

async function doMsalSignIn() {
  try {
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = "Connexion en cours…"; }
    if (IS_ELECTRON || IS_LOCALHOST) {
      // Popup sur localhost et Electron (évite les problèmes cross-origin de loginRedirect)
      const result = await msalInstance.loginPopup({ scopes: SCOPES });
      currentAccount = result.account;
      graphToken = result.accessToken;
      showLoadingScreen();
      await loadSharePointData();
    } else {
      await msalInstance.loginRedirect({
        scopes: SCOPES,
        redirectUri: window.location.href.split('?')[0].split('#')[0]
      });
    }
  } catch (err) {
    showAuthError("Erreur : " + err.message);
    const btnErr = document.getElementById('btn-login');
    if (btnErr) { btnErr.disabled = false; btnErr.textContent = "Se connecter avec Microsoft"; }
  }
}
async function initMSAL() {
  try {
    // Utiliser l'origine courante comme redirectUri (localhost ou GitHub Pages)
    const redirectUri = IS_LOCALHOST
      ? (window.location.origin + '/')
      : SP_CONFIG.redirectUri;

    msalInstance = new msal.PublicClientApplication({
      auth: {
        clientId:    SP_CONFIG.msalClientId,
        authority:   SP_CONFIG.msalAuthority,
        redirectUri: redirectUri,
        navigateToLoginRequestUrl: true
      },
      cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: true
      },
      system: {
        allowNativeBroker: false
      }
    });
    await msalInstance.initialize();
    window.__msalReady = true;
    window.__doSignIn = doMsalSignIn;

    // Si cette page s'est chargée dans un popup MSAL (retour du login),
    // MSAL gère l'échange de code en interne — ne pas lancer l'app
    if (window.opener && window.opener !== window) return;

    if (IS_ELECTRON || IS_LOCALHOST) {
      // Popup mode — pas de redirect, vérifier le cache directement
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        currentAccount = accounts[0];
        await acquireToken();
      }
    } else {
      const resp = await msalInstance.handleRedirectPromise();
      if (resp) {
        currentAccount = resp.account;
        graphToken = resp.accessToken;
      } else {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          currentAccount = accounts[0];
          await acquireToken();
        }
      }
    }

    if (currentAccount && graphToken) {
      showLoadingScreen();
      await loadSharePointData();
    } else {
      showAuthScreen();
    }
  } catch (err) {
    console.warn("MSAL init error, falling back to demo mode:", err);
    loadDemoData();
  }
}

function signOut() {
  if (msalInstance && currentAccount) {
    msalInstance.logoutRedirect({
      account: currentAccount,
      postLogoutRedirectUri: window.location.href.split('?')[0].split('#')[0]
    });
  } else {
    // Mode démo : recharger simplement la page
    window.location.reload();
  }
}

async function acquireToken() {
  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: SCOPES,
      account: currentAccount
    });
    graphToken = result.accessToken;
  } catch {
    if (IS_ELECTRON || IS_LOCALHOST) {
      // Popup sur localhost et Electron (jamais de redirect)
      const result = await msalInstance.acquireTokenPopup({
        scopes: SCOPES,
        account: currentAccount
      });
      graphToken = result.accessToken;
    } else {
      await msalInstance.acquireTokenRedirect({
        scopes: SCOPES,
        account: currentAccount,
        redirectUri: window.location.href.split('?')[0].split('#')[0]
      });
    }
  }
}
