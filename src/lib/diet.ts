import { catalogFood, type CatalogFood } from '../data/food-catalog';
import type { StarterMeal } from '../data/starter';
import { must, supabase } from './supabase';
import type { DietPlan, Food, IntakeLog, Meal, MealItem } from './types';

const PLAN_COLUMNS = 'id,name,variants,meals(id,plan_id,name,position,meal_items(id,meal_id,food_id,qty,variant,position))';

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

function sortPlan(plan: DietPlan): DietPlan {
  plan.meals.sort(byPosition);
  for (const meal of plan.meals) meal.meal_items.sort(byPosition);
  return plan;
}

export async function fetchPlan(id: string): Promise<DietPlan | null> {
  const plan = must(await supabase.from('diet_plans').select(PLAN_COLUMNS).eq('id', id).maybeSingle()) as DietPlan | null;
  return plan && sortPlan(plan);
}

export async function fetchPlans(): Promise<DietPlan[]> {
  const plans = must(await supabase.from('diet_plans').select(PLAN_COLUMNS).order('created_at')) as DietPlan[];
  return plans.map(sortPlan);
}

export const FOOD_COLUMNS = 'id,name,serving,protein_g,calories,is_backup';

export async function fetchFoods(): Promise<Food[]> {
  return must(await supabase.from('foods').select(FOOD_COLUMNS).order('name')) as Food[];
}

/** Copies a food from the shared list into the account's foods, or returns the copy it already has (same name). */
export async function addCatalogFood(food: CatalogFood, owned: Food[]): Promise<Food> {
  const existing = owned.find((f) => f.name.toLowerCase() === food.name.toLowerCase());
  if (existing) return existing;
  return must(
    await supabase.from('foods').insert({ name: food.name, serving: food.serving, protein_g: food.protein_g, calories: food.calories }).select(FOOD_COLUMNS).single(),
  ) as Food;
}

/** Items eaten on the given variant: those tagged with it plus the untagged ones. */
export const itemsFor = (meal: Meal, variant: string | null): MealItem[] =>
  meal.meal_items.filter((i) => i.variant === null || i.variant === variant);

export const round1 = (n: number) => Math.round(n * 10) / 10;

export function proteinOf(items: MealItem[], foods: Map<string, Food>): number {
  return round1(items.reduce((sum, i) => sum + i.qty * (foods.get(i.food_id)?.protein_g ?? 0), 0));
}

/** Unknown calories (older entries, foods without a label) count as none. */
export function caloriesOf(items: MealItem[], foods: Map<string, Food>): number {
  return Math.round(items.reduce((sum, i) => sum + i.qty * Number(foods.get(i.food_id)?.calories ?? 0), 0));
}

/** Calories in one starter meal, from the shared list. */
export const starterMealCalories = (meal: StarterMeal) => Math.round(meal.items.reduce((sum, [food, qty]) => sum + qty * catalogFood(food).calories, 0));

export const sumCalories = (logs: Pick<IntakeLog, 'calories'>[]) => Math.round(logs.reduce((sum, l) => sum + Number(l.calories ?? 0), 0));

/** A log entry for some servings of a food: protein and calories are totals, frozen at log time. */
export const intakeFromFood = (food: Pick<Food, 'name' | 'protein_g' | 'calories'> & { id: string | null }, qty: number, mealName: string | null = null) => ({
  food_id: food.id,
  food_name: food.name,
  qty,
  protein_g: round1(qty * food.protein_g),
  calories: food.calories === null ? null : Math.round(qty * food.calories),
  meal_name: mealName,
});

/** "4 × Egg, 2 × Roti" */
export function describeItems(items: MealItem[], foods: Map<string, Food>): string {
  return items
    .map((i) => {
      const name = foods.get(i.food_id)?.name ?? 'Deleted food';
      return i.qty === 1 ? name : `${i.qty} × ${name}`;
    })
    .join(', ');
}
