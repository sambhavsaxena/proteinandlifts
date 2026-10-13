import starterExercises from './starter-exercises.json';

// The starter plans a new account is built from during onboarding: one
// training programme per goal and one diet per way of eating. Everything here
// becomes ordinary user data once inserted, so it can be edited or deleted.

export type ExerciseKey = keyof typeof starterExercises;
export type Goal = 'gain' | 'lose' | 'maintain';
export type DietPreference = 'vegan' | 'vegetarian' | 'eggetarian' | 'non_vegetarian';

// ------------------------------------------------------------------ training

type StarterWorkout = {
  name: string;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  /** A pair is [exercise, alternate]. */
  exercises: (ExerciseKey | [ExerciseKey, ExerciseKey])[];
};

export type StarterProgram = {
  label: string;
  blurb: string;
  /** Body weight change to aim for, kg per week. */
  weeklyChangeKg: number;
  restSeconds: number;
  repMin: number;
  repMax: number;
  notes: string;
  workouts: StarterWorkout[];
};

export const STARTER_PROGRAMS: Record<Goal, StarterProgram> = {
  gain: {
    label: 'Lean bulk',
    blurb: 'Push, pull, legs and a mixed day. Four sessions a week, heavy sets, long rests.',
    weeklyChangeKg: 0.3,
    restSeconds: 120,
    repMin: 8,
    repMax: 12,
    notes: 'Warm up for 5–10 minutes. 2–3 sets to failure, 2 minutes rest between sets.',
    workouts: [
      { name: 'Push', weekday: 0, exercises: [['bench', 'machinePress'], 'ohp', 'incline', 'lateral', 'pushdown'] },
      { name: 'Pull', weekday: 1, exercises: ['latPulldown', 'cableRow', 'dbRow', 'facePull', 'curl'] },
      { name: 'Legs', weekday: 3, exercises: [['squat', 'legPress'], 'rdl', 'legCurl', 'lunge', 'calf'] },
      { name: 'Abs + Mix', weekday: 4, exercises: ['incline', ['pullup', 'assistedPullup'], 'ohp', 'cableRow', 'curl', 'pushdown', 'legRaise'] },
    ],
  },
  lose: {
    label: 'Fat loss',
    blurb: 'Three full-body sessions a week to keep muscle while the scale comes down, with walking on the days between.',
    weeklyChangeKg: -0.5,
    restSeconds: 90,
    repMin: 10,
    repMax: 15,
    notes: 'Warm up for 5–10 minutes. Stop each set a rep or two short of failure. Walk 8–10k steps on rest days.',
    workouts: [
      { name: 'Full body A', weekday: 0, exercises: ['gobletSquat', 'dbBench', 'latPulldown', 'rdl', 'crunch'] },
      { name: 'Full body B', weekday: 2, exercises: ['legPress', 'ohp', 'cableRow', 'lunge', 'legRaise'] },
      { name: 'Full body C', weekday: 4, exercises: [['squat', 'legPress'], 'incline', 'dbRow', 'legCurl', 'crunch'] },
    ],
  },
  maintain: {
    label: 'Maintain',
    blurb: 'An upper day, a lower day and a full-body day. Three sessions a week to hold weight and keep getting stronger.',
    weeklyChangeKg: 0,
    restSeconds: 120,
    repMin: 8,
    repMax: 12,
    notes: 'Warm up for 5–10 minutes. 2–3 hard sets per exercise, 2 minutes rest between sets.',
    workouts: [
      { name: 'Upper', weekday: 0, exercises: [['bench', 'machinePress'], 'latPulldown', 'ohp', 'cableRow', 'curl', 'pushdown'] },
      { name: 'Lower', weekday: 2, exercises: [['squat', 'legPress'], 'rdl', 'legCurl', 'calf', 'crunch'] },
      { name: 'Full body', weekday: 4, exercises: ['incline', ['pullup', 'assistedPullup'], 'lunge', 'lateral', 'legRaise'] },
    ],
  },
};

/** Within a kilo of the target counts as already there. */
export function goalFor(weightKg: number, targetKg: number): Goal {
  if (targetKg - weightKg > 1) return 'gain';
  if (weightKg - targetKg > 1) return 'lose';
  return 'maintain';
}

