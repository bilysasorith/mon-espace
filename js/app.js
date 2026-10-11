/* Mon espace : pense-bête, objectifs, finances, recherches.
   Tout est stocké dans le navigateur (localStorage). Export/import JSON depuis « Données ». */
(function () {
  'use strict';

  /* ---------- Stockage ---------- */
  const KEY = 'monEspace.v1';
  const DEFAULT_CATEGORIES = {
    revenu: ['Salaire', 'Freelance', 'Aides', 'Remboursements', 'Cadeaux', 'Autres revenus'],
    depense: ['Logement', 'Courses', 'Restaurants', 'Transport', 'Abonnements', 'Shopping', 'Beauté & soins',
      'Santé', 'Loisirs', 'Voyages', 'Épargne', 'Impôts', 'Autres dépenses']
  };
  const DEFAULT_RULES = [
    ['carrefour', 'Courses'], ['monoprix', 'Courses'], ['lidl', 'Courses'], ['franprix', 'Courses'], ['auchan', 'Courses'],
    ['leclerc', 'Courses'], ['picard', 'Courses'], ['uber eats', 'Restaurants'], ['deliveroo', 'Restaurants'],
    ['mcdo', 'Restaurants'], ['sncf', 'Transport'], ['ratp', 'Transport'], ['navigo', 'Transport'], ['uber', 'Transport'],
    ['total', 'Transport'], ['netflix', 'Abonnements'], ['spotify', 'Abonnements'], ['free mobile', 'Abonnements'],
    ['amazon prime', 'Abonnements'], ['sephora', 'Beauté & soins'], ['nocibe', 'Beauté & soins'],
    ['pharmacie', 'Santé'], ['loyer', 'Logement'], ['edf', 'Logement'], ['zara', 'Shopping'], ['amazon', 'Shopping'],
    ['salaire', 'Salaire'], ['caf', 'Aides']
  ].map(([keyword, category]) => ({ keyword, category }));

  function emptyState() {
    return {
      version: 1,
      notes: [],
      goals: [],
      finance: {
        transactions: [],
        categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
        rules: DEFAULT_RULES.map(r => ({ ...r }))
      },
      research: [],
      appointments: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyState();
      return normalize(JSON.parse(raw));
    } catch (e) {
      console.error(e);
      return emptyState();
    }
  }

  function normalize(s) {
    const base = emptyState();
    if (!s || typeof s !== 'object') return base;
    const f = s.finance || {};
    return {
      version: 1,
      notes: Array.isArray(s.notes) ? s.notes : [],
      goals: Array.isArray(s.goals) ? s.goals : [],
      finance: {
        transactions: Array.isArray(f.transactions) ? f.transactions : [],
        categories: f.categories && f.categories.revenu && f.categories.depense ? f.categories : base.finance.categories,
        rules: Array.isArray(f.rules) ? f.rules : base.finance.rules
      },
      research: Array.isArray(s.research) ? s.research : [],
      appointments: Array.isArray(s.appointments) ? s.appointments : []
    };
  }

  let state = load();
  let saveOk = true;
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      saveOk = true;
    } catch (e) {
      if (saveOk) toast('Impossible d’enregistrer dans ce navigateur. Exporte tes données pour ne rien perdre.');
      saveOk = false;
    }
  }

  /* ---------- Utilitaires ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const money = n => eur.format(n || 0);
  const pad = n => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const monthKey = d => d.slice(0, 7);
  const currentMonth = () => todayISO().slice(0, 7);
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const monthLabel = mk => { const [y, m] = mk.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
  const shiftMonth = (mk, delta) => { let [y, m] = mk.split('-').map(Number); m += delta; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${pad(m)}`; };
  const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const daysUntil = iso => { const a = new Date(todayISO() + 'T00:00'); const b = new Date(iso + 'T00:00'); return Math.round((b - a) / 86400000); };

  function dueTag(iso) {
    if (!iso) return '';
    const n = daysUntil(iso);
    let cls = '', txt = fmtDate(iso);
    if (n < 0) { cls = 'late'; txt = `En retard · ${fmtDate(iso)}`; }
    else if (n === 0) { cls = 'soon'; txt = 'Aujourd’hui'; }
    else if (n === 1) { cls = 'soon'; txt = 'Demain'; }
    else if (n <= 7) { cls = 'soon'; txt = `Dans ${n} j · ${fmtDate(iso)}`; }
    return `<span class="tag ${cls}">${esc(txt)}</span>`;
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- Modale ---------- */
  const modal = $('#modal');
  function openModal(html, { wide = false, onSubmit, onOpen } = {}) {
    modal.className = 'modal' + (wide ? ' wide' : '');
    modal.innerHTML = html;
    const form = $('form', modal);
    if (form && onSubmit) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        if (onSubmit(data, form) !== false) closeModal();
      });
    }
    $$('[data-close]', modal).forEach(b => b.addEventListener('click', closeModal));
    modal.showModal();
    if (onOpen) onOpen(modal);
    const first = $('input:not([type=hidden]):not([type=checkbox]), textarea, select', modal);
    if (first) first.focus();
  }
  function closeModal() { if (modal.open) modal.close(); }
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  function confirmBox(message, onYes, yesLabel = 'Supprimer') {
    openModal(`
      <div class="modal-body">
        <h2 class="modal-title">Confirmer</h2>
        <p>${esc(message)}</p>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Annuler</button>
          <button type="button" class="btn primary" id="yesBtn">${esc(yesLabel)}</button>
        </div>
      </div>`);
    $('#yesBtn', modal).addEventListener('click', () => { closeModal(); onYes(); });
  }

  /* ---------- Routeur ---------- */
  const view = $('#view');
  const routes = {
    'accueil': renderHome,
    'pense-bete': renderNotes,
    'rendez-vous': renderAppointments,
    'objectifs': renderGoals,
    'finances': renderFinance,
    'recherches': renderResearch,
    'donnees': renderData
  };
  function currentRoute() {
    const h = location.hash.replace(/^#/, '');
    const [name, ...rest] = h.split('/');
    return { name: routes[name] ? name : 'accueil', arg: rest.join('/') };
  }
  function render() {
    const r = currentRoute();
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === r.name));
    routes[r.name](r.arg);
  }
  window.addEventListener('hashchange', () => { render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });

  /* ---------- Thème ---------- */
  const THEME_KEY = 'monEspace.theme';
  function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
  try { applyTheme(localStorage.getItem(THEME_KEY)); } catch (e) { /* ignore */ }
  $('#themeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    if (currentRoute().name === 'finances' || currentRoute().name === 'accueil') render();
  });

  /* =========================================================
     ACCUEIL
     ========================================================= */
  function renderHome() {
    const h = new Date().getHours();
    const hello = h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir';
    const d = new Date();
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const todo = state.notes.filter(n => !n.done)
      .sort((a, b) => (b.pinned - a.pinned) || ((a.due || '9999') < (b.due || '9999') ? -1 : 1));
    const goals = state.goals.filter(g => goalProgress(g) < 1).sort((a, b) => goalProgress(b) - goalProgress(a));
    const mk = currentMonth();
    const m = monthTotals(mk);
    const upcoming = state.appointments.map(a => ({ a, st: apptStatus(a) })).filter(x => x.st.order <= 30).sort((x, y) => x.st.order - y.st.order).slice(0, 5);

    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="hello">${hello} 👋</h1>
          <p class="muted" style="text-transform:capitalize">${esc(dateStr)}</p>
        </div>
      </div>
      <div class="grid grid-2">
        <section class="card">
          <div class="card-head"><h2>À faire</h2><a class="link-more" href="#pense-bete">Tout voir →</a></div>
          ${todo.length ? `<ul class="home-list">${todo.slice(0, 6).map(n => `
            <li><span>${n.pinned ? '📌 ' : ''}${esc(n.title || n.text.split('\n')[0])}</span>${dueTag(n.due)}</li>`).join('')}</ul>`
            : '<div class="empty">Rien à faire pour l’instant.</div>'}
        </section>
        <section class="card">
          <div class="card-head"><h2>Rendez-vous</h2><a class="link-more" href="#rendez-vous">Tout voir →</a></div>
          ${upcoming.length ? `<ul class="home-list">${upcoming.map(({ a, st }) => `<li><span>${esc(a.name)}</span>${st.html}</li>`).join('')}</ul>`
            : '<div class="empty">Rien à prévoir dans les 30 prochains jours.</div>'}
        </section>
        <section class="card">
          <div class="card-head"><h2>Objectifs en cours</h2><a class="link-more" href="#objectifs">Tout voir →</a></div>
          ${goals.length ? `<div class="stack" style="gap:14px">${goals.slice(0, 4).map(g => {
            const p = goalProgress(g);
            return `<div class="home-goal"><div style="display:flex;justify-content:space-between"><span>${esc(g.title)}</span><span class="muted num">${Math.round(p * 100)} %</span></div>
              <div class="progress"><span style="width:${p * 100}%"></span></div></div>`;
          }).join('')}</div>` : '<div class="empty">Aucun objectif en cours.</div>'}
        </section>
        <section class="card">
          <div class="card-head"><h2 style="text-transform:capitalize">Finances · ${esc(monthLabel(mk))}</h2><a class="link-more" href="#finances">Détails →</a></div>
          <div class="grid grid-3">
            <div class="kpi"><div class="label">Revenus</div><div class="value num" style="font-size:20px">${eur0.format(m.revenu)}</div></div>
            <div class="kpi"><div class="label">Dépenses</div><div class="value num" style="font-size:20px">${eur0.format(m.depense)}</div></div>
            <div class="kpi"><div class="label">Solde</div><div class="value num ${m.solde >= 0 ? 'pos' : 'neg'}" style="font-size:20px">${eur0.format(m.solde)}</div></div>
          </div>
        </section>
        <section class="card" style="grid-column:1/-1">
          <div class="card-head"><h2>Recherches récentes</h2><a class="link-more" href="#recherches">Tout voir →</a></div>
          ${state.research.length ? `<ul class="home-list">${state.research.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5).map(r => `
            <li><a href="#recherches/${esc(r.id)}">${esc(r.title)}</a><span class="muted small">${r.items.length} élément${r.items.length > 1 ? 's' : ''}</span></li>`).join('')}</ul>`
            : '<div class="empty">Aucun benchmark pour l’instant.</div>'}
        </section>
      </div>
      ${isEmpty() ? `<div class="card" style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div><h3>Tout est vide</h3><p class="muted small" style="margin:4px 0 0">Tu peux charger des exemples pour voir à quoi ressemble chaque page, puis tout effacer depuis « Données ».</p></div>
        <button class="btn" id="loadDemo">Charger des exemples</button></div>` : ''}
    `;
    const demo = $('#loadDemo');
    if (demo) demo.addEventListener('click', () => { loadDemo(); render(); toast('Exemples chargés'); });
  }

  function isEmpty() {
    return !state.notes.length && !state.goals.length && !state.finance.transactions.length && !state.research.length && !state.appointments.length;
  }

  /* =========================================================
     PENSE-BÊTE
     ========================================================= */
  let notesFilter = 'todo';
  let notesSearch = '';

  function renderNotes() {
    const tags = [...new Set(state.notes.map(n => n.tag).filter(Boolean))].sort();
    let list = state.notes.slice();
    if (notesFilter === 'todo') list = list.filter(n => !n.done);
    else if (notesFilter === 'done') list = list.filter(n => n.done);
    else if (notesFilter.startsWith('tag:')) list = list.filter(n => n.tag === notesFilter.slice(4));
    if (notesSearch) {
      const q = notesSearch.toLowerCase();
      list = list.filter(n => ((n.title || '') + ' ' + n.text + ' ' + (n.tag || '')).toLowerCase().includes(q));
    }
    list.sort((a, b) => (a.done - b.done) || (b.pinned - a.pinned) ||
      ((a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0) ||
      (b.createdAt - a.createdAt));

    const count = state.notes.filter(n => !n.done).length;
    view.innerHTML = `
      <div class="page-head">
        <div><h1>Pense-bête</h1><p class="muted">${count} chose${count > 1 ? 's' : ''} à faire</p></div>
        <div class="toolbar">
          <input class="input" id="noteSearch" type="search" placeholder="Rechercher…" value="${esc(notesSearch)}" style="width:200px">
          <button class="btn primary" id="newNote">+ Note détaillée</button>
        </div>
      </div>
      <form class="quick-add" id="quickNote">
        <input class="input" name="text" placeholder="Ajouter rapidement… (Entrée pour valider)" autocomplete="off">
        <input class="input" name="due" type="date" style="flex:0 0 160px" title="Échéance (optionnel)">
        <button class="btn" type="submit">Ajouter</button>
      </form>
      <div class="toolbar" style="margin-bottom:14px">
        <div class="seg" id="noteFilters">
          ${[['todo', 'À faire'], ['done', 'Faits'], ['all', 'Tout']].map(([k, l]) => `<button data-f="${k}" class="${notesFilter === k ? 'active' : ''}">${l}</button>`).join('')}
        </div>
        ${tags.map(t => `<button class="btn sm ${notesFilter === 'tag:' + t ? 'primary' : ''}" data-f="tag:${esc(t)}">#${esc(t)}</button>`).join('')}
      </div>
      <div class="notes-list">
        ${list.length ? list.map(noteHTML).join('') : `<div class="empty">${notesFilter === 'done' ? 'Rien de terminé pour l’instant.' : 'Aucune note ici.'}</div>`}
      </div>
    `;

    $('#quickNote').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const text = (fd.get('text') || '').trim();
      if (!text) return;
      state.notes.push({ id: uid(), title: '', text, due: fd.get('due') || '', tag: '', done: false, pinned: false, createdAt: Date.now() });
      save();
      renderNotes();
      $('#quickNote input[name=text]').focus();
    });
    $('#newNote').addEventListener('click', () => noteForm());
    const search = $('#noteSearch');
    search.addEventListener('input', () => {
      notesSearch = search.value;
      const pos = search.selectionStart;
      renderNotes();
      const s = $('#noteSearch'); s.focus(); s.setSelectionRange(pos, pos);
    });
    $$('[data-f]', view).forEach(b => b.addEventListener('click', () => {
      notesFilter = notesFilter === b.dataset.f && b.dataset.f.startsWith('tag:') ? 'all' : b.dataset.f;
      renderNotes();
    }));
    $$('.note', view).forEach(el => {
      const n = state.notes.find(x => x.id === el.dataset.id);
      $('[data-act=done]', el).addEventListener('change', e => { n.done = e.target.checked; save(); renderNotes(); });
      $('[data-act=pin]', el).addEventListener('click', () => { n.pinned = !n.pinned; save(); renderNotes(); });
      $('[data-act=edit]', el).addEventListener('click', () => noteForm(n));
      $('[data-act=del]', el).addEventListener('click', () => {
        state.notes = state.notes.filter(x => x !== n); save(); renderNotes(); toast('Note supprimée');
      });
    });
  }

  function noteHTML(n) {
    return `
      <div class="note ${n.done ? 'done' : ''} ${n.pinned ? 'pinned' : ''}" data-id="${esc(n.id)}">
        <input type="checkbox" data-act="done" ${n.done ? 'checked' : ''} aria-label="Marquer comme fait" style="margin-top:3px">
        <div>
          ${n.title ? `<div class="note-title">${esc(n.title)}</div>` : ''}
          ${n.text ? `<div class="note-text">${linkify(esc(n.text))}</div>` : ''}
          ${(n.due || n.tag) ? `<div class="note-meta">${n.done ? '' : dueTag(n.due)}${n.tag ? `<span class="tag">#${esc(n.tag)}</span>` : ''}</div>` : ''}
        </div>
        <div class="note-actions">
          <button class="icon-btn ${n.pinned ? 'on' : ''}" data-act="pin" title="${n.pinned ? 'Désépingler' : 'Épingler'}">${n.pinned ? '★' : '☆'}</button>
          <button class="icon-btn" data-act="edit" title="Modifier">✎</button>
          <button class="icon-btn" data-act="del" title="Supprimer">✕</button>
        </div>
      </div>`;
  }

  function linkify(s) {
    return s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  function noteForm(n) {
    const tags = [...new Set(state.notes.map(x => x.tag).filter(Boolean))];
    openModal(`
      <form>
        <h2 class="modal-title">${n ? 'Modifier la note' : 'Nouvelle note'}</h2>
        <div class="form-grid">
          <div class="field full"><label>Titre</label><input class="input" name="title" value="${esc(n ? n.title : '')}"></div>
          <div class="field full"><label>Contenu (optionnel)</label><textarea class="input" name="text">${esc(n ? n.text : '')}</textarea></div>
          <div class="field"><label>Échéance</label><input class="input" type="date" name="due" value="${esc(n ? n.due : '')}"></div>
          <div class="field"><label>Étiquette</label><input class="input" name="tag" list="tagList" placeholder="ex. courses, admin" value="${esc(n ? n.tag : '')}">
            <datalist id="tagList">${tags.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
          <label class="check full"><input type="checkbox" name="pinned" ${n && n.pinned ? 'checked' : ''}> Épingler en haut</label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Annuler</button>
          <button class="btn primary">Enregistrer</button>
        </div>
      </form>`, {
      onSubmit: d => {
        const vals = { title: d.title.trim(), text: d.text.trim(), due: d.due, tag: d.tag.trim().replace(/^#/, ''), pinned: !!d.pinned };
        if (!vals.title && !vals.text) { toast('Mets au moins un titre ou un contenu'); return false; }
        if (n) Object.assign(n, vals);
        else state.notes.push({ id: uid(), done: false, createdAt: Date.now(), ...vals });
        save(); renderNotes();
      }
    });
  }

  /* =========================================================
     OBJECTIFS
     ========================================================= */
  let goalsFilter = 'active';

  function goalProgress(g) {
    if (g.mode === 'etapes') {
      if (!g.steps || !g.steps.length) return 0;
      return g.steps.filter(s => s.done).length / g.steps.length;
    }
    const t = Number(g.target) || 0;
    if (t <= 0) return 0;
    return Math.max(0, Math.min(1, (Number(g.current) || 0) / t));
  }

  function renderGoals() {
    const cats = [...new Set(state.goals.map(g => g.category).filter(Boolean))].sort();
    let list = state.goals.slice();
    if (goalsFilter === 'active') list = list.filter(g => goalProgress(g) < 1);
    else if (goalsFilter === 'done') list = list.filter(g => goalProgress(g) >= 1);
    else if (goalsFilter.startsWith('cat:')) list = list.filter(g => g.category === goalsFilter.slice(4));
    list.sort((a, b) => ((a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1));
    const active = state.goals.filter(g => goalProgress(g) < 1).length;
    const done = state.goals.length - active;

    view.innerHTML = `
      <div class="page-head">
        <div><h1>Objectifs</h1><p class="muted">${active} en cours · ${done} atteint${done > 1 ? 's' : ''}</p></div>
        <div class="toolbar"><button class="btn primary" id="newGoal">+ Nouvel objectif</button></div>
      </div>
      <div class="toolbar" style="margin-bottom:16px">
        <div class="seg">
          ${[['active', 'En cours'], ['done', 'Atteints'], ['all', 'Tous']].map(([k, l]) => `<button data-f="${k}" class="${goalsFilter === k ? 'active' : ''}">${l}</button>`).join('')}
        </div>
        ${cats.map(c => `<button class="btn sm ${goalsFilter === 'cat:' + c ? 'primary' : ''}" data-f="cat:${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      ${list.length ? `<div class="grid grid-2">${list.map(goalHTML).join('')}</div>`
        : `<div class="card empty">${state.goals.length ? 'Aucun objectif dans ce filtre.' : 'Ajoute ton premier objectif : un chiffre à atteindre (ex. épargner 2 000 €, lire 12 livres) ou une liste d’étapes.'}</div>`}
    `;

    $('#newGoal').addEventListener('click', () => goalForm());
    $$('[data-f]', view).forEach(b => b.addEventListener('click', () => {
      goalsFilter = goalsFilter === b.dataset.f && b.dataset.f.startsWith('cat:') ? 'all' : b.dataset.f;
      renderGoals();
    }));
    $$('.goal', view).forEach(el => {
      const g = state.goals.find(x => x.id === el.dataset.id);
      $('[data-act=edit]', el).addEventListener('click', () => goalForm(g));
      $('[data-act=del]', el).addEventListener('click', () => confirmBox(`Supprimer l’objectif « ${g.title} » ?`, () => {
        state.goals = state.goals.filter(x => x !== g); save(); renderGoals();
      }));
      const cur = $('[data-act=current]', el);
      if (cur) cur.addEventListener('change', () => { g.current = Number(cur.value) || 0; save(); renderGoals(); });
      $$('[data-act=step]', el).forEach(cb => cb.addEventListener('change', () => {
        const s = g.steps.find(x => x.id === cb.dataset.step); s.done = cb.checked; save(); renderGoals();
      }));
      $$('[data-act=delstep]', el).forEach(b => b.addEventListener('click', () => {
        g.steps = g.steps.filter(x => x.id !== b.dataset.step); save(); renderGoals();
      }));
      const addStep = $('[data-act=addstep]', el);
      if (addStep) addStep.addEventListener('submit', e => {
        e.preventDefault();
        const inp = $('input', addStep);
        const t = inp.value.trim();
        if (!t) return;
        g.steps.push({ id: uid(), text: t, done: false }); save(); renderGoals();
        const again = $(`.goal[data-id="${g.id}"] [data-act=addstep] input`, view);
        if (again) again.focus();
      });
      $$('[data-act=bump]', el).forEach(b => b.addEventListener('click', () => {
        g.current = Math.round(((Number(g.current) || 0) + Number(b.dataset.v)) * 100) / 100; save(); renderGoals();
      }));
    });
  }

  function goalHTML(g) {
    const p = goalProgress(g);
    const pct = Math.round(p * 100);
    let body = '';
    if (g.mode === 'etapes') {
      body = `
        <ul class="steps">${(g.steps || []).map(s => `
          <li class="${s.done ? 'done' : ''}"><input type="checkbox" data-act="step" data-step="${esc(s.id)}" ${s.done ? 'checked' : ''}>
            <span>${esc(s.text)}</span><button class="icon-btn" data-act="delstep" data-step="${esc(s.id)}" title="Retirer">✕</button></li>`).join('')}
        </ul>
        <form data-act="addstep" style="display:flex;gap:6px"><input class="input" placeholder="Ajouter une étape…" style="padding:5px 8px;font-size:14px"><button class="btn sm">+</button></form>`;
    } else {
      body = `
        <div class="goal-num">
          <input class="input num" type="number" step="any" data-act="current" value="${esc(g.current || 0)}" aria-label="Valeur actuelle">
          <span class="muted">/ ${esc(g.target)} ${esc(g.unit || '')}</span>
          <span style="margin-left:auto;display:flex;gap:4px">
            <button class="btn sm" data-act="bump" data-v="-1">−1</button>
            <button class="btn sm" data-act="bump" data-v="1">+1</button>
          </span>
        </div>`;
    }
    return `
      <article class="card goal" data-id="${esc(g.id)}">
        <div class="goal-top">
          <div>
            <h3>${p >= 1 ? '✅ ' : ''}${esc(g.title)}</h3>
            <div class="note-meta">${g.category ? `<span class="tag">${esc(g.category)}</span>` : ''}${g.deadline && p < 1 ? dueTag(g.deadline) : ''}</div>
          </div>
          <div class="note-actions">
            <button class="icon-btn" data-act="edit" title="Modifier">✎</button>
            <button class="icon-btn" data-act="del" title="Supprimer">✕</button>
          </div>
        </div>
        ${g.description ? `<p class="goal-desc">${esc(g.description)}</p>` : ''}
        <div style="display:flex;align-items:center;gap:10px">
          <div class="progress ${p >= 1 ? 'done' : ''}" style="flex:1"><span style="width:${pct}%"></span></div>
          <span class="num small" style="min-width:40px;text-align:right">${pct} %</span>
        </div>
        ${body}
      </article>`;
  }

  function goalForm(g) {
    const cats = [...new Set(state.goals.map(x => x.category).filter(Boolean).concat(['Santé', 'Finances', 'Perso', 'Pro', 'Apprentissage']))];
    const mode = g ? g.mode : 'nombre';
    openModal(`
      <form>
        <h2 class="modal-title">${g ? 'Modifier l’objectif' : 'Nouvel objectif'}</h2>
        <div class="form-grid">
          <div class="field full"><label>Objectif</label><input class="input" name="title" required placeholder="ex. Épargner pour un voyage" value="${esc(g ? g.title : '')}"></div>
          <div class="field"><label>Catégorie</label><input class="input" name="category" list="catList" value="${esc(g ? g.category : '')}">
            <datalist id="catList">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
          <div class="field"><label>Échéance</label><input class="input" type="date" name="deadline" value="${esc(g ? g.deadline : '')}"></div>
          <div class="field full"><label>Pourquoi / détails</label><textarea class="input" name="description" style="min-height:60px">${esc(g ? g.description : '')}</textarea></div>
          <div class="field full"><label>Suivi</label>
            <div class="seg" id="modeSeg">
              <button type="button" data-m="nombre" class="${mode === 'nombre' ? 'active' : ''}">Un chiffre à atteindre</button>
              <button type="button" data-m="etapes" class="${mode === 'etapes' ? 'active' : ''}">Des étapes</button>
            </div>
            <input type="hidden" name="mode" value="${mode}">
          </div>
          <div class="mode-nombre field"><label>Valeur actuelle</label><input class="input" type="number" step="any" name="current" value="${esc(g ? g.current || 0 : 0)}"></div>
          <div class="mode-nombre field"><label>Cible</label><div style="display:flex;gap:6px">
            <input class="input" type="number" step="any" name="target" value="${esc(g ? g.target || '' : '')}" placeholder="ex. 2000">
            <input class="input" name="unit" value="${esc(g ? g.unit || '' : '')}" placeholder="unité (€, livres…)" style="width:130px"></div></div>
          <div class="mode-etapes field full"><label>Étapes (une par ligne)</label>
            <textarea class="input" name="steps" placeholder="Réserver les billets&#10;Faire le budget">${esc(g && g.steps ? g.steps.map(s => s.text).join('\n') : '')}</textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Annuler</button>
          <button class="btn primary">Enregistrer</button>
        </div>
      </form>`, {
      onOpen: m => {
        const sync = v => {
          $('input[name=mode]', m).value = v;
          $$('#modeSeg button', m).forEach(b => b.classList.toggle('active', b.dataset.m === v));
          $$('.mode-nombre', m).forEach(e => e.style.display = v === 'nombre' ? '' : 'none');
          $$('.mode-etapes', m).forEach(e => e.style.display = v === 'etapes' ? '' : 'none');
        };
        $$('#modeSeg button', m).forEach(b => b.addEventListener('click', () => sync(b.dataset.m)));
        sync(mode);
      },
      onSubmit: d => {
        const lines = (d.steps || '').split('\n').map(s => s.trim()).filter(Boolean);
        const oldSteps = g && g.steps ? g.steps : [];
        const steps = lines.map(t => { const o = oldSteps.find(s => s.text === t); return o || { id: uid(), text: t, done: false }; });
        const vals = {
          title: d.title.trim(), category: d.category.trim(), deadline: d.deadline, description: d.description.trim(),
          mode: d.mode, current: Number(d.current) || 0, target: Number(d.target) || 0, unit: d.unit.trim(), steps
        };
        if (vals.mode === 'nombre' && vals.target <= 0) { toast('Indique une cible supérieure à 0'); return false; }
        if (g) Object.assign(g, vals);
        else state.goals.push({ id: uid(), createdAt: Date.now(), ...vals });
        save(); renderGoals();
      }
    });
  }

  /* =========================================================
     FINANCES
     ========================================================= */
  let finMonth = currentMonth();
  let finType = 'all';
  let showChartTable = false;

  function monthTx(mk) { return state.finance.transactions.filter(t => monthKey(t.date) === mk); }
  function monthTotals(mk) {
    let revenu = 0, depense = 0;
    monthTx(mk).forEach(t => { if (t.type === 'revenu') revenu += t.amount; else depense += t.amount; });
    return { revenu, depense, solde: revenu - depense };
  }

  function renderFinance() {
    const mk = finMonth;
    const tx = monthTx(mk).sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));
    const tot = monthTotals(mk);
    const prev = monthTotals(shiftMonth(mk, -1));
    const rate = tot.revenu > 0 ? tot.solde / tot.revenu : null;

    // Dépenses par catégorie
    const byCat = {};
    tx.filter(t => t.type === 'depense').forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const maxCat = cats.length ? cats[0][1] : 0;

    const shown = finType === 'all' ? tx : tx.filter(t => t.type === finType);
    const diff = (a, b) => {
      if (!b) return '';
      const d = a - b;
      return `${d >= 0 ? '+' : '−'}${eur0.format(Math.abs(d))} vs mois précédent`;
    };

    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Finances</h1>
          <p class="muted">Ce que tu gagnes et où part ton argent, mois par mois.</p>
        </div>
        <div class="toolbar">
          <div class="month-nav">
            <button class="icon-btn" id="prevM" title="Mois précédent">‹</button>
            <strong>${esc(monthLabel(mk))}</strong>
            <button class="icon-btn" id="nextM" title="Mois suivant">›</button>
          </div>
          ${mk !== currentMonth() ? '<button class="btn sm" id="todayM">Ce mois-ci</button>' : ''}
          <button class="btn" id="importCsv">Importer un relevé (CSV)</button>
          <button class="btn primary" id="newTx">+ Ajouter</button>
        </div>
      </div>

      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="card kpi"><div class="label">Revenus</div><div class="value num">${money(tot.revenu)}</div><div class="sub">${diff(tot.revenu, prev.revenu)}</div></div>
        <div class="card kpi"><div class="label">Dépenses</div><div class="value num">${money(tot.depense)}</div><div class="sub">${diff(tot.depense, prev.depense)}</div></div>
        <div class="card kpi"><div class="label">Solde du mois</div><div class="value num ${tot.solde >= 0 ? 'pos' : 'neg'}">${tot.solde >= 0 ? '+' : ''}${money(tot.solde)}</div><div class="sub">${tot.solde >= 0 ? 'Tu as mis de côté' : 'Tu as dépensé plus que gagné'}</div></div>
        <div class="card kpi"><div class="label">Taux d’épargne</div><div class="value num">${rate === null ? '—' : Math.round(rate * 100) + ' %'}</div><div class="sub">part des revenus non dépensée</div></div>
      </div>

      <div class="grid grid-2" style="margin-bottom:16px">
        <section class="card">
          <div class="card-head"><h2>Où part l’argent</h2><span class="muted small">${cats.length} catégorie${cats.length > 1 ? 's' : ''}</span></div>
          ${cats.length ? `<div class="catbars">${cats.map(([c, v]) => `
            <div class="catbar" title="${esc(c)} : ${money(v)}">
              <span class="name">${esc(c)}</span>
              <div class="track"><div class="fill" style="width:${(v / maxCat) * 100}%"></div></div>
              <span class="amt num">${eur0.format(v)} <span class="muted small">${Math.round(v / tot.depense * 100)}%</span></span>
            </div>`).join('')}</div>` : '<div class="empty">Aucune dépense ce mois-ci.</div>'}
        </section>
        <section class="card">
          <div class="card-head">
            <h2>Revenus vs dépenses · 12 mois</h2>
            <button class="btn sm" id="toggleChartTable">${showChartTable ? 'Graphique' : 'Tableau'}</button>
          </div>
          <div class="legend" style="margin-bottom:8px"><span><i style="background:var(--series-1)"></i>Revenus</span><span><i style="background:var(--series-2)"></i>Dépenses</span></div>
          ${showChartTable ? yearTableHTML(mk) : `<div class="chart-wrap" id="yearChart"></div>`}
        </section>
      </div>

      <section class="card">
        <div class="card-head">
          <h2>Opérations du mois</h2>
          <div class="seg" id="txFilter">
            ${[['all', 'Tout'], ['revenu', 'Revenus'], ['depense', 'Dépenses']].map(([k, l]) => `<button data-t="${k}" class="${finType === k ? 'active' : ''}">${l}</button>`).join('')}
          </div>
        </div>
        ${shown.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th class="right">Montant</th><th></th></tr></thead>
          <tbody>${shown.map(t => `
            <tr data-id="${esc(t.id)}">
              <td class="num" style="white-space:nowrap">${fmtDate(t.date)}</td>
              <td>${esc(t.label)}${t.source === 'csv' ? ' <span class="tag" title="Importé depuis un relevé">CSV</span>' : ''}</td>
              <td><select class="input" data-act="cat">${state.finance.categories[t.type].concat(state.finance.categories[t.type].includes(t.category) ? [] : [t.category])
                .map(c => `<option ${c === t.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></td>
              <td class="right num ${t.type === 'revenu' ? 'pos' : ''}" style="white-space:nowrap">${t.type === 'revenu' ? '+' : '−'}${money(t.amount)}</td>
              <td class="right" style="white-space:nowrap">
                <button class="icon-btn" data-act="edit" title="Modifier">✎</button>
                <button class="icon-btn" data-act="del" title="Supprimer">✕</button>
              </td>
            </tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">Aucune opération ce mois-ci. Ajoute-en une ou importe ton relevé bancaire.</div>'}
      </section>

      <details class="card" style="margin-top:16px">
        <summary style="cursor:pointer;font-weight:600">Catégories et règles d’import</summary>
        ${categoriesHTML()}
      </details>
    `;

    $('#prevM').addEventListener('click', () => { finMonth = shiftMonth(finMonth, -1); renderFinance(); });
    $('#nextM').addEventListener('click', () => { finMonth = shiftMonth(finMonth, 1); renderFinance(); });
    const tm = $('#todayM'); if (tm) tm.addEventListener('click', () => { finMonth = currentMonth(); renderFinance(); });
    $('#newTx').addEventListener('click', () => txForm());
    $('#importCsv').addEventListener('click', csvImport);
    $('#toggleChartTable').addEventListener('click', () => { showChartTable = !showChartTable; renderFinance(); });
    $$('#txFilter button').forEach(b => b.addEventListener('click', () => { finType = b.dataset.t; renderFinance(); }));
    $$('tr[data-id]', view).forEach(tr => {
      const t = state.finance.transactions.find(x => x.id === tr.dataset.id);
      $('[data-act=cat]', tr).addEventListener('change', e => { t.category = e.target.value; save(); renderFinance(); });
      $('[data-act=edit]', tr).addEventListener('click', () => txForm(t));
      $('[data-act=del]', tr).addEventListener('click', () => {
        state.finance.transactions = state.finance.transactions.filter(x => x !== t); save(); renderFinance(); toast('Opération supprimée');
      });
    });
    bindCategories();
    if (!showChartTable) drawYearChart($('#yearChart'), mk);
  }

  function last12(mk) {
    const out = [];
    for (let i = 11; i >= 0; i--) { const k = shiftMonth(mk, -i); out.push({ k, ...monthTotals(k) }); }
    return out;
  }

  function yearTableHTML(mk) {
    const rows = last12(mk);
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Mois</th><th class="right">Revenus</th><th class="right">Dépenses</th><th class="right">Solde</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td style="text-transform:capitalize">${esc(monthLabel(r.k))}</td><td class="right num">${eur0.format(r.revenu)}</td><td class="right num">${eur0.format(r.depense)}</td>
      <td class="right num ${r.solde >= 0 ? 'pos' : 'neg'}">${eur0.format(r.solde)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function niceScale(v) {
    if (v <= 0) return { max: 1000, ticks: 4 };
    let best = null;
    [4, 5].forEach(n => {
      const raw = v / n, p = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / p;
      const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p;
      if (!best || step * n < best.max) best = { max: step * n, ticks: n };
    });
    return best;
  }

  function drawYearChart(el, mk) {
    const data = last12(mk);
    const W = 560, H = 240, L = 48, R = 8, T = 8, B = 26;
    const { max, ticks } = niceScale(Math.max(...data.map(d => Math.max(d.revenu, d.depense))));
    const cw = (W - L - R) / data.length;
    const bw = Math.min(14, (cw - 10) / 2);
    const y = v => T + (H - T - B) * (1 - v / max);
    const base = y(0);
    const bar = (x, v, color) => {
      if (v <= 0) return '';
      const top = y(v), h = base - top, r = Math.min(4, h, bw / 2);
      return `<path d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z" fill="${color}"/>`;
    };
    let grid = '';
    for (let i = 0; i <= ticks; i++) {
      const v = max * i / ticks, yy = y(v);
      grid += `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/>
        <text class="axis" x="${L - 6}" y="${yy + 3.5}" text-anchor="end">${v >= 1000 ? (v / 1000).toLocaleString('fr-FR') + ' k' : v.toLocaleString('fr-FR')}</text>`;
    }
    let bars = '', labels = '', hits = '';
    data.forEach((d, i) => {
      const cx = L + cw * i + cw / 2;
      bars += bar(cx - bw - 1, d.revenu, 'var(--series-1)') + bar(cx + 1, d.depense, 'var(--series-2)');
      const m = Number(d.k.slice(5)) - 1;
      labels += `<text class="axis" x="${cx}" y="${H - 8}" text-anchor="middle" ${d.k === mk ? 'style="fill:var(--text);font-weight:600"' : ''}>${MONTHS_SHORT[m]}</text>`;
      hits += `<rect class="hit" data-i="${i}" x="${L + cw * i}" y="${T}" width="${cw}" height="${H - T - B}" rx="4"/>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenus et dépenses des 12 derniers mois">${grid}${hits}${bars}${labels}</svg><div class="tooltip"></div>`;
    const tip = $('.tooltip', el);
    const svg = $('svg', el);
    $$('.hit', el).forEach(h => {
      h.addEventListener('mouseenter', () => {
        const d = data[h.dataset.i];
        tip.innerHTML = `<div style="font-weight:600;text-transform:capitalize;margin-bottom:4px">${esc(monthLabel(d.k))}</div>
          <div class="row"><span><i style="background:var(--series-1)"></i>Revenus</span><span class="num">${money(d.revenu)}</span></div>
          <div class="row"><span><i style="background:var(--series-2)"></i>Dépenses</span><span class="num">${money(d.depense)}</span></div>
          <div class="row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:4px"><span>Solde</span><span class="num ${d.solde >= 0 ? 'pos' : 'neg'}">${money(d.solde)}</span></div>`;
        tip.style.display = 'block';
        const sr = svg.getBoundingClientRect(), hr = h.getBoundingClientRect();
        let left = hr.left - sr.left + hr.width / 2 - tip.offsetWidth / 2;
        left = Math.max(0, Math.min(sr.width - tip.offsetWidth, left));
        tip.style.left = left + 'px';
        tip.style.top = '-8px';
        tip.style.transform = 'translateY(-100%)';
      });
      h.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      h.addEventListener('click', () => { finMonth = data[h.dataset.i].k; renderFinance(); });
    });
  }

  function categoriesHTML() {
    const c = state.finance.categories;
    const all = c.revenu.concat(c.depense);
    return `
      <div class="grid grid-2" style="margin-top:14px">
        ${['revenu', 'depense'].map(type => `
          <div>
            <h3 style="margin-bottom:8px">${type === 'revenu' ? 'Catégories de revenus' : 'Catégories de dépenses'}</h3>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
              ${c[type].map(x => `<span class="tag" style="display:inline-flex;align-items:center;gap:4px">${esc(x)}<button class="icon-btn" style="width:18px;height:18px;font-size:11px" data-delcat="${type}" data-name="${esc(x)}" title="Retirer">✕</button></span>`).join('')}
            </div>
            <form data-addcat="${type}" style="display:flex;gap:6px"><input class="input" placeholder="Nouvelle catégorie" style="padding:5px 8px"><button class="btn sm">Ajouter</button></form>
          </div>`).join('')}
      </div>
      <div style="margin-top:20px">
        <h3>Règles d’import CSV</h3>
        <p class="muted small" style="margin:4px 0 10px">Si le libellé d’une opération importée contient le mot-clé, elle est rangée dans la catégorie. Sinon elle va dans « Autres ».</p>
        <form id="addRule" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          <input class="input" name="keyword" placeholder="mot-clé (ex. carrefour)" style="width:200px;padding:5px 8px">
          <select class="input" name="category" style="width:200px;padding:5px 8px">${all.map(x => `<option>${esc(x)}</option>`).join('')}</select>
          <button class="btn sm">Ajouter la règle</button>
        </form>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${state.finance.rules.map((r, i) => `<span class="tag" style="display:inline-flex;align-items:center;gap:4px">${esc(r.keyword)} → ${esc(r.category)}<button class="icon-btn" style="width:18px;height:18px;font-size:11px" data-delrule="${i}" title="Retirer">✕</button></span>`).join('')}
        </div>
      </div>`;
  }

  function bindCategories() {
    $$('[data-delcat]', view).forEach(b => b.addEventListener('click', () => {
      const list = state.finance.categories[b.dataset.delcat];
      if (list.length <= 1) return;
      state.finance.categories[b.dataset.delcat] = list.filter(x => x !== b.dataset.name);
      save(); renderFinance(); $('details', view).open = true;
    }));
    $$('[data-addcat]', view).forEach(f => f.addEventListener('submit', e => {
      e.preventDefault();
      const v = $('input', f).value.trim();
      const list = state.finance.categories[f.dataset.addcat];
      if (v && !list.includes(v)) { list.push(v); save(); }
      renderFinance(); $('details', view).open = true;
    }));
    $('#addRule').addEventListener('submit', e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target).entries());
      const k = d.keyword.trim().toLowerCase();
      if (k) { state.finance.rules.unshift({ keyword: k, category: d.category }); save(); }
      renderFinance(); $('details', view).open = true;
    });
    $$('[data-delrule]', view).forEach(b => b.addEventListener('click', () => {
      state.finance.rules.splice(Number(b.dataset.delrule), 1); save(); renderFinance(); $('details', view).open = true;
    }));
  }

  function txForm(t) {
    const type = t ? t.type : 'depense';
    const date = t ? t.date : (finMonth === currentMonth() ? todayISO() : finMonth + '-01');
    const catOptions = ty => state.finance.categories[ty].map(c => `<option ${t && c === t.category ? 'selected' : ''}>${esc(c)}</option>`).join('');
    openModal(`
      <form>
        <h2 class="modal-title">${t ? 'Modifier l’opération' : 'Nouvelle opération'}</h2>
        <div class="form-grid">
          <div class="field full">
            <div class="seg" id="typeSeg">
              <button type="button" data-ty="depense" class="${type === 'depense' ? 'active' : ''}">Dépense</button>
              <button type="button" data-ty="revenu" class="${type === 'revenu' ? 'active' : ''}">Revenu</button>
            </div>
            <input type="hidden" name="type" value="${type}">
          </div>
          <div class="field"><label>Montant (€)</label><input class="input num" name="amount" inputmode="decimal" required placeholder="0,00" value="${t ? String(t.amount).replace('.', ',') : ''}"></div>
          <div class="field"><label>Date</label><input class="input" type="date" name="date" required value="${esc(date)}"></div>
          <div class="field full"><label>Libellé</label><input class="input" name="label" placeholder="ex. Courses Monoprix" value="${esc(t ? t.label : '')}"></div>
          <div class="field full"><label>Catégorie</label><select class="input" name="category">${catOptions(type)}</select></div>
          ${t ? '' : '<label class="check full"><input type="checkbox" name="again"> Enchaîner avec une autre opération</label>'}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Annuler</button>
          <button class="btn primary">Enregistrer</button>
        </div>
      </form>`, {
      onOpen: m => {
        $$('#typeSeg button', m).forEach(b => b.addEventListener('click', () => {
          $('input[name=type]', m).value = b.dataset.ty;
          $$('#typeSeg button', m).forEach(x => x.classList.toggle('active', x === b));
          $('select[name=category]', m).innerHTML = catOptions(b.dataset.ty);
        }));
        $('input[name=amount]', m).focus();
      },
      onSubmit: d => {
        const amount = parseAmount(d.amount);
        if (!amount || amount <= 0) { toast('Montant invalide'); return false; }
        const vals = { type: d.type, amount: Math.abs(amount), date: d.date, label: d.label.trim() || d.category, category: d.category };
        if (t) Object.assign(t, vals);
        else state.finance.transactions.push({ id: uid(), source: 'manuel', ...vals });
        save();
        finMonth = monthKey(vals.date);
        renderFinance();
        if (d.again) { setTimeout(() => txForm(), 0); toast('Opération ajoutée'); }
      }
    });
  }

  /* ---------- Import CSV ---------- */
  function parseAmount(s) {
    if (s == null) return NaN;
    let v = String(s).trim().replace(/[€\s  ]/g, '').replace(/EUR/i, '');
    if (!v) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(v)) { neg = true; v = v.slice(1, -1); }
    if (v.endsWith('-')) { neg = true; v = v.slice(0, -1); }
    const lastComma = v.lastIndexOf(','), lastDot = v.lastIndexOf('.');
    if (lastComma > lastDot) v = v.replace(/\./g, '').replace(',', '.');
    else v = v.replace(/,/g, '');
    const n = parseFloat(v);
    return neg ? -n : n;
  }

  function parseDate(s) {
    s = String(s || '').trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) {
      let y = m[3]; if (y.length === 2) y = '20' + y;
      return `${y}-${pad(m[2])}-${pad(m[1])}`;
    }
    return null;
  }

  function parseCSV(text) {
    const firstLine = text.split(/\r?\n/).find(l => l.trim()) || '';
    const counts = { ';': 0, ',': 0, '\t': 0 };
    let inQ = false;
    for (const ch of firstLine) { if (ch === '"') inQ = !inQ; else if (!inQ && ch in counts) counts[ch]++; }
    const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(c => c.trim())) rows.push(row);
        row = [];
      } else field += ch;
    }
    row.push(field);
    if (row.some(c => c.trim())) rows.push(row);
    return rows.map(r => r.map(c => c.trim()));
  }

  function categorize(label, type) {
    const l = label.toLowerCase();
    const allowed = state.finance.categories[type];
    const r = state.finance.rules.find(r => r.keyword && l.includes(r.keyword.toLowerCase()) && allowed.includes(r.category));
    if (r) return r.category;
    const other = allowed.find(c => /^autres/i.test(c));
    return other || allowed[allowed.length - 1];
  }

  function readFileText(file) {
    return file.arrayBuffer().then(buf => {
      let txt = new TextDecoder('utf-8').decode(buf);
      if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
      return txt.replace(/^﻿/, '');
    });
  }

  function guessColumns(header) {
    const h = header.map(x => x.toLowerCase());
    const find = re => h.findIndex(x => re.test(x));
    return {
      date: Math.max(0, find(/date/)),
      label: [/libell/, /description|label|intitul|d[ée]tail/, /op[ée]ration/].map(re => h.findIndex((x, i) => re.test(x) && !/date/.test(x))).find(i => i >= 0) ?? -1,
      amount: find(/^montant|amount|valeur/),
      debit: find(/d[ée]bit/),
      credit: find(/cr[ée]dit/)
    };
  }

  function csvImport() {
    openModal(`
      <div class="modal-body">
        <h2 class="modal-title">Importer un relevé bancaire (CSV)</h2>
        <p class="muted small" style="margin-top:0">Exporte tes opérations depuis le site de ta banque au format CSV, puis dépose le fichier ici. Rien n’est envoyé sur internet : tout reste dans ton navigateur.</p>
        <label class="drop" id="drop">
          <input type="file" accept=".csv,text/csv,text/plain" id="csvFile" hidden>
          <div style="font-size:15px;font-weight:500">Glisse ton fichier CSV ici</div>
          <div class="small">ou clique pour le choisir</div>
        </label>
        <div id="csvStep2"></div>
        <div class="modal-actions" id="csvActions">
          <button type="button" class="btn" data-close>Annuler</button>
        </div>
      </div>`, { wide: true });
    const drop = $('#drop', modal), input = $('#csvFile', modal);
    input.addEventListener('change', () => input.files[0] && handleFile(input.files[0]));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  }

  function handleFile(file) {
    readFileText(file).then(text => {
      const rows = parseCSV(text);
      if (rows.length < 1) { toast('Fichier vide ou illisible'); return; }
      // Certaines banques mettent des lignes d'en-tête avant le tableau : on prend la 1re ligne contenant "date".
      let headerIdx = rows.findIndex(r => r.some(c => /date/i.test(c)));
      if (headerIdx < 0) headerIdx = 0;
      const header = rows[headerIdx];
      const body = rows.slice(headerIdx + 1).filter(r => r.length >= 2);
      csvMapping(file.name, header, body);
    });
  }

  function csvMapping(name, header, body) {
    const g = guessColumns(header);
    const mode = g.amount >= 0 || (g.debit < 0 && g.credit < 0) ? 'single' : 'split';
    const opts = (sel, allowNone) => (allowNone ? '<option value="-1">—</option>' : '') +
      header.map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(h || 'Colonne ' + (i + 1))}</option>`).join('');
    $('#drop', modal).style.display = 'none';
    $('#csvStep2', modal).innerHTML = `
      <p style="margin:0 0 12px"><strong>${esc(name)}</strong> · ${body.length} ligne${body.length > 1 ? 's' : ''}</p>
      <div class="form-grid" id="mapForm">
        <div class="field"><label>Colonne date</label><select class="input" name="date">${opts(g.date)}</select></div>
        <div class="field"><label>Colonne libellé</label><select class="input" name="label">${opts(g.label >= 0 ? g.label : 1)}</select></div>
        <div class="field full"><label>Montants</label>
          <div class="seg" id="amtMode">
            <button type="button" data-m="single" class="${mode === 'single' ? 'active' : ''}">Une colonne (négatif = dépense)</button>
            <button type="button" data-m="split" class="${mode === 'split' ? 'active' : ''}">Deux colonnes débit / crédit</button>
          </div></div>
        <div class="field m-single"><label>Colonne montant</label><select class="input" name="amount">${opts(g.amount >= 0 ? g.amount : header.length - 1)}</select></div>
        <div class="field m-single"><label class="check" style="margin-top:26px"><input type="checkbox" name="invert"> Les dépenses sont en positif</label></div>
        <div class="field m-split"><label>Colonne débit (dépenses)</label><select class="input" name="debit">${opts(g.debit, true)}</select></div>
        <div class="field m-split"><label>Colonne crédit (revenus)</label><select class="input" name="credit">${opts(g.credit, true)}</select></div>
      </div>
      <div class="csv-preview" id="csvPreview"></div>`;
    $('#csvActions', modal).innerHTML = `<button type="button" class="btn" data-close>Annuler</button><button type="button" class="btn primary" id="doImport">Importer</button>`;
    $$('[data-close]', modal).forEach(b => b.addEventListener('click', closeModal));
    let amtMode = mode;
    const read = () => {
      const f = $('#mapForm', modal);
      const v = n => Number($(`[name=${n}]`, f).value);
      return { date: v('date'), label: v('label'), amount: v('amount'), debit: v('debit'), credit: v('credit'), invert: $('[name=invert]', f).checked, mode: amtMode };
    };
    const build = () => {
      const m = read();
      const existing = new Set(state.finance.transactions.map(t => `${t.date}|${t.amount}|${t.label}`));
      const out = [];
      body.forEach(r => {
        const date = parseDate(r[m.date]);
        if (!date) return;
        let val;
        if (m.mode === 'single') {
          val = parseAmount(r[m.amount]);
          if (m.invert) val = -val;
        } else {
          const d = m.debit >= 0 ? Math.abs(parseAmount(r[m.debit]) || 0) : 0;
          const c = m.credit >= 0 ? Math.abs(parseAmount(r[m.credit]) || 0) : 0;
          val = c - d;
        }
        if (!val || isNaN(val)) return;
        const type = val > 0 ? 'revenu' : 'depense';
        const label = (r[m.label] || '').replace(/\s+/g, ' ').trim();
        const amount = Math.round(Math.abs(val) * 100) / 100;
        const dup = existing.has(`${date}|${amount}|${label}`);
        out.push({ date, label, amount, type, category: categorize(label, type), dup });
      });
      return out;
    };
    const preview = () => {
      const items = build();
      const fresh = items.filter(i => !i.dup);
      $('#csvPreview', modal).innerHTML = items.length ? `<table class="table"><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie devinée</th><th class="right">Montant</th></tr></thead><tbody>
        ${items.slice(0, 50).map(i => `<tr style="${i.dup ? 'opacity:.4' : ''}"><td class="num">${fmtDate(i.date)}</td><td>${esc(i.label)}${i.dup ? ' <span class="tag">déjà importée</span>' : ''}</td><td>${esc(i.category)}</td>
        <td class="right num ${i.type === 'revenu' ? 'pos' : ''}">${i.type === 'revenu' ? '+' : '−'}${money(i.amount)}</td></tr>`).join('')}
        </tbody></table>${items.length > 50 ? `<p class="muted small" style="padding:0 10px">… et ${items.length - 50} autres</p>` : ''}`
        : '<div class="empty">Aucune ligne reconnue avec ces colonnes. Vérifie la colonne date et la colonne montant.</div>';
      $('#doImport', modal).textContent = `Importer ${fresh.length} opération${fresh.length > 1 ? 's' : ''}`;
      $('#doImport', modal).disabled = !fresh.length;
    };
    const syncMode = () => {
      $$('#amtMode button', modal).forEach(b => b.classList.toggle('active', b.dataset.m === amtMode));
      $$('.m-single', modal).forEach(e => e.style.display = amtMode === 'single' ? '' : 'none');
      $$('.m-split', modal).forEach(e => e.style.display = amtMode === 'split' ? '' : 'none');
      preview();
    };
    $$('#amtMode button', modal).forEach(b => b.addEventListener('click', () => { amtMode = b.dataset.m; syncMode(); }));
    $$('#mapForm select, #mapForm input', modal).forEach(e => e.addEventListener('change', preview));
    syncMode();
    $('#doImport', modal).addEventListener('click', () => {
      const fresh = build().filter(i => !i.dup);
      fresh.forEach(i => state.finance.transactions.push({ id: uid(), source: 'csv', date: i.date, label: i.label, amount: i.amount, type: i.type, category: i.category }));
      save();
      if (fresh.length) {
        const months = fresh.map(i => monthKey(i.date)).sort();
        finMonth = months[months.length - 1];
      }
      closeModal();
      renderFinance();
      toast(`${fresh.length} opération${fresh.length > 1 ? 's' : ''} importée${fresh.length > 1 ? 's' : ''}`);
    });
  }

  /* =========================================================
     RECHERCHES / BENCHMARKS
     ========================================================= */
  const COL_TYPES = { text: 'Texte', number: 'Nombre', price: 'Prix (€)', rating: 'Note /5', url: 'Lien' };
  const DEFAULT_COLUMNS = () => [
    { id: uid(), name: 'Produit', type: 'text' },
    { id: uid(), name: 'Marque', type: 'text' },
    { id: uid(), name: 'Prix', type: 'price' },
    { id: uid(), name: 'Contenance', type: 'text' },
    { id: uid(), name: 'Note', type: 'rating' },
    { id: uid(), name: 'Ingrédients clés', type: 'text' },
    { id: uid(), name: 'Avis / notes', type: 'text' },
    { id: uid(), name: 'Lien', type: 'url' }
  ];
  let researchSort = { col: null, dir: 1 };
  let researchQuery = '';

  function renderResearch(arg) {
    if (arg) {
      const r = state.research.find(x => x.id === arg);
      if (r) return renderBenchmark(r);
    }
    const q = researchQuery.toLowerCase();
    const list = state.research.filter(r => !q || (r.title + ' ' + (r.topic || '') + ' ' + (r.description || '')).toLowerCase().includes(q))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    view.innerHTML = `
      <div class="page-head">
        <div><h1>Recherches</h1><p class="muted">Tes benchmarks : compare des produits, des services, n’importe quoi.</p></div>
        <div class="toolbar">
          <input class="input" type="search" id="resSearch" placeholder="Rechercher…" value="${esc(researchQuery)}" style="width:200px">
          <button class="btn primary" id="newBench">+ Nouveau benchmark</button>
        </div>
      </div>
      ${list.length ? `<div class="bench-cards">${list.map(r => {
        const fav = r.items.filter(i => i.fav).length;
        return `<a class="card bench-card" href="#recherches/${esc(r.id)}" style="text-decoration:none;color:inherit">
          <div style="display:flex;justify-content:space-between;gap:8px"><h3>${esc(r.title)}</h3>${r.topic ? `<span class="tag">${esc(r.topic)}</span>` : ''}</div>
          ${r.description ? `<p class="muted small">${esc(r.description)}</p>` : ''}
          <p class="small muted">${r.items.length} élément${r.items.length > 1 ? 's' : ''} comparé${r.items.length > 1 ? 's' : ''}${fav ? ` · ${fav} favori${fav > 1 ? 's' : ''}` : ''}</p>
        </a>`;
      }).join('')}</div>`
      : `<div class="card empty">${state.research.length ? 'Aucun résultat.' : 'Crée ton premier benchmark, par exemple « Sérums vitamine C » ou « Crèmes solaires ».'}</div>`}
    `;
    $('#newBench').addEventListener('click', () => benchForm());
    const s = $('#resSearch');
    s.addEventListener('input', () => { researchQuery = s.value; const p = s.selectionStart; renderResearch(); const n = $('#resSearch'); n.focus(); n.setSelectionRange(p, p); });
  }

  function benchForm(r) {
    const topics = [...new Set(state.research.map(x => x.topic).filter(Boolean).concat(['Skincare', 'Maquillage', 'Cheveux', 'Tech', 'Maison', 'Voyage']))];
    openModal(`
      <form>
        <h2 class="modal-title">${r ? 'Modifier le benchmark' : 'Nouveau benchmark'}</h2>
        <div class="form-grid">
          <div class="field full"><label>Titre</label><input class="input" name="title" required placeholder="ex. Sérums vitamine C" value="${esc(r ? r.title : '')}"></div>
          <div class="field full"><label>Thème</label><input class="input" name="topic" list="topicList" value="${esc(r ? r.topic : 'Skincare')}">
            <datalist id="topicList">${topics.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
          <div class="field full"><label>Ce que je cherche</label><textarea class="input" name="description" style="min-height:60px" placeholder="ex. un sérum anti-taches, peau mixte, moins de 30 €">${esc(r ? r.description : '')}</textarea></div>
          ${r ? '' : '<p class="muted small full" style="margin:0">Colonnes de départ : produit, marque, prix, contenance, note, ingrédients clés, avis, lien. Tu pourras en ajouter ou en retirer.</p>'}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Annuler</button>
          <button class="btn primary">${r ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </form>`, {
      onSubmit: d => {
        const vals = { title: d.title.trim(), topic: d.topic.trim(), description: d.description.trim(), updatedAt: Date.now() };
        if (r) { Object.assign(r, vals); save(); renderBenchmark(r); }
        else {
          const nr = { id: uid(), createdAt: Date.now(), columns: DEFAULT_COLUMNS(), items: [], conclusion: '', ...vals };
          state.research.push(nr); save();
          location.hash = '#recherches/' + nr.id;
        }
      }
    });
  }

  function cellHTML(col, v) {
    if (v == null || v === '') return '<span class="muted">—</span>';
    if (col.type === 'price') return `<span class="num">${money(Number(v))}</span>`;
    if (col.type === 'number') return `<span class="num">${esc(Number(v).toLocaleString('fr-FR'))}</span>`;
    if (col.type === 'rating') {
      const n = Math.max(0, Math.min(5, Math.round(Number(v))));
      return `<span class="stars" title="${esc(v)}/5">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
    }
    if (col.type === 'url') {
      const safe = /^https?:\/\//i.test(v) ? v : 'https://' + v;
      let host = v; try { host = new URL(safe).hostname.replace(/^www\./, ''); } catch (e) { /* garde le texte */ }
      return `<a href="${esc(safe)}" target="_blank" rel="noopener">${esc(host)}</a>`;
    }
    return `<div class="cell-text">${esc(v)}</div>`;
  }

  function renderBenchmark(r) {
    let items = r.items.slice();
    if (researchSort.col) {
      const col = r.columns.find(c => c.id === researchSort.col);
      if (col) {
        const numeric = ['price', 'number', 'rating'].includes(col.type);
        items.sort((a, b) => {
          const va = a.values[col.id], vb = b.values[col.id];
          const ea = va == null || va === '', eb = vb == null || vb === '';
          if (ea && eb) return 0; if (ea) return 1; if (eb) return -1;
          return (numeric ? Number(va) - Number(vb) : String(va).localeCompare(String(vb), 'fr')) * researchSort.dir;
        });
      }
    }
    items.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));

    view.innerHTML = `
      <a href="#recherches" class="crumb">← Recherches</a>
      <div class="page-head">
        <div>
          <h1>${esc(r.title)}</h1>
          <p class="muted">${r.topic ? `<span class="tag">${esc(r.topic)}</span> ` : ''}${esc(r.description || '')}</p>
        </div>
        <div class="toolbar">
          <button class="btn" id="editBench">Modifier</button>
          <button class="btn" id="editCols">Colonnes</button>
          <button class="btn danger" id="delBench">Supprimer</button>
          <button class="btn primary" id="newItem">+ Ajouter un élément</button>
        </div>
      </div>
      <section class="card" style="padding:8px 8px 4px">
        ${items.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th></th>${r.columns.map(c => `<th class="sortable ${['price', 'number', 'rating'].includes(c.type) ? 'right' : ''}" data-sort="${esc(c.id)}">${esc(c.name)}${researchSort.col === c.id ? (researchSort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}<th></th></tr></thead>
          <tbody>${items.map(it => `
            <tr data-id="${esc(it.id)}" class="${it.fav ? 'fav' : ''}">
              <td><button class="icon-btn ${it.fav ? 'on' : ''}" data-act="fav" title="${it.fav ? 'Retirer des favoris' : 'Mettre en favori'}">${it.fav ? '★' : '☆'}</button></td>
              ${r.columns.map(c => `<td class="${['price', 'number', 'rating'].includes(c.type) ? 'right' : ''}">${cellHTML(c, it.values[c.id])}</td>`).join('')}
              <td class="right" style="white-space:nowrap">
                <button class="icon-btn" data-act="edit" title="Modifier">✎</button>
                <button class="icon-btn" data-act="dup" title="Dupliquer">⧉</button>
                <button class="icon-btn" data-act="del" title="Supprimer">✕</button>
              </td>
            </tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">Ajoute les produits que tu compares. Clique sur un en-tête de colonne pour trier (par prix, par note…).</div>'}
      </section>
      <section class="card" style="margin-top:16px">
        <div class="card-head"><h2>Conclusion</h2><span class="muted small" id="conclSaved"></span></div>
        <textarea class="input" id="conclusion" placeholder="Ce que je retiens, ce que je vais acheter, ce que j’évite…" style="min-height:110px">${esc(r.conclusion || '')}</textarea>
      </section>
    `;

    $('#editBench').addEventListener('click', () => benchForm(r));
    $('#editCols').addEventListener('click', () => columnsForm(r));
    $('#newItem').addEventListener('click', () => itemForm(r));
    $('#delBench').addEventListener('click', () => confirmBox(`Supprimer le benchmark « ${r.title} » et tout son contenu ?`, () => {
      state.research = state.research.filter(x => x !== r); save(); location.hash = '#recherches';
    }));
    $$('[data-sort]', view).forEach(th => th.addEventListener('click', () => {
      if (researchSort.col === th.dataset.sort) researchSort.dir = -researchSort.dir;
      else researchSort = { col: th.dataset.sort, dir: 1 };
      renderBenchmark(r);
    }));
    $$('tr[data-id]', view).forEach(tr => {
      const it = r.items.find(x => x.id === tr.dataset.id);
      $('[data-act=fav]', tr).addEventListener('click', () => { it.fav = !it.fav; touch(r); renderBenchmark(r); });
      $('[data-act=edit]', tr).addEventListener('click', () => itemForm(r, it));
      $('[data-act=dup]', tr).addEventListener('click', () => {
        r.items.push({ id: uid(), fav: false, values: { ...it.values } }); touch(r); renderBenchmark(r);
      });
      $('[data-act=del]', tr).addEventListener('click', () => { r.items = r.items.filter(x => x !== it); touch(r); renderBenchmark(r); toast('Élément supprimé'); });
    });
    let t;
    $('#conclusion').addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { r.conclusion = e.target.value; touch(r); $('#conclSaved').textContent = 'Enregistré'; }, 400);
    });
  }

  function touch(r) { r.updatedAt = Date.now(); save(); }

  function itemForm(r, it) {
    openModal(`
      <form>
        <h2 class="modal-title">${it ? 'Modifier' : 'Ajouter'} · ${esc(r.title)}</h2>
        <div class="form-grid">
          ${r.columns.map(c => {
            const v = it ? it.values[c.id] : '';
            const full = c.type === 'text' && /ingr|avis|note|comment|descr/i.test(c.name);
            let input;
            if (c.type === 'rating') input = `<select class="input" name="${esc(c.id)}"><option value="">—</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${String(v) === String(n) ? 'selected' : ''}>${'★'.repeat(n)} (${n}/5)</option>`).join('')}</select>`;
            else if (c.type === 'price' || c.type === 'number') input = `<input class="input num" name="${esc(c.id)}" inputmode="decimal" value="${esc(v == null ? '' : String(v).replace('.', ','))}">`;
            else if (full) input = `<textarea class="input" name="${esc(c.id)}" style="min-height:60px">${esc(v)}</textarea>`;
            else input = `<input class="input" name="${esc(c.id)}" ${c.type === 'url' ? 'placeholder="https://…"' : ''} value="${esc(v)}">`;
            return `<div class="field ${full ? 'full' : ''}"><label>${esc(c.name)}${c.type === 'price' ? ' (€)' : ''}</label>${input}</div>`;
          }).join('')}
          ${it ? '' : '<label class="check full"><input type="checkbox" name="__again"> Enchaîner avec un autre élément</label>'}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Annuler</button>
          <button class="btn primary">Enregistrer</button>
        </div>
      </form>`, {
      wide: r.columns.length > 6,
      onSubmit: d => {
        const values = {};
        r.columns.forEach(c => {
          let v = (d[c.id] || '').trim();
          if (v && (c.type === 'price' || c.type === 'number')) { const n = parseAmount(v); v = isNaN(n) ? '' : n; }
          if (v && c.type === 'rating') v = Number(v);
          values[c.id] = v;
        });
        if (!Object.values(values).some(v => v !== '')) { toast('Remplis au moins un champ'); return false; }
        if (it) it.values = values;
        else r.items.push({ id: uid(), fav: false, values });
        touch(r); renderBenchmark(r);
        if (d.__again) setTimeout(() => itemForm(r), 0);
      }
    });
  }

  function columnsForm(r) {
    let cols = r.columns.map(c => ({ ...c }));
    const draw = () => {
      $('#colList', modal).innerHTML = cols.map((c, i) => `
        <div class="col-row" data-i="${i}">
          <input class="input" data-k="name" value="${esc(c.name)}" style="padding:5px 8px">
          <select class="input" data-k="type" style="padding:5px 8px">${Object.entries(COL_TYPES).map(([k, l]) => `<option value="${k}" ${c.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button type="button" class="icon-btn" data-mv="-1" title="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="icon-btn" data-mv="1" title="Descendre" ${i === cols.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="icon-btn" data-rm title="Retirer">✕</button>
        </div>`).join('');
      $$('.col-row', modal).forEach(row => {
        const i = Number(row.dataset.i);
        $$('[data-k]', row).forEach(inp => inp.addEventListener('input', () => { cols[i][inp.dataset.k] = inp.value; }));
        $$('[data-mv]', row).forEach(b => b.addEventListener('click', () => {
          const j = i + Number(b.dataset.mv); [cols[i], cols[j]] = [cols[j], cols[i]]; draw();
        }));
        $('[data-rm]', row).addEventListener('click', () => { cols.splice(i, 1); draw(); });
      });
    };
    openModal(`
      <form>
        <h2 class="modal-title">Colonnes du benchmark</h2>
        <p class="muted small" style="margin-top:0">Retirer une colonne efface ses valeurs.</p>
        <div class="col-list" id="colList"></div>
        <button type="button" class="btn sm" id="addCol" style="margin-top:10px">+ Ajouter une colonne</button>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Annuler</button>
          <button class="btn primary">Enregistrer</button>
        </div>
      </form>`, {
      onOpen: () => {
        draw();
        $('#addCol', modal).addEventListener('click', () => { cols.push({ id: uid(), name: 'Nouvelle colonne', type: 'text' }); draw(); const last = $$('.col-row input', modal).pop(); last.focus(); last.select(); });
      },
      onSubmit: () => {
        cols = cols.filter(c => c.name.trim());
        if (!cols.length) { toast('Garde au moins une colonne'); return false; }
        const keep = new Set(cols.map(c => c.id));
        r.items.forEach(it => Object.keys(it.values).forEach(k => { if (!keep.has(k)) delete it.values[k]; }));
        r.columns = cols.map(c => ({ ...c, name: c.name.trim() }));
        touch(r); renderBenchmark(r);
      }
    });
  }

  /* =========================================================
     RENDEZ-VOUS RÉCURRENTS
     ========================================================= */
  const addInterval = (iso, n, unit) => {
    const d = new Date(iso + 'T00:00');
    if (unit === 'semaines') d.setDate(d.getDate() + n * 7);
    else {
      const day = d.getDate();
      d.setDate(1); d.setMonth(d.getMonth() + n);
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    }
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const lastVisit = a => (a.history || []).slice().sort((x, y) => x.date < y.date ? 1 : -1)[0] || null;
  const freqLabel = a => a.everyN === 1 ? (a.unit === 'semaines' ? 'Chaque semaine' : 'Chaque mois') : `Toutes les ${a.everyN} ${a.unit}`;

  // Prochaine échéance : le RDV pris s'il existe, sinon la dernière visite + la fréquence.
  function apptNext(a) {
    if (a.nextDate) return { date: a.nextDate, booked: true };
    const l = lastVisit(a);
    if (l && a.everyN > 0) return { date: addInterval(l.date, a.everyN, a.unit), booked: false };
    return null;
  }

  function apptStatus(a) {
    const n = apptNext(a);
    if (!n) return { order: 1e6, html: '<span class="tag">Pas encore de visite notée</span>' };
    const days = daysUntil(n.date);
    if (n.booked) {
      const when = days === 0 ? 'aujourd’hui' : days === 1 ? 'demain' : `le ${fmtDate(n.date)}`;
      return { order: days, html: `<span class="tag ${days <= 7 ? 'soon' : ''} ${days < 0 ? 'late' : ''}">📅 RDV ${when}${a.nextTime ? ' à ' + esc(a.nextTime) : ''}</span>` };
    }
    if (days < 0) return { order: days, html: `<span class="tag late">À prendre · prévu vers le ${fmtDate(n.date)}</span>` };
    if (days <= 14) return { order: days, html: `<span class="tag soon">À prendre bientôt · vers le ${fmtDate(n.date)}</span>` };
    return { order: days, html: `<span class="tag">Prochain vers le ${fmtDate(n.date)}</span>` };
  }

  // Coût moyen par mois : prix moyen des visites (ou prix prévu) ramené à la fréquence.
  function apptMonthly(a) {
    const prices = (a.history || []).map(h => Number(h.price)).filter(p => p > 0);
    const avg = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : Number(a.expectedPrice) || 0;
    if (!avg || !a.everyN) return 0;
    const months = a.unit === 'semaines' ? a.everyN * 7 / 30.44 : a.everyN;
    return avg / months;
  }

  function renderAppointments() {
    const list = state.appointments.slice().sort((x, y) => apptStatus(x).order - apptStatus(y).order);
    const monthly = state.appointments.reduce((s, a) => s + apptMonthly(a), 0);
    view.innerHTML = `
      <div class="page-head">
        <div><h1>Rendez-vous</h1><p class="muted">Tes RDV qui reviennent : coiffeur, ongles, médecin… avec ce que tu as fait et payé.</p></div>
        <div class="toolbar"><button class="btn primary" id="newAppt">+ Nouveau RDV récurrent</button></div>
      </div>
      ${list.length ? `
        <p class="muted small" style="margin:-8px 0 16px">Budget moyen : <strong class="num" style="color:var(--text)">${eur0.format(monthly)} / mois</strong>, soit ${eur0.format(monthly * 12)} par an.</p>
        <div class="grid grid-2">${list.map(apptHTML).join('')}</div>`
      : '<div class="card empty">Ajoute ton premier RDV récurrent, par exemple « Coiffeur, toutes les 6 semaines ». À chaque visite, tu notes la date, le prix et ce que tu as fait, et le site te dit quand reprendre RDV.</div>'}
    `;
    $('#newAppt').addEventListener('click', () => apptForm());
    $$('.appt', view).forEach(el => {
      const a = state.appointments.find(x => x.id === el.dataset.id);
      $('[data-act=done]', el).addEventListener('click', () => visitForm(a));
      $('[data-act=book]', el).addEventListener('click', () => bookForm(a));
      $('[data-act=edit]', el).addEventListener('click', () => apptForm(a));
      $('[data-act=del]', el).addEventListener('click', () => confirmBox(`Supprimer « ${a.name} » et son historique ? Les dépenses déjà ajoutées aux finances restent.`, () => {
        state.appointments = state.appointments.filter(x => x !== a); save(); renderAppointments();
      }));
      $$('[data-act=delvisit]', el).forEach(b => b.addEventListener('click', () => {
        const h = a.history.find(x => x.id === b.dataset.v);
        confirmBox(`Supprimer la visite du ${fmtDate(h.date)}${h.txId ? ' et la dépense liée dans Finances' : ''} ?`, () => {
          a.history = a.history.filter(x => x !== h);
          if (h.txId) state.finance.transactions = state.finance.transactions.filter(t => t.id !== h.txId);
          save(); renderAppointments();
        });
      }));
      $$('[data-act=editvisit]', el).forEach(b => b.addEventListener('click', () => visitForm(a, a.history.find(x => x.id === b.dataset.v))));
    });
  }

  function apptHTML(a) {
    const st = apptStatus(a);
    const hist = (a.history || []).slice().sort((x, y) => x.date < y.date ? 1 : -1);
    const l = hist[0];
    return `
      <article class="card appt stack" style="gap:12px" data-id="${esc(a.id)}">
        <div class="goal-top">
          <div>
            <h3>${esc(a.name)}</h3>
            <div class="muted small">${esc(freqLabel(a))}${a.place ? ' · ' + esc(a.place) : ''}</div>
          </div>
          <div class="note-actions">
            <button class="icon-btn" data-act="edit" title="Modifier">✎</button>
            <button class="icon-btn" data-act="del" title="Supprimer">✕</button>
          </div>
        </div>
        <div>${st.html}</div>
        <div class="grid grid-2" style="gap:10px">
          <div class="kpi"><div class="label">Dernière fois</div>
            <div class="num" style="font-weight:600">${l ? `${fmtDate(l.date)} · ${l.price ? money(l.price) : 'prix non noté'}` : '—'}</div>
            ${l && l.note ? `<div class="small muted">${esc(l.note)}</div>` : ''}</div>
          <div class="kpi"><div class="label">Prochaine fois (prévu)</div>
            <div class="num" style="font-weight:600">${a.expectedPrice ? money(a.expectedPrice) : '—'}</div>
            ${a.nextNote ? `<div class="small muted">${esc(a.nextNote)}</div>` : ''}</div>
        </div>
        <div class="toolbar">
          <button class="btn sm primary" data-act="done">✓ C’est fait</button>
          <button class="btn sm" data-act="book">${a.nextDate ? 'Changer la date du RDV' : 'J’ai pris RDV'}</button>
        </div>
        ${hist.length ? `<details><summary class="small muted" style="cursor:pointer">Historique (${hist.length})</summary>
          <table class="table" style="margin-top:6px"><tbody>${hist.map(h => `
            <tr><td class="num" style="white-space:nowrap">${fmtDate(h.date)}</td><td class="small">${esc(h.note || '')}</td>
            <td class="right num" style="white-space:nowrap">${h.price ? money(h.price) : '—'}</td>
            <td class="right" style="white-space:nowrap"><button class="icon-btn" data-act="editvisit" data-v="${esc(h.id)}" title="Modifier">✎</button><button class="icon-btn" data-act="delvisit" data-v="${esc(h.id)}" title="Supprimer">✕</button></td></tr>`).join('')}
          </tbody></table></details>` : ''}
      </article>`;
  }

  function apptForm(a) {
    const cats = state.finance.categories.depense;
    const defCat = a ? a.category : (cats.find(c => /beaut/i.test(c)) || cats[0]);
    openModal(`
      <form>
        <h2 class="modal-title">${a ? 'Modifier le RDV récurrent' : 'Nouveau RDV récurrent'}</h2>
        <div class="form-grid">
          <div class="field full"><label>Quoi</label><input class="input" name="name" required placeholder="ex. Coiffeur" value="${esc(a ? a.name : '')}"></div>
          <div class="field"><label>Fréquence</label><div style="display:flex;gap:6px;align-items:center">
            <span class="muted small">Tous les</span>
            <input class="input num" type="number" min="1" name="everyN" value="${esc(a ? a.everyN : 6)}" style="width:70px">
            <select class="input" name="unit" style="width:auto">${['semaines', 'mois'].map(u => `<option ${a && a.unit === u || !a && u === 'semaines' ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
          <div class="field"><label>Où / contact</label><input class="input" name="place" placeholder="ex. Salon Léa, 01 23 45 67 89" value="${esc(a ? a.place : '')}"></div>
          <div class="field"><label>Prix prévu la prochaine fois (€)</label><input class="input num" name="expectedPrice" inputmode="decimal" value="${a && a.expectedPrice ? String(a.expectedPrice).replace('.', ',') : ''}"></div>
          <div class="field"><label>Catégorie dans Finances</label><select class="input" name="category">${cats.map(c => `<option ${c === defCat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
          <div class="field full"><label>Prochaine fois, je veux…</label><input class="input" name="nextNote" placeholder="ex. couleur + coupe" value="${esc(a ? a.nextNote : '')}"></div>
          ${a ? '' : `<div class="field"><label>Dernière visite (optionnel)</label><input class="input" type="date" name="lastDate"></div>
          <div class="field"><label>Prix payé la dernière fois (€)</label><input class="input num" name="lastPrice" inputmode="decimal"></div>
          <div class="field full"><label>Ce que j’ai fait la dernière fois</label><input class="input" name="lastNote" placeholder="ex. coupe + brushing"></div>`}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Annuler</button>
          <button class="btn primary">Enregistrer</button>
        </div>
      </form>`, {
      onSubmit: d => {
        const vals = {
          name: d.name.trim(), everyN: Math.max(1, Number(d.everyN) || 1), unit: d.unit, place: d.place.trim(),
          expectedPrice: parseAmount(d.expectedPrice) || 0, category: d.category, nextNote: d.nextNote.trim()
        };
        if (a) Object.assign(a, vals);
        else {
          const na = { id: uid(), createdAt: Date.now(), nextDate: '', nextTime: '', history: [], ...vals };
          if (d.lastDate) na.history.push({ id: uid(), date: d.lastDate, price: parseAmount(d.lastPrice) || 0, note: d.lastNote.trim() });
          state.appointments.push(na);
        }
        save(); renderAppointments();
      }
    });
  }

  function bookForm(a) {
    const n = apptNext(a);
    openModal(`
      <form>
        <h2 class="modal-title">RDV · ${esc(a.name)}</h2>
        <div class="form-grid">
          <div class="field"><label>Date</label><input class="input" type="date" name="date" required value="${esc(a.nextDate || (n ? n.date : todayISO()))}"></div>
          <div class="field"><label>Heure (optionnel)</label><input class="input" type="time" name="time" value="${esc(a.nextTime || '')}"></div>
        </div>
        <div class="modal-actions">
          ${a.nextDate ? '<button type="button" class="btn danger" id="unbook" style="margin-right:auto">Annuler le RDV</button>' : ''}
          <button type="button" class="btn" data-close>Fermer</button>
          <button class="btn primary">Enregistrer</button>
        </div>
      </form>`, {
      onOpen: m => { const u = $('#unbook', m); if (u) u.addEventListener('click', () => { a.nextDate = ''; a.nextTime = ''; save(); closeModal(); renderAppointments(); }); },
      onSubmit: d => { a.nextDate = d.date; a.nextTime = d.time; save(); renderAppointments(); }
    });
  }

  function visitForm(a, h) {
    const t = todayISO();
    const date = h ? h.date : (a.nextDate && a.nextDate <= t ? a.nextDate : t);
    const linked = h && h.txId && state.finance.transactions.find(x => x.id === h.txId);
    const price = h ? h.price : a.expectedPrice;
    openModal(`
      <form>
        <h2 class="modal-title">${h ? 'Modifier la visite' : 'C’est fait'} · ${esc(a.name)}</h2>
        <div class="form-grid">
          <div class="field"><label>Date</label><input class="input" type="date" name="date" required value="${esc(date)}"></div>
          <div class="field"><label>Prix payé (€)</label><input class="input num" name="price" inputmode="decimal" value="${price ? String(price).replace('.', ',') : ''}"></div>
          <div class="field full"><label>Ce que j’ai fait</label><input class="input" name="note" value="${esc(h ? h.note : a.nextNote || '')}" placeholder="ex. coupe + couleur"></div>
          ${h ? '' : `<div class="field full"><label>Prix prévu la prochaine fois (€)</label><input class="input num" name="expectedPrice" inputmode="decimal" value="${a.expectedPrice ? String(a.expectedPrice).replace('.', ',') : ''}"></div>`}
          <label class="check full"><input type="checkbox" name="toFinance" ${!h || linked ? 'checked' : ''}> Ajouter la dépense dans Finances (${esc(a.category)})</label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Annuler</button>
          <button class="btn primary">Enregistrer</button>
        </div>
      </form>`, {
      onSubmit: d => {
        const p = parseAmount(d.price) || 0;
        const v = h || { id: uid() };
        Object.assign(v, { date: d.date, price: p, note: d.note.trim() });
        let tx = v.txId && state.finance.transactions.find(x => x.id === v.txId);
        if (d.toFinance && p > 0) {
          const vals = { type: 'depense', amount: p, date: v.date, label: a.name + (v.note ? ' · ' + v.note : ''), category: a.category };
          if (tx) Object.assign(tx, vals);
          else { tx = { id: uid(), source: 'rdv', ...vals }; state.finance.transactions.push(tx); v.txId = tx.id; }
        } else if (tx) {
          state.finance.transactions = state.finance.transactions.filter(x => x !== tx); delete v.txId;
        }
        if (!h) {
          a.history.push(v);
          if (a.nextDate && a.nextDate <= d.date) { a.nextDate = ''; a.nextTime = ''; }
          const ep = parseAmount(d.expectedPrice);
          if (!isNaN(ep)) a.expectedPrice = ep;
        }
        save(); renderAppointments();
        toast(d.toFinance && p > 0 ? 'Visite notée et ajoutée aux finances' : 'Visite notée');
      }
    });
  }

  /* =========================================================
     DONNÉES
     ========================================================= */
  function renderData() {
    const size = new Blob([JSON.stringify(state)]).size;
    view.innerHTML = `
      <div class="page-head"><div><h1>Données</h1><p class="muted">Tout est enregistré dans ce navigateur, sur cet ordinateur.</p></div></div>
      <div class="grid grid-2">
        <section class="card stack" style="gap:10px">
          <h2>Sauvegarder</h2>
          <p class="muted small" style="margin:0">Télécharge un fichier avec toutes tes données. Fais-le régulièrement : si tu vides ton navigateur, tout est perdu sans sauvegarde.</p>
          <div><button class="btn primary" id="exportBtn">Exporter (JSON)</button></div>
          <p class="muted small" style="margin:0">${state.notes.length} notes · ${state.goals.length} objectifs · ${state.finance.transactions.length} opérations · ${state.research.length} benchmarks · ${state.appointments.length} RDV récurrents · ${(size / 1024).toFixed(1)} Ko</p>
        </section>
        <section class="card stack" style="gap:10px">
          <h2>Restaurer / consulter sur un autre appareil</h2>
          <p class="muted small" style="margin:0">Importe un fichier exporté (par exemple sur ton téléphone pour consulter). Cela <strong>remplace</strong> les données actuelles de ce navigateur.</p>
          <div><label class="btn">Importer un fichier JSON<input type="file" accept=".json,application/json" id="importJson" hidden></label></div>
        </section>
        <section class="card stack" style="gap:10px">
          <h2>Exporter les finances (CSV)</h2>
          <p class="muted small" style="margin:0">Toutes tes opérations dans un fichier lisible par Excel ou Google Sheets.</p>
          <div><button class="btn" id="exportCsv">Exporter les opérations</button></div>
        </section>
        <section class="card stack" style="gap:10px">
          <h2>Tout effacer</h2>
          <p class="muted small" style="margin:0">Supprime toutes les données de ce navigateur. Pense à exporter avant.</p>
          <div><button class="btn danger" id="resetBtn">Tout effacer</button></div>
        </section>
      </div>`;

    $('#exportBtn').addEventListener('click', () => {
      download(`mon-espace-${todayISO()}.json`, JSON.stringify(state, null, 2), 'application/json');
      toast('Sauvegarde téléchargée');
    });
    $('#exportCsv').addEventListener('click', () => {
      const rows = [['Date', 'Type', 'Catégorie', 'Libellé', 'Montant']].concat(
        state.finance.transactions.slice().sort((a, b) => a.date < b.date ? -1 : 1)
          .map(t => [t.date, t.type === 'revenu' ? 'Revenu' : 'Dépense', t.category, t.label, (t.type === 'revenu' ? t.amount : -t.amount).toFixed(2).replace('.', ',')]));
      const csv = rows.map(r => r.map(c => /[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(';')).join('\r\n');
      download(`finances-${todayISO()}.csv`, '﻿' + csv, 'text/csv');
    });
    $('#importJson').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      f.text().then(txt => {
        let data;
        try { data = JSON.parse(txt); } catch (err) { toast('Fichier JSON invalide'); return; }
        confirmBox('Remplacer toutes les données de ce navigateur par celles du fichier ?', () => {
          state = normalize(data); save(); render(); toast('Données importées');
        }, 'Remplacer');
      });
    });
    $('#resetBtn').addEventListener('click', () => confirmBox('Effacer définitivement toutes les données de ce navigateur ?', () => {
      state = emptyState(); save(); render(); toast('Tout est effacé');
    }, 'Tout effacer'));
  }

  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* ---------- Exemples ---------- */
  function loadDemo() {
    const t = todayISO();
    const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    state.notes.push(
      { id: uid(), title: '', text: 'Prendre RDV chez le dermato', due: inDays(3), tag: 'santé', done: false, pinned: true, createdAt: Date.now() },
      { id: uid(), title: 'Courses', text: 'Lait d’avoine\nCrème solaire SPF 50\nCafé', due: t, tag: 'courses', done: false, pinned: false, createdAt: Date.now() - 1 },
      { id: uid(), title: '', text: 'Renvoyer le colis Zara', due: inDays(-1), tag: 'admin', done: false, pinned: false, createdAt: Date.now() - 2 },
      { id: uid(), title: '', text: 'Appeler mamie', due: '', tag: '', done: true, pinned: false, createdAt: Date.now() - 3 }
    );
    state.goals.push(
      { id: uid(), title: 'Épargner pour le voyage au Japon', category: 'Finances', deadline: inDays(180), description: '', mode: 'nombre', current: 850, target: 2500, unit: '€', steps: [], createdAt: Date.now() },
      { id: uid(), title: 'Lire 12 livres cette année', category: 'Perso', deadline: `${t.slice(0, 4)}-12-31`, description: '', mode: 'nombre', current: 7, target: 12, unit: 'livres', steps: [], createdAt: Date.now() },
      { id: uid(), title: 'Routine skincare simple', category: 'Santé', deadline: '', description: 'Trouver une routine matin/soir qui marche pour ma peau.', mode: 'etapes', current: 0, target: 0, unit: '',
        steps: [{ id: uid(), text: 'Choisir un nettoyant doux', done: true }, { id: uid(), text: 'Choisir un sérum', done: false }, { id: uid(), text: 'Trouver une crème solaire', done: false }], createdAt: Date.now() }
    );
    const tx = [];
    for (let i = 5; i >= 0; i--) {
      const mk = shiftMonth(currentMonth(), -i);
      const day = d => `${mk}-${pad(d)}`;
      const r = n => Math.round((n + (Math.random() - .5) * n * .3) * 100) / 100;
      tx.push(
        ['revenu', 2100, 'Salaire', 'Salaire', day(1)], ['depense', 750, 'Logement', 'Loyer', day(3)],
        ['depense', r(220), 'Courses', 'Carrefour', day(6)], ['depense', r(90), 'Courses', 'Monoprix', day(17)],
        ['depense', r(85), 'Restaurants', 'Uber Eats', day(12)], ['depense', 86.4, 'Transport', 'Navigo', day(2)],
        ['depense', 13.49, 'Abonnements', 'Netflix', day(8)], ['depense', r(60), 'Beauté & soins', 'Sephora', day(14)],
        ['depense', r(120), 'Shopping', 'Zara', day(20)], ['depense', r(45), 'Loisirs', 'Cinéma', day(22)]
      );
      if (i % 2 === 0) tx.push(['revenu', r(300), 'Freelance', 'Mission freelance', day(15)]);
    }
    const today = todayISO();
    tx.filter(x => x[4] <= today).forEach(([type, amount, category, label, date]) =>
      state.finance.transactions.push({ id: uid(), type, amount, category, label, date, source: 'manuel' }));
    const cols = DEFAULT_COLUMNS();
    const v = (...a) => Object.fromEntries(cols.map((c, i) => [c.id, a[i] == null ? '' : a[i]]));
    state.research.push({
      id: uid(), title: 'Sérums vitamine C', topic: 'Skincare', description: 'Anti-taches et éclat, peau mixte, budget < 40 €',
      columns: cols, createdAt: Date.now(), updatedAt: Date.now(), conclusion: '',
      items: [
        { id: uid(), fav: true, values: v('Vitamin C 23% + HA Spheres', 'The Ordinary', 9.9, '30 ml', 3, 'Acide ascorbique 23 %, acide hyaluronique', 'Pas cher mais picote un peu', 'theordinary.com') },
        { id: uid(), fav: false, values: v('C E Ferulic', 'SkinCeuticals', 175, '30 ml', 5, 'Vitamine C 15 %, vitamine E, acide férulique', 'La référence mais hors budget', 'skinceuticals.fr') },
        { id: uid(), fav: false, values: v('Sérum Vitamine C10', 'La Roche-Posay', 39, '30 ml', 4, 'Vitamine C 10 %, acide salicylique', 'Texture agréable, trouvé en pharmacie', '') }
      ]
    });
    state.appointments.push({
      id: uid(), name: 'Coiffeur', everyN: 6, unit: 'semaines', place: 'Salon du quartier', expectedPrice: 45, category: 'Beauté & soins',
      nextNote: 'Coupe + soin', nextDate: '', nextTime: '', createdAt: Date.now(),
      history: [{ id: uid(), date: inDays(-50), price: 35, note: 'Coupe' }, { id: uid(), date: inDays(-92), price: 60, note: 'Coupe + couleur' }]
    });
    save();
  }

  render();
})();
