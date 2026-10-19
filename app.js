/* DIGISOLDE PRO MULTI-BOUTIQUES - app.js (V4) */
const KEY = "digisolde_pro_v4";
const CPT = [
  { id: "om_p", nom: "Orange principal", res: "Orange", t: "p" },
  { id: "om_c", nom: "Orange commissions", res: "Orange", t: "c" },
  { id: "om_cr", nom: "Orange crédit", res: "Orange", t: "cr" },
  { id: "mtn_p", nom: "MTN principal", res: "MTN", t: "p" },
  { id: "mtn_c", nom: "MTN commissions", res: "MTN", t: "c" },
  { id: "cam_p", nom: "Camtel principal", res: "Camtel", t: "cr" },
  { id: "cam_c", nom: "Camtel commissions", res: "Camtel", t: "c" }
];
const RES = { Orange: "network-orange", MTN: "network-mtn", Camtel: "network-camtel" };
const EXT = {
  p: "Mouvement net clients déclaré (+ entrée / − sortie)",
  c: "Commissions générées déclarées (≥ 0)",
  cr: "Crédit vendu déclaré (−) ou recharge (+)"
};
const TITRES = { accueil: "Accueil", service: "Service", transferts: "Transferts entre comptes", cash: "Cash et dépenses", stats: "Statistiques", rapports: "Rapports et historique", params: "Paramètres" };
const HYP = "Hypothèses possibles, non confirmées : transfert non enregistré, erreur de saisie, commission mal déclarée, conversion de crédit non enregistrée, dépense non déclarée, retrait non justifié, autre mouvement non identifié.";

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const F = n => Math.round(n).toLocaleString("fr-FR") + " FCFA";
const num = v => { const s = String(v).replace(/\s/g, "").replace(",", "."); if (s === "") return null; const n = Number(s); return isNaN(n) ? null : n; };
const val = id => { const e = document.getElementById(id); return e ? e.value : ""; };
const cptOf = id => CPT.find(c => c.id === id);
const dt = iso => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
const fg = (id, label, ph, mode) => `<div class="form-group"><label>${label}</label><input id="${id}" inputmode="${mode || "numeric"}" placeholder="${ph || "0"}"></div>`;
const head = (t, p) => `<div class="page-header"><h2>${t}</h2><p>${p || ""}</p></div>`;
const cls = n => n < 0 ? "text-red" : n > 0 ? "text-orange" : "";

let db = load();
let page = "accueil";
let ouvert = null;

function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.settings) return d; } catch (e) {}
  return { settings: { boutique: "Ma boutique", taux: 4, cash: true }, session: null, last: null, history: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { alert("Enregistrement impossible : stockage plein ou bloqué. Faites une sauvegarde JSON."); }
}
function notify(m) {
  const n = $("#notification"); n.textContent = m; n.className = "show";
  setTimeout(() => { n.className = ""; }, 2500);
}

/* ---------- Calculs ---------- */
function cashCourant(s) {
  const inn = s.cash.filter(m => m.type === "in").reduce((a, m) => a + m.montant, 0);
  const out = s.cash.filter(m => m.type === "out" || m.type === "dep").reduce((a, m) => a + m.montant, 0);
  const ret = s.transferts.filter(t => t.vers === "cash").reduce((a, t) => a + t.cred, 0);
  return s.cashInit + inn + ret - out;
}
function calcul(s, reel, ext, cashReel) {
  const comptes = CPT.map(c => {
    const tin = s.transferts.filter(t => t.vers === c.id).reduce((a, t) => a + t.cred, 0);
    const tout = s.transferts.filter(t => t.de === c.id).reduce((a, t) => a + t.deb, 0);
    const theo = s.bal[c.id] + ext[c.id] + tin - tout;
    return { id: c.id, nom: c.nom, debut: s.bal[c.id], ext: ext[c.id], tin, tout, theo, reel: reel[c.id], ecart: reel[c.id] - theo };
  });
  const gainConv = s.transferts.filter(t => t.de === "om_p" && t.vers === "om_cr").reduce((a, t) => a + (t.cred - t.deb), 0);
  const comm = CPT.filter(c => c.t === "c").reduce((a, c) => a + ext[c.id], 0);
  const dep = s.cash.filter(m => m.type === "dep").reduce((a, m) => a + m.montant, 0);
  const benef = gainConv + comm;
  let cash = null;
  if (db.settings.cash) { const theo = cashCourant(s); cash = { init: s.cashInit, theo, reel: cashReel, ecart: cashReel - theo }; }
  return { comptes, gainConv, comm, dep, benef, net: benef - dep, cash };
}

