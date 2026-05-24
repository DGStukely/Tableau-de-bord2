/* ================================================================
   PARAMÈTRES — GESTION DES LISTES CONFIGURABLES
   ================================================================ */

// Deux clés séparées : configuration (responsables/statuts/priorités/thème) vs données (axes)
const SETTINGS_KEY = 'plan_strategique_settings';
const CONFIG_KEY   = 'plan_strategique_config';

function loadSettings() {
  try {
    // 1. Charger la configuration (responsables, statuts, priorités, thème)
    const cfg = localStorage.getItem(CONFIG_KEY);
    if (cfg) {
      const c = JSON.parse(cfg);
      if (c.responsables) APP.responsables = c.responsables;
      if (c.statuts)      APP.statuts      = c.statuts;
      if (c.priorites)    APP.priorites    = c.priorites;
      if (c.autoCalcAxes !== undefined) APP.autoCalcAxes = c.autoCalcAxes;
      if (c.theme)        applyTheme(c.theme);
    }
    // 2. Charger les axes (clé séparée pour ne pas affecter la config)
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const s = JSON.parse(saved);
      if (s.axes) { APP.axes = s.axes; invalidateAxeMap(); }
      // Migration : récupérer responsables/statuts/priorités de l'ancienne clé si CONFIG_KEY vide
      if (!cfg) {
        if (s.responsables) APP.responsables = s.responsables;
        if (s.statuts)      APP.statuts      = s.statuts;
        if (s.priorites)    APP.priorites    = s.priorites;
        if (s.autoCalcAxes !== undefined) APP.autoCalcAxes = s.autoCalcAxes;
        if (s.theme)        applyTheme(s.theme);
      }
    }
  } catch(e) { console.log('Settings load error', e); }
}

function persistSettings() {
  try {
    // Sauvegarder la configuration séparément des axes
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      responsables: APP.responsables,
      statuts:      APP.statuts,
      priorites:    APP.priorites,
      autoCalcAxes: APP.autoCalcAxes,
      theme:        APP.theme || 'grey',
      savedAt:      new Date().toISOString()
    }));
    // Sauvegarder les axes séparément
    const existing = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    existing.axes = APP.axes;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(existing));
  } catch(e) {}
  // Synchroniser vers SharePoint si connecté (deboncé)
  if (typeof persistSpConfig === 'function') {
    clearTimeout(window._spConfigTimer);
    window._spConfigTimer = setTimeout(() => persistSpConfig(), 1500);
  }
}

function applyTheme(name) {
  document.body.classList.remove('theme-grey', 'theme-white', 'theme-dark');
  document.body.classList.add('theme-' + name);
  APP.theme = name;
  ['grey','white','dark'].forEach(t => {
    const btn = document.getElementById('theme-btn-' + t);
    if (btn) btn.classList.toggle('active', t === name);
  });
}

function setTheme(name) {
  applyTheme(name);
  debouncedPersist();
}

// Données par défaut si non configurées
function initDefaultSettings() {
  if (!APP.responsables) {
    APP.responsables = [];
  }
  if (!APP.statuts) {
    APP.statuts = [
      { id:'terminée',   label:'Terminée',   bg:'#EAF3DE', fg:'#3B6D11' },
      { id:'en cours',   label:'En cours',   bg:'#E6F1FB', fg:'#185FA5' },
      { id:'en retard',  label:'En retard',  bg:'#FCEBEB', fg:'#A32D2D' },
      { id:'en attente', label:'En attente', bg:'#FAEEDA', fg:'#854F0B' },
      { id:'à faire',    label:'À faire',    bg:'#F1EFE8', fg:'#5F5E5A' },
    ];
  }
  if (!APP.priorites) {
    APP.priorites = [
      { id:'haute',   label:'Haute',   couleur:'#E24B4A' },
      { id:'moyenne', label:'Moyenne', couleur:'#EF9F27' },
      { id:'basse',   label:'Basse',   couleur:'#639922' },
    ];
  }
}

