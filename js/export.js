/* ================================================================
   EXPORT PDF
   ================================================================ */
function exportPDF() {
  const style = `
    <style>
      body { font-family: sans-serif; color: #1A1917; margin: 0; padding: 20px; }
      h1 { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
      .subtitle { font-size: 12px; color: #888; margin-bottom: 20px; }
      .kpis { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
      .kpi { background: #F7F6F3; border-radius: 8px; padding: 12px 16px; min-width: 100px; }
      .kpi-label { font-size: 11px; color: #888; margin-bottom: 4px; }
      .kpi-val { font-size: 24px; font-weight: 300; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
      th { text-align: left; padding: 7px 8px; background: #F7F6F3; border-bottom: 1px solid #ddd; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
      td { padding: 7px 8px; border-bottom: 0.5px solid #eee; vertical-align: top; }
      td.realisation { font-size: 11px; color: #444; max-width: 260px; }
      .pill { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 500; }
      .footer { margin-top: 30px; font-size: 10px; color: #aaa; text-align: center; border-top: 0.5px solid #eee; padding-top: 10px; }
      @media print { body { padding: 10px; } @page { size: landscape; margin: 1.5cm; } }
  
    .action-btns { display:flex; gap:4px; justify-content:flex-end; }
    .btn-action { border:none; background:none; cursor:pointer; padding:5px 7px; border-radius:6px; line-height:1; transition:background 0.15s; }
    .btn-action svg { width:13px; height:13px; display:block; }
    .btn-edit { color:var(--c-blue); }
    .btn-edit:hover { background:var(--c-blue-l); }
    .btn-del { color:var(--c-danger); }
    .btn-del:hover { background:var(--c-danger-l); }

  </style>`;

  const total  = APP.actions.length;
  const done   = APP.actions.filter(a => a.statut === 'terminée').length;
  const late   = APP.actions.filter(a => {
    if (!a.echeance || a.statut === 'terminée') return false;
    const _d = parseLocalDate(a.echeance); return _d && _d < new Date();
  }).length;
  const global = APP.axes.length ? Math.round(APP.axes.reduce((s,a) => s+a.pct,0)/APP.axes.length) : 0;

  const rows = APP.actions.map(a => {
    const sm = STATUS_MAP[a.statut] || STATUS_MAP['à faire'];
    const bg = sm.dot + '22';
    return `<tr>
      <td>${h(a.titre)}</td>
      <td>${h(a.axe)}</td>
      <td>${h(a.resp || '—')}</td>
      <td>${h(a.prio || '—')}</td>
      <td style="white-space:nowrap;">${fmtDate(a.echeance)}</td>
      <td style="white-space:nowrap;">${h(a.pct)}%</td>
      <td><span class="pill" style="background:${h(bg)};color:${h(sm.dot)};">${h(a.statut)}</span></td>
      <td class="realisation">${h(a.desc || '—')}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Plan stratégique — Rapport</title>${style}</head><body>
    <h1>Plan stratégique</h1>
    <div class="subtitle">Rapport généré le ${new Date().toLocaleDateString('fr-CA', {year:'numeric',month:'long',day:'numeric'})} — Stukely-Sud</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Avancement global</div><div class="kpi-val">${global}%</div></div>
      <div class="kpi"><div class="kpi-label">Objectifs totaux</div><div class="kpi-val">${total}</div></div>
      <div class="kpi"><div class="kpi-label">Terminées</div><div class="kpi-val">${done}</div></div>
      <div class="kpi"><div class="kpi-label">En retard</div><div class="kpi-val">${late}</div></div>
    </div>
    <table>
      <thead><tr><th>Objectif</th><th>Axe</th><th>Responsable</th><th>Priorité</th><th>Échéance</th><th>%</th><th>Statut</th><th>Réalisation</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">© ${new Date().getFullYear()} Muni-Consul™ — Solutions municipales intelligentes — Tous droits réservés</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Les fenêtres pop-up sont bloquées. Autorisez-les pour ce site afin d\'exporter en PDF.'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

/* ================================================================
   RAPPORT PDF PAR AXE STRATÉGIQUE — jsPDF 14×11 po paysage
   ================================================================ */
function exportAxePDF(axeId) {
  if (!window.jspdf) { alert('La librairie jsPDF n\'est pas chargée. Vérifiez votre connexion internet.'); return; }

  const axeMap = getAxeMap();
  const axe    = axeMap[axeId];
  if (!axe) return;

  // ── Données ───────────────────────────────────────────────
  const actions = APP.actions.filter(a => a.axe === axeId);
  const jalons  = APP.jalons.filter(j => j.axe === axeId);
  const done    = actions.filter(a => a.statut === 'terminée').length;
  const late    = actions.filter(a => a.statut === 'en retard').length;
  const inprog  = actions.filter(a => a.statut === 'en cours').length;
  const waiting = actions.filter(a => a.statut === 'en attente').length;
  const avgPct  = actions.length ? Math.round(actions.reduce((s,a)=>s+(parseInt(a.pct)||0),0)/actions.length) : 0;

  const SORT_ST  = {'en retard':0,'en cours':1,'en attente':2,'à faire':3,'terminée':4};
  const sorted   = [...actions].sort((a,b) => {
    const d = (SORT_ST[a.statut]??99) - (SORT_ST[b.statut]??99);
    return d !== 0 ? d : (a.echeance||'').localeCompare(b.echeance||'');
  });

  const STATUT_RGB = {
    'terminée':[99,153,34],'en cours':[55,138,221],'en retard':[226,75,74],
    'en attente':[239,159,39],'à faire':[158,156,150]
  };
  const PRIO_LBL = { haute:'Haute', moyenne:'Moyenne', basse:'Basse' };

  // ── Convertir couleur hex en tableau RGB ──────────────────
  function hr(hex) {
    const c = hex.replace('#','');
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  }
  const axeRGB = hr(axe.color);

  // ── Créer le document légal paysage 14×8½ po ─────────────
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'legal', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();   // 14 po = 1008 pt
  const H = doc.internal.pageSize.getHeight();  // 8.5 po = 612 pt
  const ML = 48, MR = 48, MT = 48;
  const CW = W - ML - MR;
  doc.setProperties({ title: `${axe.nom} — Rapport stratégique — Stukely-Sud` });

  let y = MT;

  // ── Bandeau couleur en haut ───────────────────────────────
  doc.setFillColor(...axeRGB);
  doc.rect(0, 0, W, 5, 'F');

  // ── En-tête ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...axeRGB);
  doc.text('Stukely-Sud', ML, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('Plan stratégique — Rapport par axe', ML, y + 24);

  const dateStr = new Date().toLocaleDateString('fr-CA', {year:'numeric',month:'long',day:'numeric'});
  doc.text(`Rapport du ${dateStr}`, W - MR, y + 12, { align: 'right' });

  y += 36;
  doc.setDrawColor(...axeRGB);
  doc.setLineWidth(1);
  doc.line(ML, y, W - MR, y);
  y += 14;

  // ── Nom de l'axe + pourcentage ────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(26, 25, 23);
  doc.text(axe.nom, ML + 10, y + 13);

  doc.setFontSize(22);
  doc.setTextColor(...axeRGB);
  doc.text(`${axe.pct}%`, W - MR, y + 13, { align: 'right' });
  y += 22;

  // Barre de progression
  doc.setFillColor(225, 224, 220);
  doc.roundedRect(ML, y, CW, 7, 3, 3, 'F');
  if (axe.pct > 0) {
    doc.setFillColor(...axeRGB);
    doc.roundedRect(ML, y, CW * (axe.pct / 100), 7, 3, 3, 'F');
  }
  y += 16;

  // Description de l'axe
  if (axe.desc) {
    doc.setFillColor(...axeRGB);
    doc.rect(ML, y, 3, 16, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 100, 100);
    const descLines = doc.splitTextToSize(axe.desc, CW - 14);
    doc.text(descLines, ML + 10, y + 10);
    y += Math.max(20, descLines.length * 12 + 6);
  }
  y += 8;

  // ── KPIs ──────────────────────────────────────────────────
  const kpis = [
    { label:'Objectifs totaux', val: String(actions.length), color:[26,25,23] },
    { label:'Terminées',       val: String(done),   color:[99,153,34] },
    { label:'En cours',        val: String(inprog), color:[55,138,221] },
    ...(waiting ? [{ label:'En attente', val: String(waiting), color:[239,159,39] }] : []),
    { label:'En retard',       val: String(late),   color:[226,75,74] },
    { label:'Avancement moy.', val: avgPct+'%',     color: axeRGB },
  ];
  const kpiW = (CW - (kpis.length - 1) * 7) / kpis.length;
  const kpiH = 46;
  kpis.forEach((k, i) => {
    const kx = ML + i * (kpiW + 7);
    doc.setFillColor(247, 246, 243);
    doc.roundedRect(kx, y, kpiW, kpiH, 4, 4, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(k.label, kx + kpiW / 2, y + 13, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...k.color);
    doc.text(k.val, kx + kpiW / 2, y + 36, { align: 'center' });
  });
  y += kpiH + 14;

  // ── Tableau des actions ───────────────────────────────────
  doc.autoTable({
    startY: y,
    margin: { left: ML, right: MR },
    head: [['Objectif', 'Responsable', 'Priorité', 'Échéance', '%', 'Statut', 'Notes']],
    body: sorted.map(a => {
      const diff = a.echeance && a.statut !== 'terminée'
        ? Math.round((new Date(a.echeance) - new Date()) / 86400000) : null;
      const delai = diff !== null && diff < 0 ? ` (${Math.abs(diff)}j dépassé)` :
                    diff !== null && diff <= 14 ? ` (${diff}j)` : '';
      return [
        a.titre || '',
        a.resp  || '—',
        PRIO_LBL[a.prio] || '—',
        (fmtDate(a.echeance) || '—') + delai,
        `${a.pct}%`,
        a.statut || '',
        a.desc   || ''
      ];
    }),
    headStyles: {
      fillColor:[247,246,243], textColor:[100,100,100],
      fontStyle:'bold', fontSize:8, cellPadding:5,
    },
    bodyStyles: { fontSize:9, cellPadding:4 },
    columnStyles: {
      0: { cellWidth: 190 },
      1: { cellWidth: 110 },
      2: { cellWidth:  65 },
      3: { cellWidth:  90 },
      4: { cellWidth:  38, halign:'center' },
      5: { cellWidth:  80 },
      6: { cellWidth: 'auto' },
    },
    didParseCell(data) {
      if (data.column.index === 5 && data.section === 'body') {
        const rgb = STATUT_RGB[sorted[data.row.index]?.statut];
        if (rgb) { data.cell.styles.textColor = rgb; data.cell.styles.fontStyle = 'bold'; }
      }
      if (data.column.index === 3 && data.section === 'body') {
        const a = sorted[data.row.index];
        if (a && a.echeance && a.statut !== 'terminée') {
          const diff = Math.round((new Date(a.echeance) - new Date()) / 86400000);
          if (diff < 0) data.cell.styles.textColor = [226,75,74];
          else if (diff <= 14) data.cell.styles.textColor = [239,159,39];
        }
      }
    },
    alternateRowStyles: { fillColor:[252,251,249] },
    theme: 'plain',
    tableLineColor:[230,228,224], tableLineWidth:0.3,
  });

  y = doc.lastAutoTable.finalY + 14;

  // ── Jalons ────────────────────────────────────────────────
  if (jalons.length > 0) {
    if (y + 70 > H - MT) { doc.addPage(); y = MT; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`JALONS (${jalons.length})`, ML, y);
    y += 6;
    const sortedJ = [...jalons].sort((a,b) => (a.date||'').localeCompare(b.date||''));
    doc.autoTable({
      startY: y,
      margin: { left: ML, right: MR },
      head: [['Date', 'Jalon', 'Statut']],
      body: sortedJ.map(j => [fmtDate(j.date)||'—', j.titre||'', j.statut||'']),
      headStyles: { fillColor:[247,246,243], textColor:[100,100,100], fontStyle:'bold', fontSize:8, cellPadding:4 },
      bodyStyles: { fontSize:9, cellPadding:4 },
      columnStyles: { 0:{ cellWidth:90 }, 1:{ cellWidth:'auto' }, 2:{ cellWidth:90 } },
      didParseCell(data) {
        if (data.column.index === 2 && data.section === 'body') {
          const rgb = STATUT_RGB[sortedJ[data.row.index]?.statut];
          if (rgb) { data.cell.styles.textColor = rgb; data.cell.styles.fontStyle = 'bold'; }
        }
      },
      theme:'plain', tableLineColor:[230,228,224], tableLineWidth:0.3,
    });
  }

  // ── Pied de page (toutes les pages) ──────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(220, 218, 214);
    doc.setLineWidth(0.5);
    doc.line(ML, H - 32, W - MR, H - 32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 180, 180);
    doc.text(`© ${new Date().getFullYear()} Muni-Consul™ — Solutions municipales intelligentes — Document confidentiel`, ML, H - 22);
    doc.text(`Page ${p} / ${pageCount}`, W - MR, H - 22, { align: 'right' });
    doc.setFillColor(...axeRGB);
    doc.rect(0, H - 4, W, 4, 'F');
  }

  // ── Télécharger ───────────────────────────────────────────
  const safeName = axe.nom.replace(/[\\/:*?"<>|]/g, '').trim();
  doc.save(`${safeName} — Rapport stratégique.pdf`);
}

/* ================================================================
   TABLEAU DE BORD IMPRIMABLE — Séance du conseil
   Format : lettre paysage 11×8.5 po — une page épurée
   ================================================================ */
function exportDashboardPDF() {
  if (!window.jspdf) { alert('La librairie jsPDF n\'est pas chargée.'); return; }
  const { jsPDF } = window.jspdf;

  // ── Dimensions : légal paysage 14×8.5 po ─────────────────
  // 'legal' = 8.5×14 po, orientation 'landscape' → 14×8.5 po
  const doc = new jsPDF({ unit: 'pt', format: 'legal', orientation: 'landscape' });
  const W  = doc.internal.pageSize.getWidth();   // ~1008 pt
  const H  = doc.internal.pageSize.getHeight();  //  ~612 pt
  const ML = 40, MR = 40, MT = 36;
  const CW = W - ML - MR;
  doc.setProperties({ title: 'Tableau de bord stratégique — Séance du conseil' });

  function hr(hex) {
    const c = (hex||'#888888').replace('#','');
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  }

  const PURPLE = [83, 74, 183];
  const now    = new Date();
  const dateStr = now.toLocaleDateString('fr-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  let y = 0;

  // ── Bandeau supérieur ─────────────────────────────────────
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, W, 38, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('Tableau de bord stratégique', ML, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 197, 240);
  doc.text(`Séance du conseil  ·  ${dateStr}`, ML, 34);

  if (window.isLiveData) {
    doc.text('Données en direct', W - MR, 24, { align: 'right' });
  }

  y = 52;

  // ── KPIs ──────────────────────────────────────────────────
  const total   = APP.actions.length;
  const done    = APP.actions.filter(a => a.statut === 'terminée').length;
  const late    = APP.actions.filter(a => a.statut === 'en retard').length;
  const inprog  = APP.actions.filter(a => a.statut === 'en cours').length;
  const waiting = APP.actions.filter(a => a.statut === 'en attente').length;
  const global  = APP.axes.length ? Math.round(APP.axes.reduce((s,a) => s + a.pct, 0) / APP.axes.length) : 0;
  const totalBudget = APP.actions.reduce((s, a) => s + (parseFloat(a.budget) || 0), 0);
  const budgetStr = totalBudget > 0
    ? totalBudget.toLocaleString('fr-CA', { minimumFractionDigits:0, maximumFractionDigits:0 }) + ' $'
    : '—';

  const kpis = [
    { label:'Avancement global', val:`${global}%`, color: PURPLE },
    { label:'Objectifs totaux',  val:total,        color:[26,25,23] },
    { label:'Terminés',          val:done,         color:[99,153,34] },
    { label:'En retard',         val:late,         color:[226,75,74] },
    { label:'En cours',          val:inprog,       color:[55,138,221] },
    { label:'En attente',        val:waiting,      color:[239,159,39] },
    { label:'Budget prévu',      val:budgetStr,    color:[26,25,23], small:true },
  ];
  const kW = (CW - (kpis.length - 1) * 8) / kpis.length;
  const kH = 52;
  kpis.forEach((k, i) => {
    const kx = ML + i * (kW + 8);
    doc.setFillColor(247, 246, 243);
    doc.roundedRect(kx, y, kW, kH, 4, 4, 'F');
    // Barre couleur en haut de la carte KPI
    doc.setFillColor(...k.color);
    doc.roundedRect(kx, y, kW, 4, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(k.label, kx + kW / 2, y + 16, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(k.small ? 11 : (i === 0 ? 20 : 18));
    doc.setTextColor(...k.color);
    doc.text(String(k.val), kx + kW / 2, y + 38, { align: 'center' });
  });

  y += kH + 14;

  // ── Séparateur + titre sections ───────────────────────────
  doc.setDrawColor(220, 218, 214);
  doc.setLineWidth(0.4);
  doc.line(ML, y, W - MR, y);
  y += 10;

  // ── Deux colonnes : axes (gauche) | jalons (droite) ───────
  const colLeft  = ML;
  const colRight = ML + Math.round(CW * 0.62) + 12;
  const colLeftW = Math.round(CW * 0.62);
  const colRightW = CW - colLeftW - 12;

  // Titre colonne gauche
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text('AXES STRATÉGIQUES', colLeft, y);
  doc.text('PROCHAINS JALONS', colRight, y);
  y += 10;

  // ── Axes (colonne gauche) ─────────────────────────────────
  const axeMap = getAxeMap();
  let yAxe = y;
  APP.axes.forEach(axe => {
    const rgb      = hr(axe.color);
    const actsAxe  = APP.actions.filter(a => a.axe === axe.id);
    const nbObj    = actsAxe.length;
    const nbDone   = actsAxe.filter(a => a.statut === 'terminée').length;
    const nbLate   = actsAxe.filter(a => a.statut === 'en retard').length;
    const axeBudget = actsAxe.reduce((s, a) => s + (parseFloat(a.budget) || 0), 0);
    const axeBudgetStr = axeBudget > 0
      ? axeBudget.toLocaleString('fr-CA', { minimumFractionDigits:0, maximumFractionDigits:0 }) + ' $'
      : '';

    // Point couleur + nom
    doc.setFillColor(...rgb);
    doc.circle(colLeft + 5, yAxe + 5, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(26, 25, 23);
    const nomTrunc = doc.splitTextToSize(axe.nom, colLeftW - 90)[0];
    doc.text(nomTrunc, colLeft + 14, yAxe + 8);

    // Pourcentage + budget (à droite)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...rgb);
    doc.text(`${axe.pct}%`, colLeft + colLeftW, yAxe + 8, { align: 'right' });
    if (axeBudgetStr) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(160, 160, 160);
      doc.text(axeBudgetStr, colLeft + colLeftW, yAxe + 17, { align: 'right' });
    }

    // Barre de progression
    const barY = yAxe + 12;
    const barW = colLeftW - 36;
    doc.setFillColor(225, 224, 220);
    doc.roundedRect(colLeft + 14, barY, barW, 5, 2, 2, 'F');
    if (axe.pct > 0) {
      doc.setFillColor(...rgb);
      doc.roundedRect(colLeft + 14, barY, barW * (axe.pct / 100), 5, 2, 2, 'F');
    }

    // Sous-stats : tout sur une ligne — gris puis rouge pour les retards
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const statX = colLeft + 14;
    const statY = barY + 14;

    // Partie grise
    const greyPart = `${nbObj} objectif${nbObj > 1 ? 's' : ''}` +
                     (nbDone > 0 ? `  ·  ${nbDone} terminé${nbDone > 1 ? 's' : ''}` : '');
    doc.setTextColor(160, 160, 160);
    doc.text(greyPart, statX, statY);

    // Partie rouge (en retard) — décalée de la largeur approx. du texte gris
    if (nbLate > 0) {
      const approxGW = greyPart.length * 3.85; // ~3.85 pt par caractère à 7.5pt
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(226, 75, 74);
      doc.text(`  ·  ${nbLate} en retard`, statX + approxGW, statY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 160, 160);
    }

    yAxe += 42;
  });

  // ── Jalons (colonne droite) ───────────────────────────────
  const upcomingJalons = [...APP.jalons]
    .filter(j => j.date && j.statut !== 'terminée')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(0, 8);

  const pastJalons = [...APP.jalons]
    .filter(j => j.statut === 'terminée')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 3);

  const STATUT_RGB = {
    'terminée':[99,153,34],'en cours':[55,138,221],'en retard':[226,75,74],
    'en attente':[239,159,39],'à faire':[158,156,150]
  };

  let yJal = y;

  const drawJalon = (j, isRecent) => {
    const axe  = axeMap[j.axe];
    const rgb  = axe ? hr(axe.color) : [150,150,150];
    const sRgb = STATUT_RGB[j.statut] || [158,156,150];
    const dStr = fmtDate(j.date) || '';

    // Puce ronde
    doc.setFillColor(...sRgb);
    doc.circle(colRight + 5, yJal + 5, 3.5, 'F');

    // Titre jalon
    doc.setFont('helvetica', isRecent ? 'normal' : 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(isRecent ? 140 : 26, isRecent ? 140 : 25, isRecent ? 140 : 23);
    const titTrunc = doc.splitTextToSize(j.titre, colRightW - 14)[0];
    doc.text(titTrunc, colRight + 13, yJal + 7);

    // Date + axe
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb);
    const sub = axe ? `${dStr}  ·  ${axe.nom.split(' ')[0]}` : dStr;
    doc.text(sub, colRight + 13, yJal + 15);

    yJal += 22;
  };

  upcomingJalons.forEach(j => drawJalon(j, false));

  if (pastJalons.length > 0 && yJal + 30 < H - 30) {
    doc.setDrawColor(220, 218, 214);
    doc.setLineWidth(0.3);
    doc.line(colRight, yJal + 2, colRight + colRightW, yJal + 2);
    yJal += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.text('Récemment terminés', colRight, yJal);
    yJal += 8;
    pastJalons.forEach(j => drawJalon(j, true));
  }

  // ── Pied de page ──────────────────────────────────────────
  doc.setDrawColor(220, 218, 214);
  doc.setLineWidth(0.4);
  doc.line(ML, H - 26, W - MR, H - 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 180, 180);
  doc.text(`© ${now.getFullYear()} Muni-Consul™ — Solutions municipales intelligentes — Document confidentiel`, ML, H - 16);
  doc.text('1 / 1', W - MR, H - 16, { align: 'right' });
  doc.setFillColor(...PURPLE);
  doc.rect(0, H - 4, W, 4, 'F');

  doc.save(`Tableau de bord — Conseil — ${now.toISOString().slice(0,10)}.pdf`);
}

/* ================================================================
   EXPORT CSV
   ================================================================ */
function exportCSV() {
  const BOM = '\uFEFF'; // UTF-8 BOM pour Excel
  const sep = ';';
  const headers = ['Titre','Axe','Responsable','Priorité','Échéance','Avancement (%)','Statut','Description'];
  const rows = APP.actions.map(a => [
    a.titre      || '',
    a.axe        || '',
    a.resp       || '',
    a.prio       || '',
    a.echeance   || '',
    a.pct        != null ? a.pct : '',
    a.statut     || '',
    (a.desc      || '').replace(/[\r\n]+/g, ' ')
  ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(sep));

  const csv = BOM + [headers.map(h => `"${h}"`).join(sep), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `plan-strategique-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