/* ---------- Navigation ---------- */
function toggleMenu() { $("#app-drawer").classList.toggle("open"); }
function go(p) {
  page = p; ouvert = null; $("#app-drawer").classList.remove("open"); render(); window.scrollTo(0, 0);
}
function render() {
  $("#drawerBoutique").textContent = db.settings.boutique;
  $("#topBoutique").textContent = db.settings.boutique;
  $("#topTitle").textContent = TITRES[page];
  document.querySelectorAll(".drawer-nav a").forEach(a => a.classList.toggle("active", a.dataset.p === page));
  $("#app").innerHTML = banniere() + { accueil: vAccueil, service: vService, transferts: vTransferts, cash: vCash, stats: vStats, rapports: vRapports, params: vParams }[page]();
  if (page === "transferts" && db.session) majVers();
}

function banniere() {
  if (!db.history.length && !db.session) return "";
  const j = db.lastBackup ? (Date.now() - new Date(db.lastBackup).getTime()) / 864e5 : null;
  if (j !== null && j < 7) return "";
  return `<div class="alert alert-anomalie no-print"><b>Sauvegarde recommandée.</b> ${j === null ? "Aucune sauvegarde n'a encore été faite." : "Dernière sauvegarde il y a " + Math.floor(j) + " jour(s)."}<div class="actions" style="margin-top:8px"><button class="btn btn-primary btn-small" onclick="exporter()">Sauvegarder maintenant</button></div></div>`;
}

/* ---------- Accueil ---------- */
function vAccueil() {
  const today = new Date().toISOString().slice(0, 10);
  const rs = db.history.filter(r => r.fin.slice(0, 10) === today);
  const sm = f => rs.reduce((a, r) => a + f(r), 0);
  const base = db.last ? db.last.bal : null;
  const tot = base ? CPT.reduce((a, c) => a + base[c.id], 0) : 0;
  const lr = db.history[0];
  const ecs = lr ? lr.comptes.reduce((a, c) => a + Math.abs(c.ecart), 0) + (lr.cash ? Math.abs(lr.cash.ecart) : 0) : 0;
  const def = lr ? lr.comptes.filter(c => c.ecart < 0).length : 0;
  const sur = lr ? lr.comptes.filter(c => c.ecart > 0).length : 0;
  const s = db.session;
  const box = (t, v, c) => `<div class="stat-box ${c || ""}"><div class="stat-title">${t}</div><div class="stat-value">${v}</div></div>`;
  return head("digisolde", "Tableau de bord · " + new Date().toLocaleDateString("fr-FR")) +
  `<div class="card"><div class="card-title"><h3>Service en cours</h3></div>${s
    ? `<p>Ouvert le ${dt(s.debut)} par <b>${esc(s.employe)}</b></p><p class="text-muted">${s.transferts.length} transfert(s) interne(s) · ${s.cash.length} mouvement(s) de cash</p>`
    : `<div class="alert alert-anomalie">Aucun service ouvert. Allez dans « Service » pour saisir les soldes de départ.</div>`}</div>
  <div class="dashboard">
    ${box("Total soldes électroniques", F(tot), "info")}
    ${box("Cash physique (théorique)", db.settings.cash && s ? F(cashCourant(s)) : "—", "info")}
    ${box("Bénéfice commercial confirmé (aujourd'hui)", F(sm(r => r.benef)), "gain")}
    ${box("Dépenses confirmées (aujourd'hui)", F(sm(r => r.dep)), "deficit")}
    ${box("Écarts à vérifier (dernier rapport)", F(ecs), "anomalie")}
    ${box("Comptes déficitaires", def, "deficit")}
    ${box("Comptes excédentaires", sur, "anomalie")}
  </div>
  <div class="alert alert-info">Un écart n'est jamais une perte ou un bénéfice confirmé tant que sa cause n'est pas établie.</div>`;
}

