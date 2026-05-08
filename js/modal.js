/* ================================================================
   10. MODAL DÉTAIL ACTION
   ================================================================ */
function openModal(id) {
  const a = APP.actions.find(x => String(x.id) === String(id));
  if (!a) return;
  const axeMap = getAxeMap();
  const axe = axeMap[a.axe] || { color:'#888', nom:a.axe };
  const sm  = STATUS_MAP[a.statut] || STATUS_MAP['à faire'];

  const _modalEmail = (() => { const r = (APP.responsables||[]).find(x=>x.nom===a.resp); const e = safeEmail(r && r.courriel); return e ? `<br><a href="mailto:${e}" style="font-size:12px;color:var(--c-blue);">${h(e)}</a>` : ''; })();
  const _ci = a.statut !== 'terminée' ? calcCible(a) : null;
  document.getElementById('modal-box').innerHTML = `
    <div class="modal-head">
      <div id="modal-action-title" style="font-size:15px;font-weight:600;color:var(--c-text);line-height:1.4;">${h(a.titre)}</div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fermer">×</button>
    </div>
    <div class="field-row"><span class="field-label">Axe</span><span class="field-value" style="color:${h(axe.color)};font-weight:500;">${h(axe.nom)}</span></div>
    <div class="field-row"><span class="field-label">Responsable</span><span class="field-value">${h(a.resp)}${_modalEmail}</span></div>
    <div class="field-row"><span class="field-label">Priorité</span><span class="field-value"><span class="prio-badge ${PRIO_MAP[a.prio]||'pr-m'}" style="display:inline-block;margin-right:5px;"></span>${h(a.prio)}</span></div>
    <div class="field-row"><span class="field-label">Échéance</span><span class="field-value">${fmtDate(a.echeance)}</span></div>
    ${a.dateDebut ? `<div class="field-row"><span class="field-label">Date de début</span><span class="field-value">${fmtDate(a.dateDebut)}</span></div>` : ''}
    <div class="field-row"><span class="field-label">Statut</span><span class="field-value"><span class="pill ${sm.pill}">${h(a.statut)}</span></span></div>
    <div class="field-row"><span class="field-label">Avancement réel</span><span class="field-value">${h(a.pct)}%</span></div>
    ${_ci ? `<div class="field-row"><span class="field-label">Cible attendue</span><span class="field-value" style="display:flex;align-items:center;gap:8px;">${_ci.cible}%<span style="font-size:12px;font-weight:600;padding:1px 7px;border-radius:99px;background:${_ci.gap >= 0 ? '#DCFCE7' : '#FEE2E2'};color:${_ci.gap >= 0 ? '#166534' : '#991B1B'};">${_ci.gap > 0 ? '▲ +' : _ci.gap < 0 ? '▼ ' : ''}${_ci.gap}%</span></span></div>` : ''}
    <div style="margin-bottom:12px;">
      <div class="progress-wrap" style="height:8px;">
        <div class="progress-fill" style="width:${h(a.pct)}%;background:${h(sm.dot)}"></div>
      </div>
    </div>
    ${a.desc ? `<div class="field-row"><span class="field-label">Réalisation</span></div><div class="modal-desc">${h(a.desc)}</div>` : ''}
    ${isLiveData ? `<a href="https://${SP_CONFIG.tenantDomain}${SP_CONFIG.siteRelativeUrl}/Lists/${SP_CONFIG.lists.actions}/DispForm.aspx?ID=${a.id}" target="_blank" class="btn" style="margin-top:14px;text-decoration:none;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      Ouvrir dans SharePoint
    </a>` : ''}
  `;
  _openModal(document.getElementById('modal-bg'));
}

/* ----------------------------------------------------------------
   ACCESSIBILITÉ — gestion du focus et touche Échap
   ---------------------------------------------------------------- */
let _lastFocusedEl = null;

