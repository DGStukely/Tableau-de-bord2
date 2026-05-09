/* ================================================================
   CONFIGURATION SHAREPOINT — Lecture / Écriture
   Liste "Configuration" : un seul item Title="dashboard_config"
   ================================================================ */
let _spConfigItemId = null;  // ID SharePoint de l'item de config

async function loadSpConfig() {
  if (!isLiveData || !graphToken || !spSiteId) return;
  try {
    const res = await graphFetch(
      `/sites/${spSiteId}/lists/${SP_CONFIG.lists.config}/items?expand=fields($select=Title,Valeur)&$filter=fields/Title eq 'dashboard_config'&$top=1`
    );
    const items = res.value || [];
    if (items.length > 0) {
      _spConfigItemId = items[0].id;
      const valeur = items[0].fields?.Valeur;
      if (valeur) {
        try {
          const cfgSp = JSON.parse(valeur);

          // Lire le localStorage
          let cfgLocal = null;
          try { cfgLocal = JSON.parse(localStorage.getItem('plan_strategique_config') || 'null'); } catch(_) {}

          // Fusionner : garder le plus grand ensemble pour responsables et priorités
          // (évite de perdre des données ajoutées localement quand SP est en retard)
          const mergeById = (spArr, localArr) => {
            if (!localArr || !localArr.length) return spArr || [];
            if (!spArr    || !spArr.length)    return localArr;
            // Union par id : SP en base, local complète
            const map = {};
            (spArr).forEach(x => { map[x.id] = x; });
            (localArr).forEach(x => { if (!map[x.id]) map[x.id] = x; });
            return Object.values(map);
          };

          // Pour statuts et autoCalcAxes : timestamp décide
          const dateSp    = cfgSp.savedAt    ? new Date(cfgSp.savedAt).getTime()    : 0;
          const dateLocal = cfgLocal?.savedAt ? new Date(cfgLocal.savedAt).getTime() : 0;
          const spIsNewer = dateSp >= dateLocal;

          const merged = {
            responsables: mergeById(cfgSp.responsables, cfgLocal?.responsables),
            statuts:      spIsNewer ? (cfgSp.statuts || cfgLocal?.statuts || [])
                                    : (cfgLocal?.statuts || cfgSp.statuts || []),
            priorites:    mergeById(cfgSp.priorites, cfgLocal?.priorites),
            autoCalcAxes: spIsNewer ? (cfgSp.autoCalcAxes ?? cfgLocal?.autoCalcAxes ?? false)
                                    : (cfgLocal?.autoCalcAxes ?? cfgSp.autoCalcAxes ?? false),
            theme:        cfgLocal?.theme || cfgSp.theme || 'grey'
          };

          if (merged.responsables.length) APP.responsables = merged.responsables;
          if (merged.statuts.length)      APP.statuts      = merged.statuts;
          if (merged.priorites.length)    APP.priorites    = merged.priorites;
          APP.autoCalcAxes = merged.autoCalcAxes;
          if (merged.theme) APP.theme = merged.theme;

          // Si les données fusionnées sont plus complètes que SP → repousser vers SP
          const spResp  = (cfgSp.responsables || []).length;
          const spPrios = (cfgSp.priorites    || []).length;
          if (merged.responsables.length > spResp || merged.priorites.length > spPrios) {
            console.info('loadSpConfig: données locales plus complètes, push vers SP...');
            setTimeout(() => persistSpConfig(), 800);
          }

          // Mettre localStorage à jour
          localStorage.setItem('plan_strategique_config', JSON.stringify({ ...merged, savedAt: new Date().toISOString() }));
        } catch(e) { console.warn('Config SP parse error', e); }
      }
    }
  } catch(e) { console.warn('loadSpConfig error:', e.message); }
}