/* ---------- Service : ouverture et passation ---------- */
function vService() {
  if (!db.session) {
    return head("Ouverture de service", "Saisissez les soldes réels de chaque compte.") +
    `<div class="morning-box"><h3>🌅 Soldes de départ</h3>
    <div class="form-group" style="margin-bottom:15px"><label>Employé</label><input id="o_emp" placeholder="Nom de l'employé"></div>
    ${["Orange", "MTN", "Camtel"].map(r => `<div class="network-section ${RES[r]}"><h4>${r}</h4>
      ${CPT.filter(c => c.res === r).map(c => `<div class="form-group" style="margin-bottom:12px"><label>${c.nom}</label><input id="o_${c.id}" inputmode="numeric" placeholder="0"></div>`).join("")}</div>`).join("")}
    ${db.settings.cash ? `<div class="network-section network-cash"><h4>Cash</h4>${fg("o_cash", "Cash physique au début du service")}</div>` : ""}
    <div class="actions"><button class="btn btn-primary" onclick="ouvrir()">Ouvrir le service</button></div></div>`;
  }
  const s = db.session;
  return head("Passation de service", "Service ouvert le " + dt(s.debut) + ". Soldes de départ repris de la passation précédente.") +
  `<div class="evening-box"><h3>🌙 Soldes réels constatés</h3>
  <div class="form-grid" style="margin-bottom:15px"><div class="form-group"><label>Employé sortant</label><input id="r_sort" value="${esc(s.employe)}"></div>
  <div class="form-group"><label>Employé entrant</label><input id="r_ent" placeholder="Nom de l'employé entrant"></div></div>
  ${["Orange", "MTN", "Camtel"].map(r => `<div class="network-section ${RES[r]}"><h4>${r}</h4>
    ${CPT.filter(c => c.res === r).map(c => `<div class="account-row"><div class="account-name">${c.nom}<div class="text-muted">Départ : ${F(s.bal[c.id])}</div></div>
    ${fg("r_" + c.id, "Solde réel final")}${fg("x_" + c.id, EXT[c.t], "0", "decimal")}</div>`).join("")}</div>`).join("")}
  ${db.settings.cash ? `<div class="network-section network-cash"><h4>Cash</h4><div class="text-muted" style="margin-bottom:10px">Cash théorique actuel : ${F(cashCourant(s))}</div>${fg("r_cash", "Cash réellement compté")}</div>` : ""}
  <div class="form-group full"><label>Explication des écarts éventuels (facultatif)</label><textarea id="r_exp"></textarea></div>
  <div class="actions"><button class="btn btn-primary" onclick="passation()">Valider la passation</button></div></div>`;
}
function ouvrir() {
  const emp = val("o_emp").trim();
  if (!emp) return alert("Indiquez le nom de l'employé.");
  const bal = {};
  for (const c of CPT) {
    const n = num(val("o_" + c.id));
    if (n === null || n < 0) return alert("Solde invalide : " + c.nom + ". Les soldes doivent être positifs ou nuls.");
    bal[c.id] = n;
  }
  let cash = 0;
  if (db.settings.cash) { cash = num(val("o_cash")); if (cash === null || cash < 0) return alert("Cash invalide."); }
  db.session = { debut: new Date().toISOString(), employe: emp, bal, cashInit: cash, transferts: [], cash: [] };
  db.last = { bal: Object.assign({}, bal), cash };
  save(); notify("Service ouvert."); go("accueil");
}
function passation() {
  const s = db.session;
  const ent = val("r_ent").trim(), sort = val("r_sort").trim();
  if (!ent || !sort) return alert("Indiquez l'employé sortant et l'employé entrant.");
  const reel = {}, ext = {};
  for (const c of CPT) {
    const r = num(val("r_" + c.id));
    if (r === null || r < 0) return alert("Solde final invalide : " + c.nom);
    let x = num(val("x_" + c.id)); if (x === null) x = 0;
    if (c.t === "c" && x < 0) return alert("Commissions générées négatives refusées : " + c.nom);
    reel[c.id] = r; ext[c.id] = x;
  }
  let cashReel = 0;
  if (db.settings.cash) { cashReel = num(val("r_cash")); if (cashReel === null || cashReel < 0) return alert("Cash compté invalide."); }
  const k = calcul(s, reel, ext, cashReel);
  const fin = new Date().toISOString();
  db.history.unshift(Object.assign({
    id: fin, debut: s.debut, fin, boutique: db.settings.boutique, sortant: sort, entrant: ent,
    explication: val("r_exp").trim(), transferts: s.transferts.slice(), cashMvts: s.cash.slice(), corrections: []
  }, k));
  db.last = { bal: Object.assign({}, reel), cash: cashReel };
  db.session = { debut: fin, employe: ent, bal: Object.assign({}, reel), cashInit: cashReel, transferts: [], cash: [] };
  save(); notify("Passation validée."); page = "rapports"; ouvert = 0; render();
}

