/* ================================================================
   0. UTILITAIRES SÉCURITÉ
   ================================================================ */
/** Échappe les caractères HTML dangereux dans une valeur avant insertion dans innerHTML */
function h(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
/** Valide un email avant usage dans href="mailto:" ; retourne null si invalide */
function safeEmail(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return null;
  return String(email).replace(/[<>"'&]/g, '');
}


/* ================================================================
   12. UTILITAIRES
   ================================================================ */

function formatDelai(dateStr) {
  if (!dateStr) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = parseLocalDate(dateStr);
  if (!due) return '';
  const diff = Math.round((due - today) / 86400000);
  if (diff === 0) return '<span style="color:#A32D2D;font-size:11px;font-weight:500;">Aujourd\'hui</span>';
  if (diff < 0)  return `<span style="color:#A32D2D;font-size:11px;font-weight:500;">Retard ${Math.abs(diff)}j</span>`;
  if (diff <= 7) return `<span style="color:#854F0B;font-size:11px;font-weight:500;">Dans ${diff}j</span>`;
  return `<span style="font-size:11px;color:var(--c-text-3);">Dans ${diff}j</span>`;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = parseLocalDate(d);
  if (!dt) return d;
  return dt.toLocaleDateString('fr-CA', { year:'numeric', month:'short', day:'numeric' });
}

/**
 * Affiche une notification flottante en haut à droite.
 * @param {string} msg   Texte à afficher
 * @param {'success'|'error'|'info'} type  Couleur du toast (défaut: success)
 * @param {number} duration  Durée en ms avant disparition (défaut: 3500)
 */
function showToast(msg, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '✓'}</span><span>${h(msg)}</span>`;
  toast.addEventListener('click', () => dismiss(toast));
  container.appendChild(toast);

  function dismiss(t) {
    if (t.classList.contains('leaving')) return;
    t.classList.add('leaving');
    setTimeout(() => t.remove(), 300);
  }
  setTimeout(() => dismiss(toast), duration);
}

/**
 * Calcule l'avancement attendu (cible) à la date d'aujourd'hui selon une
 * progression linéaire entre dateDebut et écheance, et l'écart avec le réel.
 * @param {object} action
 * @returns {{cible:number, gap:number}|null}  null si dates manquantes
 */
function calcCible(action) {
  if (!action.dateDebut || !action.echeance) return null;
  const debut = parseLocalDate(action.dateDebut);
  const fin   = parseLocalDate(action.echeance);
  if (!debut || !fin || fin <= debut) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const raw   = (today - debut) / (fin - debut) * 100;
  const cible = Math.round(Math.min(100, Math.max(0, raw)));
  const reel  = parseInt(action.pct) || 0;
  return { cible, gap: reel - cible };
}

function exportCSV() {
  /** Échappe une valeur pour CSV : guillemets internes doublés, préfixe formule retiré */
  const csvCell = v => {
    const s = v == null ? '' : String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const headers = ['ID','Titre','Axe','Responsable','Priorité','Échéance','Avancement (%)','Statut','Réalisation'];
  const rows = APP.actions.map(a => [
    csvCell(a.id), csvCell(a.titre), csvCell(a.axe), csvCell(a.resp),
    csvCell(a.prio), csvCell(a.echeance), csvCell(a.pct), csvCell(a.statut), csvCell(a.desc)
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'plan_action_strategique.csv'; link.click();
  URL.revokeObjectURL(url);
}

function openSharePoint() {
  window.open(`https://${SP_CONFIG.tenantDomain}${SP_CONFIG.siteRelativeUrl}`, '_blank');
}

async function refreshData() {
  if (!isLiveData) { alert("Connexion SharePoint requise pour actualiser les données."); return; }
  document.querySelector('.nav-item[onclick*="refreshData"]').style.opacity = '0.5';
  try {
    await loadSharePointData();
  } finally {
    document.querySelector('.nav-item[onclick*="refreshData"]').style.opacity = '1';
  }
}

/* ================================================================
   SYNCHRONISATION SILENCIEUSE — toutes les 5 minutes
   Met à jour les données sans rechargement ni interruption
   ================================================================ */
async function silentSync() {
  // Ne synchroniser que si connecté à SharePoint
  if (!isLiveData || !graphToken || !spSiteId) return;

  // Ne pas synchroniser si une modale est ouverte (édition en cours)
  const modalesOuvertes = ['form-modal-bg', 'jalon-modal-bg', 'modal-bg']
    .some(id => { const el = document.getElementById(id); return el && el.style.display !== 'none' && el.style.display !== ''; });
  if (modalesOuvertes) return;

  try {
    // Indiquer visuellement que la synchro est en cours (point qui clignote)
    const dotEl = document.getElementById('sp-dot');
    if (dotEl) dotEl.style.opacity = '0.4';

    // Récupérer les 3 listes en parallèle
    const [rawAxes, rawActions, rawJalons] = await Promise.all([
      getListItems(SP_CONFIG.lists.axes),
      getListItems(SP_CONFIG.lists.actions),
      getListItems(SP_CONFIG.lists.jalons),
    ]);

    // Préserver les couleurs/descriptions des axes (non stockées dans SP Axes)
    const savedColors = {};
    (APP.axes || []).forEach(a => {
      const key = a.id || a.nom;
      if (key) savedColors[key] = { color: a.color, light: a.light, desc: a.desc };
      if (a.nom) savedColors[a.nom] = { color: a.color, light: a.light, desc: a.desc };
    });

    // Mettre à jour APP
    const spAxes = rawAxes.map(mapAxe);
    spAxes.forEach(a => {
      const lc = savedColors[a.id] || savedColors[a.nom];
      if (lc) {
        if (lc.color) a.color = lc.color;
        if (lc.light) a.light = lc.light;
        if (lc.desc)  a.desc  = lc.desc;
      }
    });
    APP.axes    = spAxes;
    invalidateAxeMap();
    APP.actions = rawActions.map(mapAction);
    APP.jalons  = rawJalons.map(mapJalon);

    calcAvancementAxes();

    // Re-rendre uniquement le panneau actif (pas de rechargement complet)
    const activePane = document.querySelector('.pane.active');
    if (activePane) {
      switch (activePane.id) {
        case 'pane-apercu':    renderApercu();    break;
        case 'pane-actions':   renderActions();   break;
        case 'pane-axes':      renderAxes();      break;
        case 'pane-timeline':  renderTimeline();  break;
        case 'pane-mavue':     renderMaVue();     break;
        case 'pane-gantt':     renderGantt();     break;
      }
    }

    checkAlertes();
    persistData(); // Mettre à jour le cache hors ligne

    // Mettre à jour l'indicateur avec l'heure de synchro
    const now     = new Date();
    const timeStr = now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
    const lblEl   = document.getElementById('sp-label');
    if (lblEl) lblEl.textContent = `Live · ${timeStr}`;
    if (dotEl) { dotEl.style.opacity = '1'; dotEl.className = 'sp-dot sp-live'; }

  } catch(e) {
    console.warn('Auto-sync silencieux échoué :', e.message);
    const dotEl = document.getElementById('sp-dot');
    if (dotEl) dotEl.style.opacity = '1'; // Restaurer l'opacité même en cas d'erreur
  }
}

/* Lancer la synchro auto toutes les 5 minutes */
setInterval(silentSync, 5 * 60 * 1000);
