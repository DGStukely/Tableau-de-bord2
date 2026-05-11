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

  // Jalons associés à cet objectif
  const _jp  = getJalonProgress(a.id);
  const _pct = _jp ? _jp.pct : a.pct;
  let _ci = null;
  try { _ci = a.statut !== 'terminée' ? calcCible({ ...a, pct: _pct }) : null; } catch(_) {}

  // Section jalons — toujours visible
  let _jalonSection = '';
  try {
    const actionIdStr = h(String(a.id));
    if (!_jp) {
      _jalonSection = `
        <div style="margin:14px 0 4px;padding-top:10px;border-top:1px solid var(--c-border-light);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:11px;font-weight:600;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;">Jalons</span>
            <button class="btn" onclick="closeModal();openJalonModal(null,'${actionIdStr}')" style="font-size:11px;padding:2px 8px;">+ Ajouter</button>
          </div>
          <div style="font-size:12px;color:var(--c-text-3);font-style:italic;">Aucun jalon — ajoutez-en un pour calculer l'avancement automatiquement.</div>
        </div>`;
    } else {
      const rows = _jp.jalons
        .slice()
        .sort((x, y) => (x.date || '').localeCompare(y.date || ''))
        .map((j, idx) => {
          const jsm  = STATUS_MAP[j.statut] || STATUS_MAP['à faire'];
          const done = j.statut === 'terminée';
          const jid  = h(String(j.id));
          return `
          <div style="padding:6px 0;border-bottom:1px solid var(--c-border-light);">
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" ${done ? 'checked' : ''} onchange="toggleJalon('${jid}',this.checked)"
                style="width:15px;height:15px;cursor:pointer;accent-color:#3B6D11;flex-shrink:0;">
              <span style="font-size:10px;font-weight:700;color:var(--c-text-3);background:var(--c-surface-2);padding:1px 5px;border-radius:4px;flex-shrink:0;">J${idx + 1}</span>
              <span style="flex:1;font-size:12.5px;font-weight:500;${done ? 'text-decoration:line-through;color:var(--c-text-3);' : ''}">${h(j.titre)}</span>
              <span style="font-size:11px;color:var(--c-text-3);white-space:nowrap;">${fmtDate(j.date)}</span>
              <button onclick="closeModal();openJalonModal('${jid}')" style="border:none;background:none;cursor:pointer;color:var(--c-text-3);padding:1px 3px;" title="Modifier">✏️</button>
            </div>
            ${j.desc ? `<div style="font-size:11.5px;color:var(--c-text-2);margin:3px 0 0 23px;line-height:1.4;">${h(j.desc)}</div>` : ''}
          </div>`;
        }).join('');
      _jalonSection = `
        <div style="margin:14px 0 4px;padding-top:10px;border-top:1px solid var(--c-border-light);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:600;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;">Jalons — ${_jp.done}/${_jp.total} terminés</span>
            <button class="btn" onclick="closeModal();openJalonModal(null,'${actionIdStr}')" style="font-size:11px;padding:2px 8px;">+ Ajouter</button>
          </div>
          ${rows}
        </div>`;
    }
  } catch(e) {
    console.error('_jalonSection error:', e);
    _jalonSection = '';
  }

  document.getElementById('modal-box').innerHTML = `
    <div class="modal-head">
      <div id="modal-action-title" style="font-size:15px;font-weight:600;color:var(--c-text);line-height:1.4;">${h(a.titre)}</div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fermer">×</button>
    </div>
    <div class="field-row"><span class="field-label">Axe</span><span class="field-value" style="color:${h(axe.color)};font-weight:500;">${h(axe.nom)}</span></div>
    <div class="field-row"><span class="field-label">Responsable</span><span class="field-value">${h(a.resp)}${_modalEmail}</span></div>
    <div class="field-row"><span class="field-label">Priorité</span><span class="field-value"><span class="prio-badge" style="display:inline-block;margin-right:5px;${getPrioBadgeStyle(a.prio)}"></span>${h(a.prio)}</span></div>
    <div class="field-row"><span class="field-label">Échéance</span><span class="field-value">${fmtDate(a.echeance)}</span></div>
    ${a.dateDebut ? `<div class="field-row"><span class="field-label">Date de début</span><span class="field-value">${fmtDate(a.dateDebut)}</span></div>` : ''}
    <div class="field-row"><span class="field-label">Statut</span><span class="field-value"><span class="pill ${sm.pill}">${h(a.statut)}</span></span></div>
    <div class="field-row">
      <span class="field-label">Avancement${_jp ? ' (jalons)' : ''}</span>
      <span class="field-value" style="font-weight:600;">${_pct}%${_jp ? ` <span style="font-size:11px;color:var(--c-text-3);font-weight:400;">(${_jp.done}/${_jp.total} jalons)</span>` : ''}</span>
    </div>
    ${_ci ? `<div class="field-row"><span class="field-label">Cible attendue</span><span class="field-value" style="display:flex;align-items:center;gap:8px;">${_ci.cible}%<span style="font-size:12px;font-weight:600;padding:1px 7px;border-radius:99px;background:${_ci.gap >= 0 ? '#DCFCE7' : '#FEE2E2'};color:${_ci.gap >= 0 ? '#166534' : '#991B1B'};">${_ci.gap > 0 ? '▲ +' : _ci.gap < 0 ? '▼ ' : ''}${_ci.gap}%</span></span></div>` : ''}
    <div style="margin-bottom:12px;">
      <div class="progress-wrap" style="height:8px;">
        <div class="progress-fill" style="width:${_pct}%;background:${h(sm.dot)}"></div>
      </div>
    </div>
    <!-- SECTION JALONS -->
    ${_jalonSection}
    ${a.desc ? `<div style="margin-top:10px;"><div class="field-row"><span class="field-label">Réalisation</span></div><div class="modal-desc">${h(a.desc)}</div></div>` : ''}
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

  const btnSaveNew = document.getElementById('form-btn-save-new');
  if (actionId) {
    // Mode édition
    title.textContent = 'Modifier l\'objectif';
    btnDelete.style.display = 'inline-flex';
    if (btnSaveNew) btnSaveNew.style.display = 'none';
    const a = APP.actions.find(x => String(x.id) === String(actionId));
    if (!a) {
      formEditId = null;
      return;
    }
    // Sauvegarder les valeurs originales pour la comparaison
    _originalAction = { ...a };
    const tabHist = document.getElementById('tab-historique-btn');
    if (tabHist) tabHist.style.display = '';
    // Afficher l'onglet Jalons en mode édition
    const tabJalons = document.getElementById('tab-jalons-btn');
    if (tabJalons) {
      tabJalons.style.display = '';
      // Configurer le bouton Ajouter avec l'ID de cet objectif
      const addBtn = document.getElementById('form-jalons-add-btn');
      if (addBtn) addBtn.onclick = () => { closeFormModal(); openJalonModal(null, String(actionId)); };
    }

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
    if (btnSaveNew) btnSaveNew.style.display = '';
    _originalAction = null;
    const tabHistNew = document.getElementById('tab-historique-btn');
    if (tabHistNew) tabHistNew.style.display = 'none';
    // Masquer l'onglet Jalons en mode création
    const tabJalonsNew = document.getElementById('tab-jalons-btn');
    if (tabJalonsNew) tabJalonsNew.style.display = 'none';
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
  // Réinitialiser le contenu de l'onglet Jalons
  const jc = document.getElementById('form-jalons-content');
  if (jc) jc.innerHTML = '';
}

function switchFormTab(tab, btn) {
  document.getElementById('form-pane-details').style.display    = tab === 'details'    ? '' : 'none';
  document.getElementById('form-pane-jalons').style.display     = tab === 'jalons'     ? '' : 'none';
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
  // Masquer les boutons Enregistrer/Supprimer dans les onglets Historique et Jalons
  const actions = document.querySelector('.form-actions');
  if (actions) actions.style.display = (tab === 'historique' || tab === 'jalons') ? 'none' : 'flex';

  // Charger les jalons au premier affichage de l'onglet
  if (tab === 'jalons' && formEditId) {
    loadFormJalons(formEditId);
  }
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

async function saveAction(andNew = false) {
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

  // Ajustement automatique du statut
  let statutFinal = statut;
  if (pct >= 100) {
    // 100% → terminée automatiquement
    statutFinal = 'terminée';
    document.getElementById('f-statut').value = 'terminée';
  } else if (statutFinal !== 'terminée' && echeance) {
    const echeanceDate = new Date(echeance + 'T23:59:59');
    const now = new Date();
    if (echeanceDate < now && statutFinal !== 'en retard') {
      statutFinal = 'en retard';
    } else if (echeanceDate >= now && statutFinal === 'en retard') {
      statutFinal = 'en cours';
    }
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

      const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

      const spFields = {
        Title:            titre,
        Axe_Strategique:  axeLabel,
        Priorite:         cap(priorite),
        Date_Echeance:    echeance ? new Date(echeance).toISOString() : null,
        Avancement:       pct,
        Statut:           cap(statutFinal),
        Description:      desc,
        Commentaire_Suivi: comment
      };

      // Responsable_Nom confirmé correct par la carte des colonnes
      if (resp) spFields['Responsable_Nom'] = resp;

      if (dateDebut) spFields['Date_Debut']   = new Date(dateDebut).toISOString();
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
        // Création en 2 étapes : POST Title seul (toujours accepté), puis PATCH le reste
        const result = await graphFetch(
          `/sites/${spSiteId}/lists/${SP_CONFIG.lists.actions}/items`,
          'POST', { fields: { Title: titre } }
        );
        const newSpId = result.id;
        newAction.id = newSpId;

        // PATCH avec tous les autres champs
        const patchFields = { ...spFields };
        delete patchFields.Title;
        if (Object.keys(patchFields).length > 0) {
          try {
            await graphFetch(
              `/sites/${spSiteId}/lists/${SP_CONFIG.lists.actions}/items/${newSpId}/fields`,
              'PATCH', patchFields
            );
          } catch(patchErr) {
            console.error('❌ PATCH champs erreur:', patchErr.message, JSON.stringify(patchFields));
          }
        }

        APP.actions.push(newAction);
        // Enregistrer l'historique
        await writeHistorique(newSpId, titre, 'Création', newAction);
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

    // Fermer ou réinitialiser pour un nouvel objectif
    setTimeout(() => {
      if (andNew) {
        openFormModal(null); // Rouvrir vide pour un nouvel objectif
      } else {
        closeFormModal();
      }
    }, 800);

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

/** Affiche les jalons de l'objectif dans l'onglet Jalons du formulaire */
function loadFormJalons(actionId) {
  const el    = document.getElementById('form-jalons-content');
  const cntEl = document.getElementById('form-jalons-count');
  if (!el) return;

  const jalons = (APP.jalons || [])
    .filter(j => String(j.actionId) === String(actionId))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const total = jalons.length;
  const done  = jalons.filter(j => j.statut === 'terminée').length;

  if (cntEl) {
    cntEl.textContent = total > 0
      ? `${done} / ${total} jalon${total > 1 ? 's' : ''} terminé${done > 1 ? 's' : ''} — avancement calculé automatiquement`
      : '';
  }

  if (total === 0) {
    el.innerHTML = `<div style="font-size:12px;color:var(--c-text-3);font-style:italic;padding:8px 0;">Aucun jalon — ajoutez-en un pour calculer l'avancement automatiquement.</div>`;
    return;
  }

  el.innerHTML = jalons.map((j, idx) => {
    const isDone = j.statut === 'terminée';
    const jid    = h(String(j.id));
    const aid    = h(String(actionId));
    return `
      <div style="padding:7px 0;border-bottom:1px solid var(--c-border-light);">
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" ${isDone ? 'checked' : ''}
            onchange="toggleJalon('${jid}',this.checked);setTimeout(()=>loadFormJalons('${aid}'),900)"
            style="width:15px;height:15px;cursor:pointer;accent-color:#3B6D11;flex-shrink:0;">
          <span style="font-size:10px;font-weight:700;color:var(--c-text-3);background:var(--c-surface-2);padding:1px 5px;border-radius:4px;flex-shrink:0;">J${idx + 1}</span>
          <span style="flex:1;font-size:12.5px;font-weight:500;${isDone ? 'text-decoration:line-through;color:var(--c-text-3);' : ''}">${h(j.titre)}</span>
          <span style="font-size:11px;color:var(--c-text-3);white-space:nowrap;">${fmtDate(j.date)}</span>
          <button onclick="closeFormModal();openJalonModal('${jid}')"
            style="border:none;background:none;cursor:pointer;color:var(--c-text-3);padding:1px 3px;" title="Modifier">✏️</button>
        </div>
        ${j.desc ? `<div style="font-size:11.5px;color:var(--c-text-2);margin:3px 0 0 23px;line-height:1.4;">${h(j.desc)}</div>` : ''}
      </div>`;
  }).join('');
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

