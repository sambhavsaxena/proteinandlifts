import { FOOD_CATEGORIES, sharedFood, type CatalogFood, type FoodCategory } from '../data/food-catalog';
import type { Food } from './types';

// Searching and grouping the food pickers. Names are lowercased once when a
// list is indexed, so each keystroke is one pass of substring checks over the
// list, and grouping by category is one more pass (not one per category).
// Same as the mobile app's src/lib/data/food-search.ts.

/** A row in a food picker: one of the account's foods, or a shared-list food not copied yet. */
export type PickerFood = {
  /** The food's id, or `shared:<name>` for a shared-list food. */
  id: string;
  name: string;
  serving: string;
  protein_g: number;
  calories: number | null;
  is_backup: boolean;
  /** Set for shared-list foods. */
  shared: CatalogFood | null;
  category: FoodCategory | null;
};

export const SHARED_ID = 'shared:';

export const ownPickerFood = (food: Food): PickerFood => ({
  ...food,
  protein_g: Number(food.protein_g),
  calories: food.calories === null || food.calories === undefined ? null : Number(food.calories),
  shared: null,
  // A copy of a shared food keeps its category; foods made up by the user have none.
  category: sharedFood(food.name)?.category ?? null,
});

export const sharedPickerFood = (food: CatalogFood): PickerFood => ({
  id: SHARED_ID + food.name,
  name: food.name,
  serving: food.serving,
  protein_g: food.protein_g,
  calories: food.calories,
  is_backup: false,
  shared: food,
  category: food.category,
});

export type FoodIndex = { food: PickerFood; key: string }[];

export const indexFoods = (foods: PickerFood[]): FoodIndex => foods.map((food) => ({ food, key: food.name.toLowerCase() }));

export const queryWords = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

const startsWord = (key: string, word: string) => {
  for (let at = key.indexOf(word); at !== -1; at = key.indexOf(word, at + 1)) {
    if (at === 0 || !/[a-z0-9]/.test(key[at - 1])) return true;
  }
  return false;
};

/**
 * How well a name matches every word: 0 when it starts with the first word,
 * 1 when one of its words does, 2 for a match inside a word; null when a word
 * is missing.
 */
function rank(key: string, words: string[]): number | null {
  for (const w of words) if (!key.includes(w)) return null;
  return key.startsWith(words[0]) ? 0 : startsWord(key, words[0]) ? 1 : 2;
}

/** Foods matching every word, best matches first; ties keep the index's order. */
export function searchFoods(index: FoodIndex, words: string[]): PickerFood[] {
  if (!words.length) return index.map((e) => e.food);
  const ranked: { food: PickerFood; rank: number; at: number }[] = [];
  index.forEach((e, at) => {
    const r = rank(e.key, words);
    if (r !== null) ranked.push({ food: e.food, rank: r, at });
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.at - b.at).map((r) => r.food);
}

/** Foods by category, in the shared list's category order, empty categories left out. */
export function byCategory(foods: PickerFood[]): { category: FoodCategory; foods: PickerFood[] }[] {
  const groups = new Map<FoodCategory, PickerFood[]>();
  for (const f of foods) {
    if (!f.category) continue;
    const list = groups.get(f.category);
    if (list) list.push(f);
    else groups.set(f.category, [f]);
  }
  return FOOD_CATEGORIES.flatMap((category) => {
    const list = groups.get(category);
    return list ? [{ category, foods: list }] : [];
  });
}
