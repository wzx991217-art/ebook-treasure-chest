let books = [];
let searchTimeout = null;
const MAX_RESULTS = 100;

let selectedCategory = 'all';

const PREFERENCES = {
  serious: [
    '文学','神话','哲学','思想','历史','心理','传记','古典','世界','诗歌','艺术','社会','宗教'
  ],
  fun: [
    '言情','爱情','青春','奇幻','玄幻','武侠','推理','悬疑','侦探','三国','宫斗','后宫','权谋','仙侠','耽美','BL'
  ],
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

function normalize(s) {
  return (s || '').toLowerCase();
}

function categoryMatch(book, bucket) {
  const c = book.category || '';
  const t = book.title || '';
  return bucket.some(k => c.includes(k) || t.includes(k));
}

function isAvoid(book) {
  return PREFERENCES.avoid.some(k => (book.category || '').includes(k) || (book.title || '').includes(k));
}

function initCategoryFilter() {
  const select = document.getElementById('category-filter');
  if (!select) return;

  const categories = Array.from(new Set(books.map(b => b.category).filter(Boolean))).sort((a,b)=>a.localeCompare(b, 'zh-CN'));
  for (const c of categories) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  }

  select.addEventListener('change', (e) => {
    selectedCategory = e.target.value;
    const keyword = (document.getElementById('search-input')?.value || '').trim();
    if (keyword) renderResults(searchBooks(keyword), keyword);
  });
}

function searchBooks(keyword) {
  const k = normalize(keyword).trim();
  if (!k) return [];
  const keywords = k.split(/\s+/);

  return books.filter(b => {
    if (selectedCategory !== 'all' && b.category !== selectedCategory) return false;
    const title = normalize(b.title);
    const author = normalize(b.author);
    const category = normalize(b.category);
    return keywords.every(word => title.includes(word) || author.includes(word) || category.includes(word));
  }).slice(0, MAX_RESULTS);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderResults(results, keyword) {
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

  results.forEach(b => box.appendChild(renderBookCard(b, keyword)));
}

function renderBookCard(book, keyword, reason = '') {
  const div = document.createElement('div');
  div.className = 'book-card';
  const safeLink = escapeHtml(book.link || '#');
  const typeBadge = reason.includes('快乐狗血') ? '<span class="badge fun">快乐狗血</span>' : (reason ? '<span class="badge serious">正经阅读</span>' : '');

  div.innerHTML = `
    <div class="title-row">
      <strong>${escapeHtml(book.title || '未知')}</strong>
      ${typeBadge}
    </div>
    <div class="meta">👤 ${escapeHtml(book.author || '未知')} ｜ 📂 ${escapeHtml(book.category || '未分类')}</div>
    ${reason ? `<div class="reason">${escapeHtml(reason)}</div>` : ''}
    <a href="${safeLink}" target="_blank" rel="noopener" class="book-link">📥 资源链接</a>
  `;

  return div;
}

function buildReason(book, type) {
  if (type === 'serious') {
    return `正经阅读：题材含${book.category || '文学/思想'}，更贴近你偏好的理性、群像与精神张力。`;
  }
  return `快乐狗血：含${book.category || '情感/冲突'}元素，拉扯感强，更容易“上头”。`;
}

function uniqueByTitle(arr) {
  const seen = new Set();
  return arr.filter(b => {
    const key = `${b.title}::${b.author}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recommendForMe() {
  if (!books.length) return;

  const serious = uniqueByTitle(
    books.filter(b => !isAvoid(b) && categoryMatch(b, PREFERENCES.serious))
  ).slice(0, 12);

  const fun = uniqueByTitle(
    books.filter(b => !isAvoid(b) && categoryMatch(b, PREFERENCES.fun))
  ).slice(0, 12);

  const seriousBox = document.getElementById('serious-recs');
  const funBox = document.getElementById('fun-recs');

  seriousBox.innerHTML = '';
  funBox.innerHTML = '';

  if (!serious.length) seriousBox.innerHTML = '<p class="empty">暂无匹配，建议放宽筛选条件。</p>';
  if (!fun.length) funBox.innerHTML = '<p class="empty">暂无匹配，建议放宽筛选条件。</p>';

  serious.forEach(b => seriousBox.appendChild(renderBookCard(b, '', buildReason(b, 'serious'))));
  fun.forEach(b => funBox.appendChild(renderBookCard(b, '', buildReason(b, 'fun'))));

  document.getElementById('recommendation-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  searchTimeout = setTimeout(() => {
    renderResults(searchBooks(keyword), keyword);
  }, 250);
}

(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadBooks();
      document.getElementById('recommend-btn')?.addEventListener('click', recommendForMe);
    });
  } else {
    loadBooks();
    document.getElementById('recommend-btn')?.addEventListener('click', recommendForMe);
  }
})();