// Cache des noms internes des colonnes de la liste Jalons
let _jalonColMap = null;

async function getJalonColMap() {
  if (_jalonColMap) return _jalonColMap;
  try {
    const cols = await graphFetch(`/sites/${spSiteId}/lists/${SP_CONFIG.lists.jalons}/columns`);
    _jalonColMap = {};
    (cols.value || []).forEach(c => {
      if (c.readOnly || c.hidden || (c.name || '').startsWith('_')) return;
      const dn = (c.displayName || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      // Préférer la première occurrence (ex: Date_Jalon avant Date pour "Date du jalon")
      if (!_jalonColMap[dn]) _jalonColMap[dn] = c.name;
    });
    console.log('🗂 Colonnes Jalons:', _jalonColMap);
  } catch(e) {
    console.warn('getJalonColMap error:', e.message);
    _jalonColMap = {};
  }
  return _jalonColMap;
}

/** Résout le nom interne d'un champ Jalon par son nom d'affichage (insensible à la casse/accents) */
function jalonField(colMap, ...candidates) {
  for (const c of candidates) {
    const key = c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    if (colMap[key]) return colMap[key];
  }
  return candidates[0]; // fallback
}

function openJalonModal(id = null, preselectedActionId = null) {
  jalonEditId = id;
  const modal = document.getElementById('jalon-modal-bg');
  const titleEl = document.getElementById('jalon-modal-title');
  const deleteBtn = document.getElementById('jalon-btn-delete');
  const errEl = document.getElementById('jalon-form-error');
  document.getElementById('jalon-form-saving').classList.remove('show');
  errEl.classList.remove('show');

  // Remplir le select des objectifs (trié par axe puis titre)
  const objSel = document.getElementById('jf-objectif');
  objSel.innerHTML = '<option value="">— Aucun —</option>';
  const axeMap = getAxeMap();
  const sortedActions = [...APP.actions].sort((a, b) => {
    const axeA = (axeMap[a.axe] || {}).nom || a.axe || '';
    const axeB = (axeMap[b.axe] || {}).nom || b.axe || '';
    return axeA.localeCompare(axeB, 'fr') || (a.titre || '').localeCompare(b.titre || '', 'fr');
  });
  let lastAxe = null;
  sortedActions.forEach(a => {
    const axeNom = (axeMap[a.axe] || {}).nom || a.axe || '—';
    if (axeNom !== lastAxe) {
      const grp = document.createElement('optgroup');
      grp.label = axeNom;
      objSel.appendChild(grp);
      lastAxe = axeNom;
    }
    const opt = document.createElement('option');
    opt.value = String(a.id);
    opt.textContent = a.titre;
    objSel.lastChild.appendChild(opt);
  });

  // Bouton "+ Nouveau" visible seulement en création
  const saveNewBtn = document.getElementById('jalon-btn-save-new');
  if (saveNewBtn) saveNewBtn.style.display = id ? 'none' : '';

  if (id) {
    // Mode édition
    const j = APP.jalons.find(x => String(x.id) === String(id));
    if (!j) return;
    titleEl.textContent = 'Modifier le jalon';
    deleteBtn.style.display = '';
    document.getElementById('jf-titre').value     = j.titre    || '';
    document.getElementById('jf-date').value      = j.date     || '';
    document.getElementById('jf-statut').value    = j.statut   || 'à faire';
    document.getElementById('jf-objectif').value  = j.actionId || '';
    document.getElementById('jf-desc').value      = j.desc     || '';
  } else {
    // Mode création — pré-sélectionner l'objectif si passé en paramètre
    titleEl.textContent = 'Nouveau jalon';
    deleteBtn.style.display = 'none';
    document.getElementById('jf-titre').value     = '';
    document.getElementById('jf-date').value      = '';
    document.getElementById('jf-statut').value    = 'à faire';
    document.getElementById('jf-objectif').value  = preselectedActionId ? String(preselectedActionId) : '';
    document.getElementById('jf-desc').value      = '';
  }

  modal.classList.add('open');
}

function closeJalonModal() {
  document.getElementById('jalon-modal-bg').classList.remove('open');
  jalonEditId = null;
}

async function saveJalon(andNew = false) {
  const titre    = document.getElementById('jf-titre').value.trim();
  const date     = document.getElementById('jf-date').value;
  const statut   = document.getElementById('jf-statut').value;
  const actionId = document.getElementById('jf-objectif').value;
  const desc     = document.getElementById('jf-desc').value.trim();

  const errEl = document.getElementById('jalon-form-error');
  errEl.classList.remove('show');

  if (!titre) { errEl.textContent = 'Le titre est obligatoire.'; errEl.classList.add('show'); return; }
  if (!date)  { errEl.textContent = 'La date est obligatoire.';  errEl.classList.add('show'); return; }

  document.getElementById('jalon-form-saving').classList.add('show');
  document.querySelectorAll('#jalon-modal-bg .form-btn-save, #jalon-modal-bg .form-btn-cancel, #jalon-modal-bg .form-btn-delete').forEach(b => b.disabled = true);

  const newJalon = {
    id:       jalonEditId || ('local-' + Date.now()),
    titre:    titre,
    date:     date,
    statut:   statut,
    actionId: actionId,
    desc:     desc
  };

  try {
    if (isLiveData && graphToken && spSiteId) {
      // Découvrir les vrais noms de colonnes
      const colMap  = await getJalonColMap();
      const colDate  = jalonField(colMap, 'Date du jalon', 'Date', 'DateJalon', 'date');
      const colStat  = jalonField(colMap, 'Statut', 'statut', 'Status');
      const colActId = jalonField(colMap, 'ActionId', 'actionid');
      const colDesc  = jalonField(colMap, 'Description', 'description');
      const colAxe   = jalonField(colMap, 'Axe concerne', 'Axe_Concerne', 'Axe', 'axe');

      // Champs à patcher (sans Title ni valeurs nulles)
      const patchFields = {};
      if (date) {
        patchFields[colDate] = date + 'T00:00:00Z';
        // Écrire aussi dans l'autre colonne date si différente (doublon SP)
        if (colDate !== 'Date')      patchFields['Date']      = date + 'T00:00:00Z';
        if (colDate !== 'Date_Jalon') patchFields['Date_Jalon'] = date + 'T00:00:00Z';
      }
      if (statut)   patchFields[colStat]  = statut;
      if (actionId) patchFields[colActId] = actionId;
      if (desc)     patchFields[colDesc]  = desc;
      // Remplir l'axe depuis l'objectif associé (colonne requise dans SP)
      if (actionId && colAxe) {
        const linkedAction = APP.actions.find(a => String(a.id) === String(actionId));
        if (linkedAction && linkedAction.axe) patchFields[colAxe] = linkedAction.axe;
      }

      if (jalonEditId && !String(jalonEditId).startsWith('local-')) {
        // Édition : PATCH tous les champs dont Title
        await graphFetch(
          `/sites/${spSiteId}/lists/${SP_CONFIG.lists.jalons}/items/${jalonEditId}/fields`,
          'PATCH', { Title: titre, ...patchFields }
        );
        const idx = APP.jalons.findIndex(x => String(x.id) === String(jalonEditId));
        if (idx !== -1) APP.jalons[idx] = { ...APP.jalons[idx], ...newJalon };
      } else {
        // Création : POST Title seulement, puis PATCH le reste
        const res = await graphFetch(
          `/sites/${spSiteId}/lists/${SP_CONFIG.lists.jalons}/items`,
          'POST', { fields: { Title: titre } }
        );
        const newId = res.id;
        newJalon.id = newId;
        if (Object.keys(patchFields).length > 0) {
          try {
            await graphFetch(
              `/sites/${spSiteId}/lists/${SP_CONFIG.lists.jalons}/items/${newId}/fields`,
              'PATCH', patchFields
            );
          } catch(patchErr) {
            console.error('PATCH jalon champs:', patchErr.message);
          }
        }
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
    if (andNew) {
      openJalonModal(null);
    } else {
      closeJalonModal();
    }
  } catch (err) {
    errEl.textContent = 'Erreur : ' + err.message;
    errEl.classList.add('show');
  } finally {
    // Toujours réactiver les boutons et masquer le spinner (succès OU erreur)
    document.getElementById('jalon-form-saving').classList.remove('show');
    document.querySelectorAll('#jalon-modal-bg .form-btn-save, #jalon-modal-bg .form-btn-cancel, #jalon-modal-bg .form-btn-delete').forEach(b => b.disabled = false);
  }
}

/**
 * Coche/décoche un jalon directement sans ouvrir le formulaire.
 * Terminée ↔ en cours. Met à jour SP et rafraîchit l'affichage.
 */
async function toggleJalon(jalonId, checked) {
  const j = APP.jalons.find(x => String(x.id) === String(jalonId));
  if (!j) return;

  const nouveauStatut = checked ? 'terminée' : 'en cours';
  j.statut = nouveauStatut;

  // Sauvegarder dans SharePoint
  if (isLiveData && graphToken && spSiteId && !String(jalonId).startsWith('local-')) {
    try {
      const colMap    = await getJalonColMap();
      const colStatut = jalonField(colMap, 'Statut', 'statut', 'Status');
      await graphFetch(
        `/sites/${spSiteId}/lists/${SP_CONFIG.lists.jalons}/items/${jalonId}/fields`,
        'PATCH', { [colStatut]: nouveauStatut }
      );
    } catch(e) {
      console.error('❌ toggleJalon — erreur:', e.message);
      showToast('Erreur sauvegarde jalon : ' + e.message, 'error');
      j.statut = checked ? 'en cours' : 'terminée'; // annuler
    }
  }

  // ── Propager l'avancement des jalons vers l'objectif et l'axe ──────────
  if (j.actionId) {
    const jp       = getJalonProgress(j.actionId);
    const aIdx     = APP.actions.findIndex(x => String(x.id) === String(j.actionId));
    if (jp !== null && aIdx !== -1) {
      APP.actions[aIdx].pct = jp.pct;

      // Auto-statut selon progression jalons
      const newStatut = jp.pct >= 100 ? 'terminée'
                      : jp.pct  >  0  ? 'en cours'
                      : 'à faire';
      APP.actions[aIdx].statut = newStatut;

      // Synchroniser SharePoint (fire-and-forget, ne bloque pas l'UI)
      if (isLiveData && graphToken && spSiteId && !String(j.actionId).startsWith('local-')) {
        graphFetch(
          `/sites/${spSiteId}/lists/${SP_CONFIG.lists.actions}/items/${j.actionId}/fields`,
          'PATCH', { Avancement: jp.pct, Statut: newStatut }
        ).catch(e => console.warn('Sync avancement objectif:', e.message));
      }

      // Recalculer le % de l'axe correspondant (indépendant de autoCalcAxes)
      const axeId  = APP.actions[aIdx].axe;
      const axeObj = APP.axes.find(ax => ax.id === axeId);
      if (axeObj) {
        const axeActions = APP.actions.filter(a => a.axe === axeId);
        axeObj.pct = Math.round(
          axeActions.reduce((s, a) => s + (parseInt(a.pct) || 0), 0) / axeActions.length
        );
      }
    }
  }

  // Rafraîchir tous les panneaux
  renderTimeline();
  renderActions();
  renderApercu();
  renderAxes();

  // Si la fiche de détail de l'objectif est ouverte, la rafraîchir
  if (j.actionId) {
    const modalBg = document.getElementById('modal-bg');
    if (modalBg && modalBg.classList.contains('open')) {
      openModal(j.actionId);
    }
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