/* ---------- Transferts entre comptes ---------- */
function vTransferts() {
  const s = db.session;
  if (!s) return head("Transferts entre comptes") + `<div class="alert alert-anomalie">Ouvrez d'abord un service.</div>`;
  const lst = s.transferts.map(t => `<tr><td>${dt(t.t)}</td><td>${esc(t.deNom)} → ${esc(t.versNom)}</td><td class="money">${F(t.deb)}</td><td class="money">${F(t.cred)}</td><td>${esc(t.motif)}</td></tr>`).join("");
  return head("Transferts entre comptes", "Mouvements internes : ils ne sont ni des recettes ni des dépenses.") +
  `<div class="card"><div class="card-title"><h3>Nouveau transfert</h3></div>
  <div class="form-grid">
   <div class="form-group"><label>Compte de départ</label><select id="t_de" onchange="majVers()">${CPT.map(c => `<option value="${c.id}">${c.nom}</option>`).join("")}</select></div>
   <div class="form-group"><label>Compte d'arrivée</label><select id="t_vers" onchange="majApercu()"></select></div>
   ${fg("t_deb", "Montant débité").replace('placeholder="0"', 'placeholder="0" oninput="majApercu()"')}
   <div class="form-group"><label>Motif</label><input id="t_motif" placeholder="Motif du transfert"></div>
  </div>
  <div class="credit-advantage"><h4>Aperçu</h4><div id="t_apercu" class="credit-formula"></div></div>
  <div class="actions"><button class="btn btn-primary" onclick="ajouterTransfert()">Enregistrer le transfert</button></div></div>
  <div class="card"><div class="card-title"><h3>Transferts du service</h3></div>${lst
    ? `<div class="table-container"><table><thead><tr><th>Heure</th><th>Trajet</th><th>Débité</th><th>Crédité</th><th>Motif</th></tr></thead><tbody>${lst}</tbody></table></div>`
    : `<div class="empty-state"><h3>Aucun transfert</h3><p>Les transferts déclarés apparaîtront ici.</p></div>`}</div>`;
}
function majVers() {
  const de = cptOf(val("t_de")); const sel = $("#t_vers"); if (!de || !sel) return;
  const o = CPT.filter(c => c.res === de.res && c.id !== de.id).map(c => `<option value="${c.id}">${c.nom}</option>`);
  if (db.settings.cash && de.t === "c") o.push(`<option value="cash">Espèces (retrait de commissions)</option>`);
  sel.innerHTML = o.join(""); majApercu();
}
function creditPour(de, vers, deb) {
  return (de === "om_p" && vers === "om_cr") ? Math.round(deb * (1 + db.settings.taux / 100)) : deb;
}
function majApercu() {
  const el = $("#t_apercu"); if (!el) return;
  const deb = num(val("t_deb")); const de = val("t_de"), vers = val("t_vers");
  if (!deb || deb <= 0) { el.textContent = "Saisissez un montant."; return; }
  const cr = creditPour(de, vers, deb);
  el.innerHTML = cr !== deb
    ? `Crédit obtenu = ${F(deb)} × ${(1 + db.settings.taux / 100).toFixed(2)} = <b>${F(cr)}</b><br>Gain théorique de conversion = <b>${F(cr - deb)}</b>`
    : `Montant crédité = <b>${F(cr)}</b> (transfert interne, aucun gain)`;
}
function ajouterTransfert() {
  const de = val("t_de"), vers = val("t_vers"), deb = num(val("t_deb")), motif = val("t_motif").trim();
  if (!vers || de === vers) return alert("Choisissez deux comptes différents.");
  if (deb === null || deb <= 0) return alert("Montant invalide : il doit être positif.");
  if (!motif) return alert("Indiquez le motif.");
  const cred = creditPour(de, vers, deb);
  db.session.transferts.push({ t: new Date().toISOString(), de, vers, deNom: cptOf(de).nom, versNom: vers === "cash" ? "Espèces" : cptOf(vers).nom, deb, cred, motif, emp: db.session.employe });
  save(); notify("Transfert enregistré."); render();
}

