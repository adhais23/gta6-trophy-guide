// Leonida Trophy Guide: tracker, filters, spoiler setting, export/import and roadmap.
// All trophy data lives in data/trophies.json; progress lives in localStorage on this device.
const KEY = 'gta6-trophy-checklist';
const SPOILER_KEY = 'gta6-trophy-spoiler';

const params = new URLSearchParams(location.search);

// The trophy data is the whole app: if it cannot be loaded, say so on the page
// instead of leaving a blank checklist.
let doc;
try {
  const res = await fetch('data/trophies.json');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  doc = await res.json();
} catch {
  const msg = document.createElement('p');
  msg.className = 'empty';
  msg.textContent = 'Could not load the trophy data (data/trophies.json). Check the file is beside this page and reload.';
  document.getElementById('cards').replaceChildren(msg);
  throw new Error('trophy data failed to load');
}
const trophies = doc.trophies;
const byId = new Map(trophies.map((t) => [t.id, t]));

// A corrupt progress value in localStorage must not break the whole page.
function loadEarned() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return new Set((Array.isArray(raw) ? raw : []).filter((id) => byId.has(id)));
  } catch {
    return new Set();
  }
}

let earned = loadEarned();
let spoiler = localStorage.getItem(SPOILER_KEY) === '1';

// Screenshot scenes (?shot=checklist|roadmap|filters|progress) may preset the view.
const shot = params.get('shot');
if (params.get('earn')) {
  for (const n of params.get('earn').split(',')) {
    const id = Number(n);
    if (byId.has(id)) earned.add(id);
  }
  save();
}
if (params.get('spoiler') === '1') spoiler = true;
if (params.get('spoiler') === '0') spoiler = false;

const $ = (id) => document.getElementById(id);
const cardsEl = $('cards');
const kindLabels = {
  story: 'Story', missable: 'Missable', collectibles: 'Collectibles', activities: 'Activities',
  crime: 'Crime & robberies', 'side-quests': 'Side quests', other: 'Other', online: 'Online',
};