async function persistSpConfig() {
  if (!isLiveData || !graphToken || !spSiteId) return;
  const valeur = JSON.stringify({
    responsables: APP.responsables || [],
    statuts:      APP.statuts      || [],
    priorites:    APP.priorites    || [],
    autoCalcAxes: APP.autoCalcAxes || false,
    savedAt:      new Date().toISOString()
  });
  try {
    // Si l'ID n'est pas connu, chercher l'item existant avant d'en créer un nouveau
    if (!_spConfigItemId) {
      const existing = await graphFetch(
        `/sites/${spSiteId}/lists/${SP_CONFIG.lists.config}/items?expand=fields($select=Title)&$filter=fields/Title eq 'dashboard_config'&$top=10`
      );
      const items = existing.value || [];
      if (items.length > 0) {
        _spConfigItemId = items[0].id;
        // Supprimer les doublons éventuels (items 2, 3, …)
        for (let i = 1; i < items.length; i++) {
          try {
            await graphFetch(
              `/sites/${spSiteId}/lists/${SP_CONFIG.lists.config}/items/${items[i].id}`,
              'DELETE'
            );
          } catch(e2) { console.warn('Doublon config non supprimé:', e2.message); }
        }
      }
    }

    if (_spConfigItemId) {
      await graphFetch(
        `/sites/${spSiteId}/lists/${SP_CONFIG.lists.config}/items/${_spConfigItemId}/fields`,
        'PATCH', { Valeur: valeur }
      );
    } else {
      const res = await graphFetch(
        `/sites/${spSiteId}/lists/${SP_CONFIG.lists.config}/items`,
        'POST', { fields: { Title: 'dashboard_config', Valeur: valeur } }
      );
      _spConfigItemId = res.id;
    }
    return true; // succès
  } catch(e) {
    console.error('persistSpConfig error:', e.message);
    if (typeof showToast === 'function') {
      showToast('⚠️ Paramètres non sauvegardés sur SharePoint : ' + e.message, 'error');
    }
    return false;
  }
}

/* ================================================================
   3. MAPPING DES CHAMPS SHAREPOINT → MODÈLE INTERNE
   NOTE : Adaptez les noms de champs selon votre liste SharePoint
   ================================================================ */
function mapAxe(fields) {
  return {
    id:     fields.Identifiant       || fields.Title,
    nom:    fields.Nom               || fields.Title,
    pct:    parseInt(fields.Avancement || fields.Pourcentage || 0),
    color:  fields.Couleur           || "#534AB7",
    light:  fields.CouleurClaire     || "#EEEDFE",
    desc:   fields.Description_Axe   || fields.Description || "",
    spId:   fields._spId             || null,   // ID SharePoint pour les mises à jour
  };
}

function mapAction(fields) {
  // Extraire le code axe (ex: "A1 - Gouvernance" -> "A1")
  const axeRaw = fields.Axe_Strategique || fields.Axe || fields.AxeId || "";
  const axeCode = axeRaw.match(/^(A\d+)/)?.[1] || axeRaw;

  // Parser les dates correctement
  const parseDate = (d) => {
    if (!d) return "";
    try { return new Date(d).toISOString().split('T')[0]; }
    catch { return ""; }
  };

  return {
    id:          fields.ID              || fields.id,
    titre:       fields.Title           || fields.Titre || "",
    axe:         axeCode,
    resp:        fields.Responsable_Nom ||
                 fields.Responsable_Texte ||
                 ((typeof fields.Responsable === 'object' && fields.Responsable !== null)
                   ? (fields.Responsable.LookupValue || fields.Responsable.DisplayName || "")
                   : (fields.Responsable || "")),
    courriel:    fields.Responsable_Courriel || "",
    prio:        (fields.Priorite       || fields.Priority || "moyenne").toLowerCase(),
    echeance:    parseDate(fields.Date_Echeance || fields.Echeance || fields.DateEcheance),
    dateDebut:   parseDate(fields.Date_Debut    || fields.DateDebut),
    pct:         parseInt(fields.Avancement || 0),
    statut:      (fields.Statut         || "à faire").toLowerCase(),
    desc:        fields.Description     || fields.Notes || "",
    budget:      fields.Budget_Prevu    || "",
    commentaire: fields.Commentaire_Suivi || fields.Commentaire || "",
  };
}

