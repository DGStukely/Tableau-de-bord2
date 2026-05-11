/* ================================================================
   5. ÉTAT GLOBAL DE L'APPLICATION
   ================================================================ */
const APP = {
  axes: [], actions: [], jalons: [],
  activeFilter: 'tous',   // filtre statut
  filterAxe:    '',        // filtre axe stratégique
  filterResp:   '',        // filtre responsable
  donutChart: null, lineChart: null,
  _axeMap: null,   // cache invalidé quand APP.axes change
  sortCol: null,
  sortDir: 'asc',
  actionsPage: 1
};

/** Convertit "YYYY-MM-DD" en Date locale (minuit) ; retourne null si invalide */
function parseLocalDate(d) {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  return isNaN(dt.getTime()) ? null : dt;
}

/** Génère la version claire d'une couleur hex (opacité ~13%) */
function hexLight(color) { return color + '22'; }

/** Retourne un objet {id → axe} mis en cache. Appeler invalidateAxeMap() après toute modification de APP.axes. */
function getAxeMap() {
  if (!APP._axeMap) {
    APP._axeMap = {};
    (APP.axes || []).forEach(a => { APP._axeMap[a.id] = a; });
  }
  return APP._axeMap;
}
function invalidateAxeMap() { APP._axeMap = null; }

/** persistSettings déboncé — évite les écritures localStorage répétées lors d'éditions en rafale */
let _persistTimer = null;
function debouncedPersist() {
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(persistSettings, 300);
}

const STATUS_MAP = {
  'terminée':   { pill:'p-done',    dot:'#639922',  label:'Terminée' },
  'en cours':   { pill:'p-prog',    dot:'#378ADD',  label:'En cours' },
  'en retard':  { pill:'p-late',    dot:'#E24B4A',  label:'En retard' },
  'en attente': { pill:'p-hold',    dot:'#EF9F27',  label:'En attente' },
  'en suspend': { pill:'p-suspend', dot:'#7B68EE',  label:'En suspend' },
  'à faire':    { pill:'p-todo',    dot:'#9E9C96',  label:'À faire' },
};
const PRIO_MAP = { haute:'pr-h', moyenne:'pr-m', basse:'pr-l' };

/** Retourne le style inline pour un badge de priorité.
 *  Cherche d'abord dans APP.priorites (couleur personnalisée),
 *  puis dans PRIO_MAP pour les 3 priorités par défaut. */
function getPrioBadgeStyle(prioId) {
  if (!prioId) return '';
  const p = (APP.priorites || []).find(x => x.id === prioId);
  if (p && p.couleur) return `background:${p.couleur};`;
  // Fallback : couleurs par défaut codées en dur
  const defaults = { haute:'#E24B4A', moyenne:'#EF9F27', basse:'#639922' };
  return defaults[prioId] ? `background:${defaults[prioId]};` : 'background:#EF9F27;';
}

/**
 * Calcule l'avancement d'un objectif à partir de ses jalons.
 * Retourne null si l'objectif n'a aucun jalon (=> utiliser le % manuel).
 * Retourne un objet { pct, total, done } sinon.
 */
function getJalonProgress(actionId) {
  if (!APP.jalons || !actionId) return null;
  const jalons = APP.jalons.filter(j => String(j.actionId) === String(actionId));
  if (!jalons.length) return null;
  const done = jalons.filter(j => j.statut === 'terminée').length;
  return { pct: Math.round(done / jalons.length * 100), done, total: jalons.length, jalons };
}

/* ================================================================
   PERSISTANCE DES DONNÉES (mode hors ligne)
   ================================================================ */
const DATA_CACHE_KEY = 'plan_strategique_data';

/** Sauvegarde les données SharePoint dans localStorage après chargement */
function persistData() {
  try {
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({
      axes:    APP.axes,
      actions: APP.actions,
      // jalons exclus — toujours chargés depuis SharePoint
      savedAt: new Date().toISOString()
    }));
  } catch(e) { console.warn('Impossible de sauvegarder les données hors ligne', e); }
}

/** Restaure les données depuis localStorage si disponibles */
function restoreData() {
  try {
    const raw = localStorage.getItem(DATA_CACHE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d.axes    && d.axes.length)    APP.axes    = d.axes;
    if (d.actions && d.actions.length) APP.actions = d.actions;
    // Les jalons viennent toujours de SharePoint — purger le cache existant
    if (d.jalons) {
      delete d.jalons;
      localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(d));
    }
    invalidateAxeMap();
    return d.savedAt || true;
  } catch(e) { return false; }
}

/* ================================================================
   INDICATEUR EN LIGNE / HORS LIGNE
   ================================================================ */
function updateOnlineStatus() {
  const dot   = document.getElementById('sp-dot');
  const label = document.getElementById('sp-label');
  if (!dot || !label) return;
  if (!navigator.onLine) {
    dot.className   = 'sp-dot sp-offline';
    label.textContent = 'Hors ligne';
  } else if (isLiveData) {
    dot.className   = 'sp-dot sp-live';
    label.textContent = 'Données SharePoint';
  } else {
    dot.className   = 'sp-dot';
    label.textContent = 'Non connecté';
  }
}

window.addEventListener('online',  () => { updateOnlineStatus(); checkAlertes(); });
window.addEventListener('offline', () => { updateOnlineStatus(); });