function openSettingsModal() {
  // Mettre à jour l'état de la case à cocher
  const cb = document.getElementById('auto-calc-axes');
  if (cb) cb.checked = APP.autoCalcAxes || false;
  initDefaultSettings();
  renderSettingsAxes();
  renderSettingsResp();
  renderSettingsStatuts();
  renderSettingsPriorities();
  _openModal(document.getElementById('settings-modal-bg'));
}

function closeSettingsModal() {
  _closeModal(document.getElementById('settings-modal-bg'));
}

function switchSettingsTab(id, btn) {
  document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('settings-pane-' + id).classList.add('active');
  btn.classList.add('active');
}

/* --- AXES --- */
function renderSettingsAxes() {
  const el = document.getElementById('settings-axes-list');
  el.innerHTML = APP.axes.map((a, i) => `
    <div class="item-row" id="axe-row-${i}">
      <span class="item-row-color" style="background:${a.color};width:14px;height:14px;border-radius:50%;flex-shrink:0;display:inline-block;"></span>
      <span class="item-row-name"><strong style="font-weight:500;">${h(a.id)}</strong> — ${h(a.nom)}</span>
      <span class="item-row-sub">${h(a.pct || 0)}% complété</span>
      <button class="item-btn-edit" onclick="editAxe(${i})" title="Modifier" style="color:var(--c-purple);margin-right:4px;">✏️</button>
      <button class="item-btn-del" onclick="removeAxe(${i})" title="Supprimer" style="color:#A32D2D;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
    <div id="axe-edit-${i}" style="display:none;background:var(--c-surface-2);border-radius:8px;padding:10px 12px;margin-top:4px;gap:8px;flex-wrap:wrap;align-items:flex-end;" class="add-item-form">
      <div class="add-item-field" style="flex:0 0 60px;">
        <label>Code</label>
        <input type="text" id="edit-axe-id-${i}" value="${h(a.id)}" maxlength="5" style="width:60px;" />
      </div>
      <div class="add-item-field" style="flex:1;min-width:160px;">
        <label>Nom de l'axe</label>
        <input type="text" id="edit-axe-nom-${i}" value="${h(a.nom)}" />
      </div>
      <div class="add-item-field">
        <label>Couleur</label>
        <input type="color" id="edit-axe-couleur-${i}" value="${a.color}" style="width:50px;height:32px;padding:2px;cursor:pointer;" />
      </div>
      <div class="add-item-field" style="flex:0 0 70px;">
        <label>Avancement</label>
        <input type="number" id="edit-axe-pct-${i}" value="${a.pct || 0}" min="0" max="100" style="width:70px;" />
      </div>
      <div class="add-item-field" style="flex:100%;width:100%;">
        <label>Description</label>
        <textarea id="edit-axe-desc-${i}" rows="2" style="width:100%;resize:vertical;font-family:inherit;font-size:12px;padding:6px 8px;border:1px solid var(--c-border-med);border-radius:6px;background:var(--c-surface);color:var(--c-text);" placeholder="Décrivez l'orientation stratégique de cet axe…">${h(a.desc || '')}</textarea>
      </div>
      <button class="btn btn-add" onclick="saveAxe(${i})" style="height:32px;align-self:flex-end;">✓ Sauvegarder</button>
      <button class="btn" onclick="cancelEditAxe(${i})" style="height:32px;align-self:flex-end;">Annuler</button>
    </div>`).join('');
}