/* ---------- Cash et dépenses ---------- */
function vCash() {
  if (!db.settings.cash) return head("Cash et dépenses") + `<div class="alert alert-info">Le module cash est désactivé dans les paramètres.</div>`;
  const s = db.session;
  if (!s) return head("Cash et dépenses") + `<div class="alert alert-anomalie">Ouvrez d'abord un service.</div>`;
  const T = { in: "Entrée espèces", out: "Sortie espèces", dep: "Dépense" };
  const lst = s.cash.map(m => `<div class="dynamic-item"><span>${dt(m.t)} · ${T[m.type]} · ${esc(m.motif)}</span><b class="money">${F(m.montant)}</b></div>`).join("");
  return head("Cash et dépenses", "Cash physique distinct des soldes électroniques.") +
  `<div class="stat-box info" style="margin-bottom:20px"><div class="stat-title">Cash théorique actuel</div><div class="stat-value">${F(cashCourant(s))}</div></div>
  <div class="expense-box"><h3>Nouveau mouvement</h3><div class="form-grid">
   <div class="form-group"><label>Type</label><select id="c_type"><option value="in">Entrée espèces</option><option value="out">Sortie espèces</option><option value="dep">Dépense (charge)</option></select></div>
   ${fg("c_m", "Montant")}
   <div class="form-group full"><label>Motif</label><input id="c_motif" placeholder="Motif"></div></div>
  <div class="actions"><button class="btn btn-primary" onclick="ajouterCash()">Enregistrer</button></div></div>
  <div class="card"><div class="card-title"><h3>Mouvements du service</h3><p>Les retraits de commissions en espèces s'enregistrent dans Transferts.</p></div>
  ${lst ? `<div class="dynamic-list">${lst}</div>` : `<div class="empty-state"><h3>Aucun mouvement</h3></div>`}</div>`;
}
function ajouterCash() {
  const m = num(val("c_m")), motif = val("c_motif").trim();
  if (m === null || m <= 0) return alert("Montant invalide : il doit être positif.");
  if (!motif) return alert("Indiquez le motif.");
  db.session.cash.push({ t: new Date().toISOString(), type: val("c_type"), montant: m, motif, emp: db.session.employe });
  save(); notify("Mouvement enregistré."); render();
}