/** Every exercise a programme uses, alternates included. */
export function exercisesIn(program: StarterProgram): ExerciseKey[] {
  return [...new Set(program.workouts.flatMap((w) => w.exercises.flat()))];
}

// ---------------------------------------------------------------------- diet

// Protein per serving is a standard approximation — edit it to match the label
// on what you actually buy.
export const STARTER_FOODS = {
  milk: { name: 'Whole milk', serving: '250 ml', protein_g: 8 },
  soyMilk: { name: 'Soy milk', serving: '250 ml', protein_g: 7 },
  sattu: { name: 'Sattu', serving: '1 tbsp', protein_g: 1.75 },
  banana: { name: 'Banana', serving: '1 medium', protein_g: 1 },
  jaggery: { name: 'Jaggery', serving: '1 tsp', protein_g: 0 },
  peanutButter: { name: 'Peanut butter', serving: '1 tbsp', protein_g: 4 },
  egg: { name: 'Egg', serving: '1 whole', protein_g: 6.25 },
  paneer: { name: 'Paneer', serving: '100 g', protein_g: 18 },
  tofu: { name: 'Tofu', serving: '100 g', protein_g: 13 },
  soyaChunks: { name: 'Soya chunks', serving: '30 g dry', protein_g: 15.5 },
  chicken: { name: 'Chicken breast', serving: '100 g cooked', protein_g: 30 },
  roti: { name: 'Roti', serving: '1 medium', protein_g: 3 },
  bread: { name: 'Bread', serving: '1 slice', protein_g: 3 },
  rice: { name: 'Cooked rice', serving: '1 cup', protein_g: 4 },
  dal: { name: 'Dal', serving: '1 bowl', protein_g: 7 },
  rajma: { name: 'Rajma or chole', serving: '1 bowl', protein_g: 8 },
  sabzi: { name: 'Sabzi', serving: '1 bowl', protein_g: 2 },
  curd: { name: 'Curd', serving: '1 bowl', protein_g: 5 },
  chana: { name: 'Roasted chana', serving: '40 g', protein_g: 8.5 },
  peanuts: { name: 'Peanuts', serving: '1 handful (30 g)', protein_g: 7 },
  dates: { name: 'Dates', serving: '2 pieces', protein_g: 0.5 },
  whey: { name: 'Whey protein', serving: '1 scoop', protein_g: 24 },
  plantProtein: { name: 'Plant protein powder', serving: '1 scoop', protein_g: 20 },
} satisfies Record<string, { name: string; serving: string; protein_g: number }>;

export type FoodKey = keyof typeof STARTER_FOODS;

/** [food, quantity, variant index (omit = every day)] */
type StarterItem = [FoodKey, number, number?];
type StarterMeal = { name: string; items: StarterItem[] };

export type StarterDiet = {
  label: string;
  blurb: string;
  planName: string;
  /** Alternate day types within the plan, e.g. an egg day and a no-egg day. */
  variants: string[];
  /** Offered as a one-tap top-up when the day ends short. */
  backup: FoodKey;
  /** Foods worth having in the list even though no meal uses them. */
  pantry: FoodKey[];
  meals: StarterMeal[];
};

const DAIRY_SHAKE: StarterMeal = { name: 'Morning shake (pre-workout)', items: [['milk', 1], ['sattu', 4], ['banana', 1], ['jaggery', 1], ['peanutButter', 1]] };
const EVENING: StarterMeal = { name: 'Evening', items: [['chana', 1], ['peanuts', 1], ['dates', 1]] };
const DAL_LUNCH: StarterMeal = { name: 'Lunch', items: [['roti', 3], ['dal', 1.5], ['sabzi', 1], ['curd', 1]] };
const BEDTIME_MILK: StarterMeal = { name: 'Bedtime', items: [['milk', 1]] };