async function addAxe() {
  const id     = document.getElementById('new-axe-id').value.trim().toUpperCase();
  const nom    = document.getElementById('new-axe-nom').value.trim();
  const color  = document.getElementById('new-axe-couleur').value;
  const desc   = document.getElementById('new-axe-desc').value.trim();
  if (!id || !nom) { alert('Code et nom obligatoires.'); return; }
  if (APP.axes.find(a => a.id === id)) { alert('Ce code existe déjà.'); return; }
  const light = hexLight(color);
  const newAxe = { id, nom, color, light, pct: 0, desc };

  // Créer dans SharePoint si connecté
  if (isLiveData && graphToken && spSiteId) {
    try {
      const res = await graphFetch(
        `/sites/${spSiteId}/lists/${SP_CONFIG.lists.axes}/items`,
        'POST',
        { fields: {
          Title:        nom,
          Identifiant:  id,
          Avancement:   0
        }}
      );
      newAxe.spId = res.id || res.fields?.id;
      showToast('Axe créé dans SharePoint', 'success');
    } catch(e) {
      showToast('Axe sauvegardé localement (erreur SharePoint : ' + e.message + ')', 'error');
    }
  }

  APP.axes.push(newAxe);
  invalidateAxeMap();
  persistSettings();
  document.getElementById('new-axe-id').value = '';
  document.getElementById('new-axe-nom').value = '';
  document.getElementById('new-axe-desc').value = '';
  renderSettingsAxes();
}

function toggleAutoCalc(enabled) {
  APP.autoCalcAxes = enabled;
  persistSettings();
  if (enabled) {
    calcAvancementAxes();
    renderSettingsAxes();
    renderApercu();
    renderAxes();
  }
}

async function removeAxe(i) {
  if (!confirm('Supprimer cet axe ? Les objectifs associés ne seront pas supprimés.')) return;
  const axe = APP.axes[i];
  if (isLiveData && graphToken && spSiteId && axe.spId) {
    try {
      await graphFetch(`/sites/${spSiteId}/lists/${SP_CONFIG.lists.axes}/items/${axe.spId}`, 'DELETE');
    } catch(e) {
      if (!e.message.includes('404')) { showToast('Erreur suppression SharePoint : ' + e.message, 'error'); return; }
    }
  }
  APP.axes.splice(i, 1);
  invalidateAxeMap();
  persistSettings();
  renderSettingsAxes();
}

function editAxe(i) {
  document.querySelectorAll('[id^="axe-edit-"]').forEach(el => el.style.display = 'none');
  const editDiv = document.getElementById('axe-edit-' + i);
  if (editDiv) editDiv.style.display = 'flex';
}

function cancelEditAxe(i) {
  const editDiv = document.getElementById('axe-edit-' + i);
  if (editDiv) editDiv.style.display = 'none';
}

async function saveAxe(i) {
  const id      = document.getElementById('edit-axe-id-' + i)?.value.trim().toUpperCase();
  const nom     = document.getElementById('edit-axe-nom-' + i)?.value.trim();
  const color   = document.getElementById('edit-axe-couleur-' + i)?.value;
  const pct     = parseInt(document.getElementById('edit-axe-pct-' + i)?.value || 0);
  const desc    = document.getElementById('edit-axe-desc-' + i)?.value.trim();
  if (!id || !nom) { alert('Le code et le nom sont obligatoires.'); return; }
  const light = hexLight(color);
  const axeOld = APP.axes[i];
  APP.axes[i] = { ...axeOld, id, nom, color, light, pct, desc };
  invalidateAxeMap();
  persistSettings();

  // Sauvegarder dans SharePoint si connecté
  if (isLiveData && graphToken && spSiteId) {
    // 1. Avancement dans la liste Axes_Strategiques
    if (axeOld.spId) {
      try {
        await graphFetch(
          `/sites/${spSiteId}/lists/${SP_CONFIG.lists.axes}/items/${axeOld.spId}/fields`,
          'PATCH',
          { Avancement: pct }
        );
      } catch(e) {
        console.warn('Mise à jour SharePoint axe échouée :', e.message);
      }
    }
    // 2. Couleurs + descriptions dans la liste Configuration (axesMeta)
    const ok = await persistSpConfig();
    if (typeof showToast === 'function') {
      showToast(ok ? '✅ Couleurs de l\'axe sauvegardées' : '⚠️ Erreur : couleurs non sauvegardées sur SharePoint', ok ? 'success' : 'error');
    }
  }

  renderSettingsAxes();
  if (typeof renderApp === 'function') renderApp();
}

