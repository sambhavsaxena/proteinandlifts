import type { SupabaseClient } from '@supabase/supabase-js';
import { catalogFood } from '../data/food-catalog';
import { exercisesIn, STARTER_DIETS, STARTER_PROGRAMS, starterExercises, type DietPreference, type ExerciseKey, type Goal } from '../data/starter';
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
 * Adds a diet preference's starter plan and returns its id: its foods are
 * copied from the shared list (reusing any the account has, by name), then the
 * plan, its meals and their items.
 */
export async function addStarterDiet(db: SupabaseClient, preference: DietPreference): Promise<string> {
  const diet = STARTER_DIETS[preference];
  const names = [...new Set(diet.meals.flatMap((m) => m.items.map(([food]) => food)))];

  const existing = must(await db.from('foods').select('id,name')) as { id: string; name: string }[];
  const byName = new Map(existing.map((f) => [f.name.toLowerCase(), f.id]));
  const foodIds = new Map(names.map((name) => [name, byName.get(name.toLowerCase()) ?? uuid()]));
  const missing = names.filter((name) => !byName.has(name.toLowerCase()));
  if (missing.length) {
    must(
      await db.from('foods').insert(
        missing.map((name) => {
          const food = catalogFood(name);
          return { id: foodIds.get(name), name: food.name, serving: food.serving, protein_g: food.protein_g, calories: food.calories };
        }),
      ),
    );
  }

  const planId = uuid();
  must(await db.from('diet_plans').insert({ id: planId, name: diet.planName }));
  const meals = diet.meals.map((m, position) => ({ ...m, id: uuid(), position }));
  must(await db.from('meals').insert(meals.map((m) => ({ id: m.id, plan_id: planId, name: m.name, position: m.position }))));
  must(
    await db
      .from('meal_items')
      .insert(meals.flatMap((m) => m.items.map(([food, qty], position) => ({ meal_id: m.id, food_id: foodIds.get(food), qty, position })))),
  );
  return planId;
}

/** Builds a new account's plan from its onboarding answers; returns the diet plan id. */
export async function seedStarter(db: SupabaseClient, goal: Goal, preference: DietPreference): Promise<string> {
  await seedProgram(db, goal);
  return addStarterDiet(db, preference);
}
