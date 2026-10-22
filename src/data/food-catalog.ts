import type { DietPreference } from './starter';

// The shared food list: protein-rich foods every account can pick from. It is
// read-only. Picking one copies it into the account's own foods (matched by
// name, so it is never copied twice); foods a user makes up stay in their own
// list and never come back here.
//
// Protein per serving is a standard approximation (USDA FoodData Central and
// the Indian Food Composition Tables); labels on what people buy will differ.

/** What a food is made from, which decides the diets it fits. */
export type FoodSource = 'plant' | 'dairy' | 'egg' | 'meat';

export type CatalogFood = {
  name: string;
  serving: string;
  protein_g: number;
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
  'Supplements',
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_CATALOG: CatalogFood[] = [
  // Pulses & beans
  { name: 'Dal', serving: '1 bowl (150 g cooked)', protein_g: 7, category: 'Pulses & beans', source: 'plant' },
  { name: 'Lentils', serving: '1 cup (200 g cooked)', protein_g: 18, category: 'Pulses & beans', source: 'plant' },
  { name: 'Moong (whole)', serving: '1 cup (200 g cooked)', protein_g: 14, category: 'Pulses & beans', source: 'plant' },
  { name: 'Chickpeas (chole)', serving: '1 cup (165 g cooked)', protein_g: 14.5, category: 'Pulses & beans', source: 'plant' },
  { name: 'Kala chana', serving: '1 cup (165 g cooked)', protein_g: 14, category: 'Pulses & beans', source: 'plant' },
  { name: 'Rajma (kidney beans)', serving: '1 cup (175 g cooked)', protein_g: 15, category: 'Pulses & beans', source: 'plant' },
  { name: 'Rajma or chole', serving: '1 bowl (150 g curry)', protein_g: 8, category: 'Pulses & beans', source: 'plant' },
  { name: 'Black beans', serving: '1 cup (170 g cooked)', protein_g: 15, category: 'Pulses & beans', source: 'plant' },
  { name: 'Green peas', serving: '1 cup (160 g cooked)', protein_g: 8.5, category: 'Pulses & beans', source: 'plant' },
  { name: 'Roasted chana', serving: '40 g', protein_g: 8.5, category: 'Pulses & beans', source: 'plant' },
  { name: 'Sattu', serving: '30 g', protein_g: 6.5, category: 'Pulses & beans', source: 'plant' },
  { name: 'Besan (gram flour)', serving: '30 g', protein_g: 6.5, category: 'Pulses & beans', source: 'plant' },
  { name: 'Hummus', serving: '4 tbsp (60 g)', protein_g: 5, category: 'Pulses & beans', source: 'plant' },

  // Soy & plant protein
  { name: 'Soya chunks', serving: '30 g dry', protein_g: 15.5, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Tofu', serving: '100 g', protein_g: 13, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Tempeh', serving: '100 g', protein_g: 20, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Edamame', serving: '1 cup (155 g shelled)', protein_g: 18, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Soy milk', serving: '250 ml', protein_g: 7, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Seitan', serving: '100 g', protein_g: 25, category: 'Soy & plant protein', source: 'plant' },
  { name: 'Nutritional yeast', serving: '2 tbsp (10 g)', protein_g: 5, category: 'Soy & plant protein', source: 'plant' },

  // Dairy
  { name: 'Whole milk', serving: '250 ml', protein_g: 8, category: 'Dairy', source: 'dairy' },
  { name: 'Skimmed milk', serving: '250 ml', protein_g: 8.5, category: 'Dairy', source: 'dairy' },
  { name: 'Curd', serving: '1 bowl (200 g)', protein_g: 7, category: 'Dairy', source: 'dairy' },
  { name: 'Greek yogurt', serving: '170 g', protein_g: 17, category: 'Dairy', source: 'dairy' },
  { name: 'Skyr', serving: '150 g', protein_g: 16, category: 'Dairy', source: 'dairy' },
  { name: 'Kefir', serving: '250 ml', protein_g: 9, category: 'Dairy', source: 'dairy' },
  { name: 'Paneer', serving: '100 g', protein_g: 18, category: 'Dairy', source: 'dairy' },
  { name: 'Cottage cheese', serving: '½ cup (115 g)', protein_g: 12, category: 'Dairy', source: 'dairy' },
  { name: 'Cheddar cheese', serving: '1 slice (28 g)', protein_g: 7, category: 'Dairy', source: 'dairy' },
  { name: 'Mozzarella', serving: '28 g', protein_g: 6, category: 'Dairy', source: 'dairy' },

  // Eggs
  { name: 'Egg', serving: '1 whole', protein_g: 6.25, category: 'Eggs', source: 'egg' },
  { name: 'Egg white', serving: '1 large', protein_g: 3.5, category: 'Eggs', source: 'egg' },

  // Meat & poultry
  { name: 'Chicken breast', serving: '100 g cooked', protein_g: 31, category: 'Meat & poultry', source: 'meat' },
  { name: 'Chicken thigh', serving: '100 g cooked', protein_g: 25, category: 'Meat & poultry', source: 'meat' },
  { name: 'Turkey breast', serving: '100 g cooked', protein_g: 29, category: 'Meat & poultry', source: 'meat' },
  { name: 'Mutton (goat)', serving: '100 g cooked', protein_g: 27, category: 'Meat & poultry', source: 'meat' },
  { name: 'Lamb', serving: '100 g cooked', protein_g: 25, category: 'Meat & poultry', source: 'meat' },
  { name: 'Lean beef mince', serving: '100 g cooked', protein_g: 26, category: 'Meat & poultry', source: 'meat' },
  { name: 'Beef steak', serving: '100 g cooked', protein_g: 29, category: 'Meat & poultry', source: 'meat' },
  { name: 'Pork loin', serving: '100 g cooked', protein_g: 27, category: 'Meat & poultry', source: 'meat' },
  { name: 'Beef jerky', serving: '28 g', protein_g: 9, category: 'Meat & poultry', source: 'meat' },

  // Fish & seafood
  { name: 'Tuna (canned in water)', serving: '100 g drained', protein_g: 25, category: 'Fish & seafood', source: 'meat' },
  { name: 'Salmon', serving: '100 g cooked', protein_g: 22, category: 'Fish & seafood', source: 'meat' },
  { name: 'Rohu or catla', serving: '100 g cooked', protein_g: 20, category: 'Fish & seafood', source: 'meat' },
  { name: 'Mackerel (bangda)', serving: '100 g cooked', protein_g: 24, category: 'Fish & seafood', source: 'meat' },
  { name: 'Tilapia', serving: '100 g cooked', protein_g: 26, category: 'Fish & seafood', source: 'meat' },
  { name: 'Cod', serving: '100 g cooked', protein_g: 23, category: 'Fish & seafood', source: 'meat' },
  { name: 'Sardines (canned)', serving: '100 g', protein_g: 25, category: 'Fish & seafood', source: 'meat' },
  { name: 'Prawns', serving: '100 g cooked', protein_g: 23, category: 'Fish & seafood', source: 'meat' },

  // Nuts & seeds
  { name: 'Peanuts', serving: '1 handful (30 g)', protein_g: 7.5, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Peanut butter', serving: '2 tbsp (32 g)', protein_g: 7, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Almonds', serving: '30 g', protein_g: 6, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Cashews', serving: '30 g', protein_g: 5.5, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Walnuts', serving: '30 g', protein_g: 4.5, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Pumpkin seeds', serving: '30 g', protein_g: 8.5, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Sunflower seeds', serving: '30 g', protein_g: 6, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Hemp seeds', serving: '3 tbsp (30 g)', protein_g: 9.5, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Chia seeds', serving: '2 tbsp (24 g)', protein_g: 4, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Flaxseed', serving: '2 tbsp (20 g)', protein_g: 3.5, category: 'Nuts & seeds', source: 'plant' },
  { name: 'Makhana (fox nuts)', serving: '30 g', protein_g: 3, category: 'Nuts & seeds', source: 'plant' },

  // Grains & breads
  { name: 'Roti', serving: '1 medium', protein_g: 3, category: 'Grains & breads', source: 'plant' },
  { name: 'Bread', serving: '1 slice', protein_g: 3, category: 'Grains & breads', source: 'plant' },
  { name: 'Cooked rice', serving: '1 cup', protein_g: 4, category: 'Grains & breads', source: 'plant' },
  { name: 'Brown rice', serving: '1 cup cooked', protein_g: 5.5, category: 'Grains & breads', source: 'plant' },
  { name: 'Oats', serving: '40 g dry', protein_g: 5, category: 'Grains & breads', source: 'plant' },
  { name: 'Quinoa', serving: '1 cup (185 g cooked)', protein_g: 8, category: 'Grains & breads', source: 'plant' },
  { name: 'Pasta', serving: '1 cup (140 g cooked)', protein_g: 8, category: 'Grains & breads', source: 'plant' },
  { name: 'Idli', serving: '2 pieces', protein_g: 4, category: 'Grains & breads', source: 'plant' },
  { name: 'Dosa', serving: '1 medium, plain', protein_g: 3, category: 'Grains & breads', source: 'plant' },

  // Supplements
  { name: 'Whey protein', serving: '1 scoop', protein_g: 24, category: 'Supplements', source: 'dairy' },
  { name: 'Casein protein', serving: '1 scoop', protein_g: 24, category: 'Supplements', source: 'dairy' },
  { name: 'Plant protein powder', serving: '1 scoop', protein_g: 20, category: 'Supplements', source: 'plant' },
  { name: 'Protein bar', serving: '1 bar (60 g)', protein_g: 20, category: 'Supplements', source: 'dairy' },
];

const ALLOWED: Record<DietPreference, FoodSource[]> = {
  vegan: ['plant'],
  vegetarian: ['plant', 'dairy'],
  eggetarian: ['plant', 'dairy', 'egg'],
  non_vegetarian: ['plant', 'dairy', 'egg', 'meat'],
};

/** Whether a food suits a way of eating; with no preference every food does. */
export const fitsDiet = (food: CatalogFood, preference: DietPreference | null) => !preference || ALLOWED[preference].includes(food.source);

/** Shared foods that suit the diet and that the account does not have yet (matched by name). */
export function catalogFoodsFor(preference: DietPreference | null, ownedNames: Iterable<string>): CatalogFood[] {
  const owned = new Set([...ownedNames].map((n) => n.toLowerCase()));
  return FOOD_CATALOG.filter((f) => fitsDiet(f, preference) && !owned.has(f.name.toLowerCase()));
}