/* --- RESPONSABLES --- */
function renderSettingsResp() {
  const el = document.getElementById('settings-resps-list');
  el.innerHTML = APP.responsables.map((r, i) => {
    const initials = h(r.nom.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase());
    const _respEmail = safeEmail(r.courriel);
    return `
    <div class="item-row" id="resp-row-${i}">
      <div class="resp-avatar">${initials}</div>
      <div style="flex:1;">
        <span class="item-row-name" style="display:block;">${h(r.nom)}</span>
        <span class="item-row-sub" style="display:block;">${h(r.titre || '')}${_respEmail ? ' · <a href="mailto:'+_respEmail+'" style="color:var(--c-blue);">'+h(_respEmail)+'</a>' : '<span style="color:var(--c-text-3);font-style:italic;">Aucun courriel</span>'}</span>
      </div>
      <button class="item-btn-edit" onclick="editResp(${i})" title="Modifier" style="color:var(--c-purple);margin-right:4px;">✏️</button>
      <button class="item-btn-del" onclick="removeResp(${i})" title="Supprimer" style="color:#A32D2D;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
    <div id="resp-edit-${i}" style="display:none;background:var(--c-surface-2);border-radius:8px;padding:10px 12px;margin-top:4px;gap:8px;flex-wrap:wrap;align-items:flex-end;" class="add-item-form">
      <div class="add-item-field" style="flex:1;min-width:120px;">
        <label>Nom</label>
        <input type="text" id="edit-resp-nom-${i}" value="${h(r.nom)}" />
      </div>
      <div class="add-item-field" style="flex:1;min-width:120px;">
        <label>Titre</label>
        <input type="text" id="edit-resp-titre-${i}" value="${h(r.titre || '')}" />
      </div>
      <div class="add-item-field" style="flex:1;min-width:160px;">
        <label>Courriel</label>
        <input type="email" id="edit-resp-courriel-${i}" value="${h(r.courriel || '')}" placeholder="courriel@municipalite.ca" />
      </div>
      <button class="btn btn-add" onclick="saveResp(${i})" style="height:32px;align-self:flex-end;">✓ Sauvegarder</button>
      <button class="btn" onclick="cancelEditResp(${i})" style="height:32px;align-self:flex-end;">Annuler</button>
    </div>`;
  }).join('');
}

function addResponsable() {
  const nom      = document.getElementById('new-resp-nom').value.trim();
  const titre    = document.getElementById('new-resp-titre').value.trim();
  const courriel = document.getElementById('new-resp-courriel').value.trim();
  if (!nom) { alert('Le nom est obligatoire.'); return; }
  APP.responsables.push({ id: 'r' + Date.now(), nom, titre, courriel });
  document.getElementById('new-resp-nom').value = '';
  document.getElementById('new-resp-titre').value = '';
  document.getElementById('new-resp-courriel').value = '';
  persistSettings();
  renderSettingsResp();
}

function removeResp(i) {
  APP.responsables.splice(i, 1);
  persistSettings();
  renderSettingsResp();
}

function editResp(i) {
  // Masquer tous les formulaires d'édition
  document.querySelectorAll('[id^="resp-edit-"]').forEach(el => el.style.display = 'none');
  // Afficher celui-ci
  const editDiv = document.getElementById('resp-edit-' + i);
  if (editDiv) editDiv.style.display = 'flex';
}

function cancelEditResp(i) {
  const editDiv = document.getElementById('resp-edit-' + i);
  if (editDiv) editDiv.style.display = 'none';
}

function saveResp(i) {
  const nom      = document.getElementById('edit-resp-nom-' + i)?.value.trim();
  const titre    = document.getElementById('edit-resp-titre-' + i)?.value.trim();
  const courriel = document.getElementById('edit-resp-courriel-' + i)?.value.trim();
  if (!nom) { alert('Le nom est obligatoire.'); return; }
  APP.responsables[i] = { ...APP.responsables[i], nom, titre, courriel };
  persistSettings(); // Sauvegarder immédiatement
  renderSettingsResp();
}