export const STARTER_DIETS: Record<DietPreference, StarterDiet> = {
  vegan: {
    label: 'Vegan',
    blurb: 'No animal products. Soy milk, tofu, soya chunks, dal and legumes.',
    planName: 'Vegan · 120 g',
    variants: [],
    backup: 'plantProtein',
    pantry: ['rice', 'bread'],
    meals: [
      { name: 'Morning shake (pre-workout)', items: [['soyMilk', 1], ['sattu', 4], ['banana', 1], ['jaggery', 1], ['peanutButter', 1]] },
      { name: 'Breakfast (post-workout)', items: [['tofu', 1.5], ['roti', 2]] },
      { name: 'Lunch', items: [['roti', 3], ['dal', 1.5], ['soyaChunks', 1], ['sabzi', 1]] },
      EVENING,
      { name: 'Dinner', items: [['roti', 3], ['rajma', 1], ['sabzi', 1]] },
      { name: 'Bedtime', items: [['soyMilk', 1]] },
    ],
  },
  vegetarian: {
    label: 'Vegetarian',
    blurb: 'Dairy but no eggs. Milk, paneer, curd, dal and sattu.',
    planName: 'Vegetarian · 120 g',
    variants: [],
    backup: 'whey',
    pantry: ['rice', 'bread'],
    meals: [
      DAIRY_SHAKE,
      { name: 'Breakfast (post-workout)', items: [['paneer', 1], ['roti', 2]] },
      DAL_LUNCH,
      EVENING,
      { name: 'Dinner', items: [['roti', 3], ['dal', 1.5], ['sabzi', 1], ['curd', 1]] },
      BEDTIME_MILK,
    ],
  },
  eggetarian: {
    label: 'Eggetarian',
    blurb: 'Vegetarian plus eggs, with a no-egg day variant built around paneer.',
    planName: 'Eggetarian · 120 g',
    variants: ['Egg day', 'No-egg day'],
    backup: 'whey',
    pantry: ['rice', 'bread'],
    meals: [
      DAIRY_SHAKE,
      { name: 'Breakfast (post-workout)', items: [['egg', 4, 0], ['paneer', 1, 1], ['roti', 2]] },
      DAL_LUNCH,
      EVENING,
      { name: 'Dinner', items: [['roti', 3], ['dal', 1, 0], ['dal', 1.5, 1], ['sabzi', 1], ['curd', 1]] },
      BEDTIME_MILK,
    ],
  },
  non_vegetarian: {
    label: 'Non-vegetarian',
    blurb: 'Everything. Eggs at breakfast, chicken at lunch, dal at dinner.',
    planName: 'Non-vegetarian · 125 g',
    variants: [],
    backup: 'whey',
    pantry: ['rice', 'bread', 'paneer'],
    meals: [
      DAIRY_SHAKE,
      { name: 'Breakfast (post-workout)', items: [['egg', 3], ['roti', 2]] },
      { name: 'Lunch', items: [['chicken', 1], ['roti', 2], ['sabzi', 1], ['curd', 1]] },
      EVENING,
      { name: 'Dinner', items: [['roti', 2], ['dal', 1], ['sabzi', 1]] },
      BEDTIME_MILK,
    ],
  },
};

export const DIET_ORDER: DietPreference[] = ['vegan', 'vegetarian', 'eggetarian', 'non_vegetarian'];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Protein in one meal on the given variant (index into the diet's variants). */
export function mealProtein(meal: StarterMeal, variant = 0): number {
  return round1(meal.items.filter(([, , v]) => v === undefined || v === variant).reduce((sum, [food, qty]) => sum + qty * STARTER_FOODS[food].protein_g, 0));
}

/** Daily protein per variant; a diet without variants has a single total. */
export function dietTotals(diet: StarterDiet): number[] {
  const columns = diet.variants.length ? diet.variants.map((_, i) => i) : [0];
  return columns.map((v) => round1(diet.meals.reduce((sum, m) => sum + mealProtein(m, v), 0)));
}

// A common range for people who lift is 1.6–2.2 g of protein per kg of body
// weight; the suggestion takes the middle of it against the target weight.
const PROTEIN_PER_KG = 1.8;

export function suggestedProtein(targetWeightKg: number): number {
  const rounded = Math.round((targetWeightKg * PROTEIN_PER_KG) / 5) * 5;
  return Math.min(220, Math.max(60, rounded));
}

export { starterExercises };