/* ---------- Statistiques : courbes semaine / mois / année ---------- */
let statsMode = "mois";
function setStats(m) { statsMode = m; render(); }
const pad2 = n => String(n).padStart(2, "0");
function cle(d, mode) {
  if (mode === "annee") return String(d.getFullYear());
  if (mode === "mois") return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getFullYear() + "-" + pad2(x.getMonth() + 1) + "-" + pad2(x.getDate());
}
function lib(k, mode) {
  if (mode === "annee") return k;
  if (mode === "mois") { const p = k.split("-"); return ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"][p[1] - 1] + " " + p[0].slice(2); }
  const p = k.split("-"); return p[2] + "/" + p[1];
}
function serie(mode) {
  const g = {};
  db.history.slice().reverse().forEach(r => {
    const k = cle(new Date(r.fin), mode);
    const o = g[k] || (g[k] = { gain: 0, val: 0 });
    o.gain += r.benef;
    o.val = r.comptes.reduce((a, c) => a + c.reel, 0) + (r.cash ? r.cash.reel : 0);
  });
  const keys = Object.keys(g).sort();
  return keys.slice(mode === "annee" ? -keys.length : -12).map(k => ({ l: lib(k, mode), gain: g[k].gain, val: g[k].val }));
}
function abr(v) {
  const a = Math.abs(v);
  const s = a >= 1e6 ? (a / 1e6).toFixed(1).replace(".0", "") + " M" : a >= 1e3 ? Math.round(a / 1e3) + " k" : String(Math.round(a));
  return (v < 0 ? "−" : "") + s;
}
function courbe(vals, labs) {
  if (!vals.length) return `<div class="empty-state"><h3>Aucune donnée</h3><p>Les courbes apparaîtront après la première passation validée.</p></div>`;
  const W = 600, H = 240, L = 58, R = 14, T = 14, B = 34, VERT = "#0b7d35", ROUGE = "#c62828";
  let mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  if (mn === mx) { mn -= 1; mx += 1; }
  const p = (mx - mn) * 0.1; mn -= p; mx += p;
  const n = vals.length;
  const X = i => n === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (n - 1);
  const Y = v => T + (mx - v) * (H - T - B) / (mx - mn);
  let g = "";
  for (let i = 0; i <= 3; i++) {
    const v = mn + (mx - mn) * i / 3, y = Y(v);
    g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#e3e9e5"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#68736d">${abr(v)}</text>`;
  }
  if (mn < 0 && mx > 0) g += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#68736d" stroke-dasharray="4 3"/>`;
  for (let i = 1; i < n; i++) {
    g += `<line x1="${X(i - 1)}" y1="${Y(vals[i - 1])}" x2="${X(i)}" y2="${Y(vals[i])}" stroke="${vals[i] >= vals[i - 1] ? VERT : ROUGE}" stroke-width="3" stroke-linecap="round"/>`;
  }
  const step = Math.ceil(n / 6);
  for (let i = 0; i < n; i++) {
    const c = i === 0 || vals[i] >= vals[i - 1] ? VERT : ROUGE;
    g += `<circle cx="${X(i)}" cy="${Y(vals[i])}" r="4" fill="${c}"/>`;
    if (i % step === 0 || i === n - 1) g += `<text x="${X(i)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="#68736d">${esc(labs[i])}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${g}</svg>`;
}
function vStats() {
  const pts = serie(statsMode);
  const lab = { semaine: "par semaine", mois: "par mois", annee: "par an" }[statsMode];
  const bt = (m, t) => `<button class="btn ${statsMode === m ? "btn-primary" : "btn-secondary"} btn-small" onclick="setStats('${m}')">${t}</button>`;
  const info = vals => {
    if (vals.length < 2) return "";
    const d = vals[vals.length - 1] - vals[vals.length - 2];
    return `<p class="${d >= 0 ? "text-green" : "text-red"}"><b>${d >= 0 ? "▲ +" : "▼ "}${F(d)}</b> par rapport à la période précédente</p>`;
  };
  const gains = pts.map(x => x.gain), vals = pts.map(x => x.val), labs = pts.map(x => x.l);
  return head("Statistiques", "Courbes " + lab + " · vert : en hausse, rouge : en baisse") +
  `<div class="actions" style="margin-bottom:15px">${bt("semaine", "Semaine")}${bt("mois", "Mois")}${bt("annee", "Année")}</div>
  <div class="card"><div class="card-title"><h3>Évolution des gains</h3><p>Bénéfice commercial confirmé, ${lab}</p></div>${courbe(gains, labs)}${info(gains)}</div>
  <div class="card"><div class="card-title"><h3>Évolution de l'entreprise</h3><p>Valeur totale (soldes électroniques + cash) à la fin de chaque période</p></div>${courbe(vals, labs)}${info(vals)}</div>`;
}

/* ---------- Rapports et historique ---------- */
function rapHTML(r) {
  const lignes = r.comptes.map(c => `<tr><td>${c.nom}</td><td class="money text-blue">${F(c.debut)}</td><td class="money text-blue">${F(c.theo)}</td><td class="money text-blue">${F(c.reel)}</td><td class="money ${cls(c.ecart)}">${c.ecart > 0 ? "+" : ""}${F(c.ecart)}</td></tr>`).join("");
  const ecarts = r.comptes.filter(c => c.ecart !== 0).map(c => {
    const a = Math.abs(c.ecart);
    const titre = c.ecart < 0 ? `DÉFICIT DE ${F(a)} — ${c.nom.toUpperCase()}` : `SURPLUS DE ${F(a)} — ${c.nom.toUpperCase()}`;
    const fin = r.explication ? `Explication saisie : ${esc(r.explication)}` : (c.ecart < 0 ? `PERTE INEXPLIQUÉE : ${F(a)}` : `GAIN OU SURPLUS INEXPLIQUÉ : ${F(a)}`);
    return `<div class="alert ${c.ecart < 0 ? "alert-danger" : "alert-anomalie"}"><b>${titre}</b><br>${fin}<br><span class="text-muted">${HYP}</span></div>`;
  }).join("");
  const dets = r.comptes.filter(c => c.ecart < 0).map(c => `Un déficit de ${F(-c.ecart)} est constaté sur ${c.nom}.`).concat(r.comptes.filter(c => c.ecart > 0).map(c => `Un surplus de ${F(c.ecart)} est constaté sur ${c.nom}.`));
  if (r.cash && r.cash.ecart !== 0) dets.push(`Un écart de caisse de ${F(r.cash.ecart)} est constaté.`);
  const eq = dets.length === 0;
  const totD = r.comptes.reduce((a, c) => a + c.debut, 0), totF = r.comptes.reduce((a, c) => a + c.reel, 0);
  const item = (l, v, c) => `<div class="calculation-item"><div class="label">${l}</div><div class="value ${c || ""}">${v}</div></div>`;
  return `<div class="section-divider"></div>
  <div class="calculation-grid">
   ${item("Total soldes initiaux", F(totD), "text-blue")}${item("Total soldes finaux", F(totF), "text-blue")}${item("Gains de conversion", F(r.gainConv), "text-green")}
   ${item("Commissions générées déclarées", F(r.comm), "text-green")}${item("Bénéfice commercial confirmé", F(r.benef), "text-green")}${item("Dépenses", F(r.dep), "text-red")}
  </div>
  <div class="result-grid"><div class="result-card result-principal"><h3>Résultat net confirmé</h3><div class="result-number ${r.net < 0 ? "result-perte" : "result-gain"}">${F(r.net)}</div><div class="result-label">Bénéfice confirmé − dépenses</div></div>
  <div class="result-card result-faux"><h3>Écarts à vérifier</h3><div class="result-number">${F(r.comptes.reduce((a, c) => a + Math.abs(c.ecart), 0))}</div><div class="result-label">Non assimilés à une perte ou un gain</div></div></div>
  <div class="table-container"><table><thead><tr><th>Compte</th><th>Départ</th><th>Théorique</th><th>Réel</th><th>Écart</th></tr></thead><tbody>${lignes}</tbody></table></div>
  ${r.cash ? `<div class="network-section network-cash" style="margin-top:15px"><h4>Cash</h4><div class="cash-detail-grid"><div class="calculation-item"><div class="label">Initial</div><div class="value">${F(r.cash.init)}</div></div><div class="calculation-item"><div class="label">Théorique final</div><div class="value">${F(r.cash.theo)}</div></div><div class="calculation-item"><div class="label">Réel final</div><div class="value">${F(r.cash.reel)}</div></div><div class="calculation-item"><div class="label">Écart de caisse</div><div class="value ${cls(r.cash.ecart)}">${F(r.cash.ecart)}</div></div></div></div>` : ""}
  <div style="margin-top:15px">${ecarts}</div>
  <div class="closure-box ${eq ? "" : "anomalie"}"><h3>${eq ? "PASSATION ÉQUILIBRÉE." : "PASSATION PARTIELLEMENT ÉQUILIBRÉE."}</h3>
  <p>Le bénéfice commercial confirmé est de ${F(r.benef)}.</p>${dets.map(d => `<p>${d}</p>`).join("")}${eq ? "" : `<p>Les causes de ces écarts restent à confirmer.</p><p class="text-muted">Ne pas assimiler automatiquement les écarts constatés aux pertes ou bénéfices définitifs de la boutique.</p>`}</div>
  ${r.corrections.length ? `<div class="dynamic-list">${r.corrections.map(c => `<div class="dynamic-item"><span>${dt(c.date)} · ${esc(c.auteur)} · ${esc(c.texte)}</span></div>`).join("")}</div>` : ""}`;
}
function vRapports() {
  const f = val("f_date");
  const lst = db.history.map((r, i) => ({ r, i })).filter(x => !f || x.r.fin.slice(0, 10) === f);
  return head("Rapports et historique", "Chaque passation validée est conservée.") +
  `<div class="card no-print"><div class="form-group"><label>Rechercher une journée</label><input type="date" id="f_date" value="${esc(f)}" onchange="render()"></div></div>
  ${lst.length ? lst.map(x => `<div class="history-card"><div class="history-header"><div><div class="history-date">${dt(x.r.fin)}</div><div class="history-employee">${esc(x.r.sortant)} → ${esc(x.r.entrant)} · ${esc(x.r.boutique)}</div></div>
  <div class="history-result ${x.r.net < 0 ? "text-red" : "text-green"}">${F(x.r.net)}</div></div>
  <div class="history-details"><div class="history-detail"><span>Bénéfice confirmé</span><strong>${F(x.r.benef)}</strong></div><div class="history-detail"><span>Dépenses</span><strong>${F(x.r.dep)}</strong></div>
  <div class="history-detail"><span>Comptes en déficit</span><strong>${x.r.comptes.filter(c => c.ecart < 0).length}</strong></div><div class="history-detail"><span>Comptes en surplus</span><strong>${x.r.comptes.filter(c => c.ecart > 0).length}</strong></div></div>
  <div class="actions no-print"><button class="btn btn-secondary btn-small" onclick="ouvert=${ouvert === x.i ? "null" : x.i};render()">${ouvert === x.i ? "Masquer le rapport" : "Voir le rapport"}</button>
  ${ouvert === x.i ? `<button class="btn btn-secondary btn-small" onclick="window.print()">Imprimer / PDF</button><button class="btn btn-secondary btn-small" onclick="corriger(${x.i})">Ajouter une correction</button>` : ""}</div>
  ${ouvert === x.i ? rapHTML(x.r) : ""}</div>`).join("") : `<div class="card"><div class="empty-state"><h3>Aucun rapport</h3><p>Aucune passation ne correspond à cette recherche.</p></div></div>`}`;
}
function corriger(i) {
  const texte = prompt("Décrivez la correction et sa justification :");
  if (!texte || !texte.trim()) return;
  const auteur = (db.session && db.session.employe) || "Gérant";
  db.history[i].corrections.push({ date: new Date().toISOString(), auteur, texte: texte.trim() });
  save(); notify("Correction enregistrée."); render();
}

/* ---------- Paramètres, sauvegarde, restauration ---------- */
function vParams() {
  return head("Paramètres") +
  `<div class="settings-section"><h3>Boutique et calculs</h3><div class="form-grid">
   <div class="form-group"><label>Nom de la boutique</label><input id="p_nom" value="${esc(db.settings.boutique)}"></div>
   <div class="form-group"><label>Taux Orange principal → crédit (%)</label><input id="p_taux" inputmode="decimal" value="${db.settings.taux}"></div>
   <div class="form-group"><label>Module cash physique</label><select id="p_cash"><option value="1" ${db.settings.cash ? "selected" : ""}>Activé</option><option value="0" ${db.settings.cash ? "" : "selected"}>Désactivé</option></select></div></div>
  <div class="actions"><button class="btn btn-primary" onclick="enregParams()">Enregistrer les paramètres</button></div></div>
  <div class="settings-section"><h3>Sauvegarde et restauration</h3>
  <div class="alert alert-anomalie">Les données sont dans le navigateur de ce téléphone. Ce n'est pas une sauvegarde infaillible : exportez régulièrement un fichier JSON.</div>
  <p class="text-muted">Dernière sauvegarde : ${db.lastBackup ? dt(db.lastBackup) : "aucune"}</p>
  <p class="text-muted">Stockage protégé par le téléphone : ${persiste === null ? "non vérifié" : persiste ? "oui" : "non (le navigateur peut le nettoyer en cas de manque de place)"}</p>
  <div class="actions"><button class="btn btn-primary" onclick="exporter()">Exporter la sauvegarde (JSON)</button></div>
  <div class="form-group" style="margin-top:15px"><label>Restaurer depuis un fichier JSON</label><input type="file" id="p_file" accept=".json,application/json" onchange="importer(this)"></div></div>`;
}
function enregParams() {
  const t = num(val("p_taux"));
  if (t === null || t < 0) return alert("Taux invalide.");
  const nom = val("p_nom").trim();
  if (!nom) return alert("Indiquez le nom de la boutique.");
  db.settings = { boutique: nom, taux: t, cash: val("p_cash") === "1" };
  save(); render(); notify("Paramètres enregistrés.");
}
function exporter() {
  db.lastBackup = new Date().toISOString(); save();
  const b = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = "digisolde-sauvegarde-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  notify("Sauvegarde exportée."); render();
}
function importer(inp) {
  const f = inp.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || !d.settings || !Array.isArray(d.history)) throw new Error("format");
      if (!confirm("Remplacer toutes les données actuelles par cette sauvegarde ?")) return;
      db = d; save(); notify("Sauvegarde restaurée."); go("accueil");
    } catch (e) { alert("Fichier de sauvegarde invalide."); }
  };
  rd.readAsText(f);
}

let persiste = null;
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(ok => { persiste = ok; if (page === "params") render(); }).catch(() => {});
}
render();