function _openModal(modalEl) {
  _lastFocusedEl = document.activeElement;
  modalEl.classList.add('open');
  // Mettre le focus sur le premier bouton Fermer dans la modale
  const firstFocusable = modalEl.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) requestAnimationFrame(() => firstFocusable.focus());
}

function _closeModal(modalEl) {
  modalEl.classList.remove('open');
  // Remettre le focus sur l'élément qui avait déclenché l'ouverture
  if (_lastFocusedEl) { _lastFocusedEl.focus(); _lastFocusedEl = null; }
}

// Fermer la modale active avec Échap
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (document.getElementById('settings-modal-bg').classList.contains('open')) { closeSettingsModal(); return; }
  if (document.getElementById('form-modal-bg').classList.contains('open'))     { closeFormModal();     return; }
  if (document.getElementById('modal-bg').classList.contains('open'))          { closeModal();         return; }
});

function closeModal() {
  _closeModal(document.getElementById('modal-bg'));
}


/* ================================================================
   FORMULAIRE — SAISIE ET MODIFICATION
   ================================================================ */
let formEditId     = null;
let _originalAction = null; // valeurs avant modification

function openFormModal(actionId) {
  formEditId = actionId != null ? String(actionId) : null;
  const bg = document.getElementById('form-modal-bg');
  const title = document.getElementById('form-modal-title');
  const btnDelete = document.getElementById('form-btn-delete');

  // Reset form
  document.getElementById('form-error').classList.remove('show');
  document.getElementById('form-success').classList.remove('show');
  document.getElementById('form-saving').classList.remove('show');

  initDefaultSettings();

  // Axe dropdown
  const axeSelect = document.getElementById('f-axe');
  axeSelect.innerHTML = '<option value="">-- Choisir --</option>';
  APP.axes.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.id + ' – ' + a.nom;
    axeSelect.appendChild(opt);
  });

  // Responsable dropdown
  loadSettings();
  const respSelect = document.getElementById('f-responsable');
  if (respSelect && respSelect.tagName === 'SELECT') {
    respSelect.innerHTML = '<option value="">-- Choisir --</option>';
    (APP.responsables || []).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.nom;
      opt.textContent = r.nom + (r.titre ? ' — ' + r.titre : '') + (r.courriel ? ' (' + r.courriel + ')' : '');
      respSelect.appendChild(opt);
    });
  }

  // Priorité dropdown
  const prioSelect = document.getElementById('f-priorite');
  prioSelect.innerHTML = '<option value="">-- Choisir --</option>';
  (APP.priorites || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    prioSelect.appendChild(opt);
  });

  // Statut dropdown
  const statutSelect = document.getElementById('f-statut');
  statutSelect.innerHTML = '<option value="">-- Choisir --</option>';
  (APP.statuts || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    statutSelect.appendChild(opt);
  });

  if (actionId) {
    // Mode édition
    title.textContent = 'Modifier l\'objectif';
    btnDelete.style.display = 'inline-flex';
    const a = APP.actions.find(x => String(x.id) === String(actionId));
    if (!a) {
      formEditId = null;
      return;
    }
    // Sauvegarder les valeurs originales pour la comparaison
    _originalAction = { ...a };
    const tabHist = document.getElementById('tab-historique-btn');
    if (tabHist) tabHist.style.display = '';

    document.getElementById('f-titre').value       = a.titre || '';
    document.getElementById('f-axe').value         = a.axe || '';
    document.getElementById('f-responsable').value = a.resp || '';
    document.getElementById('f-priorite').value    = a.prio || 'moyenne';
    document.getElementById('f-statut').value      = a.statut || 'à faire';
    document.getElementById('f-echeance').value    = a.echeance || '';
    document.getElementById('f-avancement').value  = a.pct || 0;
    document.getElementById('f-avancement-val').textContent = (a.pct || 0) + '%';
    document.getElementById('f-description').value = a.desc || '';
    document.getElementById('f-budget').value      = a.budget || '';
    document.getElementById('f-commentaire').value = a.commentaire || '';

    // Charger l'historique dans l'onglet
    loadHistorique(String(actionId));
  } else {
    // Mode création
    title.textContent = 'Nouvel objectif';
    btnDelete.style.display = 'none';
    _originalAction = null;
    const tabHistNew = document.getElementById('tab-historique-btn');
    if (tabHistNew) tabHistNew.style.display = 'none';
    document.getElementById('f-titre').value       = '';
    document.getElementById('f-axe').value         = '';
    document.getElementById('f-responsable').value = '';
    document.getElementById('f-priorite').value    = 'moyenne';
    document.getElementById('f-statut').value      = 'à faire';
    document.getElementById('f-echeance').value    = '';
    document.getElementById('f-avancement').value  = 0;
    document.getElementById('f-avancement-val').textContent = '0%';
    document.getElementById('f-description').value  = '';
    document.getElementById('f-budget').value      = '';
    document.getElementById('f-commentaire').value = '';

    // Default date = today + 30 days
    const d = new Date();
    d.setDate(d.getDate() + 30);
    document.getElementById('f-echeance').value = d.toISOString().split('T')[0];
  }

  _lastFocusedEl = document.activeElement;
  bg.classList.add('open');
  requestAnimationFrame(() => document.getElementById('f-titre').focus());
}


