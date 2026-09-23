import './style.css';
import {
  createIcons,
  Wine,
  Settings,
  Plus,
  Search,
  X,
  Camera,
  Trash2,
  Check,
  Edit,
  Edit3,
  Database,
  Download,
  Upload,
  Sparkles,
  PlusCircle,
  AlertTriangle,
  MapPin,
  Layers,
  Calendar,
  Coins,
  CheckCircle2,
  AlertCircle,
  Info
} from 'lucide';
import {
  db,
  getAllDrinks,
  getDrinkById,
  addDrink,
  updateDrink,
  deleteDrink,
  clearAllDrinks,
  getDrinkStats
} from './db.js';
import {
  compressImage,
  formatCurrency,
  formatDate,
  getTodayDateString,
  CATEGORY_DEFINITIONS,
  SAKE_TYPES,
  WINE_TYPES,
  PREFECTURES,
  exportDataAsJSON,
  parseImportJSON
} from './utils.js';
import { SAMPLE_DRINKS } from './sampleData.js';

const appIcons = {
  Wine,
  Settings,
  Plus,
  Search,
  X,
  Camera,
  Trash2,
  Check,
  Edit,
  Edit3,
  Database,
  Download,
  Upload,
  Sparkles,
  PlusCircle,
  AlertTriangle,
  MapPin,
  Layers,
  Calendar,
  Coins,
  CheckCircle2,
  AlertCircle,
  Info
};

// アプリケーション状態管理
const state = {
  drinks: [],
  filteredDrinks: [],
  selectedCategory: 'all',
  searchQuery: '',
  sortBy: 'drankAt-desc',
  activeDrinkId: null,
  currentPhotoDataUrl: null,
  selectedFormType: 'sake'
};

// ==========================================================================
// 初期化
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initLucideIcons();
  initDatalists();
  initCategoryTabs();
  initFormTypeSelector();
  initWineTypeSelect();
  initEventListeners();

  // 初回データ読み込み
  await loadAndRenderDrinks();

  // 初回起動時かつデータが空なら、サンプルデータを自動で投入してすぐ試せるようにする
  const count = await db.drinks.count();
  if (count === 0) {
    for (const sample of SAMPLE_DRINKS) {
      await addDrink(sample);
    }
    await loadAndRenderDrinks();
    showToast('サンプルお酒データを初期設定しました 🍶🍷', 'success');
  }

  // PWA Service Worker 登録
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration skipped or failed:', err);
    });
  }
});

function initLucideIcons() {
  createIcons({ icons: appIcons });
}

// フォーム内のデータリスト初期化
function initDatalists() {
  const prefDatalist = document.getElementById('prefectures-list');
  if (prefDatalist) {
    prefDatalist.innerHTML = PREFECTURES.map(p => `<option value="${p}">${p}</option>`).join('');
  }

  const sakeTypesDatalist = document.getElementById('sake-types-list');
  if (sakeTypesDatalist) {
    sakeTypesDatalist.innerHTML = SAKE_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
  }
}

// ワイン種類のセレクトボックス初期化
function initWineTypeSelect() {
  const wineSelect = document.getElementById('input-wine-type');
  if (wineSelect) {
    wineSelect.innerHTML = WINE_TYPES.map(w => `<option value="${w.value}">${w.label}</option>`).join('');
  }
}

// ==========================================================================
// カテゴリタブ & コントロール
// ==========================================================================
function initCategoryTabs() {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  const categories = [
    { id: 'all', name: 'すべて', icon: '✨' },
    ...Object.values(CATEGORY_DEFINITIONS)
  ];

  container.innerHTML = categories.map(cat => `
    <button type="button" class="category-tab ${cat.id === 'all' ? 'active' : ''} tab-${cat.id}" data-category="${cat.id}">
      <span>${cat.icon}</span>
      <span>${cat.name}</span>
    </button>
  `).join('');

  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.category-tab');
    if (!tab) return;
    const catId = tab.dataset.category;
    
    document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    state.selectedCategory = catId;
    applyFiltersAndRender();
  });
}