function mapJalon(fields) {
  return {
    date:    fields.Date             || fields.DateJalon,
    titre:   fields.Title            || fields.Titre,
    axe:     fields.Axe              || "",
    statut:  (fields.Statut          || "à faire").toLowerCase(),
  };
}


/* ================================================================
   4. CHARGEMENT DES DONNÉES — SHAREPOINT OU DÉMO
   ================================================================ */
async function loadSharePointData() {
  setLoadingStep("Récupération de l'ID du site…");
  try {
    spSiteId = await getSiteId();
    setLoadingStep("Chargement des axes stratégiques…");
    const rawAxes    = await getListItems(SP_CONFIG.lists.axes);
    setLoadingStep("Chargement des actions…");
    const rawActions = await getListItems(SP_CONFIG.lists.actions);
    setLoadingStep("Chargement des jalons…");
    const rawJalons  = await getListItems(SP_CONFIG.lists.jalons);
    setLoadingStep("Chargement de la configuration…");
    await loadSpConfig();

    // Charger les axes SharePoint
    const spAxes = rawAxes.map(mapAxe);

    // Charger les paramètres sauvegardés (axes perso, responsables, etc.)
    loadSettings();
    
    // Fusionner : garder les axes du localStorage, compléter avec ceux de SharePoint
    const savedAxeIds = (APP.axes || []).map(a => a.id);
    const newSpAxes = spAxes.filter(a => !savedAxeIds.includes(a.id));
    APP.axes = [...(APP.axes || []), ...newSpAxes];

    invalidateAxeMap();

    APP.actions = rawActions.map(mapAction);
    APP.jalons  = rawJalons.map(mapJalon);
    isLiveData  = true;

    // Sauvegarder pour usage hors ligne
    persistData();

    setLoadingStep("Rendu du tableau de bord…");
    showApp();
  } catch (err) {
    console.error("SharePoint load error:", err);

    // Tenter de restaurer les données du cache local (mode hors ligne)
    const savedAt = restoreData();
    if (savedAt) {
      const date = new Date(savedAt).toLocaleDateString('fr-CA', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
      console.info(`Mode hors ligne — données du ${date}`);
      isLiveData = false;
      setLoadingStep("Chargement des données en cache…");
      showApp();
      setTimeout(() => {
        const dot = document.getElementById('sp-dot');
        const lbl = document.getElementById('sp-label');
        if (dot) dot.className = 'sp-dot sp-offline';
        if (lbl) lbl.textContent = `Hors ligne · ${date}`;
      }, 500);
    } else {
      // Afficher l'erreur réelle sur l'écran de chargement avant de basculer
      console.warn("Aucun cache disponible, mode démonstration:", err.message);
      setLoadingStep("⚠️ Connexion SharePoint échouée");
      // Afficher un message visible pendant 4 secondes
      const stepEl = document.getElementById('loading-step');
      if (stepEl) {
        stepEl.style.color = '#E24B4A';
        stepEl.innerHTML =
          `<strong>Accès SharePoint refusé</strong><br>
           <span style="font-size:.8rem;">${err.message}</span><br>
           <span style="font-size:.75rem;opacity:.7;">Chargement des données locales…</span>`;
      }
      setTimeout(() => loadDemoData(), 3000);
    }
  }
}

function loadDemoData() {
  /* ---- DONNÉES DE DÉMONSTRATION ----
     Remplacées automatiquement par les données SharePoint en production */

  // Charger d'abord les paramètres sauvegardés
  loadSettings();

  // Aucune donnée de démonstration — les axes et objectifs seront
  // chargés depuis SharePoint ou saisis manuellement via les Paramètres.
  if (!APP.axes || APP.axes.length === 0) {
    APP.axes = [];
  }
  invalidateAxeMap();

  APP.actions = [];
  APP.jalons  = [];
  // Purger les jalons du cache localStorage (nettoyage définitif)
  try {
    const raw = localStorage.getItem('plan_strategique_data');
    if (raw) {
      const d = JSON.parse(raw);
      if (d.jalons) { delete d.jalons; localStorage.setItem('plan_strategique_data', JSON.stringify(d)); }
    }
  } catch(e) {}
  isLiveData = false;
  showApp();
}
