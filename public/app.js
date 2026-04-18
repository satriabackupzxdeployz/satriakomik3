(function () {
  'use strict';

  const CATEGORIES = [
    'Drama', 'Fantasi', 'Kerajaan', 'Komedi', 'Aksi',
    'Slice of life', 'Romantis', 'Thriller', 'Horor', 'Supernatural'
  ];

  const API_BASE = '/api';
  let cache = {};
  let currentKomik = null;
  let favorites = JSON.parse(localStorage.getItem('satriad_favorites') || '[]');
  let readingHistory = JSON.parse(localStorage.getItem('satriad_history') || 'null');
  let pendingReaderEpIdx = null;

  async function fetchAPI(endpoint) {
    if (cache[endpoint]) return cache[endpoint];
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      if (!response.ok) throw new Error('API Error ' + response.status);
      const data = await response.json();
      cache[endpoint] = data;
      return data;
    } catch (error) {
      console.error('Fetch error:', error);
      return null;
    }
  }

  function generateColorHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    const colors = ['#2c4a3a', '#3a2a4a', '#5a3a2a', '#2a4a5a', '#3a5a3a', '#4a3a5a', '#5a4a3a', '#8b1a1a', '#4a2e4a'];
    return colors[Math.abs(hash) % colors.length];
  }

  function createSvgPlaceholder(text, color) {
    const safe = (text || '').substring(0, 20).replace(/[<>"'&]/g, '');
    return `<svg preserveAspectRatio="xMidYMid slice" width="100%" height="100%" viewBox="0 0 200 300">
      <rect width="100%" height="100%" fill="${color}"/>
      <text x="10" y="150" fill="#fff" font-size="14" font-weight="bold">${safe}</text>
    </svg>`;
  }

  function renderGrid(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = data.map(item => {
      const color = generateColorHash(item.url || item.title);
      return `
        <div class="grid-item" data-link="${item.url || '#'}">
          <div class="image_wrap">
            <img src="${item.thumbnail || ''}" alt="${item.title || ''}"
                 style="width:100%;height:100%;object-fit:cover;"
                 onerror="this.style.display='none';this.parentElement.innerHTML=\`${createSvgPlaceholder(item.title, color)}\`">
          </div>
          <div class="title">${item.title || ''}</div>
          <div class="genre">${item.genre || 'Komik'}</div>
        </div>
      `;
    }).join('');
    bindDetailLinks();
  }

  function bindDetailLinks() {
    document.querySelectorAll('[data-link]').forEach(el => {
      el.removeEventListener('click', handleDetailClick);
      el.addEventListener('click', handleDetailClick);
    });
  }

  function handleDetailClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const link = this.getAttribute('data-link');
    if (link && link !== '#') showDetail(link);
  }

  function showDetail(comicUrl) {
    document.getElementById('detailTitleHeader').textContent = 'Loading...';
    document.getElementById('detailGenre').textContent = '';
    document.getElementById('detailDesc').textContent = 'Mengambil detail komik...';
    document.getElementById('episodeList').innerHTML = '<div class="loading-spinner"></div>';
    switchPage('detail');

    fetchAPI(`/detail?url=${encodeURIComponent(comicUrl)}`).then(data => {
      if (!data) {
        showToast('Gagal mengambil detail');
        switchPage('home');
        return;
      }

      currentKomik = data;
      document.getElementById('detailTitleHeader').textContent = data.title;
      document.getElementById('detailGenre').textContent =
        `${(data.genres || []).slice(0, 2).join(' · ')} ${data.metaInfo?.author ? '· ' + data.metaInfo.author : ''}`.trim();
      document.getElementById('detailDesc').textContent = data.full_synopsis || data.short_description || '';
      document.getElementById('detailRating').textContent = '★ -';
      document.getElementById('detailViews').textContent = '';
      document.getElementById('episodeCount').textContent = `${(data.episodes || []).length} Episode`;

      const color = generateColorHash(comicUrl);
      document.getElementById('detailPoster').innerHTML =
        `<img src="${data.thumbnail_url || ''}" alt="${data.title}" style="width:100%;height:100%;object-fit:cover;"
           onerror="this.style.display='none';this.parentElement.innerHTML=\`${createSvgPlaceholder(data.title, color)}\`" />`;

      let epsHtml = '';
      if (data.episodes && data.episodes.length > 0) {
        data.episodes.forEach((ep, idx) => {
          epsHtml += `
            <div class="episode-item" data-ep="${idx}" data-url="${ep.link}">
              <div class="episode-thumb">
                <svg preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
                  <rect width="100%" height="100%" fill="${color}"/>
                  <text x="8" y="35" fill="#fff" font-size="11" font-weight="bold">Ep.${idx + 1}</text>
                </svg>
              </div>
              <div class="episode-info">
                <div class="episode-num">${ep.title}</div>
                <div class="episode-date">${ep.release_date || 'N/A'}</div>
              </div>
            </div>
          `;
        });
      } else {
        epsHtml = '<p style="color:#888;padding:20px;text-align:center;">Belum ada episode tersedia.</p>';
      }
      document.getElementById('episodeList').innerHTML = epsHtml;

      const isFav = favorites.some(f => f.url === comicUrl);
      const favBtn = document.getElementById('detailFavoriteBtn');
      const favText = document.getElementById('favoriteBtnText');
      if (isFav) {
        favBtn.classList.add('active');
        favText.textContent = 'Hapus dari Favorit';
      } else {
        favBtn.classList.remove('active');
        favText.textContent = 'Tambah ke Favorit';
      }
    });
  }

  function isAdultContent(ageRating) {
    if (!ageRating) return false;
    const lower = ageRating.toLowerCase();
    return lower.includes('18') || lower.includes('dewasa') || lower.includes('mature');
  }

  function showAgeModal(epIdx) {
    pendingReaderEpIdx = epIdx;
    document.getElementById('ageModalOverlay').style.display = 'block';
    document.getElementById('ageModal').style.display = 'block';
  }

  function hideAgeModal() {
    document.getElementById('ageModalOverlay').style.display = 'none';
    document.getElementById('ageModal').style.display = 'none';
    pendingReaderEpIdx = null;
  }

  function confirmAgeAndRead() {
    hideAgeModal();
    if (pendingReaderEpIdx !== null) {
      proceedToReader(pendingReaderEpIdx);
    }
  }

  function rejectAge() {
    hideAgeModal();
    showToast('Anda harus berusia 18+ untuk membaca konten ini.');
  }

  function requestOpenReader(epIdx) {
    if (!currentKomik) return;
    const ageRating = currentKomik.metaInfo?.age_rating || '';
    if (isAdultContent(ageRating)) {
      showAgeModal(epIdx);
    } else {
      proceedToReader(epIdx);
    }
  }

  async function proceedToReader(epIdx) {
    if (!currentKomik || !currentKomik.episodes) return;
    const ep = currentKomik.episodes[epIdx];
    if (!ep) return;

    const color = generateColorHash(currentKomik.url);

    document.getElementById('readerTitle').textContent = `${currentKomik.title} - ${ep.title}`;
    document.getElementById('readerContent').innerHTML = '<div class="loading-spinner" style="height:200px;"></div>';
    document.getElementById('readerMode').classList.add('active');
    document.body.style.overflow = 'hidden';

    const thumbsHtml = currentKomik.episodes.map((e, i) => `
      <div class="reader-thumb-item ${i === epIdx ? 'active' : ''}" data-reader-ep="${i}">
        <div class="reader-thumb-img">
          <svg preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
            <rect width="100%" height="100%" fill="${color}"/>
            <text x="8" y="35" fill="#fff" font-size="10">Ep.${i + 1}</text>
          </svg>
        </div>
        <div class="reader-thumb-ep">${e.title}</div>
      </div>
    `).join('');
    document.getElementById('readerThumbnails').innerHTML = thumbsHtml;

    const activeThumb = document.querySelector('.reader-thumb-item.active');
    if (activeThumb) activeThumb.scrollIntoView({ inline: 'center', behavior: 'smooth' });

    document.querySelectorAll('.reader-thumb-item').forEach(item => {
      item.addEventListener('click', function () {
        requestOpenReader(parseInt(this.dataset.readerEp));
      });
    });

    const result = await fetchAPI(`/chapter?url=${encodeURIComponent(ep.link)}`);
    if (!result || !result.images || result.images.length === 0) {
      document.getElementById('readerContent').innerHTML =
        '<p style="color:#aaa;text-align:center;padding:40px;">Gagal memuat chapter. Mungkin chapter terkunci.</p>';
      return;
    }

    const pagesHtml = result.images.map((src, i) => `
      <div class="reader-page">
        <img src="${src}" alt="Halaman ${i + 1}" style="width:100%;display:block;"
             loading="${i < 3 ? 'eager' : 'lazy'}"
             onerror="this.style.display='none'">
      </div>
    `).join('');
    document.getElementById('readerContent').innerHTML = pagesHtml;

    readingHistory = {
      url: currentKomik.url,
      title: currentKomik.title,
      episode: ep.title,
      epIdx,
      color,
    };
    localStorage.setItem('satriad_history', JSON.stringify(readingHistory));
    updateContinueReading();
  }

  function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId + 'Page');
    if (targetPage) targetPage.classList.add('active');
    document.querySelectorAll('.lnb .item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageId);
    });
    window.scrollTo(0, 0);

    if (pageId === 'home') {
      loadHomeData();
    } else if (pageId === 'manga') {
      loadManga();
    } else if (pageId === 'manhwa') {
      loadManhwa();
    } else if (pageId === 'manhua') {
      loadManhua();
    } else if (pageId === 'favoritku') {
      renderFavoriteList();
    }
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function initCategories() {
    const list = document.getElementById('categoryList');
    list.innerHTML = CATEGORIES.map(cat =>
      `<div class="category-box" data-genre="${cat}">${cat}</div>`
    ).join('');

    document.querySelectorAll('.category-box').forEach(box => {
      box.addEventListener('click', function () {
        const drawer = document.getElementById('drawer');
        const overlay = document.getElementById('drawerOverlay');
        drawer.classList.remove('active');
        overlay.classList.remove('active');
        showToast(`Kategori: ${this.dataset.genre}`);
      });
    });
  }

  function initEventListeners() {
    const searchBtn = document.getElementById('searchBtn');
    const searchContainer = document.getElementById('searchContainer');
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const searchBackBtn = document.getElementById('searchBackBtn');
    let searchTimer;

    searchBtn.addEventListener('click', () => {
      searchContainer.classList.toggle('active');
      if (searchContainer.classList.contains('active')) {
        searchInput.focus();
        searchBackBtn.classList.add('show');
        document.getElementById('navWrapper').style.display = 'none';
      }
    });

    searchInput.addEventListener('input', function () {
      searchClear.style.display = this.value ? 'block' : 'none';
      clearTimeout(searchTimer);
      if (this.value.length > 2) {
        searchTimer = setTimeout(() => performSearch(this.value), 400);
      }
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.style.display = 'none';
      document.getElementById('searchResults').innerHTML = '';
    });

    searchBackBtn.addEventListener('click', () => {
      searchContainer.classList.remove('active');
      document.getElementById('navWrapper').style.display = 'block';
      searchInput.value = '';
      searchClear.style.display = 'none';
      document.getElementById('searchResults').innerHTML = '';
      searchBackBtn.classList.remove('show');
    });

    const drawer = document.getElementById('drawer');
    const drawerOverlay = document.getElementById('drawerOverlay');
    document.getElementById('menuBtn').addEventListener('click', () => {
      drawer.classList.add('active');
      drawerOverlay.classList.add('active');
    });
    document.getElementById('drawerClose').addEventListener('click', () => {
      drawer.classList.remove('active');
      drawerOverlay.classList.remove('active');
    });
    drawerOverlay.addEventListener('click', () => {
      drawer.classList.remove('active');
      drawerOverlay.classList.remove('active');
    });
    document.getElementById('menuFavorite').addEventListener('click', () => {
      drawer.classList.remove('active');
      drawerOverlay.classList.remove('active');
      switchPage('favoritku');
      renderFavoriteList();
    });
    document.getElementById('menuRanking').addEventListener('click', () => {
      drawer.classList.remove('active');
      drawerOverlay.classList.remove('active');
      showToast('Fitur ranking segera hadir');
    });
    document.getElementById('menuCategory').addEventListener('click', () => {
      document.getElementById('categorySubmenu').classList.toggle('active');
    });

    document.querySelectorAll('.lnb .item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const pageId = item.dataset.page;
        switchPage(pageId);
      });
    });

    document.getElementById('logoHome').addEventListener('click', e => {
      e.preventDefault();
      switchPage('home');
    });

    document.getElementById('detailBack').addEventListener('click', () => {
      switchPage('home');
    });

    document.getElementById('searchResultsBack').addEventListener('click', () => {
      switchPage('home');
    });

    document.getElementById('detailFavoriteBtn').addEventListener('click', function () {
      if (!currentKomik) return;
      const existingIdx = favorites.findIndex(f => f.url === currentKomik.url);
      if (existingIdx > -1) {
        favorites.splice(existingIdx, 1);
        this.classList.remove('active');
        document.getElementById('favoriteBtnText').textContent = 'Tambah ke Favorit';
        showToast('Dihapus dari Favorit');
      } else {
        favorites.push({
          url: currentKomik.url,
          title: currentKomik.title,
          genre: (currentKomik.genres || [])[0] || 'Komik',
          thumbnail_url: currentKomik.thumbnail_url,
        });
        this.classList.add('active');
        document.getElementById('favoriteBtnText').textContent = 'Hapus dari Favorit';
        showToast('Ditambahkan ke Favorit');
      }
      localStorage.setItem('satriad_favorites', JSON.stringify(favorites));
    });

    document.addEventListener('click', function (e) {
      const epItem = e.target.closest('.episode-item');
      if (epItem) {
        const epIdx = parseInt(epItem.dataset.ep);
        requestOpenReader(epIdx);
      }
    });

    document.getElementById('readerClose').addEventListener('click', () => {
      document.getElementById('readerMode').classList.remove('active');
      document.body.style.overflow = '';
    });

    document.getElementById('continueReadingItem').addEventListener('click', () => {
      if (readingHistory) {
        if (readingHistory.url && currentKomik && currentKomik.url === readingHistory.url) {
          requestOpenReader(readingHistory.epIdx || 0);
        } else {
          showDetail(readingHistory.url);
          showToast('Klik episode untuk lanjut membaca');
        }
      }
    });

    document.querySelectorAll('#trendingTab .button').forEach(btn => {
      btn.addEventListener('click', async function() {
        document.querySelectorAll('#trendingTab .button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const tab = this.dataset.tab;
        const data = await fetchAPI('/home');
        if (!data) return;
        const items = tab === 'trending' ? data.trending : data.popular;
        renderRankingList(items);
      });
    });

    document.getElementById('ageConfirmBtn').addEventListener('click', confirmAgeAndRead);
    document.getElementById('ageUnderBtn').addEventListener('click', rejectAge);
    document.getElementById('ageModalOverlay').addEventListener('click', hideAgeModal);
  }

  async function loadHomeData() {
    const data = await fetchAPI('/home');
    if (!data) return;
    renderRankingList(data.trending);
    renderPopularGrid(data.popular);
  }

  function renderRankingList(items) {
    const container = document.getElementById('trendingList');
    if (!container) return;
    container.innerHTML = items.slice(0, 10).map((item, index) => {
      const color = generateColorHash(item.url);
      return `
        <li class="item">
          <a class="link" data-link="${item.url}">
            <div class="ranking_number">
              <div class="ranking_num">${index + 1}</div>
              <div class="trending_wrap">
                <span class="trending_arrow">▲</span>
              </div>
            </div>
            <div class="image_wrap">
              <img src="${item.thumbnail}" alt="${item.title}" loading="lazy"
                   onerror="this.style.display='none';this.parentElement.innerHTML=\`${createSvgPlaceholder(item.title, color)}\`">
            </div>
            <div class="info_text">
              <strong class="title">${item.title}</strong>
              <div class="genre">${item.genre}</div>
            </div>
          </a>
        </li>
      `;
    }).join('');
    bindDetailLinks();
  }

  function renderPopularGrid(items) {
    const container = document.getElementById('categoryGrid');
    if (!container) return;
    container.innerHTML = items.slice(0, 9).map(item => {
      const color = generateColorHash(item.url);
      return `
        <div class="grid-item" data-link="${item.url}">
          <div class="image_wrap">
            <img src="${item.thumbnail}" alt="${item.title}" loading="lazy"
                 onerror="this.style.display='none';this.parentElement.innerHTML=\`${createSvgPlaceholder(item.title, color)}\`">
          </div>
          <div class="title">${item.title}</div>
          <div class="genre">${item.genre}</div>
        </div>
      `;
    }).join('');
    bindDetailLinks();
  }

  async function performSearch(keyword) {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '<div class="loading-spinner"></div>';

    const cacheKey = `/search?q=${encodeURIComponent(keyword)}`;
    delete cache[cacheKey];

    const data = await fetchAPI(cacheKey);
    if (!data || data.length === 0) {
      resultsContainer.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">Tidak ditemukan</p>';
      return;
    }

    resultsContainer.innerHTML = data.slice(0, 20).map(c => {
      const color = generateColorHash(c.url || c.title);
      return `
        <div class="search-result-item" data-link="${c.url}">
          <div style="position:relative;width:50px;height:65px;border-radius:6px;background:${color};overflow:hidden;flex-shrink:0;">
            <img src="${c.thumbnail || ''}" alt="${c.title}" style="width:100%;height:100%;object-fit:cover;"
                 onerror="this.style.display='none';" />
          </div>
          <div>
            <strong>${c.title}</strong>
            <div style="font-size:12px;color:#888;">${(c.genres || []).join(', ') || c.genre || 'Komik'}</div>
          </div>
        </div>
      `;
    }).join('');

    bindDetailLinks();
  }

  function loadManga() {
    const grid = document.getElementById('mangaGrid');
    const loading = document.getElementById('mangaLoading');
    if (grid.innerHTML) return;
    loading.style.display = 'flex';
    fetchAPI('/manga?page=1').then(res => {
      loading.style.display = 'none';
      if (res && res.data) renderGrid('mangaGrid', res.data);
    });
  }

  function loadManhwa() {
    const grid = document.getElementById('manhwaGrid');
    const loading = document.getElementById('manhwaLoading');
    if (grid.innerHTML) return;
    loading.style.display = 'flex';
    fetchAPI('/manhwa?page=1').then(res => {
      loading.style.display = 'none';
      if (res && res.data) renderGrid('manhwaGrid', res.data);
    });
  }

  function loadManhua() {
    const grid = document.getElementById('manhuaGrid');
    const loading = document.getElementById('manhuaLoading');
    if (grid.innerHTML) return;
    loading.style.display = 'flex';
    fetchAPI('/manhua?page=1').then(res => {
      loading.style.display = 'none';
      if (res && res.data) renderGrid('manhuaGrid', res.data);
    });
  }

  function renderFavoriteList() {
    const container = document.getElementById('favoriteList');
    const emptyState = document.getElementById('favoriteEmptyState');
    if (favorites.length === 0) {
      container.style.display = 'none';
      emptyState.style.display = 'block';
    } else {
      container.style.display = 'block';
      emptyState.style.display = 'none';
      container.innerHTML = favorites.map(item => {
        const color = generateColorHash(item.url);
        return `
          <li class="item">
            <a class="link" data-link="${item.url}">
              <div class="image_wrap">
                <img src="${item.thumbnail_url || ''}" alt="${item.title}"
                     style="width:100%;height:100%;object-fit:cover;"
                     onerror="this.style.display='none'" />
              </div>
              <div class="info_text" style="margin-left:8px;">
                <strong class="title">${item.title}</strong>
                <div class="genre">${item.genre}</div>
              </div>
            </a>
          </li>
        `;
      }).join('');
      bindDetailLinks();
    }
  }

  function updateContinueReading() {
    const section = document.getElementById('continueReadingSection');
    if (readingHistory && readingHistory.url) {
      section.style.display = 'block';
      document.getElementById('continueTitle').textContent = readingHistory.title;
      document.getElementById('continueEpisode').textContent = `${readingHistory.episode} · Lanjutkan`;
      document.getElementById('continueThumb').innerHTML = `
        <svg preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
          <rect width="100%" height="100%" fill="${readingHistory.color || '#2c4a3a'}"/>
          <text x="8" y="35" fill="#fff" font-size="11">Baca</text>
        </svg>`;
    } else {
      section.style.display = 'none';
    }
  }

  function init() {
    initCategories();
    initEventListeners();
    updateContinueReading();
    switchPage('home');
  }

  init();
})();