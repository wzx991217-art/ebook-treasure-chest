let books = [];
let searchTimeout = null;
const MAX_RESULTS = 100;
const RECOMMEND_SIZE = 12;
const STORAGE_KEY = 'ebook_user_records_v1';

let selectedCategory = 'all';
let userRecords = [];
let lastRecommendation = { serious: [], fun: [] };

const RECORD_TYPES = [
  { key: 'read', label: '已读' },
  { key: 'want', label: '想读' },
  { key: 'downloaded', label: '下载过' },
  { key: 'like', label: '喜欢' },
  { key: 'dislike', label: '不喜欢' }
];

const PREFERENCES = {
  serious: ['文学', '神话', '哲学', '思想', '历史', '心理', '传记', '古典', '世界', '诗歌', '艺术', '社会', '宗教'],
  fun: ['言情', '爱情', '青春', '奇幻', '玄幻', '武侠', '推理', '悬疑', '侦探', '三国', '宫斗', '后宫', '权谋', '仙侠', '耽美', 'BL'],
  avoid: ['鸡汤']
};

async function loadBooks() {
  try {
    const res = await fetch('all-books.json');
    if (res.ok) {
      books = await res.json();
      initCategoryFilter();
      return;
    }
  } catch (_) {}

  try {
    const res = await fetch('books.json');
    if (res.ok) {
      books = await res.json();
      initCategoryFilter();
      return;
    }
  } catch (_) {}

  alert('⚠️ 无法加载书籍数据，请刷新重试');
}

const normalize = (s) => (s || '').toLowerCase();

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    userRecords = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(userRecords)) userRecords = [];
  } catch (_) {
    userRecords = [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userRecords));
}

function bookKey(book) {
  return `${book.title || ''}::${book.author || ''}`;
}

function addRecord(book, recordType) {
  const now = new Date().toISOString();
  userRecords = userRecords.filter((r) => !(r.key === bookKey(book) && r.recordType === recordType));
  userRecords.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key: bookKey(book),
    title: book.title || '未知',
    author: book.author || '未知',
    category: book.category || '未分类',
    recordType,
    recordLabel: RECORD_TYPES.find((t) => t.key === recordType)?.label || recordType,
    createdAt: now
  });
  saveRecords();
  renderRecords();
  renderRecordSummary();
}

function removeRecord(id) {
  userRecords = userRecords.filter((r) => r.id !== id);
  saveRecords();
  renderRecords();
  renderRecordSummary();
}

function clearRecords() {
  if (!window.confirm('确定清空全部记录吗？此操作不可撤销。')) return;
  if (!window.confirm('请再次确认：真的要清空全部记录？')) return;
  userRecords = [];
  saveRecords();
  renderRecords();
  renderRecordSummary();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function createActionButtons(book) {
  const wrap = document.createElement('div');
  wrap.className = 'action-buttons';
  RECORD_TYPES.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn';
    btn.type = 'button';
    btn.textContent = t.label;
    btn.addEventListener('click', () => addRecord(book, t.key));
    wrap.appendChild(btn);
  });
  return wrap;
}

function categoryMatch(book, bucket) {
  const c = book.category || '';
  const t = book.title || '';
  return bucket.some((k) => c.includes(k) || t.includes(k));
}

function isAvoid(book) {
  return PREFERENCES.avoid.some((k) => (book.category || '').includes(k) || (book.title || '').includes(k));
}

