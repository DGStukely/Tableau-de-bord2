/* ================================================================
   ALERTES VISUELLES
   ================================================================ */
function checkAlertes() {
  const banner = document.getElementById('alert-banner');
  const txt    = document.getElementById('alert-banner-text');
  const badge  = document.getElementById('nav-alert-badge');
  if (!banner || !txt) return;

  const today = new Date(); today.setHours(0,0,0,0);

  const late = APP.actions.filter(a => {
    if (!a.echeance || a.statut === 'terminée') return false;
    const due = parseLocalDate(a.echeance);
    return due && due < today;
  });

  const soon = APP.actions.filter(a => {
    if (!a.echeance || a.statut === 'terminée') return false;
    const due = parseLocalDate(a.echeance);
    if (!due) return false;
    const diff = Math.round((due - today) / 86400000);
    return diff >= 0 && diff <= 30;
  });

  // Badge sur le menu Actions
  if (badge) {
    const total = late.length + soon.length;
    if (total > 0) {
      badge.textContent = total;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (late.length === 0 && soon.length === 0) {
    banner.classList.remove('show');
    return;
  }

  // Construire le message détaillé
  let html = '';

  if (late.length > 0) {
    html += `<strong style="color:#7F1D1D;">${late.length} objectif${late.length > 1 ? 's' : ''} en retard :</strong> `;
    html += late.slice(0, 3).map(a => {
      const jours = Math.round((today - parseLocalDate(a.echeance)) / 86400000);
      return `<span class="alert-item" onclick="goToAction('${h(a.id)}')" title="Ouvrir">${h(a.titre)} <em>(${jours}j)</em></span>`;
    }).join(', ');
    if (late.length > 3) html += ` <span style="color:#A32D2D;">+${late.length - 3} autres</span>`;
    if (soon.length > 0) html += ' &nbsp;·&nbsp; ';
  }

  if (soon.length > 0) {
    html += `<strong style="color:#854F0B;">${soon.length} échéant sous 30 jours :</strong> `;
    html += soon.slice(0, 2).map(a => {
      const due  = parseLocalDate(a.echeance);
      const diff = Math.round((due - today) / 86400000);
      const label = diff === 0 ? "aujourd'hui" : `dans ${diff}j`;
      return `<span class="alert-item" onclick="goToAction('${h(a.id)}')" title="Ouvrir">${h(a.titre)} <em>(${label})</em></span>`;
    }).join(', ');
    if (soon.length > 2) html += ` <span style="color:#854F0B;">+${soon.length - 2} autres</span>`;
  }

  html += `&nbsp;<button class="alert-link" onclick="filterLate()">Voir tout →</button>`;

  txt.innerHTML = html;
  banner.classList.add('show');
}

/* Naviguer vers une action et ouvrir son formulaire */
function goToAction(id) {
  const btn = document.getElementById('nav-actions');
  if (btn) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    btn.classList.add('active');
    switchPane('actions', btn);
  }
  setTimeout(() => openFormModal(id), 150);
}

/* Filtrer le tableau Actions sur "en retard" */
function filterLate() {
  const btn = document.getElementById('nav-actions');
  if (btn) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    btn.classList.add('active');
    switchPane('actions', btn);
  }
  setTimeout(() => renderActions('en retard', 1), 150);
}

/* Rafraîchissement automatique toutes les 5 min */
setInterval(checkAlertes, 5 * 60 * 1000);