// フォーム内のお酒タイプセレクター初期化
function initFormTypeSelector() {
  const selector = document.getElementById('form-type-selector');
  if (!selector) return;

  const items = Object.values(CATEGORY_DEFINITIONS);
  selector.innerHTML = items.map((cat, idx) => `
    <div class="type-option ${idx === 0 ? 'selected' : ''} type-${cat.id}" data-type="${cat.id}">
      <span class="type-option-icon">${cat.icon}</span>
      <span class="type-option-name">${cat.name}</span>
    </div>
  `).join('');

  selector.addEventListener('click', (e) => {
    const opt = e.target.closest('.type-option');
    if (!opt) return;
    const type = opt.dataset.type;
    setFormType(type);
  });
}

function setFormType(type) {
  state.selectedFormType = type;
  document.querySelectorAll('.type-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.type === type);
  });

  const sakeFields = document.getElementById('fields-sake');
  const wineFields = document.getElementById('fields-wine');
  const otherFields = document.getElementById('fields-other');

  if (type === 'sake') {
    sakeFields.style.display = 'block';
    wineFields.style.display = 'none';
    otherFields.style.display = 'none';
  } else if (type === 'wine') {
    sakeFields.style.display = 'none';
    wineFields.style.display = 'block';
    otherFields.style.display = 'none';
  } else {
    sakeFields.style.display = 'none';
    wineFields.style.display = 'none';
    otherFields.style.display = 'block';
  }
}

// ==========================================================================
// データ読み込み & フィルタ・ソート
// ==========================================================================
async function loadAndRenderDrinks() {
  state.drinks = await getAllDrinks();
  await updateStats();
  applyFiltersAndRender();
}

