import { must, supabase } from './supabase';
import type { DietPlan, Food, Meal, MealItem } from './types';

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

export async function fetchFoods(): Promise<Food[]> {
  return must(await supabase.from('foods').select('id,name,serving,protein_g,is_backup').order('name')) as Food[];
}

/** Items eaten on the given variant: those tagged with it plus the untagged ones. */
export const itemsFor = (meal: Meal, variant: string | null): MealItem[] =>
  meal.meal_items.filter((i) => i.variant === null || i.variant === variant);

export const round1 = (n: number) => Math.round(n * 10) / 10;

export function proteinOf(items: MealItem[], foods: Map<string, Food>): number {
  return round1(items.reduce((sum, i) => sum + i.qty * (foods.get(i.food_id)?.protein_g ?? 0), 0));
}

/** "4 × Egg, 2 × Roti" */
export function describeItems(items: MealItem[], foods: Map<string, Food>): string {
  return items
    .map((i) => {
      const name = foods.get(i.food_id)?.name ?? 'Deleted food';
      return i.qty === 1 ? name : `${i.qty} × ${name}`;
    })
    .join(', ');
}