function confirmDelete(id, event) {
  event.stopPropagation();
  const a = APP.actions.find(x => String(x.id) === String(id));
  if (!a) return;
  if (!confirm('Supprimer « ' + a.titre + ' » ?\nCette action est irréversible.')) return;
  formEditId = id != null ? String(id) : null;
  deleteAction(true); // confirmation déjà obtenue ci-dessus
}

function closeFormModal() {
  _closeModal(document.getElementById('form-modal-bg'));
  formEditId      = null;
  _originalAction = null;
  switchFormTab('details', document.querySelector('.form-tab'));
}

function switchFormTab(tab, btn) {
  document.getElementById('form-pane-details').style.display    = tab === 'details'    ? '' : 'none';
  document.getElementById('form-pane-historique').style.display = tab === 'historique' ? '' : 'none';
  document.querySelectorAll('.form-tab').forEach(b => {
    b.style.color       = 'var(--c-text-2)';
    b.style.borderBottom = '2px solid transparent';
    b.style.fontWeight  = '400';
  });
  if (btn) {
    btn.style.color       = 'var(--c-purple)';
    btn.style.borderBottom = '2px solid var(--c-purple)';
    btn.style.fontWeight  = '500';
  }
  // Masquer les boutons Enregistrer/Supprimer dans l'onglet Historique
  const actions = document.querySelector('.form-actions');
  if (actions) actions.style.display = tab === 'historique' ? 'none' : 'flex';
}

/** Ajuste automatiquement le statut selon la date d'échéance et l'avancement */
function autoAdjustStatut() {
  const echeanceEl = document.getElementById('f-echeance');
  const statutEl   = document.getElementById('f-statut');
  const pct        = parseInt(document.getElementById('f-avancement').value) || 0;
  if (!echeanceEl || !statutEl) return;

  const currentStatut = statutEl.value;
  // Ne pas toucher si déjà terminée ou avancement 100%
  if (currentStatut === 'terminée' || pct >= 100) return;

  const echeance = echeanceEl.value ? new Date(echeanceEl.value + 'T23:59:59') : null;
  const now      = new Date();

  if (echeance) {
    if (echeance < now && currentStatut !== 'en retard') {
      // Date passée → en retard
      statutEl.value = 'en retard';
    } else if (echeance >= now && currentStatut === 'en retard') {
      // Date future → retirer « en retard », passer à « en cours »
      statutEl.value = 'en cours';
    }
  }
}

function showFormError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.add('show');
}

