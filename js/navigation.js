/* ================================================================
   11. NAVIGATION
   ================================================================ */

/* ----------------------------------------------------------------
   RACCOURCIS CLAVIER
   N → Nouvel objectif
   P → Mode présentation
   A → Aller à Objectifs
   H → Aller à Aperçu (Home)
   ? → Afficher l'aide des raccourcis
   Échap → déjà géré dans modal.js
   ---------------------------------------------------------------- */
document.addEventListener('keydown', function(e) {
  // Ignorer si on est dans un champ de saisie
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  // Ignorer si une modale est ouverte
  if (document.getElementById('form-modal-bg')?.classList.contains('open'))     return;
  if (document.getElementById('settings-modal-bg')?.classList.contains('open')) return;
  if (document.getElementById('modal-bg')?.classList.contains('open'))          return;

  switch (e.key.toLowerCase()) {
    case 'n':  // Nouvel objectif
      e.preventDefault();
      openFormModal(null);
      break;
    case 'p':  // Mode présentation
      e.preventDefault();
      togglePresentationMode();
      break;
    case 'a':  // Aller à Objectifs
      e.preventDefault();
      switchPane('actions', document.getElementById('nav-actions'));
      break;
    case 'h':  // Aperçu (Home)
      e.preventDefault();
      switchPane('apercu', document.querySelector('.nav-item'));
      break;
    case '?':  // Aide raccourcis
      e.preventDefault();
      showShortcutsHelp();
      break;
  }
});

function showShortcutsHelp() {
  const box = document.getElementById('modal-box');
  if (!box) return;
  box.innerHTML = `
    <div class="modal-head">
      <div style="font-size:15px;font-weight:600;">⌨️ Raccourcis clavier</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${[
        ['N',   'Nouvel objectif'],
        ['A',   'Aller à Objectifs'],
        ['H',   'Aller à Aperçu'],
        ['P',   'Mode présentation'],
        ['?',   'Afficher cette aide'],
        ['Échap','Fermer la fenêtre active'],
      ].map(([key, desc]) => `
        <tr style="border-bottom:1px solid var(--c-border);">
          <td style="padding:8px 12px;">
            <kbd style="display:inline-block;padding:2px 8px;background:var(--c-surface-2);border:1px solid var(--c-border-med);border-radius:4px;font-family:var(--font-mono);font-size:12px;font-weight:600;">${key}</kbd>
          </td>
          <td style="padding:8px 12px;color:var(--c-text-2);">${desc}</td>
        </tr>`).join('')}
    </table>
    <p style="margin-top:12px;font-size:11px;color:var(--c-text-3);">Les raccourcis sont désactivés quand un champ de saisie est actif.</p>
  `;
  _openModal(document.getElementById('modal-bg'));
}

function switchPane(id, btn) {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('pane-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
}


/* ================================================================
   13. GESTION DES ÉCRANS
   ================================================================ */
function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app').style.display = 'none';
}

function showLoadingScreen() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function setLoadingStep(msg) {
  document.getElementById('loading-step').textContent = msg;
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  // Bannière démo désactivée pour cette instance
  // const db = document.getElementById('demo-banner'); if(db) db.style.display = 'flex';

  // Infos utilisateur
  if (currentAccount) {
    const name = currentAccount.name || currentAccount.username;
    const initials = name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    const uiEl = document.getElementById('user-initials'); if (uiEl) uiEl.textContent = initials;
    const unEl = document.getElementById('user-name'); if (unEl) unEl.textContent = name.split(' ')[0];
  } else {
    const diEl = document.getElementById('user-initials'); if (diEl) diEl.textContent = 'SS';
    const dnEl = document.getElementById('user-name'); if (dnEl) dnEl.textContent = 'Stukely-Sud';
  }

  // Indicateur live / démo
  if (isLiveData) {
    const dotEl = document.getElementById('sp-dot');
    const lblEl = document.getElementById('sp-label');
    if (dotEl) dotEl.className = 'sp-dot sp-live';
    if (lblEl) lblEl.textContent = 'Données SharePoint';
  }

  // Topbar
  const tmEl = document.getElementById('topbar-meta'); if (tmEl) tmEl.textContent =
    `Mise à jour le ${new Date().toLocaleDateString('fr-CA', {year:'numeric',month:'long',day:'numeric'})}` +
    (isLiveData ? ' · SharePoint Live' : '');

  calcAvancementAxes();
  renderApercu();
  renderActions();
  renderAxes();
  renderTimeline();
  renderMaVue();
  renderGantt();
  checkAlertes();
}

function showAuthError(msg) {
  document.getElementById('auth-error').innerHTML = `<div class="error-card">${h(msg)}</div>`;
}


/* ================================================================
   14. DÉMARRAGE
   ================================================================ */
const fyEl = document.getElementById('footer-year'); if (fyEl) fyEl.textContent = new Date().getFullYear();
document.querySelectorAll('.footer-year-side').forEach(el => el.textContent = new Date().getFullYear());
// Initialisation sécurisée — attendre que MSAL soit chargé
let msalLoadAttempts = 0;
function startApp() {
  msalLoadAttempts++;
  if (typeof msal === 'undefined' || !msal.PublicClientApplication) {
    if (msalLoadAttempts > 20) {
      console.warn('MSAL non disponible après 6s, mode démo');
      loadDemoData();
      return;
    }
    setTimeout(startApp, 300);
    return;
  }
  initMSAL().catch(err => {
    console.warn('MSAL init failed, loading demo:', err);
    loadDemoData();
  });
}

// Démarrer après chargement complet
window.addEventListener('load', function() {
  setTimeout(startApp, 200);
});
