import MORE_FOODS from './food-catalog-more.json';
import type { DietPreference } from './starter';

// The shared food list: everyday foods every account can pick from. It is
// read-only. Picking one copies it into the account's own foods (matched by
// name, so it is never copied twice); foods a user makes up stay in their own
// list and never come back here.
//
// Protein and calories per serving are standard approximations (USDA
// FoodData Central and the Indian Food Composition Tables); labels on what
// people buy will differ. FOOD_CATALOG holds the hand-picked protein foods the
// starter diets are built from; food-catalog-more.json adds a wider list of
// Indian staples, dishes and snacks, all per 100 g.

/** What a food is made from, which decides the diets it fits. */
export type FoodSource = 'plant' | 'dairy' | 'egg' | 'meat';

export type CatalogFood = {
  name: string;
  serving: string;
  protein_g: number;
  /** kcal per serving. */
  calories: number;
  category: FoodCategory;
  source: FoodSource;
};

export const FOOD_CATEGORIES = [
  'Pulses & beans',
  'Soy & plant protein',
  'Dairy',
  'Eggs',
  'Meat & poultry',
  'Fish & seafood',
  'Nuts & seeds',
  'Grains & breads',
  'Vegetables',
  'Fruits',
  'Meals & curries',
  'Snacks & street food',
  'Sweets & desserts',
  'Drinks',
  'Oils, spices & condiments',
  'Supplements',
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_CATALOG = [
  // Pulses & beans
  { name: 'Dal', serving: '1 bowl (150 g cooked)', protein_g: 7, calories: 170, category: 'Pulses & beans', source: 'plant' },
  { name: 'Lentils', serving: '1 cup (200 g cooked)', protein_g: 18, calories: 230, category: 'Pulses & beans', source: 'plant' },
  { name: 'Moong (whole)', serving: '1 cup (200 g cooked)', protein_g: 14, calories: 210, category: 'Pulses & beans', source: 'plant' },
  { name: 'Chickpeas (chole)', serving: '1 cup (165 g cooked)', protein_g: 14.5, calories: 270, category: 'Pulses & beans', source: 'plant' },
  { name: 'Kala chana', serving: '1 cup (165 g cooked)', protein_g: 14, calories: 250, category: 'Pulses & beans', source: 'plant' },
  { name: 'Rajma (kidney beans)', serving: '1 cup (175 g cooked)', protein_g: 15, calories: 225, category: 'Pulses & beans', source: 'plant' },
  { name: 'Rajma or chole', serving: '1 bowl (150 g curry)', protein_g: 8, calories: 200, category: 'Pulses & beans', source: 'plant' },
  { name: 'Black beans', serving: '1 cup (170 g cooked)', protein_g: 15, calories: 225, category: 'Pulses & beans', source: 'plant' },
  { name: 'Green peas', serving: '1 cup (160 g cooked)', protein_g: 8.5, calories: 135, category: 'Pulses & beans', source: 'plant' },
  { name: 'Roasted chana', serving: '40 g', protein_g: 8.5, calories: 150, category: 'Pulses & beans', source: 'plant' },
  { name: 'Sattu', serving: '30 g', protein_g: 6.5, calories: 120, category: 'Pulses & beans', source: 'plant' },
  { name: 'Besan (gram flour)', serving: '30 g', protein_g: 6.5, calories: 115, category: 'Pulses & beans', source: 'plant' },
  { name: 'Hummus', serving: '4 tbsp (60 g)', protein_g: 5, calories: 100, category: 'Pulses & beans', source: 'plant' },

  // Soy & plant protein
  { name: 'Soya chunks', serving: '30 g dry', protein_g: 15.5, calories: 105, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Tofu', serving: '100 g', protein_g: 13, calories: 140, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Tempeh', serving: '100 g', protein_g: 20, calories: 195, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Edamame', serving: '1 cup (155 g shelled)', protein_g: 18, calories: 190, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Soy milk', serving: '250 ml', protein_g: 7, calories: 90, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Seitan', serving: '100 g', protein_g: 25, calories: 140, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Nutritional yeast', serving: '2 tbsp (10 g)', protein_g: 5, calories: 40, category: 'Soy & plant protein', source: 'plant' },

  // Dairy
  { name: 'Whole milk', serving: '250 ml', protein_g: 8, calories: 150, category: 'Dairy', source: 'dairy' },
  { name: 'Skimmed milk', serving: '250 ml', protein_g: 8.5, calories: 85, category: 'Dairy', source: 'dairy' },
  { name: 'Curd', serving: '1 bowl (200 g)', protein_g: 7, calories: 120, category: 'Dairy', source: 'dairy' },
  { name: 'Greek yogurt', serving: '170 g', protein_g: 17, calories: 100, category: 'Dairy', source: 'dairy' },
  { name: 'Skyr', serving: '150 g', protein_g: 16, calories: 95, category: 'Dairy', source: 'dairy' },
  { name: 'Kefir', serving: '250 ml', protein_g: 9, calories: 140, category: 'Dairy', source: 'dairy' },
  { name: 'Paneer', serving: '100 g', protein_g: 18, calories: 265, category: 'Dairy', source: 'dairy' },
  { name: 'Cottage cheese', serving: '½ cup (115 g)', protein_g: 12, calories: 110, category: 'Dairy', source: 'dairy' },
  { name: 'Cheddar cheese', serving: '1 slice (28 g)', protein_g: 7, calories: 115, category: 'Dairy', source: 'dairy' },
  { name: 'Mozzarella', serving: '28 g', protein_g: 6, calories: 85, category: 'Dairy', source: 'dairy' },

  // Eggs
  { name: 'Egg', serving: '1 whole', protein_g: 6.25, calories: 72, category: 'Eggs', source: 'egg' },
  { name: 'Egg white', serving: '1 large', protein_g: 3.5, calories: 17, category: 'Eggs', source: 'egg' },

  // Meat & poultry
  { name: 'Chicken breast', serving: '100 g cooked', protein_g: 31, calories: 165, category: 'Meat & poultry', source: 'meat' },
  { name: 'Chicken thigh', serving: '100 g cooked', protein_g: 25, calories: 210, category: 'Meat & poultry', source: 'meat' },
  { name: 'Turkey breast', serving: '100 g cooked', protein_g: 29, calories: 135, category: 'Meat & poultry', source: 'meat' },
  { name: 'Mutton (goat)', serving: '100 g cooked', protein_g: 27, calories: 145, category: 'Meat & poultry', source: 'meat' },
  { name: 'Lamb', serving: '100 g cooked', protein_g: 25, calories: 260, category: 'Meat & poultry', source: 'meat' },
  { name: 'Lean beef mince', serving: '100 g cooked', protein_g: 26, calories: 215, category: 'Meat & poultry', source: 'meat' },
  { name: 'Beef steak', serving: '100 g cooked', protein_g: 29, calories: 250, category: 'Meat & poultry', source: 'meat' },
  { name: 'Pork loin', serving: '100 g cooked', protein_g: 27, calories: 210, category: 'Meat & poultry', source: 'meat' },
  { name: 'Beef jerky', serving: '28 g', protein_g: 9, calories: 115, category: 'Meat & poultry', source: 'meat' },

  // Fish & seafood
  { name: 'Tuna (canned in water)', serving: '100 g drained', protein_g: 25, calories: 115, category: 'Fish & seafood', source: 'meat' },
  { name: 'Salmon', serving: '100 g cooked', protein_g: 22, calories: 205, category: 'Fish & seafood', source: 'meat' },
  { name: 'Rohu or catla', serving: '100 g cooked', protein_g: 20, calories: 140, category: 'Fish & seafood', source: 'meat' },
  { name: 'Mackerel (bangda)', serving: '100 g cooked', protein_g: 24, calories: 260, category: 'Fish & seafood', source: 'meat' },
  { name: 'Tilapia', serving: '100 g cooked', protein_g: 26, calories: 128, category: 'Fish & seafood', source: 'meat' },
  { name: 'Cod', serving: '100 g cooked', protein_g: 23, calories: 105, category: 'Fish & seafood', source: 'meat' },
  { name: 'Sardines (canned)', serving: '100 g', protein_g: 25, calories: 210, category: 'Fish & seafood', source: 'meat' },
  { name: 'Prawns', serving: '100 g cooked', protein_g: 23, calories: 100, category: 'Fish & seafood', source: 'meat' },

  // Nuts & seeds
  { name: 'Peanuts', serving: '1 handful (30 g)', protein_g: 7.5, calories: 170, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Peanut butter', serving: '2 tbsp (32 g)', protein_g: 7, calories: 190, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Almonds', serving: '30 g', protein_g: 6, calories: 175, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Cashews', serving: '30 g', protein_g: 5.5, calories: 165, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Walnuts', serving: '30 g', protein_g: 4.5, calories: 195, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Pumpkin seeds', serving: '30 g', protein_g: 8.5, calories: 170, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Sunflower seeds', serving: '30 g', protein_g: 6, calories: 175, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Hemp seeds', serving: '3 tbsp (30 g)', protein_g: 9.5, calories: 165, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Chia seeds', serving: '2 tbsp (24 g)', protein_g: 4, calories: 115, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Flaxseed', serving: '2 tbsp (20 g)', protein_g: 3.5, calories: 105, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Makhana (fox nuts)', serving: '30 g', protein_g: 3, calories: 105, category: 'Nuts & seeds', source: 'plant' },

  // Grains & breads
  { name: 'Roti', serving: '1 medium', protein_g: 3, calories: 110, category: 'Grains & breads', source: 'plant' },
  { name: 'Bread', serving: '1 slice', protein_g: 3, calories: 70, category: 'Grains & breads', source: 'plant' },
  { name: 'Cooked rice', serving: '1 cup', protein_g: 4, calories: 205, category: 'Grains & breads', source: 'plant' },
  { name: 'Brown rice', serving: '1 cup cooked', protein_g: 5.5, calories: 215, category: 'Grains & breads', source: 'plant' },
  { name: 'Oats', serving: '40 g dry', protein_g: 5, calories: 155, category: 'Grains & breads', source: 'plant' },
  { name: 'Quinoa', serving: '1 cup (185 g cooked)', protein_g: 8, calories: 220, category: 'Grains & breads', source: 'plant' },
  { name: 'Pasta', serving: '1 cup (140 g cooked)', protein_g: 8, calories: 220, category: 'Grains & breads', source: 'plant' },
  { name: 'Idli', serving: '2 pieces', protein_g: 4, calories: 80, category: 'Grains & breads', source: 'plant' },
  { name: 'Dosa', serving: '1 medium, plain', protein_g: 3, calories: 135, category: 'Grains & breads', source: 'plant' },

  // Supplements
  { name: 'Whey protein', serving: '1 scoop', protein_g: 24, calories: 120, category: 'Supplements', source: 'dairy' },
  { name: 'Casein protein', serving: '1 scoop', protein_g: 24, calories: 120, category: 'Supplements', source: 'dairy' },
  { name: 'Plant protein powder', serving: '1 scoop', protein_g: 20, calories: 110, category: 'Supplements', source: 'plant' },
  { name: 'Protein bar', serving: '1 bar (60 g)', protein_g: 20, calories: 210, category: 'Supplements', source: 'dairy' },
] as const satisfies readonly CatalogFood[];

export type FoodName = (typeof FOOD_CATALOG)[number]['name'];

/** The shared-list entry with this name. */
export const catalogFood = (name: FoodName): CatalogFood => FOOD_CATALOG.find((f) => f.name === name)!;

const ALLOWED: Record<DietPreference, FoodSource[]> = {
  vegan: ['plant'],
  vegetarian: ['plant', 'dairy'],
  eggetarian: ['plant', 'dairy', 'egg'],
  non_vegetarian: ['plant', 'dairy', 'egg', 'meat'],
};

/** Whether a food suits a way of eating; with no preference every food does. */
export const fitsDiet = (food: CatalogFood, preference: DietPreference | null) => !preference || ALLOWED[preference].includes(food.source);

/** The whole shared list: the hand-picked foods first, then the wider list. */
export const SHARED_FOODS: readonly CatalogFood[] = [...FOOD_CATALOG, ...(MORE_FOODS as CatalogFood[])];

const byName = new Map(SHARED_FOODS.map((f) => [f.name.toLowerCase(), f]));

/** The shared-list entry with this name, matched as the account's foods are (ignoring case). */
export const sharedFood = (name: string): CatalogFood | undefined => byName.get(name.toLowerCase());

/** Shared foods that suit the diet and that the account does not have yet (matched by name). */
export function catalogFoodsFor(preference: DietPreference | null, ownedNames: Iterable<string>): CatalogFood[] {
  const owned = new Set([...ownedNames].map((n) => n.toLowerCase()));
  return SHARED_FOODS.filter((f) => fitsDiet(f, preference) && !owned.has(f.name.toLowerCase()));
}
