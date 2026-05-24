/* ================================================================
   6. RENDU — APERÇU
   ================================================================ */

/** Formater un montant en dollars canadiens : 125 000 $ */
function formatBudget(n) {
  const num = parseFloat(n);
  if (!num || isNaN(num)) return null;
  return num.toLocaleString('fr-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' $';
}

function calcAvancementAxes() {
  if (!APP.autoCalcAxes) return; // Calcul auto désactivé
  // Calculer automatiquement l'avancement de chaque axe
  // en tenant compte des jalons (si définis) pour chaque objectif
  APP.axes.forEach(axe => {
    const actionsAxe = APP.actions.filter(a => a.axe === axe.id);
    if (actionsAxe.length > 0) {
      const total = actionsAxe.reduce((sum, a) => {
        const jp  = (typeof getJalonProgress === 'function') ? getJalonProgress(a.id) : null;
        // Prendre le max entre jalons cochés et % manuel (cohérent avec l'affichage)
        const pct = jp !== null ? Math.max(jp.pct, parseInt(a.pct) || 0) : (parseInt(a.pct) || 0);
        return sum + pct;
      }, 0);
      axe.pct = Math.round(total / actionsAxe.length);
    }
  });
}

function renderApercu() {
  // KPIs
  const total  = APP.actions.length;
  const done   = APP.actions.filter(a => (parseInt(a.pct) || 0) >= 100 || a.statut === 'terminée').length;
  const late   = APP.actions.filter(a => a.statut === 'en retard' && (parseInt(a.pct) || 0) < 100).length;
  const inprog = APP.actions.filter(a => a.statut === 'en cours'  && (parseInt(a.pct) || 0) < 100).length;
  const pct100 = total > 0 ? Math.round(done / total * 100) : 0;
  const pctLate = total > 0 ? Math.round(late / total * 100) : 0;
  const pctProg = total > 0 ? Math.round(inprog / total * 100) : 0;

  // Avancement global = moyenne du % réel de chaque action (jalons prioritaires)
  const global = total > 0 ? Math.round(
    APP.actions.reduce((s, a) => {
      const jp = (typeof getJalonProgress === 'function') ? getJalonProgress(a.id) : null;
      return s + (jp !== null ? Math.max(jp.pct, parseInt(a.pct) || 0) : (parseInt(a.pct) || 0));
    }, 0) / total
  ) : 0;

  // Calcul du budget total
  const totalBudget = APP.actions.reduce((s, a) => s + (parseFloat(a.budget) || 0), 0);
  const budgetFmt = formatBudget(totalBudget) || '—';
  const nbAvecBudget = APP.actions.filter(a => parseFloat(a.budget) > 0).length;

  document.getElementById('kpi-grid').innerHTML = [
    { label:'Avancement global', value:`${global}<sup>%</sup>`, delta:`${done} objectif${done!==1?'s':''} terminé${done!==1?'s':''}`, cls: global > 0 ? 'kpi-up' : 'kpi-neutral' },
    { label:'Objectifs totaux',  value:total,  delta:`Sur ${APP.axes.length} axes`, cls:'kpi-neutral' },
    { label:'Terminées',         value:done,   delta:`${pct100}% du total`, cls:'kpi-up' },
    { label:'En retard',         value:late,   delta:`${pctLate}% du total`, cls: late > 0 ? 'kpi-down' : 'kpi-neutral' },
    { label:'En cours',          value:inprog, delta:`${pctProg}% du total`, cls:'kpi-neutral' },
    { label:'Budget total prévu', value:`<span style="font-size:18px;">${budgetFmt}</span>`, delta:`${nbAvecBudget} objectif${nbAvecBudget!==1?'s':''} budgétisé${nbAvecBudget!==1?'s':''}`, cls:'kpi-neutral' },
  ].map(k => `
    <div class="kpi-card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-delta ${k.cls}">${k.delta}</div>
    </div>
  `).join('');

  // Section budget par axe
  const budgetSection = document.getElementById('budget-section');
  if (budgetSection) {
    const axesBudget = APP.axes.map(axe => {
      const acts = APP.actions.filter(a => a.axe === axe.id);
      const total = acts.reduce((s, a) => s + (parseFloat(a.budget) || 0), 0);
      const nb = acts.filter(a => parseFloat(a.budget) > 0).length;
      return { axe, total, nb };
    }).filter(ab => ab.total > 0);

    if (axesBudget.length === 0) {
      budgetSection.innerHTML = '';
    } else {
      const grandTotal = axesBudget.reduce((s, ab) => s + ab.total, 0);
      budgetSection.innerHTML = `
        <div class="budget-section-title">Budget prévu par axe</div>
        <div class="budget-grid">
          ${axesBudget.map(ab => {
            const pct = grandTotal > 0 ? Math.round(ab.total / grandTotal * 100) : 0;
            return `
            <div class="budget-card">
              <div class="budget-card-header">
                <span class="budget-card-dot" style="background:${h(ab.axe.color)}"></span>
                <span class="budget-card-nom" title="${h(ab.axe.nom)}">${h(ab.axe.nom)}</span>
              </div>
              <div class="budget-card-amount">${formatBudget(ab.total)}</div>
              <div class="budget-card-sub">${pct}% du budget · ${ab.nb} objectif${ab.nb!==1?'s':''}</div>
              <div style="margin-top:4px;height:3px;border-radius:99px;background:var(--c-surface-2);">
                <div style="width:${pct}%;height:100%;border-radius:99px;background:${h(ab.axe.color)};transition:width .7s;"></div>
              </div>
            </div>`;
          }).join('')}
        </div>`;
    }
  }

  // Barres axes
  document.getElementById('axes-bars').innerHTML = APP.axes.map(a => `
    <div class="axe-row">
      <span class="axe-dot" style="background:${h(a.color)}"></span>
      <span class="axe-name">${h(a.nom)}</span>
      <div class="axe-bar">
        <div class="progress-wrap">
          <div class="progress-fill" style="width:${h(a.pct)}%;background:${h(a.color)}"></div>
        </div>
      </div>
      <span class="axe-pct">${h(a.pct)}%</span>
    </div>
  `).join('');

  // Donut — les actions à 100% comptent comme "terminée"
  const counts = {};
  APP.actions.forEach(a => {
    const s = ((parseInt(a.pct) || 0) >= 100) ? 'terminée' : a.statut;
    counts[s] = (counts[s] || 0) + 1;
  });
  const labs = Object.keys(counts);
  const vals = labs.map(l => counts[l]);
  const cols = labs.map(l => STATUS_MAP[l]?.dot || '#999');

  if (APP.donutChart) {
    APP.donutChart.data.labels = labs;
    APP.donutChart.data.datasets[0].data = vals;
    APP.donutChart.data.datasets[0].backgroundColor = cols;
    APP.donutChart.update('none'); // 'none' désactive l'animation pour les mises à jour
  } else {
    APP.donutChart = new Chart(document.getElementById('chart-donut'), {
      type: 'doughnut',
      data: { labels: labs, datasets: [{ data: vals, backgroundColor: cols, borderWidth: 0, hoverOffset: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label} : ${c.parsed}` } } } }
    });
  }

  document.getElementById('donut-leg').innerHTML = labs.map((l,i) =>
    `<span style="display:flex;align-items:center;gap:4px;">
       <span style="width:9px;height:9px;border-radius:2px;background:${h(cols[i])}"></span>${h(l)} (${vals[i]})
     </span>`
  ).join('');

  // Graphique barres empilées — objectifs par axe et par statut
  const STATUTS_CHART = ['terminée','en cours','en attente','en suspend','en retard','à faire'];
  const axeLabels = APP.axes.map(a => a.id);

  const barDatasets = STATUTS_CHART.map(s => {
    const data = APP.axes.map(axe => {
      const acts = APP.actions.filter(a => a.axe === axe.id);
      return acts.filter(a => (((parseInt(a.pct)||0) >= 100) ? 'terminée' : a.statut) === s).length;
    });
    return { label: STATUS_MAP[s]?.label || s, data, backgroundColor: STATUS_MAP[s]?.dot || '#999', borderRadius: 2 };
  }).filter(d => d.data.some(v => v > 0));

  const tickColor = 'rgba(200,200,200,0.7)';
  const gridColor = 'rgba(128,128,128,0.08)';

  if (APP.lineChart) { APP.lineChart.destroy(); APP.lineChart = null; }
  APP.lineChart = new Chart(document.getElementById('chart-line'), {
    type: 'bar',
    data: { labels: axeLabels, datasets: barDatasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true, position: 'bottom',
          labels: { boxWidth: 12, padding: 14, font: { size: 11 }, color: tickColor }
        },
        tooltip: {
          callbacks: {
            title: items => APP.axes[items[0].dataIndex]?.nom || items[0].label,
            label: c => ` ${c.dataset.label} : ${c.parsed.y}`
          }
        }
      },
      scales: {
        x: { stacked: true, ticks: { font:{size:11}, color: tickColor }, grid:{ display:false } },
        y: { stacked: true, ticks: { font:{size:11}, color: tickColor, stepSize:1, precision:0 }, grid:{ color: gridColor } }
      }
    }
  });
}


/* ================================================================
   7. RENDU — ACTIONS
   ================================================================ */
const ACTIONS_PER_PAGE = 15;

// Ordre de priorité pour le tri
const PRIO_ORDER  = { haute: 0, moyenne: 1, basse: 2 };
const STATUT_ORDER = { 'en retard': 0, 'en cours': 1, 'en attente': 2, 'à faire': 3, 'terminée': 4 };

function sortActions(col) {
  if (APP.sortCol === col) {
    APP.sortDir = APP.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    APP.sortCol = col;
    APP.sortDir = col === 'echeance' || col === 'pct' ? 'asc' : 'asc';
  }
  renderActions(undefined, 1);
}

function applySortIcons(col, dir) {
  document.querySelectorAll('.sort-icon').forEach(el => el.textContent = '');
  const el = document.getElementById('sort-' + col);
  if (el) el.textContent = dir === 'asc' ? ' ↑' : ' ↓';
}

function clearSearch() {
  const el = document.getElementById('actions-search');
  if (el) { el.value = ''; el.focus(); }
  renderActions(undefined, 1);
}

/** Mettre à jour un filtre individuel et relancer le rendu */
function setFilter(type, value) {
  if (type === 'axe')    APP.filterAxe    = value;
  else if (type === 'statut') APP.activeFilter = value || 'tous';
  else if (type === 'resp')   APP.filterResp   = value;
  APP.actionsPage = 1;
  renderActions(undefined, undefined);
}

/** Effacer tous les filtres (axe, statut, responsable, texte) */
function resetFilters() {
  APP.activeFilter = 'tous';
  APP.filterAxe    = '';
  APP.filterResp   = '';
  const searchEl = document.getElementById('actions-search');
  if (searchEl) { searchEl.value = ''; }
  renderActions(undefined, 1);
}

function renderActions(filter, page) {
  if (filter !== undefined) APP.activeFilter = filter;
  if (page   !== undefined) APP.actionsPage  = page;
  if (!APP.actionsPage) APP.actionsPage = 1;

  // ── Barre de filtres combinés ─────────────────────────────
  const allAxes    = [...new Set(APP.actions.map(a => a.axe).filter(Boolean))].sort();
  const allStatuts = ['tous', ...new Set(APP.actions.map(a => a.statut).filter(Boolean))];
  const allResps   = [...new Set(APP.actions.map(a => a.resp).filter(Boolean))].sort((a,b) => a.localeCompare(b,'fr'));
  const axeMapFB   = getAxeMap();
  const anyFilter  = APP.activeFilter !== 'tous' || APP.filterAxe || APP.filterResp;

  document.getElementById('filter-bar').innerHTML =
    `<select id="filter-axe" class="filter-select${APP.filterAxe?' active':''}" onchange="setFilter('axe',this.value)" title="Filtrer par axe">
       <option value="">Tous les axes</option>
       ${allAxes.map(id => {
         const ax = axeMapFB[id];
         return `<option value="${h(id)}"${APP.filterAxe===id?' selected':''}>${h(ax ? ax.nom : id)}</option>`;
       }).join('')}
     </select>
     <select id="filter-statut" class="filter-select${APP.activeFilter!=='tous'?' active':''}" onchange="setFilter('statut',this.value)" title="Filtrer par statut">
       ${allStatuts.map(s => `<option value="${h(s)}"${APP.activeFilter===s?' selected':''}>${s==='tous'?'Tous les statuts':h(s)}</option>`).join('')}
     </select>
     <select id="filter-resp" class="filter-select${APP.filterResp?' active':''}" onchange="setFilter('resp',this.value)" title="Filtrer par responsable">
       <option value="">Tous les responsables</option>
       ${allResps.map(r => `<option value="${h(r)}"${APP.filterResp===r?' selected':''}>${h(r)}</option>`).join('')}
     </select>
     ${anyFilter ? `<button class="filter-reset" onclick="resetFilters()" title="Effacer tous les filtres">✕ Réinitialiser</button>` : ''}`;

  // ── Recherche texte ───────────────────────────────────────
  const searchEl = document.getElementById('actions-search');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';

  // ── Appliquer tous les filtres simultanément ──────────────
  let list = APP.actions;
  if (APP.activeFilter !== 'tous') list = list.filter(a => a.statut === APP.activeFilter);
  if (APP.filterAxe)   list = list.filter(a => a.axe  === APP.filterAxe);
  if (APP.filterResp)  list = list.filter(a => a.resp === APP.filterResp);
  if (q) {
    list = list.filter(a =>
      (a.titre  || '').toLowerCase().includes(q) ||
      (a.resp   || '').toLowerCase().includes(q) ||
      (a.axe    || '').toLowerCase().includes(q) ||
      (a.statut || '').toLowerCase().includes(q) ||
      (a.prio   || '').toLowerCase().includes(q) ||
      (a.desc   || '').toLowerCase().includes(q)
    );
  }

  // Tri des colonnes
  if (APP.sortCol) {
    const dir = APP.sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (APP.sortCol) {
        case 'titre':
          return dir * (a.titre || '').localeCompare(b.titre || '', 'fr');
        case 'axe':
          return dir * (a.axe || '').localeCompare(b.axe || '', 'fr');
        case 'resp':
          return dir * (a.resp || '').localeCompare(b.resp || '', 'fr');
        case 'prio': {
          const pa = PRIO_ORDER[a.prio] ?? 99;
          const pb = PRIO_ORDER[b.prio] ?? 99;
          return dir * (pa - pb);
        }
        case 'echeance': {
          const da = a.echeance ? new Date(a.echeance) : new Date('9999-12-31');
          const db = b.echeance ? new Date(b.echeance) : new Date('9999-12-31');
          return dir * (da - db);
        }
        case 'pct':
          return dir * ((parseInt(a.pct) || 0) - (parseInt(b.pct) || 0));
        case 'statut': {
          const sa = STATUT_ORDER[a.statut] ?? 99;
          const sb = STATUT_ORDER[b.statut] ?? 99;
          return dir * (sa - sb);
        }
        default:
          return 0;
      }
    });
    applySortIcons(APP.sortCol, APP.sortDir);
  } else {
    // Réinitialiser les icônes si aucun tri actif
    document.querySelectorAll('.sort-icon').forEach(el => el.textContent = '');
  }

  const totalPages = Math.max(1, Math.ceil(list.length / ACTIONS_PER_PAGE));
  if (APP.actionsPage > totalPages) APP.actionsPage = totalPages;
  const pageList = list.slice((APP.actionsPage - 1) * ACTIONS_PER_PAGE, APP.actionsPage * ACTIONS_PER_PAGE);
  const axeMap = getAxeMap();

  // Message aucun résultat
  if (list.length === 0) {
    const axeMapZero = getAxeMap();
    const activeFilters = [];
    if (APP.filterAxe) { const ax = axeMapZero[APP.filterAxe]; activeFilters.push(`axe « ${ax ? ax.nom : APP.filterAxe} »`); }
    if (APP.activeFilter !== 'tous') activeFilters.push(`statut « ${APP.activeFilter} »`);
    if (APP.filterResp) activeFilters.push(`responsable « ${APP.filterResp} »`);
    if (q) activeFilters.push(`recherche « ${h(q)} »`);
    const filterDesc = activeFilters.length ? ` pour ${activeFilters.join(', ')}` : '';
    document.getElementById('actions-tbody').innerHTML =
      `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--c-text-3);">
        Aucun objectif trouvé${filterDesc}.
        ${activeFilters.length > 0 ? `<br><button class="filter-reset" onclick="resetFilters()" style="margin-top:10px;">✕ Réinitialiser les filtres</button>` : ''}
      </td></tr>`;
    const pgEl2 = document.getElementById('actions-pagination');
    if (pgEl2) pgEl2.innerHTML = '';
    return;
  }

  document.getElementById('actions-tbody').innerHTML = pageList.map(a => {
    const axe = axeMap[a.axe] || { color:'#888', light:'#eee', nom:a.axe };
    const statutEff = (parseInt(a.pct) || 0) >= 100 ? 'terminée' : a.statut;
    const sm  = STATUS_MAP[statutEff] || STATUS_MAP['à faire'];
    const ci  = statutEff !== 'terminée' ? calcCible(a) : null;
    return `
      <tr>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          <span onclick="openModal('${h(String(a.id))}')" title="Voir les détails et les jalons" style="cursor:pointer;font-weight:500;color:var(--c-text);" onmouseover="this.style.color='var(--c-purple)'" onmouseout="this.style.color='var(--c-text)'">${h(a.titre)}</span>
        </td>
        <td><span style="font-size:11px;padding:2px 8px;border-radius:99px;background:${h(axe.light)};color:${h(axe.color)};font-weight:500;">${h(a.axe)}</span></td>
        <td style="white-space:nowrap;">${h(a.resp)}</td>
        <td><span class="prio-badge" style="${getPrioBadgeStyle(a.prio)}"></span></td>
        <td style="white-space:nowrap;font-size:12px;">${fmtDate(a.echeance)} ${statutEff !== 'terminée' ? formatDelai(a.echeance) : ''}</td>
        <td>
          <div class="mini-bar-wrap">
            <div class="mini-bar"><div class="mini-fill" style="width:${h(a.pct)}%;background:${h(sm.dot)}"></div></div>
            <span class="mini-pct">${h(a.pct)}%</span>
          </div>
          ${ci ? `<div style="display:flex;align-items:center;gap:5px;margin-top:2px;font-size:9.5px;line-height:1;white-space:nowrap;">
            <span style="color:var(--c-text-3);">Cible&nbsp;${ci.cible}%</span>
            <span style="font-weight:600;color:${ci.gap >= 0 ? '#166534' : '#991B1B'};" title="${ci.gap >= 0 ? 'En avance' : 'En retard'} de ${Math.abs(ci.gap)} point${Math.abs(ci.gap) > 1 ? 's' : ''}">${ci.gap > 0 ? '▲&nbsp;+' : ci.gap < 0 ? '▼&nbsp;' : ''}${ci.gap}%</span>
          </div>` : ''}
        </td>
        <td><span class="pill ${sm.pill}">${h(statutEff)}</span></td>
        <td style="white-space:nowrap;">
          <button onclick="openFormModal('${h(a.id)}')" title="Modifier" style="border:none;background:none;cursor:pointer;padding:5px 6px;border-radius:6px;color:#185FA5;" onmouseover="this.style.background='#E6F1FB'" onmouseout="this.style.background='none'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onclick="confirmDelete('${h(a.id)}', event)" title="Supprimer" style="border:none;background:none;cursor:pointer;padding:5px 6px;border-radius:6px;color:#A32D2D;" onmouseover="this.style.background='#FCEBEB'" onmouseout="this.style.background='none'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </td>
      </tr>`;
  }).join('');

  // Pagination
  const pgEl = document.getElementById('actions-pagination');
  if (pgEl) {
    if (totalPages <= 1) {
      pgEl.innerHTML = '';
    } else {
      const p = APP.actionsPage;
      pgEl.innerHTML = `
        <div class="pagination">
          <button class="pg-btn" onclick="renderActions(undefined,${p-1})" ${p<=1?'disabled':''}>‹ Préc.</button>
          <span class="pg-info">Page ${p} / ${totalPages} &nbsp;(${list.length} objectif${list.length > 1 ? 's' : ''})</span>
          <button class="pg-btn" onclick="renderActions(undefined,${p+1})" ${p>=totalPages?'disabled':''}>Suiv. ›</button>
        </div>`;
    }
  }
}


/* ================================================================
   8. RENDU — AXES
   ================================================================ */
function renderAxes() {
  const axeMap = getAxeMap();

  document.getElementById('axes-cards').innerHTML = APP.axes.map(axe => {
    const actions = APP.actions.filter(a => a.axe === axe.id);
    const done    = actions.filter(a => a.statut === 'terminée').length;
    const late    = actions.filter(a => a.statut === 'en retard').length;
    return `
      <div class="axe-card">
        <div class="axe-card-header">
          <span class="axe-card-dot" style="background:${h(axe.color)}"></span>
          <span class="axe-card-name">${h(axe.nom)}</span>
          <span class="axe-card-pct" style="color:${h(axe.color)}">${h(axe.pct)}%</span>
        </div>
        <div class="progress-wrap" style="height:8px;">
          <div class="progress-fill" style="width:${axe.pct}%;background:${axe.color}"></div>
        </div>
        ${axe.desc ? `<div style="font-size:12px;color:var(--c-text-2);margin-top:8px;line-height:1.5;font-style:italic;border-left:3px solid ${h(axe.color)};padding-left:8px;">${h(axe.desc)}</div>` : ''}
        <div style="display:flex;gap:14px;margin-top:10px;font-size:12px;color:var(--c-text-3);">
          <span>${actions.length} objectif${actions.length > 1 ? 's' : ''}</span>
          <span style="color:var(--c-ok);">${done} terminées</span>
          ${late>0?`<span style="color:var(--c-danger);">${late} en retard</span>`:''}
        </div>
        <div class="tag-list">
          ${actions.slice(0,5).map(ac=>`<span class="tag">${h(ac.titre.slice(0,28))}${ac.titre.length>28?'…':''}</span>`).join('')}
          ${actions.length>5?`<span class="tag">+${actions.length-5} autres</span>`:''}
        </div>
        <div style="margin-top:12px;border-top:1px solid var(--c-border);padding-top:10px;">
          <button onclick="exportAxePDF('${h(axe.id)}')"
            style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-family:var(--font);padding:5px 12px;border-radius:6px;border:1px solid var(--c-border-med);background:none;color:var(--c-text-2);cursor:pointer;transition:all .15s;"
            onmouseover="this.style.borderColor='${h(axe.color)}';this.style.color='${h(axe.color)}';this.style.background='${h(axe.light||axe.color+'18')}'"
            onmouseout="this.style.borderColor='var(--c-border-med)';this.style.color='var(--c-text-2)';this.style.background='none'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            Rapport PDF
          </button>
        </div>
      </div>`;
  }).join('');
}


/* ================================================================
   9. RENDU — TIMELINE
   ================================================================ */
function renderTimeline() {
  const sorted = [...APP.jalons].sort((a,b) => new Date(a.date) - new Date(b.date));
  const listEl = document.getElementById('timeline-list');
  if (!sorted.length) {
    listEl.innerHTML = `<div style="text-align:center;color:var(--c-text-3);padding:2rem;font-size:.9rem;">Aucun jalon — cliquez <strong>+ Nouveau jalon</strong> pour en créer un.</div>`;
    return;
  }
  // Précalculer le numéro de chaque jalon au sein de son objectif (triés par date)
  const jalonNumMap = {};
  const byAction = {};
  APP.jalons.forEach(j => {
    const key = j.actionId || '__none__';
    if (!byAction[key]) byAction[key] = [];
    byAction[key].push(j);
  });
  Object.values(byAction).forEach(list => {
    list.sort((a,b) => (a.date||'').localeCompare(b.date||''));
    list.forEach((j, idx) => { jalonNumMap[String(j.id)] = idx + 1; });
  });

  const axeMap = getAxeMap();
  listEl.innerHTML = sorted.map((item, i) => {
    const action  = APP.actions.find(a => String(a.id) === String(item.actionId));
    const axe     = action ? (axeMap[action.axe] || {}) : {};
    const num     = action && jalonNumMap[String(item.id)] ? `J${jalonNumMap[String(item.id)]}` : null;
    const sm      = STATUS_MAP[item.statut] || STATUS_MAP['à faire'];
    const isLast  = i === sorted.length - 1;
    return `
      <div class="tl-item">
        <div class="tl-left">
          <div class="tl-dot" style="background:${sm.dot}"></div>
          ${!isLast ? '<div class="tl-line"></div>' : ''}
        </div>
        <div class="tl-body">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;">
            <div style="display:flex;align-items:center;gap:7px;flex:1;min-width:0;">
              <input type="checkbox" ${item.statut === 'terminée' ? 'checked' : ''}
                onchange="toggleJalon('${h(String(item.id))}', this.checked)"
                style="width:15px;height:15px;cursor:pointer;accent-color:#3B6D11;flex-shrink:0;"
                title="${item.statut === 'terminée' ? 'Marquer non terminé' : 'Marquer terminé'}">
              ${num ? `<span style="font-size:10px;font-weight:700;color:var(--c-text-3);background:var(--c-surface-2);padding:1px 5px;border-radius:4px;flex-shrink:0;">${num}</span>` : ''}
              <div class="tl-title" style="${item.statut === 'terminée' ? 'text-decoration:line-through;color:var(--c-text-3);' : ''}">${h(item.titre)}</div>
            </div>
            <div style="display:flex;gap:2px;flex-shrink:0;">
              <button onclick="openJalonModal('${h(String(item.id))}')" title="Modifier"
                style="border:none;background:none;cursor:pointer;color:var(--c-text-3);padding:2px 4px;border-radius:4px;line-height:1;"
                onmouseover="this.style.color='var(--c-blue)'" onmouseout="this.style.color='var(--c-text-3)'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onclick="confirmDeleteJalon('${h(String(item.id))}')" title="Supprimer"
                style="border:none;background:none;cursor:pointer;color:var(--c-text-3);padding:2px 4px;border-radius:4px;line-height:1;"
                onmouseover="this.style.color='var(--c-danger)'" onmouseout="this.style.color='var(--c-text-3)'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </div>
          <div class="tl-meta">
            <span>${fmtDate(item.date)}</span>
            ${action ? `<span style="color:${h(axe.color||'#888')};cursor:pointer;" onclick="openModal('${h(String(action.id))}')" title="Voir l'objectif">${h(action.titre)}</span>` : ''}
            <span class="pill ${sm.pill}">${h(item.statut)}</span>
          </div>
          ${item.desc ? `<div style="font-size:11.5px;color:var(--c-text-2);margin-top:3px;line-height:1.4;">${h(item.desc)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}


/* ================================================================
   MA VUE — PAR RESPONSABLE
   ================================================================ */
function renderMaVue() {
  initDefaultSettings();
  const select = document.getElementById('mavue-resp-select');
  // Populate select
  // Reconstruire la liste à chaque appel pour rester à jour
  const prevVal = select.value;
  select.innerHTML = '<option value="">— Sélectionnez un responsable —</option>';
  const seen = new Set();
  // D'abord les responsables des actions existantes
  APP.actions.map(a => a.resp).filter(Boolean).forEach(r => {
    if (!seen.has(r)) {
      seen.add(r);
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      select.appendChild(opt);
    }
  });
  // Puis les responsables des paramètres (s'ils ne sont pas déjà là)
  (APP.responsables||[]).forEach(r => {
    if (!seen.has(r.nom)) {
      seen.add(r.nom);
      const opt = document.createElement('option');
      opt.value = r.nom; opt.textContent = r.nom;
      select.appendChild(opt);
    }
  });
  // Rétablir la sélection précédente si elle existe encore
  if (prevVal && seen.has(prevVal)) select.value = prevVal;
  const resp = select.value;
  const filtered = resp ? APP.actions.filter(a => a.resp === resp) : [];
  const axeMap = getAxeMap();

  // KPIs
  const kpisEl = document.getElementById('mavue-kpis');
  if (filtered.length > 0) {
    const done = filtered.filter(a => a.statut === 'terminée').length;
    const late = filtered.filter(a => {
      if (!a.echeance || a.statut === 'terminée') return false;
      const _d = parseLocalDate(a.echeance); return _d && _d < new Date();
    }).length;
    const avgPct = Math.round(filtered.reduce((s,a) => s+a.pct, 0) / filtered.length);
    kpisEl.innerHTML = [
      { label:'Actions assignées', val:filtered.length, cls:'' },
      { label:'Terminées', val:done, cls:'color:#3B6D11' },
      { label:'En retard', val:late, cls:'color:#A32D2D' },
      { label:'Avancement moyen', val:avgPct+'%', cls:'color:#534AB7' },
    ].map(k => `<div style="background:var(--c-surface-2);border-radius:var(--radius-md);padding:10px 12px;">
      <div style="font-size:11px;color:var(--c-text-2);margin-bottom:4px;">${k.label}</div>
      <div style="font-size:22px;font-weight:500;font-family:var(--font-mono);${k.cls}">${k.val}</div>
    </div>`).join('');
  } else {
    kpisEl.innerHTML = '';
  }

  // Table
  document.getElementById('mavue-tbody').innerHTML = filtered.map(a => {
    const axe = axeMap[a.axe] || { color:'#888', light:'#eee' };
    const sm = STATUS_MAP[a.statut] || STATUS_MAP['à faire'];
    return `<tr>
      <td style="font-weight:500;"><span onclick="openModal('${h(String(a.id))}')" title="Voir les détails et les jalons" style="cursor:pointer;" onmouseover="this.style.color='var(--c-purple)'" onmouseout="this.style.color=''">${h(a.titre)}</span></td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:99px;background:${h(axe.light)};color:${h(axe.color)};font-weight:500;">${h(a.axe)}</span></td>
      <td style="white-space:nowrap;font-size:12px;">${fmtDate(a.echeance)} ${a.statut!=='terminée'?formatDelai(a.echeance):''}</td>
      <td><div class="mini-bar-wrap"><div class="mini-bar"><div class="mini-fill" style="width:${h(a.pct)}%;background:${h(sm.dot)}"></div></div><span class="mini-pct">${h(a.pct)}%</span></div></td>
      <td><span class="pill ${sm.pill}">${h(a.statut)}</span></td>
      <td style="white-space:nowrap;">
        <button onclick="openFormModal('${h(a.id)}')" title="Modifier" style="border:none;background:none;cursor:pointer;padding:5px 6px;border-radius:6px;color:#185FA5;" onmouseover="this.style.background='#E6F1FB'" onmouseout="this.style.background='none'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button onclick="confirmDelete('${h(a.id)}', event)" title="Supprimer" style="border:none;background:none;cursor:pointer;padding:5px 6px;border-radius:6px;color:#A32D2D;" onmouseover="this.style.background='#FCEBEB'" onmouseout="this.style.background='none'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--c-text-3);padding:2rem;">Sélectionnez un responsable</td></tr>';
}


/* ================================================================
   GANTT
   ================================================================ */
function renderGantt() {
  const container = document.getElementById('gantt-container');
  if (!container) return;
  const now = new Date();
  const year = now.getFullYear();
  const gyEl = document.getElementById('gantt-year-label'); if (gyEl) gyEl.textContent = year;

  const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const startYear = new Date(year, 0, 1);
  const endYear   = new Date(year, 11, 31);
  const totalDays = Math.round((endYear - startYear) / 86400000) + 1;

  const axeMap = getAxeMap();

  let html = `<div style="font-size:11px;">`;

  // Header mois
  html += `<div style="display:flex;margin-left:210px;margin-bottom:4px;">`;
  months.forEach((m, i) => {
    const w = new Date(year, i+1, 0).getDate() / totalDays * 100;
    html += `<div style="flex:0 0 ${w}%;font-size:10px;color:var(--c-text-3);text-align:center;border-left:0.5px solid var(--c-border);">${m}</div>`;
  });
  html += `</div>`;

  // Ligne aujourd'hui
  const todayPct = Math.round((now - startYear) / 86400000) / totalDays * 100;

  let anyAxe = false;

  // Une ligne par axe
  APP.axes.forEach(axe => {
    const actionsAxe = APP.actions.filter(a => a.axe === axe.id && a.echeance);
    if (!actionsAxe.length) return;

    // Dates min/max des objectifs de cet axe
    const dates = actionsAxe.map(a => ({
      debut:    parseLocalDate(a.dateDebut) || parseLocalDate(a.echeance),
      echeance: parseLocalDate(a.echeance)
    }));
    const minDebut   = new Date(Math.min(...dates.map(d => d.debut)));
    const maxEcheance= new Date(Math.max(...dates.map(d => d.echeance)));

    // Ne montrer que si l'axe chevauche l'année affichée
    if (maxEcheance < startYear || minDebut > endYear) return;
    anyAxe = true;

    const startPct = Math.max(0,   Math.round((minDebut    - startYear) / 86400000) / totalDays * 100);
    const endPct   = Math.min(100, Math.round((maxEcheance - startYear) / 86400000) / totalDays * 100);
    const width    = Math.max(0.5, endPct - startPct);

    // Avancement réel de l'axe
    const pct = axe.pct || 0;
    const done  = actionsAxe.filter(a => (parseInt(a.pct)||0) >= 100 || a.statut === 'terminée').length;

    html += `<div style="display:flex;align-items:center;margin-bottom:8px;height:32px;">
      <div style="width:210px;flex-shrink:0;padding-right:10px;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="width:10px;height:10px;border-radius:50%;background:${h(axe.color)};flex-shrink:0;"></span>
          <span style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--c-text);" title="${h(axe.nom)}">${h(axe.nom.slice(0,28))}${axe.nom.length>28?'…':''}</span>
        </div>
        <div style="font-size:10px;color:var(--c-text-3);padding-left:16px;">${done}/${actionsAxe.length} objectifs · ${pct}%</div>
      </div>
      <div style="flex:1;position:relative;height:100%;border-left:0.5px solid var(--c-border);">
        <div style="position:absolute;left:${todayPct}%;top:0;bottom:0;width:1px;background:rgba(227,75,74,0.4);z-index:1;"></div>
        <!-- Barre totale (fond) -->
        <div style="position:absolute;left:${startPct}%;width:${width}%;top:6px;height:20px;background:${h(axe.color)};opacity:0.2;border-radius:4px;"></div>
        <!-- Barre avancement -->
        <div style="position:absolute;left:${startPct}%;width:${width * pct / 100}%;top:6px;height:20px;background:${h(axe.color)};opacity:0.85;border-radius:4px;display:flex;align-items:center;padding:0 6px;overflow:hidden;" title="${h(axe.nom)} — ${pct}%">
          ${pct > 5 ? `<span style="font-size:10px;color:white;white-space:nowrap;font-weight:600;">${pct}%</span>` : ''}
        </div>
      </div>
    </div>`;
  });

  if (!anyAxe) {
    html += `<div style="text-align:center;color:var(--c-text-3);padding:2rem;font-size:13px;">Aucun axe avec des objectifs ayant une échéance en ${year}</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}


/* ================================================================
   MODE PRÉSENTATION
   ================================================================ */
let presentationActive = false;
function togglePresentationMode() {
  presentationActive = !presentationActive;
  document.querySelector('.app').classList.toggle('presentation-mode', presentationActive);
  const btn = document.getElementById('btn-presentation');
  btn.style.background = presentationActive ? '#534AB7' : '';
  btn.style.color      = presentationActive ? '#fff' : '';
  btn.style.borderColor= presentationActive ? '#534AB7' : '';
  if (presentationActive) {
    switchPane('apercu', document.querySelector('.nav-item'));
  }
}


/* ================================================================
   HISTORIQUE PAR ACTION — ajout dans modal
   ================================================================ */

// Fermer en cliquant sur le fond
document.getElementById('form-modal-bg').addEventListener('click', function(e) {
  if (e.target === this) closeFormModal();
});

