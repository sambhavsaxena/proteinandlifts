import type { DietPreference, Goal } from '../data/starter';

export type Profile = {
  user_id: string;
  protein_target_g: number;
  gap_alert_g: number;
  progression_reps: number;
  progression_increment_kg: number;
  weight_gain_target_kg_week: number;
  active_plan_id: string | null;
  height_cm: number | null;
  start_weight_kg: number | null;
  target_weight_kg: number | null;
  diet_preference: DietPreference | null;
  goal: Goal | null;
  seeded_at: string | null;
  onboarded_at: string | null;
  created_at: string;
};

export type MediaKind = 'step' | 'machine';

export type ExerciseMedia = {
  id: string;
  exercise_id: string;
  kind: MediaKind;
  url: string | null;
  storage_path: string | null;
  caption: string | null;
  position: number;
};

export type Exercise = {
  id: string;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  instructions: string | null;
  /** Set when the exercise was copied from the public catalog. */
  catalog_id: string | null;
  exercise_media?: ExerciseMedia[];
};

export type WorkoutExercise = {
  id: string;
  workout_id: string;
  exercise_id: string;
  alt_exercise_id: string | null;
  position: number;
  target_sets: number;
  rep_min: number;
  rep_max: number;
};

export type Workout = {
  id: string;
  name: string;
  notes: string | null;
  rest_seconds: number;
  position: number;
  workout_exercises?: WorkoutExercise[];
};

export type ScheduleRow = { weekday: number; workout_id: string };

export type WorkoutSession = {
  id: string;
  workout_id: string | null;
  workout_name: string;
  performed_on: string;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
};

export type SetLog = {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  performed_on: string;
  set_no: number;
  weight_kg: number;
  reps: number;
};

export type Food = {
  id: string;
  name: string;
  serving: string;
  protein_g: number;
  /** kcal per serving; null when not known. */
  calories: number | null;
  is_backup: boolean;
};

export type MealItem = {
  id: string;
  meal_id: string;
  food_id: string;
  qty: number;
  variant: string | null;
  position: number;
};

export type Meal = {
  id: string;
  plan_id: string;
  name: string;
  position: number;
  meal_items: MealItem[];
};

export type DietPlan = {
  id: string;
  name: string;
  variants: string[];
  meals: Meal[];
};

export type IntakeLog = {
  id: string;
  logged_on: string;
  food_id: string | null;
  food_name: string;
  qty: number;
  protein_g: number;
  /** kcal for the entry, frozen at log time like protein; null when not known. */
  calories: number | null;
  meal_name: string | null;
};

export type WeightLog = { logged_on: string; kg: number };