function showFormSuccess(msg) {
  // Toast flottant
  showToast(msg, 'success');

  // Animer le bouton Enregistrer → ✓ Enregistré !
  const btn = document.querySelector('.form-btn-save');
  if (btn) {
    const origHTML = btn.innerHTML;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>&nbsp;Enregistré !`;
    btn.classList.add('btn-saved');
    btn.disabled = true;
    setTimeout(() => {
      btn.innerHTML = origHTML;
      btn.classList.remove('btn-saved');
      btn.disabled = false;
    }, 1400);
  }
}

async function saveAction() {
  // Validation
  const titre     = document.getElementById('f-titre').value.trim();
  const axe       = document.getElementById('f-axe').value;
  const echeance  = document.getElementById('f-echeance').value;
  const priorite  = document.getElementById('f-priorite').value;
  const statut    = document.getElementById('f-statut').value;
  const pct       = parseInt(document.getElementById('f-avancement').value);
  const resp      = document.getElementById('f-responsable').value.trim();
  const desc      = document.getElementById('f-description').value.trim();
  const budget    = document.getElementById('f-budget').value;
  const comment   = document.getElementById('f-commentaire').value.trim();
  const dateDebut = document.getElementById('f-date-debut').value;

  document.getElementById('form-error').classList.remove('show');
  document.getElementById('form-success').classList.remove('show');

  if (!titre)    { showFormError('Le titre de l\'objectif est obligatoire.'); return; }
  if (!axe)      { showFormError('Veuillez choisir un axe stratégique.'); return; }
  if (!resp && (APP.responsables || []).length > 0) { showFormError('Veuillez choisir un responsable.'); return; }
  if (!echeance) { showFormError('La date d\'échéance est obligatoire.'); return; }

  // Ajustement automatique du statut selon la date d'échéance
  let statutFinal = statut;
  if (statutFinal !== 'terminée' && pct < 100 && echeance) {
    const echeanceDate = new Date(echeance + 'T23:59:59');
    const now = new Date();
    if (echeanceDate < now && statutFinal !== 'en retard') {
      statutFinal = 'en retard';
    } else if (echeanceDate >= now && statutFinal === 'en retard') {
      statutFinal = 'en cours';
    }
    // Mettre à jour le select dans le formulaire pour refléter l'ajustement
    document.getElementById('f-statut').value = statutFinal;
  }

  // Show saving indicator
  document.getElementById('form-saving').classList.add('show');
  document.querySelectorAll('.form-btn-save, .form-btn-cancel, .form-btn-delete').forEach(b => b.disabled = true);

  const newAction = {
    id:          formEditId || ('local-' + Date.now()),
    titre:       titre,
    axe:         axe,
    resp:        resp,
    prio:        priorite,
    echeance:    echeance,
    pct:         pct,
    statut:      statutFinal,
    desc:        desc,
    budget:      budget,
    commentaire: comment
  };

  try {
    if (isLiveData && graphToken) {
      // Sauvegarder dans SharePoint via Graph API
      const axeMap = getAxeMap();
      const axeObj = axeMap[axe];
      const axeLabel = axeObj ? axe + ' – ' + axeObj.nom : axe;

      // Normaliser vers les valeurs exactes des choix SharePoint (sans accents, minuscules)
      const spStatutMap = {
        'à faire': 'a faire', 'a faire': 'a faire',
        'en cours': 'en cours', 'terminée': 'terminee', 'terminee': 'terminee',
        'en retard': 'en retard', 'en attente': 'en attente'
      };
      const spStatut = spStatutMap[(statutFinal || '').toLowerCase()] || statutFinal;
      const spPrio   = (priorite || 'moyenne').toLowerCase();

      const spFields = {
        Title:            titre,
        Axe_Strategique:  axeLabel,
        Priorite:         spPrio,
        Date_Echeance:    echeance ? new Date(echeance).toISOString() : null,
        Avancement:       pct,
        Statut:           spStatut,
        Description:      desc,
        Commentaire_Suivi: comment
      };

      // Sauvegarder le responsable et son courriel
      spFields['Responsable_Nom'] = resp || '—';
      if (resp) {
        // Chercher le courriel du responsable dans les paramètres
        const respObj = (APP.responsables || []).find(r => r.nom === resp);
        if (respObj && respObj.courriel) {
          spFields['Responsable_Courriel'] = respObj.courriel;
        }
      }

      if (dateDebut) spFields['Date_Debut'] = new Date(dateDebut).toISOString();
      if (budget)    spFields['Budget_Prevu'] = parseFloat(budget);

      // Supprimer les champs null/undefined/vides (SharePoint retourne 400 si null est envoyé)
      Object.keys(spFields).forEach(k => {
        if (spFields[k] === null || spFields[k] === undefined || spFields[k] === '') delete spFields[k];
      });
      console.log('📤 SP fields envoyés:', JSON.stringify(spFields, null, 2));

      if (formEditId && !formEditId.startsWith('local-')) {
        // Mise à jour
        await graphFetch(
          `/sites/${spSiteId}/lists/${SP_CONFIG.lists.actions}/items/${formEditId}/fields`,
          'PATCH', spFields
        );
        const idx = APP.actions.findIndex(x => String(x.id) === formEditId);
        if (idx !== -1) APP.actions[idx] = { ...APP.actions[idx], ...newAction };
        // Enregistrer l'historique
        await writeHistorique(formEditId, titre, 'Modification', newAction);
        showFormSuccess('Action mise à jour avec succès dans SharePoint !');
      } else {
        // Création
        const result = await graphFetch(
          `/sites/${spSiteId}/lists/${SP_CONFIG.lists.actions}/items`,
          'POST', { fields: spFields }
        );
        newAction.id = result.id;
        APP.actions.push(newAction);
        // Enregistrer l'historique
        await writeHistorique(result.id, titre, 'Création', newAction);
        showFormSuccess('Action créée avec succès dans SharePoint !');
      }
    } else {
      // Mode démo — mise à jour locale uniquement
      if (formEditId) {
        const idx = APP.actions.findIndex(x => String(x.id) === formEditId);
        if (idx !== -1) APP.actions[idx] = { ...APP.actions[idx], ...newAction };
        showFormSuccess('Action mise à jour localement');
      } else {
        APP.actions.push(newAction);
        showFormSuccess('Action ajoutée localement');
      }
    }

    // Rafraîchir les vues
    renderApercu();
    renderActions();
    renderAxes();
    renderMaVue();

    // Fermer après délai
    setTimeout(() => { closeFormModal(); }, 1500);

  } catch (err) {
    console.error('❌ saveAction erreur:', err);
    const errEl = document.getElementById('form-error');
    if (errEl) { errEl.textContent = 'Erreur : ' + err.message; errEl.classList.add('show'); }
    else { alert('Erreur : ' + err.message); }
  } finally {
    document.getElementById('form-saving').classList.remove('show');
    document.querySelectorAll('.form-btn-save, .form-btn-cancel, .form-btn-delete').forEach(b => b.disabled = false);
  }
}

/* ================================================================
   HISTORIQUE DES MODIFICATIONS
   ================================================================ */

// Libellés lisibles pour chaque champ
const CHAMP_LABELS = {
  titre:       'Titre',
  axe:         'Axe stratégique',
  resp:        'Responsable',
  prio:        'Priorité',
  statut:      'Statut',
  echeance:    'Date d\'échéance',
  dateDebut:   'Date de début',
  pct:         'Avancement (%)',
  desc:        'Réalisation / Notes',
  budget:      'Budget prévu ($)',
  commentaire: 'Commentaire de suivi',
};

/** Écrire une entrée dans Historique_Actions sur SharePoint */
async function writeHistorique(actionId, actionTitre, type, newValues) {
  if (!isLiveData || !graphToken || !spSiteId) return;
  if (!SP_CONFIG.lists.historique) return; // Liste non configurée pour ce site
  try {
    // Calculer le diff (uniquement pour les modifications)
    let details = {};
    if (type === 'Modification' && _originalAction) {
      const champsSuivis = ['titre','axe','resp','prio','statut','echeance','dateDebut','pct','desc','budget','commentaire'];
      champsSuivis.forEach(k => {
        const avant  = String(_originalAction[k] ?? '');
        const apres  = String(newValues[k]       ?? '');
        if (avant !== apres) {
          details[CHAMP_LABELS[k] || k] = { avant, apres };
        }
      });
    }
    if (type !== 'Suppression' && Object.keys(details).length === 0 && type === 'Modification') return; // rien changé

    const utilisateur = currentAccount
      ? (currentAccount.name || currentAccount.username)
      : 'Système';

    await graphFetch(
      `/sites/${spSiteId}/lists/${SP_CONFIG.lists.historique}/items`,
      'POST',
      { fields: {
        Title:             actionTitre,
        ActionId:          String(actionId),
        Utilisateur:       utilisateur,
        TypeModification:  type,
        Details:           JSON.stringify(details)
      }}
    );
  } catch(e) {
    console.warn('Historique non enregistré :', e.message);
  }
}

/** Charger et afficher l'historique d'une action */
async function loadHistorique(actionId) {
  const el = document.getElementById('historique-liste');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--c-text-3);font-size:12px;padding:.5rem 0;">Chargement…</div>';

  if (!SP_CONFIG.lists.historique) {
    el.innerHTML = '<div style="color:var(--c-text-3);font-size:12px;padding:.5rem 0;">Historique non disponible — liste non configurée.</div>';
    return;
  }
  if (!isLiveData || !graphToken || !spSiteId) {
    el.innerHTML = '<div style="color:var(--c-text-3);font-size:12px;padding:.5rem 0;">Disponible uniquement en mode SharePoint connecté.</div>';
    return;
  }

  try {
    const data = await graphFetch(
      `/sites/${spSiteId}/lists/${SP_CONFIG.lists.historique}/items?expand=fields($select=ActionId,Utilisateur,TypeModification,Details,Title,Created)&$filter=fields/ActionId eq '${actionId}'&$orderby=fields/Created desc&$top=50`,
      'GET', null, { 'Prefer': 'HonorNonIndexedQueriesWarningMayFailRandomly' }
    );
    const items = (data.value || []).map(i => i.fields);
    if (items.length === 0) {
      el.innerHTML = '<div style="color:var(--c-text-3);font-size:12px;padding:.5rem 0;">Aucune modification enregistrée.</div>';
      return;
    }
    el.innerHTML = items.map(item => {
      const date = new Date(item.Created).toLocaleDateString('fr-CA', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
      let details = {};
      try { details = JSON.parse(item.Details || '{}'); } catch {}
      const changesHtml = Object.entries(details).map(([champ, {avant, apres}]) =>
        `<div style="font-size:11px;color:var(--c-text-2);margin-top:3px;">
          <strong>${h(champ)}</strong> :
          <span style="color:var(--c-danger);text-decoration:line-through;">${h(avant||'—')}</span>
          → <span style="color:var(--c-ok);">${h(apres||'—')}</span>
        </div>`
      ).join('');
      const typeCls = item.TypeModification === 'Suppression' ? 'color:#A32D2D' :
                      item.TypeModification === 'Création'    ? 'color:#3B6D11' : 'color:var(--c-purple)';
      return `<div style="padding:.6rem 0;border-bottom:1px solid var(--c-border);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;font-weight:500;${typeCls}">● ${h(item.TypeModification)}</span>
          <span style="font-size:11px;color:var(--c-text-3);">${date}</span>
        </div>
        <div style="font-size:12px;color:var(--c-text-2);margin-top:2px;">👤 ${h(item.Utilisateur)}</div>
        ${changesHtml}
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div style="color:var(--c-danger);font-size:12px;">Erreur : ${h(e.message)}</div>`;
  }
}

async function deleteAction(skipConfirm = false) {
  if (!formEditId) return;
  if (!skipConfirm && !confirm('Supprimer cette action ? Cette opération est irréversible.')) return;

  document.getElementById('form-saving').classList.add('show');
  document.querySelectorAll('.form-btn-save, .form-btn-cancel, .form-btn-delete').forEach(b => b.disabled = true);

  try {
    const actionToDelete = APP.actions.find(x => String(x.id) === formEditId);
    if (isLiveData && graphToken && !formEditId.startsWith('local-')) {
      await graphFetch(
        `/sites/${spSiteId}/lists/${SP_CONFIG.lists.actions}/items/${formEditId}`,
        'DELETE'
      );
      if (actionToDelete) await writeHistorique(formEditId, actionToDelete.titre, 'Suppression', {});
    }
    APP.actions = APP.actions.filter(x => String(x.id) !== formEditId);
    renderApercu();
    renderActions();
    renderAxes();
    renderMaVue();
    closeFormModal();
  } catch (err) {
    showFormError('Erreur suppression : ' + err.message);
    document.getElementById('form-saving').classList.remove('show');
    document.querySelectorAll('.form-btn-save, .form-btn-cancel, .form-btn-delete').forEach(b => b.disabled = false);
  }
}


/* ================================================================
   MODAL JALON
   ================================================================ */
let jalonEditId = null;

function openJalonModal(id = null) {
  jalonEditId = id;
  const modal = document.getElementById('jalon-modal-bg');
  const titleEl = document.getElementById('jalon-modal-title');
  const deleteBtn = document.getElementById('jalon-btn-delete');
  const errEl = document.getElementById('jalon-form-error');
  document.getElementById('jalon-form-saving').classList.remove('show');
  errEl.classList.remove('show');

  // Remplir le select des axes
  const axeSel = document.getElementById('jf-axe');
  axeSel.innerHTML = '<option value="">— Aucun —</option>';
  APP.axes.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.nom;
    axeSel.appendChild(opt);
  });

  if (id) {
    // Mode édition
    const j = APP.jalons.find(x => String(x.id) === String(id));
    if (!j) return;
    titleEl.textContent = 'Modifier le jalon';
    deleteBtn.style.display = '';
    document.getElementById('jf-titre').value  = j.titre || '';
    document.getElementById('jf-date').value   = j.date  || '';
    document.getElementById('jf-statut').value = j.statut || 'à faire';
    document.getElementById('jf-axe').value    = j.axe   || '';
  } else {
    // Mode création
    titleEl.textContent = 'Nouveau jalon';
    deleteBtn.style.display = 'none';
    document.getElementById('jf-titre').value  = '';
    document.getElementById('jf-date').value   = '';
    document.getElementById('jf-statut').value = 'à faire';
    document.getElementById('jf-axe').value    = '';
  }

  modal.classList.add('open');
}

function closeJalonModal() {
  document.getElementById('jalon-modal-bg').classList.remove('open');
  jalonEditId = null;
}

async function saveJalon() {
  const titre  = document.getElementById('jf-titre').value.trim();
  const date   = document.getElementById('jf-date').value;
  const statut = document.getElementById('jf-statut').value;
  const axe    = document.getElementById('jf-axe').value;

  const errEl = document.getElementById('jalon-form-error');
  errEl.classList.remove('show');

  if (!titre) { errEl.textContent = 'Le titre est obligatoire.'; errEl.classList.add('show'); return; }
  if (!date)  { errEl.textContent = 'La date est obligatoire.';  errEl.classList.add('show'); return; }

  document.getElementById('jalon-form-saving').classList.add('show');
  document.querySelectorAll('#jalon-modal-bg .form-btn-save, #jalon-modal-bg .form-btn-cancel, #jalon-modal-bg .form-btn-delete').forEach(b => b.disabled = true);

  const newJalon = {
    id:     jalonEditId || ('local-' + Date.now()),
    titre:  titre,
    date:   date,
    statut: statut,
    axe:    axe
  };

  try {
    if (isLiveData && graphToken && spSiteId) {
      const spFields = {
        Title:  titre,
        Date:   date + 'T00:00:00Z',
        Statut: statut,
        Axe:    axe
      };
      if (jalonEditId && !String(jalonEditId).startsWith('local-')) {
        await graphFetch(`/sites/${spSiteId}/lists/${SP_CONFIG.lists.jalons}/items/${jalonEditId}/fields`, 'PATCH', spFields);
        const idx = APP.jalons.findIndex(x => String(x.id) === String(jalonEditId));
        if (idx !== -1) APP.jalons[idx] = { ...APP.jalons[idx], ...newJalon };
      } else {
        const res = await graphFetch(`/sites/${spSiteId}/lists/${SP_CONFIG.lists.jalons}/items`, 'POST', { fields: spFields });
        newJalon.id = res.id || res.fields?.id || newJalon.id;
        APP.jalons.push(newJalon);
      }
      showToast('Jalon enregistré dans SharePoint', 'success');
    } else {
      if (jalonEditId) {
        const idx = APP.jalons.findIndex(x => String(x.id) === String(jalonEditId));
        if (idx !== -1) APP.jalons[idx] = newJalon;
      } else {
        APP.jalons.push(newJalon);
      }
      showToast('Jalon enregistré localement', 'info');
    }
    renderTimeline();
    closeJalonModal();
  } catch (err) {
    errEl.textContent = 'Erreur : ' + err.message;
    errEl.classList.add('show');
    document.getElementById('jalon-form-saving').classList.remove('show');
    document.querySelectorAll('#jalon-modal-bg .form-btn-save, #jalon-modal-bg .form-btn-cancel, #jalon-modal-bg .form-btn-delete').forEach(b => b.disabled = false);
  }
}

async function deleteJalon() {
  if (!jalonEditId) return;
  if (!confirm('Supprimer ce jalon ?')) return;
  document.getElementById('jalon-form-saving').classList.add('show');
  try {
    if (isLiveData && graphToken && spSiteId && !String(jalonEditId).startsWith('local-')) {
      await graphFetch(`/sites/${spSiteId}/lists/${SP_CONFIG.lists.jalons}/items/${jalonEditId}`, 'DELETE');
    }
    APP.jalons = APP.jalons.filter(x => String(x.id) !== String(jalonEditId));
    renderTimeline();
    closeJalonModal();
    showToast('Jalon supprimé', 'success');
  } catch (err) {
    document.getElementById('jalon-form-error').textContent = 'Erreur suppression : ' + err.message;
    document.getElementById('jalon-form-error').classList.add('show');
    document.getElementById('jalon-form-saving').classList.remove('show');
  }
}

async function confirmDeleteJalon(id) {
  if (!confirm('Supprimer ce jalon ?')) return;
  try {
    if (isLiveData && graphToken && spSiteId && !String(id).startsWith('local-')) {
      try {
        await graphFetch(`/sites/${spSiteId}/lists/${SP_CONFIG.lists.jalons}/items/${id}`, 'DELETE');
      } catch (spErr) {
        // 404 = déjà supprimé de SharePoint, on continue quand même
        if (!spErr.message.includes('404')) throw spErr;
      }
    }
    APP.jalons = APP.jalons.filter(x => String(x.id) !== String(id));
    renderTimeline();
    showToast('Jalon supprimé', 'success');
  } catch (err) {
    showToast('Erreur suppression : ' + err.message, 'error');
  }
}