/* --- STATUTS --- */
function renderSettingsStatuts() {
  const el = document.getElementById('settings-statuts-list');
  el.innerHTML = APP.statuts.map((s, i) => `
    <div class="item-row" id="statut-row-${i}">
      <span style="background:${h(s.bg)};color:${h(s.fg)};padding:2px 10px;border-radius:99px;font-size:11px;font-weight:500;">${h(s.label)}</span>
      <span style="flex:1;"></span>
      <button onclick="editStatut(${i})" title="Modifier" style="border:none;background:none;cursor:pointer;color:var(--c-purple);padding:4px 6px;">✏️</button>
      <button onclick="removeStatut(${i})" title="Supprimer" style="border:none;background:none;cursor:pointer;color:#A32D2D;padding:4px 6px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
    <div id="statut-edit-${i}" style="display:none;background:var(--c-surface-2);border-radius:8px;padding:10px 12px;margin-top:4px;gap:8px;flex-wrap:wrap;align-items:flex-end;">
      <div class="add-item-field" style="flex:1;min-width:120px;">
        <label>Libellé</label>
        <input type="text" id="edit-statut-label-${i}" value="${h(s.label)}" />
      </div>
      <div class="add-item-field">
        <label>Fond</label>
        <input type="color" id="edit-statut-bg-${i}" value="${s.bg}" style="width:46px;height:32px;padding:2px;cursor:pointer;" />
      </div>
      <div class="add-item-field">
        <label>Texte</label>
        <input type="color" id="edit-statut-fg-${i}" value="${s.fg}" style="width:46px;height:32px;padding:2px;cursor:pointer;" />
      </div>
      <button class="btn btn-add" onclick="saveStatut(${i})" style="height:32px;align-self:flex-end;">✓ OK</button>
      <button class="btn" onclick="cancelEditStatut(${i})" style="height:32px;align-self:flex-end;">Annuler</button>
    </div>`).join('');
}

function editStatut(i) {
  document.querySelectorAll('[id^="statut-edit-"]').forEach(el => el.style.display = 'none');
  const el = document.getElementById('statut-edit-' + i);
  if (el) el.style.display = 'flex';
}
function cancelEditStatut(i) {
  const el = document.getElementById('statut-edit-' + i);
  if (el) el.style.display = 'none';
}
function saveStatut(i) {
  const label = document.getElementById('edit-statut-label-' + i)?.value.trim();
  const bg    = document.getElementById('edit-statut-bg-' + i)?.value;
  const fg    = document.getElementById('edit-statut-fg-' + i)?.value;
  if (!label) { alert('Le libellé est obligatoire.'); return; }
  APP.statuts[i] = { ...APP.statuts[i], label, id: label.toLowerCase(), bg, fg };
  persistSettings();
  renderSettingsStatuts();
}

function addStatut() {
  const nom = document.getElementById('new-statut-nom').value.trim();
  const bg  = document.getElementById('new-statut-bg').value;
  const fg  = document.getElementById('new-statut-fg').value;
  if (!nom) { alert('Le nom est obligatoire.'); return; }
  APP.statuts.push({ id: nom.toLowerCase(), label: nom, bg, fg });
  document.getElementById('new-statut-nom').value = '';
  persistSettings();
  renderSettingsStatuts();
}

function removeStatut(i) {
  if (APP.statuts.length <= 1) { alert('Il faut au moins un statut.'); return; }
  APP.statuts.splice(i, 1);
  persistSettings();
  renderSettingsStatuts();
}

