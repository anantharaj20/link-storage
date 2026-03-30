// ── Storage ────────────────────────────────────
const STORE_KEY = 'linkvault_links';

function loadLinks() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}

function saveLinks(links) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(links)); }
  catch { /* localStorage unavailable — data lives in memory for this session */ }
}

// ── State ──────────────────────────────────────
let links = loadLinks();
let editingId = null;
let currentTags = [];
let activeTagFilter = 'all';
let searchQuery = '';

// ── Tag colours (cycle through palette) ───────
const TAG_COLORS = [
  { bg: 'rgba(110,64,201,0.18)', text: '#a78bfa' },
  { bg: 'rgba(13,148,136,0.18)', text: '#2dd4bf' },
  { bg: 'rgba(234,88,12,0.18)',  text: '#fb923c' },
  { bg: 'rgba(37,99,235,0.18)',  text: '#60a5fa' },
  { bg: 'rgba(219,39,119,0.18)', text: '#f472b6' },
  { bg: 'rgba(200,241,53,0.18)', text: '#c8f135' },
];

function tagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) & 0xffff;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

// ── DOM Refs ───────────────────────────────────
const fab          = document.getElementById('fab');
const backdrop     = document.getElementById('modal-backdrop');
const modalClose   = document.getElementById('modal-close');
const btnCancel    = document.getElementById('btn-cancel');
const linkForm     = document.getElementById('link-form');
const inputTitle   = document.getElementById('input-title');
const inputUrl     = document.getElementById('input-url');
const tagInput     = document.getElementById('tag-input');
const tagsWrap     = document.getElementById('tags-wrap');
const cardsGrid    = document.getElementById('cards-grid');
const emptyState   = document.getElementById('empty-state');
const searchInput  = document.getElementById('search');
const filterBar    = document.getElementById('filter-bar');
const countBadge   = document.getElementById('count-badge');
const sectionLabel = document.getElementById('section-label');
const modalHeading = document.getElementById('modal-heading');
const btnSubmit    = document.getElementById('btn-submit');
const toast        = document.getElementById('toast');

// ── Modal ──────────────────────────────────────
function openModal(link = null) {
  editingId = link ? link.id : null;
  currentTags = link ? [...link.tags] : [];

  modalHeading.textContent = link ? 'Edit Link' : 'Add Link';
  btnSubmit.textContent    = link ? 'Update Link' : 'Save Link';
  inputTitle.value = link ? link.title : '';
  inputUrl.value   = link ? link.url   : '';

  // Clear tag chips & re-render
  renderTagChips();

  clearErrors();
  backdrop.classList.add('open');
  setTimeout(() => inputTitle.focus(), 250);
}

function closeModal() {
  backdrop.classList.remove('open');
  linkForm.reset();
  currentTags = [];
  renderTagChips();
  clearErrors();
  editingId = null;
}

fab.addEventListener('click', () => openModal());
modalClose.addEventListener('click', closeModal);
btnCancel.addEventListener('click', closeModal);
backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── Tag chips ──────────────────────────────────
function renderTagChips() {
  // Remove existing chips
  tagsWrap.querySelectorAll('.tag-chip').forEach(c => c.remove());

  currentTags.forEach(tag => {
    const { bg, text } = tagColor(tag);
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.style.background = bg;
    chip.style.color = text;
    chip.innerHTML = `${escHtml(tag)}<span class="remove-tag" data-tag="${escHtml(tag)}">×</span>`;
    chip.querySelector('.remove-tag').addEventListener('click', () => {
      currentTags = currentTags.filter(t => t !== tag);
      renderTagChips();
    });
    tagsWrap.insertBefore(chip, tagInput);
  });
}

tagInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addTag(tagInput.value);
  }
  if (e.key === 'Backspace' && tagInput.value === '' && currentTags.length) {
    currentTags.pop();
    renderTagChips();
  }
});

tagInput.addEventListener('blur', () => {
  if (tagInput.value.trim()) addTag(tagInput.value);
});

function addTag(raw) {
  const tag = raw.trim().replace(/,/g, '').toLowerCase();
  if (tag && !currentTags.includes(tag) && currentTags.length < 5) {
    currentTags.push(tag);
    renderTagChips();
  }
  tagInput.value = '';
}

// ── Validation ─────────────────────────────────
function clearErrors() {
  inputTitle.classList.remove('error');
  inputUrl.classList.remove('error');
  document.getElementById('err-title').classList.remove('visible');
  document.getElementById('err-url').classList.remove('visible');
}

function validate() {
  let ok = true;
  clearErrors();

  if (!inputTitle.value.trim()) {
    inputTitle.classList.add('error');
    document.getElementById('err-title').classList.add('visible');
    ok = false;
  }

  let url = inputUrl.value.trim();
  if (!url) {
    inputUrl.classList.add('error');
    document.getElementById('err-url').classList.add('visible');
    ok = false;
  } else {
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); inputUrl.value = url; }
    catch {
      inputUrl.classList.add('error');
      document.getElementById('err-url').classList.add('visible');
      ok = false;
    }
  }
  return ok;
}

// ── Save logic (shared by form submit + button click) ──
function handleSave() {
  if (!validate()) return;
  try {
    const title = inputTitle.value.trim();
    const url   = inputUrl.value.trim();
    if (editingId) {
      links = links.map(l => l.id === editingId
        ? { ...l, title, url, tags: [...currentTags], editedAt: Date.now() }
        : l
      );
      showToast('\u270F\uFE0F Link updated');
    } else {
      links.unshift({ id: uid(), title, url, tags: [...currentTags], createdAt: Date.now() });
      showToast('\u2705 Link saved');
    }
    saveLinks(links);
    closeModal();
  } catch(err) {
    console.error('Save error:', err);
    showToast('\u274C Error saving link');
  } finally {
    render();
  }
}

