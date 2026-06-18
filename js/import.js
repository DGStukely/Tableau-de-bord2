/* ================================================================
   IMPORT EXCEL → SHAREPOINT
   Lit le gabarit Gabarit_Import_Plan_Strategique.xlsx et pousse
   les items manquants dans les listes SharePoint.
   Déduplication : Identifiant (axes) · Title+Axe (actions) · Title+ActionId (jalons)
   ================================================================ */

let _xlsxReady = false;

async function ensureSheetJS() {
  if (_xlsxReady || typeof XLSX !== 'undefined') { _xlsxReady = true; return; }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload  = () => { _xlsxReady = true; resolve(); };
    s.onerror = () => reject(new Error('Impossible de charger la librairie de lecture Excel (SheetJS).'));
    document.head.appendChild(s);
  });
}

/* ── Ouverture / fermeture ─────────────────────────────────────── */
function openImportModal() {
  if (!isLiveData) {
    showToast('Connexion SharePoint requise pour importer des données.', 'error');
    return;
  }
  _importReset();
  document.getElementById('import-modal-bg').style.display = 'flex';
}

function closeImportModal() {
  document.getElementById('import-modal-bg').style.display = 'none';
}

function _importReset() {
  _importShowPanel('init');
  document.getElementById('import-file-label').textContent = 'Aucun fichier sélectionné';
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-log').innerHTML = '';
  document.getElementById('import-results').innerHTML = '';
  document.getElementById('import-btn-start').disabled = true;
}

function _importShowPanel(name) {
  ['init', 'progress', 'results'].forEach(n => {
    const el = document.getElementById(`import-panel-${n}`);
    if (el) el.style.display = n === name ? '' : 'none';
  });
}

function _setImportFile(file) {
  if (!file) return;
  const lbl = document.getElementById('import-file-label');
  const btn = document.getElementById('import-btn-start');
  // Injecter dans l'input (pour que startImport() puisse le lire)
  const dt = new DataTransfer();
  dt.items.add(file);
  document.getElementById('import-file-input').files = dt.files;
  lbl.textContent = file.name;
  btn.disabled = false;
}

function onImportFileChange(input) {
  _setImportFile(input.files[0]);
}

/* ── Drag & drop ───────────────────────────────────────────────── */
function onImportDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

function onImportDragEnter(e) {
  e.preventDefault();
  document.getElementById('import-dropzone').classList.add('import-dropzone-active');
}

function onImportDragLeave(e) {
  // Ignorer les events déclenchés par les enfants de la zone
  const zone = document.getElementById('import-dropzone');
  if (!zone.contains(e.relatedTarget)) {
    zone.classList.remove('import-dropzone-active');
  }
}

function onImportDrop(e) {
  e.preventDefault();
  document.getElementById('import-dropzone').classList.remove('import-dropzone-active');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!file.name.match(/\.xlsx?$/i)) {
    showToast('Format non supporté — veuillez déposer un fichier .xlsx', 'error');
    return;
  }
  _setImportFile(file);
}

/* ── Lecture des lignes de données du gabarit ──────────────────── */
function _getDataRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;
  // Lignes 1-2 = bannières, ligne 3 = en-têtes → données à partir de la ligne 4 (range:3 = index 0-based)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, range: 3, defval: '' });
  return rows.filter(r => r.some(c => c !== null && c !== ''));
}

function _fmtDate(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().split('T')[0];
  const s = String(v).trim();
  // Accepter AAAA-MM-JJ tel quel
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Tenter de parser
  try {
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  } catch(_) {}
  return '';
}