/* --- PRIORITÉS --- */
function renderSettingsPriorities() {
  const el = document.getElementById('settings-prios-list');
  el.innerHTML = APP.priorites.map((p, i) => `
    <div class="item-row" id="prio-row-${i}">
      <span style="background:${p.couleur};width:12px;height:12px;border-radius:50%;display:inline-block;flex-shrink:0;"></span>
      <span class="item-row-name">${h(p.label)}</span>
      <span style="flex:1;"></span>
      <button onclick="editPrio(${i})" title="Modifier" style="border:none;background:none;cursor:pointer;color:var(--c-purple);padding:4px 6px;">✏️</button>
      <button onclick="removePrio(${i})" title="Supprimer" style="border:none;background:none;cursor:pointer;color:#A32D2D;padding:4px 6px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
    <div id="prio-edit-${i}" style="display:none;background:var(--c-surface-2);border-radius:8px;padding:10px 12px;margin-top:4px;gap:8px;flex-wrap:wrap;align-items:flex-end;">
      <div class="add-item-field" style="flex:1;min-width:120px;">
        <label>Libellé</label>
        <input type="text" id="edit-prio-label-${i}" value="${h(p.label)}" />
      </div>
      <div class="add-item-field">
        <label>Couleur</label>
        <input type="color" id="edit-prio-couleur-${i}" value="${p.couleur}" style="width:46px;height:32px;padding:2px;cursor:pointer;" />
      </div>
      <button class="btn btn-add" onclick="savePrio(${i})" style="height:32px;align-self:flex-end;">✓ OK</button>
      <button class="btn" onclick="cancelEditPrio(${i})" style="height:32px;align-self:flex-end;">Annuler</button>
    </div>`).join('');
}

function editPrio(i) {
  document.querySelectorAll('[id^="prio-edit-"]').forEach(el => el.style.display = 'none');
  const el = document.getElementById('prio-edit-' + i);
  if (el) el.style.display = 'flex';
}
function cancelEditPrio(i) {
  const el = document.getElementById('prio-edit-' + i);
  if (el) el.style.display = 'none';
}
function savePrio(i) {
  const label   = document.getElementById('edit-prio-label-' + i)?.value.trim();
  const couleur = document.getElementById('edit-prio-couleur-' + i)?.value;
  if (!label) { alert('Le libellé est obligatoire.'); return; }
  APP.priorites[i] = { ...APP.priorites[i], label, id: label.toLowerCase(), couleur };
  persistSettings();
  renderSettingsPriorities();
}

function addPriorite() {
  const nom     = document.getElementById('new-prio-nom').value.trim();
  const couleur = document.getElementById('new-prio-couleur').value;
  if (!nom) { alert('Le nom est obligatoire.'); return; }
  APP.priorites.push({ id: nom.toLowerCase(), label: nom, couleur });
  document.getElementById('new-prio-nom').value = '';
  persistSettings();
  renderSettingsPriorities();
}

function removePrio(i) {
  if (APP.priorites.length <= 1) { alert('Il faut au moins une priorité.'); return; }
  APP.priorites.splice(i, 1);
  renderSettingsPriorities();
}

/* --- SAUVEGARDE --- */
async function saveSettings(closeAfter) {
  // 1. Sauvegarder en mémoire + localStorage
  //    Annuler le timer debounce avant ET après persistSettings (qui le recrée)
  clearTimeout(window._spConfigTimer);
  persistSettings();
  clearTimeout(window._spConfigTimer); // annuler le re-schedule créé par persistSettings
  calcAvancementAxes();
  renderApercu();
  renderActions();
  renderAxes();

  if (closeAfter) {
    // Bouton Terminer — fermer d'abord, puis sync SharePoint en arrière-plan
    closeSettingsModal();
    if (isLiveData && graphToken && spSiteId) {
      const ok = await persistSpConfig();
      if (ok) showToast('Paramètres sauvegardés sur SharePoint', 'success');
      // L'erreur est déjà affichée par persistSpConfig si ok === false
    }
  } else {
    // Bouton Sauvegarder — rester dans les paramètres avec confirmation
    const btn = document.querySelector('.settings-modal .btn-add');
    if (btn) {
      btn.disabled = true;
      const orig = btn.innerHTML;
      btn.innerHTML = '⏳ Sauvegarde…';
    }
    if (isLiveData && graphToken && spSiteId) {
      const ok = await persistSpConfig();
      const btn2 = document.querySelector('.settings-modal .btn-add');
      if (btn2) {
        btn2.disabled = false;
        btn2.innerHTML = ok ? '✓ Sauvegardé !' : '⚠️ Erreur SP';
        btn2.style.background = ok ? '#3B6D11' : '#A32D2D';
        btn2.style.borderColor = btn2.style.background;
        setTimeout(() => {
          btn2.innerHTML = '💾 Sauvegarder';
          btn2.style.background = '';
          btn2.style.borderColor = '';
        }, 2500);
      }
    } else {
      const btn2 = document.querySelector('.settings-modal .btn-add');
      if (btn2) {
        btn2.innerHTML = '✓ Sauvegardé !';
        btn2.style.background = '#3B6D11';
        btn2.style.borderColor = '#3B6D11';
        setTimeout(() => {
          btn2.innerHTML = '💾 Sauvegarder';
          btn2.style.background = '';
          btn2.style.borderColor = '';
        }, 2000);
      }
    }
  }
}