function save() {
  localStorage.setItem(KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}

function isSpoilerHidden(t) {
  return spoiler && t.kind === 'story' && !earned.has(t.id);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function gradeBadge(grade) {
  return el('span', 'badge grade-' + grade, grade);
}

function renderProgress() {
  const total = trophies.length;
  const n = earned.size;
  $('progress-count').textContent = `${n} of ${total} earned`;
  $('progress-pct').textContent = `${Math.round((n / total) * 100)}%`;
  $('progress-fill').style.width = `${(n / total) * 100}%`;
  const counts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const id of earned) counts[byId.get(id).grade] += 1;
  $('progress-grades').textContent =
    `${counts.platinum} platinum · ${counts.gold} gold · ${counts.silver} silver · ${counts.bronze} bronze`;
}

function sourceLinks(t) {
  const wrap = el('p', 'sources');
  wrap.append(el('span', 'sources-label', 'Sources: '));
  (t.sources ?? []).forEach((s, i) => {
    if (i) wrap.append(document.createTextNode(' · '));
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = s.name;
    wrap.append(a);
  });
  return wrap;
}

function trophyCard(t) {
  const li = el('li', 'card' + (earned.has(t.id) ? ' earned' : ''));
  li.dataset.id = t.id;

  const head = el('div', 'card-head');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = earned.has(t.id);
  box.setAttribute('aria-label', `Mark ${t.name} as earned`);
  box.addEventListener('change', () => {
    if (box.checked) earned.add(t.id);
    else earned.delete(t.id);
    save();
    renderProgress();
    renderCards();
  });
  head.append(box);

  const titleWrap = el('div', 'card-titles');
  if (isSpoilerHidden(t)) {
    titleWrap.append(el('h3', 'trophy-name spoiler-name', 'Hidden trophy — story spoiler'));
    titleWrap.append(el('p', 'trophy-desc', 'Earn this trophy to reveal its name and description.'));
  } else {
    titleWrap.append(el('h3', 'trophy-name', t.name));
    titleWrap.append(el('p', 'trophy-desc', t.description));
  }
  head.append(titleWrap);

  const meta = el('div', 'card-meta');
  meta.append(gradeBadge(t.grade));
  meta.append(el('span', 'badge kind-' + t.kind, kindLabels[t.kind] ?? t.kind));
  if (t.missable) meta.append(el('span', 'badge missable', '⚠ Missable'));
  if (t.count) {
    const target = t.count.unit === '$'
      ? `$${t.count.target.toLocaleString('en-US')}`
      : `${t.count.target} / ${t.count.of}`;
    meta.append(el('span', 'badge count', target));
  }
  head.append(meta);
  li.append(head);

  const detail = el('div', 'card-detail');
  if (isSpoilerHidden(t)) {
    detail.append(el('p', 'guide', 'Turn off “Hide story spoilers” or earn this trophy to read its guide.'));
  } else {
    detail.append(el('p', 'guide', t.guide));
    if (t.missableNote) detail.append(el('p', 'missable-note', '⚠ ' + t.missableNote));
    detail.append(sourceLinks(t));
  }
  li.append(detail);

  head.addEventListener('click', (e) => {
    if (e.target === box) return;
    li.classList.toggle('open');
  });
  return li;
}

function visibleTrophies() {
  const q = $('search').value.trim().toLowerCase();
  const kind = $('kind').value;
  const grade = $('grade').value;
  const show = $('earned-filter').value;
  return trophies.filter((t) => {
    if (kind === 'online') return false;
    if (kind !== 'all' && t.kind !== kind) return false;
    if (grade !== 'all' && t.grade !== grade) return false;
    if (show === 'earned' && !earned.has(t.id)) return false;
    if (show === 'missing' && earned.has(t.id)) return false;
    if (q) {
      const hay = `${t.name} ${t.description} ${t.guide}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderCards() {
  const list = visibleTrophies();
  cardsEl.replaceChildren(...list.map(trophyCard));
  const openId = Number(params.get('open'));
  if (openId && byId.has(openId)) {
    const card = cardsEl.querySelector(`[data-id="${openId}"]`);
    if (card) card.classList.add('open');
  }
  $('empty').hidden = list.length > 0;
  $('result-count').textContent = list.length === trophies.length
    ? `Showing all ${list.length} trophies.`
    : `Showing ${list.length} of ${trophies.length} trophies.`;
  const note = $('filter-note');
  if ($('kind').value === 'online') {
    note.hidden = false;
    note.textContent = 'There are no online trophies in GTA VI — all 55 unlock in single-player. (PowerPyx, 18 Nov 2026.)';
  } else {
    note.hidden = true;
  }
}

function renderRoadmap() {
  const ol = $('roadmap');
  ol.replaceChildren();
  for (const stage of doc.roadmap ?? []) {
    const li = el('li', 'stage');
    li.append(el('h3', 'stage-title', `Stage ${stage.stage} — ${stage.title}`));
    li.append(el('p', 'stage-text', stage.text));
    const chips = el('p', 'stage-trophies');
    for (const id of stage.trophies) {
      const t = byId.get(id);
      if (!t) continue;
      const chip = el('span', 'chip' + (earned.has(id) ? ' done' : ''), t.name);
      chips.append(chip);
    }
    li.append(chips);
    ol.append(li);
  }
}

function renderSources() {
  const seen = new Map();
  for (const t of trophies) {
    for (const s of t.sources ?? []) seen.set(s.url, s.name);
  }
  const ul = $('source-list');
  ul.replaceChildren();
  for (const [url, name] of seen) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = name;
    li.append(a);
    ul.append(li);
  }
}

function showView(name) {
  for (const v of ['tracker', 'roadmap', 'about']) {
    $('view-' + v).hidden = v !== name;
    const tab = $('tab-' + v);
    tab.classList.toggle('active', v === name);
    tab.setAttribute('aria-selected', String(v === name));
  }
}

$('tab-tracker').addEventListener('click', () => showView('tracker'));
$('tab-roadmap').addEventListener('click', () => showView('roadmap'));
$('tab-about').addEventListener('click', () => showView('about'));

for (const id of ['search', 'kind', 'grade', 'earned-filter']) {
  $(id).addEventListener('input', renderCards);
}

$('spoiler').checked = spoiler;
$('spoiler').addEventListener('change', (e) => {
  spoiler = e.target.checked;
  localStorage.setItem(SPOILER_KEY, spoiler ? '1' : '0');
  renderCards();
});

$('export').addEventListener('click', () => {
  const payload = {
    game: 'Grand Theft Auto VI',
    exportedAt: new Date().toISOString(),
    earned: [...earned].sort((a, b) => a - b),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gta6-trophy-progress.json';
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before releasing the blob URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned;
    const next = new Set();
    for (const id of ids ?? []) if (byId.has(Number(id))) next.add(Number(id));
    earned = next;
    save();
    renderProgress();
    renderCards();
  } catch {
    alert('That file could not be read as trophy progress.');
  }
  e.target.value = '';
});

$('reset').addEventListener('click', () => {
  if (!earned.size) return;
  if (confirm('Clear all earned trophies?')) {
    earned = new Set();
    save();
    renderProgress();
    renderCards();
  }
});

// Screenshot scenes: preset filters and view from the query string.
if (params.get('kind')) $('kind').value = params.get('kind');
if (params.get('grade')) $('grade').value = params.get('grade');
if (params.get('q')) $('search').value = params.get('q');
if (params.get('show')) $('earned-filter').value = params.get('show');
if (shot === 'roadmap') showView('roadmap');
if (shot === 'filters') $('spoiler').checked = true;

renderProgress();
renderCards();
renderRoadmap();
renderSources();
