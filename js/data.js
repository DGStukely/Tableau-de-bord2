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