async function syncToSharePoint() {
  if (!isLiveData || !graphToken || !spSiteId) {
    showToast('Non connecté à SharePoint — impossible de synchroniser.', 'error'); return;
  }
  const btn = document.getElementById('btn-sync-sp');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Synchronisation…'; }

  let axesOk = 0, axesErr = 0;
  const errMessages = [];

  // Découvrir les noms internes réels des colonnes couleur
  let colCouleur = null, colCouleurClaire = null;
  try {
    const cols = await graphFetch(`/sites/${spSiteId}/lists/${SP_CONFIG.lists.axes}/columns`);
    (cols.value || []).forEach(c => {
      // Ignorer les colonnes système (lecture seule, cachées, ou nom interne commençant par _)
      if (c.readOnly || c.hidden || (c.name || '').startsWith('_')) return;
      const dn = (c.displayName || '').toLowerCase();
      if (dn.includes('couleur') && !dn.includes('clair')) colCouleur = c.name;
      if (dn.includes('clair'))                             colCouleurClaire = c.name;
    });
    console.log('Colonnes couleur détectées:', colCouleur, colCouleurClaire);
  } catch(e) { console.warn('Impossible de lire les colonnes:', e.message); }

  // 1. Pousser les axes sans spId vers SharePoint
  for (let i = 0; i < APP.axes.length; i++) {
    const axe = APP.axes[i];
    if (axe.spId) { axesOk++; continue; }
    try {
      const fields = { Title: axe.nom, Identifiant: axe.id, Avancement: axe.pct || 0 };
      if (colCouleur)       fields[colCouleur]       = axe.color;
      if (colCouleurClaire) fields[colCouleurClaire]  = axe.light;
      const res = await graphFetch(
        `/sites/${spSiteId}/lists/${SP_CONFIG.lists.axes}/items`,
        'POST', { fields }
      );
      APP.axes[i] = { ...axe, spId: res.id || res.fields?.id };
      axesOk++;
    } catch(e) {
      axesErr++;
      errMessages.push(`[${axe.id}] ${e.message}`);
      console.error('Axe sync error', axe.id, e);
    }
  }
  invalidateAxeMap();
  persistSettings();

  // 2. Pousser la configuration (responsables, statuts, priorités)
  await persistSpConfig();

  if (axesErr > 0) {
    showToast(`${axesOk} OK, ${axesErr} erreur(s) : ${errMessages[0]}`, 'error');
  } else {
    showToast(`Synchronisation réussie — ${axesOk} axe(s) et configuration envoyés.`, 'success');
  }

  if (btn) { btn.disabled = false; btn.textContent = '☁ Synchroniser vers SharePoint'; }
}

function resetSettings() {
  if (!confirm('Réinitialiser tous les paramètres aux valeurs par défaut ?')) return;
  localStorage.removeItem(CONFIG_KEY);   // efface seulement responsables/statuts/priorités/thème
  APP.responsables = null;
  APP.statuts      = null;
  APP.priorites    = null;
  initDefaultSettings();
  renderSettingsAxes();
  renderSettingsResp();
  renderSettingsStatuts();
  renderSettingsPriorities();
}

// Fermer en cliquant fond
document.getElementById('settings-modal-bg').addEventListener('click', function(e) {
  if (e.target === this) closeSettingsModal();
});

// Charger les settings au démarrage
loadSettings();
if (!APP.theme) applyTheme('grey');
initDefaultSettings();