function initCategoryFilter() {
  const select = document.getElementById('category-filter');
  if (!select) return;

  const categories = Array.from(new Set(books.map((b) => b.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  for (const c of categories) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  }

  select.addEventListener('change', (e) => {
    selectedCategory = e.target.value;
    const keyword = (document.getElementById('search-input')?.value || '').trim();
    if (keyword) renderResults(searchBooks(keyword));
  });
}

function searchBooks(keyword) {
  const k = normalize(keyword).trim();
  if (!k) return [];
  const keywords = k.split(/\s+/);

  return books
    .filter((b) => {
      if (selectedCategory !== 'all' && b.category !== selectedCategory) return false;
      const title = normalize(b.title);
      const author = normalize(b.author);
      const category = normalize(b.category);
      return keywords.every((word) => title.includes(word) || author.includes(word) || category.includes(word));
    })
    .slice(0, MAX_RESULTS);
}

function renderBookCard(book, reason = '') {
  const div = document.createElement('div');
  div.className = 'book-card';
  const safeLink = escapeHtml(book.link || '#');
  const typeBadge = reason.includes('快乐狗血') ? '<span class="badge fun">快乐狗血</span>' : reason ? '<span class="badge serious">正经阅读</span>' : '';

  div.innerHTML = `
    <div class="title-row">
      <strong>${escapeHtml(book.title || '未知')}</strong>
      ${typeBadge}
    </div>
    <div class="meta">👤 ${escapeHtml(book.author || '未知')} ｜ 📂 ${escapeHtml(book.category || '未分类')}</div>
    ${reason ? `<div class="reason">${escapeHtml(reason)}</div>` : ''}
    <div class="book-ops">
      <a href="${safeLink}" target="_blank" rel="noopener" class="book-link">📥 资源链接</a>
    </div>
  `;
  div.appendChild(createActionButtons(book));
  return div;
}

function renderResults(results) {
  const box = document.getElementById('search-results');
  box.innerHTML = '';

  if (results.length === 0) {
    box.innerHTML = "<p class='empty'>❌ 没有找到相关书籍</p>";
    return;
  }

  const countDiv = document.createElement('div');
  countDiv.className = 'result-count';
  countDiv.innerHTML = `<strong>找到 ${results.length}${results.length === MAX_RESULTS ? '+' : ''} 条结果</strong>`;
  box.appendChild(countDiv);
  results.forEach((b) => box.appendChild(renderBookCard(b)));
}

function uniqueByTitle(arr) {
  const seen = new Set();
  return arr.filter((b) => {
    const key = `${b.title}::${b.author}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function weightFromRecords() {
  const likeBoost = { like: 3, read: 2, downloaded: 1, want: 1, dislike: -3 };
  const tagWeight = new Map();
  const authorWeight = new Map();
  const titleWeight = new Map();

  userRecords.forEach((r) => {
    const w = likeBoost[r.recordType] || 0;
    (r.category || '').split(/[\/、，,\s]+/).filter(Boolean).forEach((tag) => tagWeight.set(tag, (tagWeight.get(tag) || 0) + w));
    if (r.author) authorWeight.set(r.author, (authorWeight.get(r.author) || 0) + w);
    if (r.title) titleWeight.set(r.title, (titleWeight.get(r.title) || 0) + w);
  });

  return { tagWeight, authorWeight, titleWeight };
}

function buildReason(book, type, weights) {
  const authorScore = weights.authorWeight.get(book.author) || 0;
  const tags = (book.category || '').split(/[\/、，,\s]+/).filter(Boolean);
  const topTag = tags.sort((a, b) => (weights.tagWeight.get(b) || 0) - (weights.tagWeight.get(a) || 0))[0];
  if (authorScore > 0) return `因为你喜欢${book.author}相关作品，继续推荐相近阅读。`;
  if (topTag && (weights.tagWeight.get(topTag) || 0) > 0) return `因为你最近标记了${topTag}类书籍，推荐同类题材。`;
  return type === 'serious'
    ? `正经阅读：题材含${book.category || '文学/思想'}，贴近你的理性与体系感偏好。`
    : `快乐狗血：含${book.category || '情感冲突'}元素，偏好拉扯与破镜重圆向。`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRecommendations(pool, count, prevKeys) {
  const randomized = shuffle(pool);
  const first = randomized.filter((b) => !prevKeys.has(bookKey(b))).slice(0, count);
  if (first.length >= count) return first;
  const more = randomized.filter((b) => !first.includes(b)).slice(0, count - first.length);
  return [...first, ...more];
}

function recommendForMe() {
  if (!books.length) return;

  const weights = weightFromRecords();
  const dislikeTags = new Set(Array.from(weights.tagWeight.entries()).filter(([, v]) => v < 0).map(([k]) => k));

  const score = (b, type) => {
    const category = b.category || '';
    const tags = category.split(/[\/、，,\s]+/).filter(Boolean);
    let s = 0;
    tags.forEach((t) => (s += weights.tagWeight.get(t) || 0));
    s += weights.authorWeight.get(b.author) || 0;
    if (type === 'serious' && categoryMatch(b, PREFERENCES.serious)) s += 3;
    if (type === 'fun' && categoryMatch(b, PREFERENCES.fun)) s += 3;
    if (isAvoid(b)) s -= 4;
    if (tags.some((t) => dislikeTags.has(t))) s -= 3;
    return s;
  };

  const basePool = uniqueByTitle(books.filter((b) => !isAvoid(b)));
  const seriousPool = basePool.filter((b) => categoryMatch(b, PREFERENCES.serious)).sort((a, b) => score(b, 'serious') - score(a, 'serious'));
  const funPool = basePool.filter((b) => categoryMatch(b, PREFERENCES.fun)).sort((a, b) => score(b, 'fun') - score(a, 'fun'));

  const serious = pickRecommendations(seriousPool, RECOMMEND_SIZE, new Set(lastRecommendation.serious));
  const fun = pickRecommendations(funPool, RECOMMEND_SIZE, new Set(lastRecommendation.fun));

  lastRecommendation = {
    serious: serious.map((b) => bookKey(b)),
    fun: fun.map((b) => bookKey(b))
  };

  const seriousBox = document.getElementById('serious-recs');
  const funBox = document.getElementById('fun-recs');
  seriousBox.innerHTML = '';
  funBox.innerHTML = '';

  if (!serious.length) seriousBox.innerHTML = '<p class="empty">暂无匹配，建议放宽筛选条件。</p>';
  if (!fun.length) funBox.innerHTML = '<p class="empty">暂无匹配，建议放宽筛选条件。</p>';

  serious.forEach((b) => seriousBox.appendChild(renderBookCard(b, buildReason(b, 'serious', weights))));
  fun.forEach((b) => funBox.appendChild(renderBookCard(b, buildReason(b, 'fun', weights))));

  document.getElementById('recommendation-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderRecordSummary() {
  const summary = document.getElementById('record-summary');
  if (!summary) return;
  const counter = RECORD_TYPES.map((t) => `${t.label} ${userRecords.filter((r) => r.recordType === t.key).length}`).join(' ｜ ');
  summary.textContent = counter;
}

function renderRecords() {
  const box = document.getElementById('record-list');
  if (!box) return;
  box.innerHTML = '';
  if (!userRecords.length) {
    box.innerHTML = '<p class="empty">暂无记录，先去搜索或推荐里给书打标签吧。</p>';
    return;
  }

  userRecords.forEach((r) => {
    const item = document.createElement('div');
    item.className = 'record-item';
    item.innerHTML = `
      <div><strong>${escapeHtml(r.title)}</strong> <span class="badge serious">${escapeHtml(r.recordLabel)}</span></div>
      <div class="meta">👤 ${escapeHtml(r.author)} ｜ 📂 ${escapeHtml(r.category)}</div>
      <div class="meta">🕒 ${new Date(r.createdAt).toLocaleString()}</div>
    `;
    const del = document.createElement('button');
    del.className = 'tag-btn danger';
    del.textContent = '删除';
    del.type = 'button';
    del.addEventListener('click', () => removeRecord(r.id));
    item.appendChild(del);
    box.appendChild(item);
  });
}

function onSearch(e) {
  const keyword = e.target.value.trim();
  if (!books.length) {
    document.getElementById('search-results').innerHTML = "<p class='empty'>⏳ 正在加载书籍数据，请稍候...</p>";
    return;
  }
  if (searchTimeout) clearTimeout(searchTimeout);
  if (!keyword) {
    document.getElementById('search-results').innerHTML = '';
    return;
  }
  searchTimeout = setTimeout(() => renderResults(searchBooks(keyword)), 250);
}

(function () {
  const init = () => {
    loadRecords();
    renderRecords();
    renderRecordSummary();
    loadBooks();
    document.getElementById('recommend-btn')?.addEventListener('click', recommendForMe);
    document.getElementById('refresh-recommend-btn')?.addEventListener('click', recommendForMe);
    document.getElementById('clear-records-btn')?.addEventListener('click', clearRecords);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
