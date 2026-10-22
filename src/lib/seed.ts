import type { SupabaseClient } from '@supabase/supabase-js';
import { exercisesIn, STARTER_PROGRAMS, starterExercises, type ExerciseKey, type Goal } from '../data/starter';
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
 * Builds a new account's plan from its onboarding answers: the training
 * programme for the goal and one empty diet plan for the user to fill. Returns
 * the diet plan's id.
 */
export async function seedStarter(db: SupabaseClient, goal: Goal): Promise<string> {
  await seedProgram(db, goal);
  const planId = uuid();
  must(await db.from('diet_plans').insert({ id: planId, name: 'My plan' }));
  return planId;
}
