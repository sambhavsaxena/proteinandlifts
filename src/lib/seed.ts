import type { SupabaseClient } from '@supabase/supabase-js';
import {
  exercisesIn,
  STARTER_DIETS,
  STARTER_FOODS,
  STARTER_PROGRAMS,
  starterExercises,
  type DietPreference,
  type ExerciseKey,
  type FoodKey,
  type Goal,
} from '../data/starter';
import { mediaCaption } from './catalog';
import { must } from './supabase';

const uuid = () => crypto.randomUUID();

/** Inserts the training programme for a goal: its exercises, workouts and weekly schedule. */
export async function seedProgram(db: SupabaseClient, goal: Goal): Promise<void> {
  const program = STARTER_PROGRAMS[goal];
  const keys = exercisesIn(program);
  const exerciseIds = Object.fromEntries(keys.map((k) => [k, uuid()])) as Record<ExerciseKey, string>;

  must(
    await db.from('exercises').insert(
      keys.map((key) => {
        const e = starterExercises[key];
        return { id: exerciseIds[key], name: e.name, muscle_group: e.muscle_group, equipment: e.equipment, instructions: e.instructions, catalog_id: e.catalog_id };
      }),
    ),
  );
  must(
    await db.from('exercise_media').insert(
      keys.flatMap((key) =>
        starterExercises[key].images.map((url, position) => ({ exercise_id: exerciseIds[key], kind: 'step', url, caption: mediaCaption(position), position })),
      ),
    ),
  );

  const workouts = program.workouts.map((w, position) => ({ ...w, id: uuid(), position }));
  must(
    await db.from('workouts').insert(
      workouts.map((w) => ({ id: w.id, name: w.name, position: w.position, notes: program.notes, rest_seconds: program.restSeconds })),
    ),
  );
  must(
    await db.from('workout_exercises').insert(
      workouts.flatMap((w) =>
        w.exercises.map((e, position) => {
          const [main, alt] = Array.isArray(e) ? e : [e];
          return {
            workout_id: w.id,
            exercise_id: exerciseIds[main],
            alt_exercise_id: alt ? exerciseIds[alt] : null,
            position,
            rep_min: program.repMin,
            rep_max: program.repMax,
          };
        }),
      ),
    ),
  );
  must(await db.from('schedule').insert(workouts.map((w) => ({ weekday: w.weekday, workout_id: w.id }))));
}

/**
 * Adds a starter diet as a new plan and returns its id. Foods the account
 * already has (matched by name) are reused rather than duplicated, so this is
 * safe to run on an account that is already in use.
 */
export async function addDietTemplate(db: SupabaseClient, preference: DietPreference): Promise<string> {
  const diet = STARTER_DIETS[preference];
  const wanted = [...new Set<FoodKey>([...diet.meals.flatMap((m) => m.items.map(([food]) => food)), diet.backup, ...diet.pantry])];

  const existing = must(await db.from('foods').select('id,name')) as { id: string; name: string }[];
  const byName = new Map(existing.map((f) => [f.name.toLowerCase(), f.id]));
  const foodIds = {} as Record<FoodKey, string>;
  const missing: FoodKey[] = [];
  for (const key of wanted) {
    const found = byName.get(STARTER_FOODS[key].name.toLowerCase());
    foodIds[key] = found ?? uuid();
    if (!found) missing.push(key);
  }
  if (missing.length) {
    must(await db.from('foods').insert(missing.map((key) => ({ ...STARTER_FOODS[key], id: foodIds[key], is_backup: key === diet.backup }))));
  }

  const planId = uuid();
  must(await db.from('diet_plans').insert({ id: planId, name: diet.planName, variants: diet.variants }));
  const meals = diet.meals.map((m, position) => ({ ...m, id: uuid(), position }));
  must(await db.from('meals').insert(meals.map((m) => ({ id: m.id, plan_id: planId, name: m.name, position: m.position }))));
  must(
    await db.from('meal_items').insert(
      meals.flatMap((m) =>
        m.items.map(([food, qty, variant], position) => ({
          meal_id: m.id,
          food_id: foodIds[food],
          qty,
          variant: variant === undefined ? null : diet.variants[variant],
          position,
        })),
      ),
    ),
  );
  return planId;
}

/** Builds a new account's plan from its onboarding answers; returns the diet plan id. */
export async function seedStarter(db: SupabaseClient, goal: Goal, preference: DietPreference): Promise<string> {
  await seedProgram(db, goal);
  return addDietTemplate(db, preference);
}
