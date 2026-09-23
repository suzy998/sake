/**
 * 画像のリサイズ・圧縮ユーティリティ
 * IndexedDB の容量を節約し、表示を高速化するため最大幅/高さ 1200px、JPEG 品質 0.82 に変換
 */
export async function compressImage(file, maxDimension = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * 日本円フォーマット
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null || amount === '') return '-';
  const num = Number(amount);
  if (isNaN(num)) return '-';
  return `¥${num.toLocaleString()}`;
}

/**
 * 日付フォーマット (YYYY-MM-DD -> YYYY年M月D日)
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
  }
  return dateStr;
}

/**
 * 今日を YYYY-MM-DD 形式で取得
 */
export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * カテゴリの定義とアイコン・バッジ情報
 */
export const CATEGORY_DEFINITIONS = {
  sake: {
    id: 'sake',
    name: '日本酒',
    enName: 'Japanese Sake',
    icon: '🍶',
    color: '#38bdf8',
    bgGradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(14, 165, 233, 0.05))',
    border: 'rgba(56, 189, 248, 0.3)',
    tag: 'Sake'
  },
  wine: {
    id: 'wine',
    name: 'ワイン',
    enName: 'Wine',
    icon: '🍷',
    color: '#fb7185',
    bgGradient: 'linear-gradient(135deg, rgba(251, 113, 133, 0.15), rgba(225, 29, 72, 0.05))',
    border: 'rgba(251, 113, 133, 0.3)',
    tag: 'Wine'
  },
  beer: {
    id: 'beer',
    name: 'ビール',
    enName: 'Craft Beer',
    icon: '🍺',
    color: '#fbbf24',
    bgGradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(217, 119, 6, 0.05))',
    border: 'rgba(251, 191, 36, 0.3)',
    tag: 'Beer'
  },
  whisky: {
    id: 'whisky',
    name: 'ウイスキー',
    enName: 'Whisky / Spirits',
    icon: '🥃',
    color: '#f97316',
    bgGradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(194, 65, 12, 0.05))',
    border: 'rgba(249, 115, 22, 0.3)',
    tag: 'Whisky'
  },
  shochu: {
    id: 'shochu',
    name: '焼酎',
    enName: 'Shochu',
    icon: '🍶',
    color: '#a78bfa',
    bgGradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(139, 92, 246, 0.05))',
    border: 'rgba(167, 139, 250, 0.3)',
    tag: 'Shochu'
  },
  other: {
    id: 'other',
    name: 'その他',
    enName: 'Other Spirits',
    icon: '🍸',
    color: '#34d399',
    bgGradient: 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(16, 185, 129, 0.05))',
    border: 'rgba(52, 211, 153, 0.3)',
    tag: 'Other'
  }
};

/**
 * 日本酒の特定名称プリセット
 */
export const SAKE_TYPES = [
  '純米大吟醸',
  '純米吟醸',
  '特別純米酒',
  '純米酒',
  '大吟醸',
  '吟醸',
  '特別本醸造',
  '本醸造',
  '普通酒',
  '生酒 / 生原酒',
  '無濾過生原酒',
  'にごり酒 / 活性にごり',
  'スパークリング日本酒',
  '古酒 / 熟成酒',
  'その他'
];

/**
 * ワインの種類プリセット
 */
export const WINE_TYPES = [
  { value: 'red', label: '赤ワイン (Red)' },
  { value: 'white', label: '白ワイン (White)' },
  { value: 'sparkling', label: 'スパークリング / シャンパン (Sparkling)' },
  { value: 'rose', label: 'ロゼ (Rosé)' },
  { value: 'orange', label: 'オレンジ (Orange / Natural)' },
  { value: 'dessert', label: 'デザート / 貴腐 / ポート (Dessert)' },
  { value: 'other', label: 'その他' }
];

/**
 * 都道府県リスト
 */
export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
  '海外'
];

/**
 * データのエクスポート（JSONダウンロード）
 */
export async function exportDataAsJSON(drinks) {
  const exportPayload = {
    appName: 'SakeLog',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    itemCount: drinks.length,
    data: drinks
  };
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportPayload, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `sake_wine_log_backup_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * JSON ファイルのインポート
 */
export async function parseImportJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (Array.isArray(json)) {
          resolve(json);
        } else if (json && Array.isArray(json.data)) {
          resolve(json.data);
        } else {
          reject(new Error('有効なお酒ログバックアップ形式ではありません'));
        }
      } catch (err) {
        reject(new Error('JSONの解析に失敗しました: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsText(file);
  });
}