// Wire both form submit AND direct button click so it works regardless
linkForm.addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); handleSave(); });
btnSubmit.addEventListener('click',  e => { e.preventDefault(); handleSave(); });

// ── Render ─────────────────────────────────────
function getAllTags() {
  const set = new Set();
  links.forEach(l => l.tags.forEach(t => set.add(t)));
  return [...set].sort();
}

function filterLinks() {
  return links.filter(l => {
    const matchSearch = !searchQuery || l.title.toLowerCase().includes(searchQuery) || l.url.toLowerCase().includes(searchQuery);
    const matchTag = activeTagFilter === 'all' || l.tags.includes(activeTagFilter);
    return matchSearch && matchTag;
  });
}

function render() {
  const filtered = filterLinks();
  const allTags  = getAllTags();

  // Filter bar
  const existingBtns = [...filterBar.querySelectorAll('.tag-filter')];
  existingBtns.forEach(b => { if (b.dataset.tag !== 'all') b.remove(); });

  allTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag-filter' + (activeTagFilter === tag ? ' active' : '');
    btn.dataset.tag = tag;
    btn.textContent = tag;
    const { bg, text } = tagColor(tag);
    if (activeTagFilter === tag) {
      btn.style.background = bg;
      btn.style.color = text;
      btn.style.borderColor = text;
    }
    btn.addEventListener('click', () => {
      activeTagFilter = tag;
      render();
    });
    filterBar.appendChild(btn);
  });

  // All btn state
  const allBtn = filterBar.querySelector('[data-tag="all"]');
  allBtn.className = 'tag-filter' + (activeTagFilter === 'all' ? ' active' : '');

  // Section label
  const q = searchQuery ? `"${searchQuery}"` : null;
  const t = activeTagFilter !== 'all' ? `#${activeTagFilter}` : null;
  sectionLabel.textContent = filtered.length
    ? `${filtered.length} link${filtered.length === 1 ? '' : 's'}${q ? ` matching ${q}` : ''}${t ? ` tagged ${t}` : ''}`
    : 'No results';

  // Count badge
  countBadge.textContent = `${links.length} link${links.length === 1 ? '' : 's'}`;

  // Empty state
  emptyState.classList.toggle('visible', filtered.length === 0);

  // Cards
  cardsGrid.innerHTML = '';
  filtered.forEach(link => cardsGrid.appendChild(buildCard(link)));
}

function buildCard(link) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = link.id;

  // Favicon
  const faviconEl = buildFavicon(link.url);

  // Tags
  const tagsHtml = link.tags.length
    ? `<div class="card-tags">${link.tags.map(tag => {
        const { bg, text } = tagColor(tag);
        return `<span class="tag-pill" style="background:${bg};color:${text}" data-filter-tag="${escHtml(tag)}">#${escHtml(tag)}</span>`;
      }).join('')}</div>`
    : '';

  // Date
  const date = new Date(link.createdAt);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const domain = getDomain(link.url);

card.innerHTML = `
  <div class="card-header">
    <div class="card-favicon"></div>
    <div class="card-meta">
      <div class="card-title" title="${escHtml(link.title)}">${escHtml(link.title)}</div>
      <a class="card-url" href="${link.url}" target="_blank">
        ${escHtml(domain)}
      </a>
    </div>
  </div>

    ${tagsHtml}
    <div class="card-actions">
      <a class="btn-open" href="${escHtml(link.url)}" target="_blank" rel="noopener noreferrer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Open
      </a>
      <button class="btn-icon" data-action="edit" title="Edit link">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn-icon danger" data-action="delete" title="Delete link">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
      <span class="card-date">${dateStr}</span>
    </div>
  `;

  card.querySelector('.card-favicon').appendChild(faviconEl);

  // Tag filter click
  card.querySelectorAll('.tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      activeTagFilter = pill.dataset.filterTag;
      render();
    });
  });

  // Edit
  card.querySelector('[data-action="edit"]').addEventListener('click', () => {
    const link = links.find(l => l.id === card.dataset.id);
    if (link) openModal(link);
  });

  // Delete
  card.querySelector('[data-action="delete"]').addEventListener('click', () => {
    deleteLink(card.dataset.id);
  });

  return card;
}

function buildFavicon(url) {
  const container = document.createElement('div');
  const img = document.createElement('img');
  try {
    const u = new URL(url);
    img.src = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
    img.alt = '';
    img.onerror = () => { container.innerHTML = '🔗'; img.remove(); };
    container.appendChild(img);
  } catch { container.innerHTML = '🔗'; }
  return container;
}

// ── Delete ─────────────────────────────────────
function deleteLink(id) {
  const card = cardsGrid.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.style.transition = 'opacity 0.2s, transform 0.2s';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    setTimeout(() => {
      links = links.filter(l => l.id !== id);
      saveLinks(links);
      if (activeTagFilter !== 'all' && !getAllTags().includes(activeTagFilter)) {
        activeTagFilter = 'all';
      }
      render();
    }, 200);
  }
  showToast('🗑️ Link deleted');
}

// ── Search ─────────────────────────────────────
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  render();
});

// ── Filter bar all-btn ─────────────────────────
filterBar.querySelector('[data-tag="all"]').addEventListener('click', () => {
  activeTagFilter = 'all';
  render();
});

// ── Toast ──────────────────────────────────────
let toastTimer;
function showToast(msg) {
  toast.innerHTML = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// ── Utilities ──────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

// ── Boot ───────────────────────────────────────
render();