async function updateStats() {
  const stats = await getDrinkStats();
  const container = document.getElementById('stats-section');
  if (!container) return;

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">
        <i data-lucide="layers" style="width: 14px; height: 14px;"></i>
        <span>総テイスティング</span>
      </div>
      <div class="stat-value">${stats.total} <span>本</span></div>
      <div class="stat-sub">日本酒: ${stats.sakeCount} / ワイン: ${stats.wineCount}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">
        <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
        <span>今月の記録</span>
      </div>
      <div class="stat-value">${stats.thisMonthCount} <span>本</span></div>
      <div class="stat-sub">${new Date().getMonth() + 1}月のログ</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">
        <i data-lucide="sparkles" style="width: 14px; height: 14px; color: var(--accent-sake);"></i>
        <span>日本酒割合</span>
      </div>
      <div class="stat-value">${stats.total > 0 ? Math.round((stats.sakeCount / stats.total) * 100) : 0} <span>%</span></div>
      <div class="stat-sub">${stats.sakeCount} 銘柄</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">
        <i data-lucide="coins" style="width: 14px; height: 14px; color: var(--accent-gold);"></i>
        <span>総購入額</span>
      </div>
      <div class="stat-value">${stats.totalPrice > 0 ? '¥' + stats.totalPrice.toLocaleString() : '¥0'}</div>
      <div class="stat-sub">平均: ¥${stats.total > 0 ? Math.round(stats.totalPrice / stats.total).toLocaleString() : 0}</div>
    </div>
  `;
  initLucideIcons();
}

function applyFiltersAndRender() {
  let list = [...state.drinks];

  // 1. カテゴリフィルタ
  if (state.selectedCategory !== 'all') {
    list = list.filter(d => d.type === state.selectedCategory);
  }

  // 2. 検索フィルタ
  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase().trim();
    list = list.filter(d => {
      const matchName = d.name?.toLowerCase().includes(q);
      const matchBrewery = d.brewery?.toLowerCase().includes(q);
      const matchPref = d.prefecture?.toLowerCase().includes(q);
      const matchRegion = d.region?.toLowerCase().includes(q);
      const matchGrape = d.grapeVariety?.toLowerCase().includes(q);
      const matchPlace = d.purchasePlace?.toLowerCase().includes(q);
      const matchNote = d.note?.toLowerCase().includes(q);
      const matchRice = d.sakeRice?.toLowerCase().includes(q);
      const matchOrigin = d.origin?.toLowerCase().includes(q);
      const matchStyle = d.style?.toLowerCase().includes(q);
      return matchName || matchBrewery || matchPref || matchRegion || matchGrape || matchPlace || matchNote || matchRice || matchOrigin || matchStyle;
    });
  }

  // 3. ソート
  list.sort((a, b) => {
    switch (state.sortBy) {
      case 'drankAt-desc':
        return (b.drankAt || '').localeCompare(a.drankAt || '');
      case 'drankAt-asc':
        return (a.drankAt || '').localeCompare(b.drankAt || '');
      case 'price-desc':
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      case 'price-asc':
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      case 'name-asc':
        return (a.name || '').localeCompare(b.name || '', 'ja');
      default:
        return 0;
    }
  });

  state.filteredDrinks = list;
  renderDrinksGrid(list);
}

// ==========================================================================
// お酒カード描画
// ==========================================================================
function renderDrinksGrid(drinks) {
  const container = document.getElementById('drinks-grid');
  if (!container) return;

  if (drinks.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">🍶🍷</div>
        <div class="empty-title">まだお酒が記録されていません</div>
        <div class="empty-desc">右上の「お酒を記録」ボタンから、飲んだ日本酒やワインの思い出を写真と一緒に美しく残しましょう。</div>
        <button type="button" class="btn btn-primary" id="btn-empty-add">
          <i data-lucide="plus" style="width: 18px; height: 18px;"></i>
          <span>最初のお酒を記録する</span>
        </button>
      </div>
    `;
    const btnEmptyAdd = document.getElementById('btn-empty-add');
    if (btnEmptyAdd) {
      btnEmptyAdd.addEventListener('click', () => openFormModal());
    }
    initLucideIcons();
    return;
  }

  container.innerHTML = drinks.map(drink => {
    const catDef = CATEGORY_DEFINITIONS[drink.type] || CATEGORY_DEFINITIONS.other;
    const isSake = drink.type === 'sake';
    const isWine = drink.type === 'wine';

    let specsHtml = '';
    if (isSake) {
      const items = [];
      if (drink.brewery) items.push(`<div class="spec-item"><span class="spec-label">酒蔵</span><span class="spec-value">${escapeHtml(drink.brewery)}</span></div>`);
      if (drink.prefecture) items.push(`<div class="spec-item"><span class="spec-label">都道府県</span><span class="spec-value">${escapeHtml(drink.prefecture)}</span></div>`);
      if (drink.sakeType) items.push(`<div class="spec-item"><span class="spec-label">特定名称</span><span class="spec-value">${escapeHtml(drink.sakeType)}</span></div>`);
      if (drink.sakeRice) items.push(`<div class="spec-item"><span class="spec-label">酒米</span><span class="spec-value">${escapeHtml(drink.sakeRice)}</span></div>`);
      if (drink.sakeMeterValue !== undefined && drink.sakeMeterValue !== '') items.push(`<div class="spec-item"><span class="spec-label">日本酒度</span><span class="spec-value">${escapeHtml(drink.sakeMeterValue)}</span></div>`);
      if (drink.alcoholPercent) items.push(`<div class="spec-item"><span class="spec-label">Alc</span><span class="spec-value">${drink.alcoholPercent}%</span></div>`);
      
      if (items.length > 0) {
        specsHtml = `<div class="card-specs">${items.slice(0, 4).join('')}</div>`;
      }
    } else if (isWine) {
      const items = [];
      if (drink.region) items.push(`<div class="spec-item"><span class="spec-label">産地</span><span class="spec-value">${escapeHtml(drink.region)}</span></div>`);
      if (drink.grapeVariety) items.push(`<div class="spec-item"><span class="spec-label">葡萄品種</span><span class="spec-value">${escapeHtml(drink.grapeVariety)}</span></div>`);
      if (drink.vintage) items.push(`<div class="spec-item"><span class="spec-label">Vintage</span><span class="spec-value">${drink.vintage}年</span></div>`);
      if (drink.producer) items.push(`<div class="spec-item"><span class="spec-label">生産者</span><span class="spec-value">${escapeHtml(drink.producer)}</span></div>`);
      if (drink.alcoholPercent) items.push(`<div class="spec-item"><span class="spec-label">Alc</span><span class="spec-value">${drink.alcoholPercent}%</span></div>`);

      if (items.length > 0) {
        specsHtml = `<div class="card-specs">${items.slice(0, 4).join('')}</div>`;
      }
    } else {
      const items = [];
      if (drink.origin) items.push(`<div class="spec-item"><span class="spec-label">原産地/蔵</span><span class="spec-value">${escapeHtml(drink.origin)}</span></div>`);
      if (drink.style) items.push(`<div class="spec-item"><span class="spec-label">スタイル</span><span class="spec-value">${escapeHtml(drink.style)}</span></div>`);
      if (drink.alcoholPercent) items.push(`<div class="spec-item"><span class="spec-label">Alc</span><span class="spec-value">${drink.alcoholPercent}%</span></div>`);

      if (items.length > 0) {
        specsHtml = `<div class="card-specs">${items.slice(0, 4).join('')}</div>`;
      }
    }

    const imageHtml = drink.photo
      ? `<img class="card-img" src="${drink.photo}" alt="${escapeHtml(drink.name)}" loading="lazy" />`
      : `
        <div class="card-img-placeholder">
          <div class="card-placeholder-icon">${catDef.icon}</div>
          <div class="card-placeholder-text">${catDef.enName}</div>
        </div>
      `;

    const dateBadgeHtml = drink.drankAt
      ? `<div class="card-date-badge">${formatDate(drink.drankAt)}</div>`
      : '';

    return `
      <article class="drink-card card-${drink.type}" data-id="${drink.id}">
        <div class="card-image-wrap">
          <div class="card-type-badge badge-${drink.type}">
            <span>${catDef.icon}</span>
            <span>${catDef.name}</span>
          </div>
          ${dateBadgeHtml}
          ${imageHtml}
        </div>
        <div class="card-body">
          <div class="card-title-group">
            <h3 class="card-brand-name">${escapeHtml(drink.name)}</h3>
            <div class="card-meta-line">
              ${drink.prefecture ? `<span class="card-meta-tag">📍 ${escapeHtml(drink.prefecture)}</span>` : ''}
              ${drink.region ? `<span class="card-meta-tag">🌍 ${escapeHtml(drink.region)}</span>` : ''}
              ${drink.sakeType ? `<span class="card-meta-tag">🏷️ ${escapeHtml(drink.sakeType)}</span>` : ''}
              ${drink.wineType ? `<span class="card-meta-tag">🍇 ${formatWineType(drink.wineType)}</span>` : ''}
            </div>
          </div>

          ${specsHtml}

          ${drink.note ? `<div class="card-note">${escapeHtml(drink.note)}</div>` : ''}

          <div class="card-footer">
            <div class="card-place" title="${escapeHtml(drink.purchasePlace || '購入場所未設定')}">
              <i data-lucide="map-pin" style="width: 14px; height: 14px; flex-shrink: 0;"></i>
              <span>${escapeHtml(drink.purchasePlace || '購入場所未記入')}</span>
            </div>
            <div class="card-price">${formatCurrency(drink.price)}</div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  initLucideIcons();
}

function formatWineType(type) {
  const match = WINE_TYPES.find(w => w.value === type);
  return match ? match.label.split(' ')[0] : type;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// イベントリスナー設定
// ==========================================================================
function initEventListeners() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      applyFiltersAndRender();
    });
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      applyFiltersAndRender();
    });
  }

  const drinksGrid = document.getElementById('drinks-grid');
  if (drinksGrid) {
    drinksGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.drink-card');
      if (!card) return;
      const drinkId = card.dataset.id;
      if (drinkId) {
        openDetailModal(drinkId);
      }
    });
  }

  const btnOpenAdd = document.getElementById('btn-open-add');
  if (btnOpenAdd) {
    btnOpenAdd.addEventListener('click', () => openFormModal());
  }

  const btnOpenSettings = document.getElementById('btn-open-settings');
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => openSettingsModal());
  }

  document.getElementById('btn-close-form')?.addEventListener('click', closeFormModal);
  document.getElementById('btn-cancel-form')?.addEventListener('click', closeFormModal);

  document.getElementById('btn-close-detail')?.addEventListener('click', closeDetailModal);
  document.getElementById('btn-close-detail-footer')?.addEventListener('click', closeDetailModal);

  document.getElementById('btn-close-settings')?.addEventListener('click', closeSettingsModal);
  document.getElementById('btn-close-settings-footer')?.addEventListener('click', closeSettingsModal);

  document.getElementById('btn-edit-drink')?.addEventListener('click', () => {
    if (state.activeDrinkId) {
      closeDetailModal();
      openFormModal(state.activeDrinkId);
    }
  });

  document.getElementById('btn-delete-drink')?.addEventListener('click', async () => {
    if (!state.activeDrinkId) return;
    if (confirm('このお酒の記録を削除してもよろしいですか？')) {
      await deleteDrink(state.activeDrinkId);
      closeDetailModal();
      await loadAndRenderDrinks();
      showToast('お酒の記録を削除しました', 'success');
    }
  });

  const imageDropArea = document.getElementById('image-drop-area');
  const inputPhoto = document.getElementById('input-photo');
  const btnRemovePhoto = document.getElementById('btn-remove-photo');

  if (imageDropArea && inputPhoto) {
    imageDropArea.addEventListener('click', (e) => {
      if (e.target.closest('#btn-remove-photo')) return;
      inputPhoto.click();
    });

    inputPhoto.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const compressed = await compressImage(file, 1200, 0.82);
          state.currentPhotoDataUrl = compressed;
          updatePhotoPreview(compressed);
        } catch (err) {
          showToast('画像の読み込みに失敗しました: ' + err.message, 'error');
        }
      }
    });

    if (btnRemovePhoto) {
      btnRemovePhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        state.currentPhotoDataUrl = null;
        inputPhoto.value = '';
        updatePhotoPreview(null);
      });
    }
  }

  const form = document.getElementById('drink-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit();
    });
  }

  document.getElementById('btn-export-json')?.addEventListener('click', async () => {
    const drinks = await getAllDrinks();
    if (drinks.length === 0) {
      showToast('エクスポートするデータがありません', 'error');
      return;
    }
    await exportDataAsJSON(drinks);
    showToast(`${drinks.length} 件のお酒データをエクスポートしました`, 'success');
  });

  const inputImportJson = document.getElementById('input-import-json');
  document.getElementById('btn-trigger-import')?.addEventListener('click', () => {
    inputImportJson?.click();
  });

  if (inputImportJson) {
    inputImportJson.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const importedList = await parseImportJSON(file);
        if (confirm(`${importedList.length} 件のお酒データを読み込みます。取り込みますか？`)) {
          for (const item of importedList) {
            delete item.id;
            await addDrink(item);
          }
          await loadAndRenderDrinks();
          showToast(`${importedList.length} 件のデータをインポートしました！`, 'success');
          closeSettingsModal();
        }
      } catch (err) {
        showToast('インポートに失敗しました: ' + err.message, 'error');
      } finally {
        inputImportJson.value = '';
      }
    });
  }

  document.getElementById('btn-seed-sample')?.addEventListener('click', async () => {
    for (const sample of SAMPLE_DRINKS) {
      await addDrink(sample);
    }
    await loadAndRenderDrinks();
    showToast('サンプルデータを4件追加しました 🍶🍷', 'success');
    closeSettingsModal();
  });

  document.getElementById('btn-clear-db')?.addEventListener('click', async () => {
    if (confirm('本当に全データを削除しますか？\n（エクスポートしてバックアップを取っておくことをお勧めします）')) {
      if (confirm('最終確認: 全ての記録が消去されます。よろしいですか？')) {
        await clearAllDrinks();
        await loadAndRenderDrinks();
        showToast('全データを消去しました', 'success');
        closeSettingsModal();
      }
    }
  });

  ['modal-form', 'modal-detail', 'modal-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          el.classList.remove('active');
        }
      });
    }
  });
}

// ==========================================================================
// フォーム操作 (新規・編集)
// ==========================================================================
function updatePhotoPreview(dataUrl) {
  const container = document.getElementById('image-preview-container');
  const img = document.getElementById('image-preview-img');
  const placeholder = document.getElementById('image-upload-placeholder');

  if (dataUrl) {
    img.src = dataUrl;
    container.style.display = 'flex';
    placeholder.style.display = 'none';
  } else {
    img.src = '';
    container.style.display = 'none';
    placeholder.style.display = 'block';
  }
}

async function openFormModal(editId = null) {
  const modal = document.getElementById('modal-form');
  const modalTitle = document.getElementById('form-modal-title');
  const form = document.getElementById('drink-form');
  form.reset();

  state.currentPhotoDataUrl = null;
  updatePhotoPreview(null);

  if (editId) {
    const drink = await getDrinkById(editId);
    if (!drink) return;

    document.getElementById('edit-drink-id').value = drink.id;
    modalTitle.innerHTML = `<i data-lucide="edit-3" style="width: 22px; height: 22px;"></i><span>お酒の記録を編集</span>`;
    
    setFormType(drink.type || 'sake');
    document.getElementById('input-name').value = drink.name || '';
    document.getElementById('input-drank-at').value = drink.drankAt || '';
    document.getElementById('input-alcohol').value = drink.alcoholPercent !== undefined && drink.alcoholPercent !== null ? drink.alcoholPercent : '';
    document.getElementById('input-price').value = drink.price !== undefined && drink.price !== null ? drink.price : '';
    document.getElementById('input-place').value = drink.purchasePlace || '';
    document.getElementById('input-note').value = drink.note || '';

    // 日本酒
    document.getElementById('input-brewery').value = drink.brewery || '';
    document.getElementById('input-prefecture').value = drink.prefecture || '';
    document.getElementById('input-sake-type').value = drink.sakeType || '';
    document.getElementById('input-sake-rice').value = drink.sakeRice || '';
    document.getElementById('input-sake-meter').value = drink.sakeMeterValue !== undefined ? drink.sakeMeterValue : '';

    // ワイン
    document.getElementById('input-wine-type').value = drink.wineType || 'red';
    document.getElementById('input-region').value = drink.region || '';
    document.getElementById('input-grape').value = drink.grapeVariety || '';
    document.getElementById('input-vintage').value = drink.vintage || '';
    document.getElementById('input-producer').value = drink.producer || '';

    // その他
    document.getElementById('input-origin').value = drink.origin || '';
    document.getElementById('input-style').value = drink.style || '';

    // 写真
    if (drink.photo) {
      state.currentPhotoDataUrl = drink.photo;
      updatePhotoPreview(drink.photo);
    }
  } else {
    document.getElementById('edit-drink-id').value = '';
    modalTitle.innerHTML = `<i data-lucide="plus-circle" style="width: 22px; height: 22px;"></i><span>新しいお酒を記録</span>`;
    setFormType('sake');
    document.getElementById('input-drank-at').value = getTodayDateString();
  }

  initLucideIcons();
  modal.classList.add('active');
}

function closeFormModal() {
  document.getElementById('modal-form')?.classList.remove('active');
}

async function handleFormSubmit() {
  const editId = document.getElementById('edit-drink-id').value;
  const name = document.getElementById('input-name').value.trim();
  if (!name) {
    showToast('銘柄名を入力してください', 'error');
    return;
  }

  const type = state.selectedFormType;
  const drankAt = document.getElementById('input-drank-at').value || getTodayDateString();
  const alcoholVal = document.getElementById('input-alcohol').value;
  const priceVal = document.getElementById('input-price').value;
  const purchasePlace = document.getElementById('input-place').value.trim();
  const note = document.getElementById('input-note').value.trim();

  const drinkPayload = {
    type,
    name,
    drankAt,
    alcoholPercent: alcoholVal !== '' ? Number(alcoholVal) : null,
    price: priceVal !== '' ? Number(priceVal) : null,
    purchasePlace,
    note,
    photo: state.currentPhotoDataUrl || null
  };

  if (type === 'sake') {
    drinkPayload.brewery = document.getElementById('input-brewery').value.trim();
    drinkPayload.prefecture = document.getElementById('input-prefecture').value.trim();
    drinkPayload.sakeType = document.getElementById('input-sake-type').value.trim();
    drinkPayload.sakeRice = document.getElementById('input-sake-rice').value.trim();
    drinkPayload.sakeMeterValue = document.getElementById('input-sake-meter').value.trim();
  } else if (type === 'wine') {
    drinkPayload.wineType = document.getElementById('input-wine-type').value;
    drinkPayload.region = document.getElementById('input-region').value.trim();
    drinkPayload.grapeVariety = document.getElementById('input-grape').value.trim();
    const vintageVal = document.getElementById('input-vintage').value;
    drinkPayload.vintage = vintageVal !== '' ? Number(vintageVal) : null;
    drinkPayload.producer = document.getElementById('input-producer').value.trim();
  } else {
    drinkPayload.origin = document.getElementById('input-origin').value.trim();
    drinkPayload.style = document.getElementById('input-style').value.trim();
  }

  if (editId) {
    await updateDrink(Number(editId), drinkPayload);
    showToast('お酒の記録を更新しました ✨', 'success');
  } else {
    await addDrink(drinkPayload);
    showToast('お酒の記録を保存しました 🎉', 'success');
  }

  closeFormModal();
  await loadAndRenderDrinks();
}

// ==========================================================================
// 詳細モーダル
// ==========================================================================
async function openDetailModal(drinkId) {
  const drink = await getDrinkById(drinkId);
  if (!drink) return;

  state.activeDrinkId = Number(drinkId);
  const modal = document.getElementById('modal-detail');
  const titleEl = document.getElementById('detail-modal-title');
  const bodyEl = document.getElementById('detail-modal-body');

  const catDef = CATEGORY_DEFINITIONS[drink.type] || CATEGORY_DEFINITIONS.other;
  titleEl.innerHTML = `${catDef.icon} ${escapeHtml(drink.name)}`;

  const isSake = drink.type === 'sake';
  const isWine = drink.type === 'wine';

  const rows = [];
  rows.push(`<tr><th>種類</th><td>${catDef.icon} ${catDef.name}</td></tr>`);
  if (drink.drankAt) rows.push(`<tr><th>飲んだ日</th><td>${formatDate(drink.drankAt)}</td></tr>`);
  if (drink.price !== null && drink.price !== undefined) rows.push(`<tr><th>価格</th><td><strong style="color: var(--accent-gold); font-size: 1.1rem;">${formatCurrency(drink.price)}</strong></td></tr>`);
  if (drink.purchasePlace) rows.push(`<tr><th>購入場所/店舗</th><td>${escapeHtml(drink.purchasePlace)}</td></tr>`);
  if (drink.alcoholPercent) rows.push(`<tr><th>度数 (Alc)</th><td>${drink.alcoholPercent}%</td></tr>`);

  if (isSake) {
    if (drink.brewery) rows.push(`<tr><th>酒蔵 (蔵元)</th><td>${escapeHtml(drink.brewery)}</td></tr>`);
    if (drink.prefecture) rows.push(`<tr><th>都道府県</th><td>📍 ${escapeHtml(drink.prefecture)}</td></tr>`);
    if (drink.sakeType) rows.push(`<tr><th>特定名称</th><td>${escapeHtml(drink.sakeType)}</td></tr>`);
    if (drink.sakeRice) rows.push(`<tr><th>酒米 (原料米)</th><td>🌾 ${escapeHtml(drink.sakeRice)}</td></tr>`);
    if (drink.sakeMeterValue) rows.push(`<tr><th>日本酒度</th><td>${escapeHtml(drink.sakeMeterValue)}</td></tr>`);
  } else if (isWine) {
    if (drink.region) rows.push(`<tr><th>産地</th><td>🌍 ${escapeHtml(drink.region)}</td></tr>`);
    if (drink.grapeVariety) rows.push(`<tr><th>葡萄品種</th><td>🍇 ${escapeHtml(drink.grapeVariety)}</td></tr>`);
    if (drink.wineType) rows.push(`<tr><th>ワインタイプ</th><td>${formatWineType(drink.wineType)}</td></tr>`);
    if (drink.vintage) rows.push(`<tr><th>ヴィンテージ</th><td>${drink.vintage} 年</td></tr>`);
    if (drink.producer) rows.push(`<tr><th>生産者</th><td>${escapeHtml(drink.producer)}</td></tr>`);
  } else {
    if (drink.origin) rows.push(`<tr><th>原産地 / メーカー</th><td>${escapeHtml(drink.origin)}</td></tr>`);
    if (drink.style) rows.push(`<tr><th>スタイル / 原料</th><td>${escapeHtml(drink.style)}</td></tr>`);
  }

  const heroImageHtml = drink.photo
    ? `
      <div class="detail-hero-image-wrap">
        <img class="detail-hero-image" src="${drink.photo}" alt="${escapeHtml(drink.name)}" />
      </div>
    `
    : '';

  const noteHtml = drink.note
    ? `
      <div>
        <div class="detail-section-title ${isWine ? 'detail-wine-title' : ''}">テイスティングノート & 感想</div>
        <div class="detail-note-box">${escapeHtml(drink.note)}</div>
      </div>
    `
    : '';

  bodyEl.innerHTML = `
    ${heroImageHtml}
    <div>
      <div class="detail-section-title ${isWine ? 'detail-wine-title' : ''}">スペック情報</div>
      <table class="detail-table">
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </div>
    ${noteHtml}
  `;

  initLucideIcons();
  modal.classList.add('active');
}

function closeDetailModal() {
  document.getElementById('modal-detail')?.classList.remove('active');
  state.activeDrinkId = null;
}

// ==========================================================================
// 設定モーダル
// ==========================================================================
function openSettingsModal() {
  document.getElementById('modal-settings')?.classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('modal-settings')?.classList.remove('active');
}

// ==========================================================================
// トースト通知
// ==========================================================================
function showToast(message, type = 'normal') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle-2';
  if (type === 'error') iconName = 'alert-circle';

  toast.innerHTML = `
    <i data-lucide="${iconName}" style="width: 18px; height: 18px; color: ${type === 'success' ? 'var(--accent-emerald)' : type === 'error' ? 'var(--accent-wine)' : 'var(--accent-sake)'};"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  initLucideIcons();

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}