/* ── Import principal ──────────────────────────────────────────── */
async function startImport() {
  const input = document.getElementById('import-file-input');
  const file  = input.files[0];
  if (!file) { showToast('Veuillez sélectionner un fichier Excel.', 'error'); return; }

  _importShowPanel('progress');
  const logEl = document.getElementById('import-log');
  logEl.innerHTML = '';

  const log = (msg, type = 'info') => {
    const d = document.createElement('div');
    d.className = `ilog ilog-${type}`;
    d.textContent = msg;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
  };

  const counts = {
    axes:    { label: 'Axes stratégiques', created: 0, skipped: 0, errors: 0 },
    actions: { label: 'Actions',           created: 0, skipped: 0, errors: 0 },
    jalons:  { label: 'Jalons',            created: 0, skipped: 0, errors: 0 },
  };

  try {
    /* 1. Charger SheetJS */
    log('Chargement de la librairie Excel…');
    await ensureSheetJS();
    log('Librairie prête.', 'ok');

    /* 2. Parser le fichier */
    log('Lecture du fichier Excel…');
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, { type: 'array', cellDates: true });

    const rowsAxes = _getDataRows(wb, 'Axes_Strategiques');
    const rowsAct  = _getDataRows(wb, 'Actions_Plan');
    const rowsJal  = _getDataRows(wb, 'Jalons') || [];

    if (!rowsAxes || !rowsAct) {
      throw new Error('Format invalide — onglets "Axes_Strategiques" et "Actions_Plan" requis.');
    }

    const validAxes = rowsAxes.filter(r => String(r[0]||'').trim() && String(r[1]||'').trim());
    const validAct  = rowsAct.filter(r  => String(r[0]||'').trim() && String(r[1]||'').trim());
    const validJal  = rowsJal.filter(r  => String(r[0]||'').trim());

    log(`${validAxes.length} axe(s) · ${validAct.length} action(s) · ${validJal.length} jalon(s) détectés.`, 'ok');

    /* 3. Charger les données SharePoint existantes pour déduplication */
    log('Récupération des données SharePoint existantes…');
    const [exAxes, exActions, exJalons] = await Promise.all([
      getListItems(SP_CONFIG.lists.axes),
      getListItems(SP_CONFIG.lists.actions),
      getListItems(SP_CONFIG.lists.jalons),
    ]);

    // Clés de déduplication (en minuscule pour comparaison insensible à la casse)
    const existingAxeIds   = new Set(exAxes.map(f    => String(f.Identifiant || f.Title || '').toLowerCase().trim()));
    const existingActKeys  = new Set(exActions.map(f => `${String(f.Title||'').toLowerCase().trim()}|${String(f.Axe_Strategique||'').trim()}`));
    const existingJalKeys  = new Set(exJalons.map(f  => `${String(f.Title||'').toLowerCase().trim()}|${String(f.ActionId||'').trim()}`));

    // Map titre action → SP ID pour résolution des jalons
    const actionTitleToSpId = {};
    exActions.forEach(f => {
      const k = String(f.Title || '').toLowerCase().trim();
      if (k) actionTitleToSpId[k] = f._spId;
    });

    log('Données SharePoint chargées.', 'ok');

    /* 4. Importer les axes ─────────────────────────────────────── */
    log('── Axes stratégiques…');
    for (const row of validAxes) {
      // Col: 0=Identifiant 1=Nom 2=Avancement 3=Description_Axe
      const id  = String(row[0] || '').trim();
      const nom = String(row[1] || '').trim();
      if (!id || !nom) { counts.axes.skipped++; continue; }

      if (existingAxeIds.has(id.toLowerCase())) {
        counts.axes.skipped++;
        log(`  Ignoré (doublon) · ${id} — ${nom}`);
        continue;
      }

      try {
        const fields = { Title: id, Identifiant: id, Nom: nom };
        const avc = parseInt(row[2]);
        if (!isNaN(avc)) fields.Avancement = avc;
        const dsc = String(row[3] || '').trim();
        if (dsc) fields.Description_Axe = dsc;

        await graphFetch(`/sites/${spSiteId}/lists/${SP_CONFIG.lists.axes}/items`, 'POST', { fields });
        existingAxeIds.add(id.toLowerCase()); // éviter doublons dans le même fichier
        counts.axes.created++;
        log(`  Créé · ${id} — ${nom}`, 'ok');
      } catch(e) {
        counts.axes.errors++;
        log(`  Erreur · ${id} — ${e.message}`, 'error');
      }
    }

    /* 5. Importer les actions ──────────────────────────────────── */
    log('── Actions…');
    // actionRowMap[ri+1] = SP ID de l'action créée ou existante (pour résolution jalons)
    const actionRowMap = {};

    for (let ri = 0; ri < validAct.length; ri++) {
      const row = validAct[ri];
      // Col: 0=Title 1=Axe_Strategique 2=Resp_Nom 3=Resp_Courriel 4=Priorite
      //      5=Date_Debut 6=Date_Echeance 7=Avancement 8=Statut 9=Budget_Prevu
      //      10=Description 11=Commentaire_Suivi
      const titre = String(row[0] || '').trim();
      const axe   = String(row[1] || '').trim();
      if (!titre || !axe) { counts.actions.skipped++; continue; }

      const actKey = `${titre.toLowerCase()}|${axe}`;

      if (existingActKeys.has(actKey)) {
        counts.actions.skipped++;
        // Récupérer le SP ID de l'action existante pour les jalons
        const existing = exActions.find(f =>
          String(f.Title||'').toLowerCase().trim() === titre.toLowerCase() &&
          String(f.Axe_Strategique||'').trim() === axe
        );
        if (existing) actionRowMap[ri + 1] = existing._spId;
        log(`  Ignoré (doublon) · ${titre}`);
        continue;
      }

      try {
        const fields = { Title: titre, Axe_Strategique: axe };
        const respNom  = String(row[2] || '').trim(); if (respNom)  fields.Responsable_Nom      = respNom;
        const respMail = String(row[3] || '').trim(); if (respMail) fields.Responsable_Courriel = respMail;
        const prio     = String(row[4] || '').trim(); if (prio)     fields.Priorite             = prio.toLowerCase();
        const dd       = _fmtDate(row[5]);            if (dd)       fields.Date_Debut           = dd;
        const de       = _fmtDate(row[6]);            if (de)       fields.Date_Echeance        = de;
        const avc      = parseInt(row[7]);             if (!isNaN(avc)) fields.Avancement        = avc;
        const statut   = String(row[8] || '').trim(); if (statut)   fields.Statut               = statut.toLowerCase();
        const budget   = String(row[9] || '').trim(); if (budget)   fields.Budget_Prevu         = budget;
        const desc     = String(row[10]|| '').trim(); if (desc)     fields.Description          = desc;
        const comm     = String(row[11]|| '').trim(); if (comm)     fields.Commentaire_Suivi    = comm;

        const res = await graphFetch(
          `/sites/${spSiteId}/lists/${SP_CONFIG.lists.actions}/items`, 'POST', { fields }
        );
        actionRowMap[ri + 1] = res.id;
        existingActKeys.add(actKey);
        counts.actions.created++;
        log(`  Créé · ${titre}`, 'ok');
      } catch(e) {
        counts.actions.errors++;
        log(`  Erreur · ${titre} — ${e.message}`, 'error');
      }
    }

    /* 6. Importer les jalons ───────────────────────────────────── */
    if (validJal.length > 0) {
      log('── Jalons…');
      for (const row of validJal) {
        // Col: 0=Title 1=ActionId 2=Date_Jalon 3=Statut_Jalon 4=Description
        const titre    = String(row[0] || '').trim();
        const actionId = String(row[1] || '').trim();
        if (!titre) { counts.jalons.skipped++; continue; }

        // Résolution de l'ActionId : si c'est un numéro de ligne Excel → SP ID
        const resolvedId = (() => {
          const n = parseInt(actionId);
          if (!isNaN(n) && actionRowMap[n]) return String(actionRowMap[n]);
          // Sinon garder tel quel (déjà un SP ID)
          return actionId;
        })();

        const jalKey = `${titre.toLowerCase()}|${resolvedId}`;
        if (existingJalKeys.has(jalKey)) {
          counts.jalons.skipped++;
          log(`  Ignoré (doublon) · ${titre}`);
          continue;
        }

        try {
          const fields = { Title: titre, ActionId: resolvedId };
          const dt  = _fmtDate(row[2]); if (dt)  fields.Date_Jalon   = dt;
          const st  = String(row[3] || '').trim().toLowerCase(); if (st) fields.Statut_Jalon = st;
          const dsc = String(row[4] || '').trim(); if (dsc) fields.Description = dsc;

          await graphFetch(`/sites/${spSiteId}/lists/${SP_CONFIG.lists.jalons}/items`, 'POST', { fields });
          existingJalKeys.add(jalKey);
          counts.jalons.created++;
          log(`  Créé · ${titre}`, 'ok');
        } catch(e) {
          counts.jalons.errors++;
          log(`  Erreur · ${titre} — ${e.message}`, 'error');
        }
      }
    }

    log('Importation terminée.', 'ok');

    /* 7. Afficher le résumé */
    _importShowPanel('results');
    const totalCreated = counts.axes.created + counts.actions.created + counts.jalons.created;
    const totalErrors  = counts.axes.errors  + counts.actions.errors  + counts.jalons.errors;

    let html = '<table class="import-tbl"><thead><tr><th>Liste</th><th>Créés</th><th>Ignorés</th><th>Erreurs</th></tr></thead><tbody>';
    for (const k of ['axes', 'actions', 'jalons']) {
      const c = counts[k];
      html += `<tr>
        <td>${c.label}</td>
        <td class="icount icount-ok">${c.created}</td>
        <td class="icount icount-skip">${c.skipped}</td>
        <td class="icount ${c.errors ? 'icount-err' : ''}">${c.errors}</td>
      </tr>`;
    }
    html += '</tbody></table>';

    const summaryClass = totalErrors ? 'import-summary import-summary-warn' : (totalCreated ? 'import-summary import-summary-ok' : 'import-summary');
    const summaryMsg   = totalCreated
      ? `${totalCreated} élément(s) créé(s) dans SharePoint.${totalErrors ? ` ${totalErrors} erreur(s) — voir le journal.` : ''}`
      : `Aucun nouvel élément — tout était déjà présent dans SharePoint.`;
    html += `<div class="${summaryClass}">${summaryMsg}</div>`;
    document.getElementById('import-results').innerHTML = html;

    /* 8. Rafraîchir le tableau de bord si des éléments ont été créés */
    if (totalCreated > 0) {
      try { await loadSharePointData(); } catch(_) {}
    }

  } catch(e) {
    log(`Erreur fatale : ${e.message}`, 'error');
    log('Importation interrompue.', 'error');
  }
}
