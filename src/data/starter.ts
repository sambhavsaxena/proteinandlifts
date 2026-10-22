import { catalogFood, type FoodName } from './food-catalog';
import starterExercises from './starter-exercises.json';

// The starter plans a new account is built from during onboarding: one
// training programme per goal and one four-meal diet per way of eating, built
// from the shared food list (food-catalog.ts). Everything becomes ordinary
// user data once inserted, so it can be edited or deleted.

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

// How someone eats. It decides which shared foods are offered (see
// food-catalog.ts); meals themselves are left for the user to build.
export const DIET_OPTIONS: Record<DietPreference, { label: string; blurb: string }> = {
  vegan: { label: 'Vegan', blurb: 'No animal products. Soy, pulses, nuts and seeds.' },
  vegetarian: { label: 'Vegetarian', blurb: 'Dairy but no eggs, meat or fish.' },
  eggetarian: { label: 'Eggetarian', blurb: 'Vegetarian plus eggs.' },
  non_vegetarian: { label: 'Non-vegetarian', blurb: 'Everything, including meat and fish.' },
};

export const DIET_ORDER: DietPreference[] = ['vegan', 'vegetarian', 'eggetarian', 'non_vegetarian'];

/** [shared food, servings] */
type StarterItem = [FoodName, number];
export type StarterMeal = { name: string; items: StarterItem[] };
export type StarterDiet = { planName: string; meals: StarterMeal[] };

// Everyday meals for each way of eating: a protein source in every meal, with
// common staples around it.
const DAL_LUNCH: StarterMeal = { name: 'Lunch', items: [['Dal', 1.5], ['Roti', 3], ['Curd', 1]] };
const NUT_SNACK: StarterMeal = { name: 'Snack', items: [['Roasted chana', 1], ['Peanuts', 1]] };
const EGG_BREAKFAST: StarterMeal = { name: 'Breakfast', items: [['Egg', 3], ['Bread', 2]] };

export const STARTER_DIETS: Record<DietPreference, StarterDiet> = {
  vegan: {
    planName: 'Vegan starter',
    meals: [
      { name: 'Breakfast', items: [['Oats', 1], ['Soy milk', 1], ['Peanut butter', 1], ['Chia seeds', 1]] },
      { name: 'Lunch', items: [['Dal', 1.5], ['Roti', 3], ['Soya chunks', 1]] },
      NUT_SNACK,
      { name: 'Dinner', items: [['Tofu', 1.5], ['Roti', 2], ['Green peas', 1]] },
    ],
  },
  vegetarian: {
    planName: 'Vegetarian starter',
    meals: [
      { name: 'Breakfast', items: [['Whole milk', 1], ['Oats', 1], ['Peanut butter', 1]] },
      DAL_LUNCH,
      NUT_SNACK,
      { name: 'Dinner', items: [['Paneer', 1], ['Roti', 2], ['Green peas', 1]] },
    ],
  },
  eggetarian: {
    planName: 'Eggetarian starter',
    meals: [EGG_BREAKFAST, DAL_LUNCH, NUT_SNACK, { name: 'Dinner', items: [['Paneer', 1], ['Roti', 2], ['Dal', 1]] }],
  },
  non_vegetarian: {
    planName: 'Non-vegetarian starter',
    meals: [
      EGG_BREAKFAST,
      { name: 'Lunch', items: [['Chicken breast', 1], ['Cooked rice', 1], ['Dal', 1]] },
      NUT_SNACK,
      { name: 'Dinner', items: [['Rohu or catla', 1], ['Roti', 2], ['Curd', 1]] },
    ],
  },
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Protein in one starter meal. */
export const mealProtein = (meal: StarterMeal) => round1(meal.items.reduce((sum, [food, qty]) => sum + qty * catalogFood(food).protein_g, 0));

/** Protein in a starter diet's whole day. */
export const dietTotal = (diet: StarterDiet) => round1(diet.meals.reduce((sum, m) => sum + mealProtein(m), 0));

// A common range for people who lift is 1.6–2.2 g of protein per kg of body
// weight; the suggestion takes the middle of it against the target weight.
const PROTEIN_PER_KG = 1.8;

export function suggestedProtein(targetWeightKg: number): number {
  const rounded = Math.round((targetWeightKg * PROTEIN_PER_KG) / 5) * 5;
  return Math.min(220, Math.max(60, rounded));
}

export { starterExercises };
