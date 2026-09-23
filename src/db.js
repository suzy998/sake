import Dexie from 'dexie';

export const db = new Dexie('SakeWineLogDB');

// スキーマ定義
// id: 主キー（自動採番）
// type: お酒のカテゴリ (sake, wine, beer, whisky, shochu, other)
// name: 銘柄名
// drankAt: 飲んだ日
// price: 価格
// prefecture, brewery: 日本酒用インデックス
// region, grapeVariety: ワイン用インデックス
// createdAt: 登録日時
db.version(1).stores({
  drinks: '++id, type, name, drankAt, price, prefecture, brewery, region, grapeVariety, createdAt'
});

// サンプルデータ（初回起動時にデータが空の場合に追加可能にするか、空スタート）
export async function getAllDrinks() {
  return await db.drinks.orderBy('drankAt').reverse().toArray();
}

export async function getDrinkById(id) {
  return await db.drinks.get(Number(id));
}

export async function addDrink(drinkData) {
  const now = new Date().toISOString();
  return await db.drinks.add({
    ...drinkData,
    createdAt: now,
    updatedAt: now
  });
}

export async function updateDrink(id, drinkData) {
  const now = new Date().toISOString();
  return await db.drinks.update(Number(id), {
    ...drinkData,
    updatedAt: now
  });
}

export async function deleteDrink(id) {
  return await db.drinks.delete(Number(id));
}

export async function clearAllDrinks() {
  return await db.drinks.clear();
}

export async function getDrinkStats() {
  const drinks = await db.drinks.toArray();
  const total = drinks.length;
  const sakeCount = drinks.filter(d => d.type === 'sake').length;
  const wineCount = drinks.filter(d => d.type === 'wine').length;
  const otherCount = total - sakeCount - wineCount;
  
  const totalPrice = drinks.reduce((sum, d) => sum + (Number(d.price) || 0), 0);
  
  // 今月飲んだ本数
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const thisMonthCount = drinks.filter(d => d.drankAt && d.drankAt.startsWith(currentMonth)).length;

  return {
    total,
    sakeCount,
    wineCount,
    otherCount,
    totalPrice,
    thisMonthCount
  };
}
