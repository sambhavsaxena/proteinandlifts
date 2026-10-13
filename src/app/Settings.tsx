import { useState } from 'preact/hooks';
import { today } from '../lib/dates';
import { MEDIA_BUCKET, must, supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import { Gate, type Ctx } from './Gate';
import { Card, ConfirmButton, ErrorNote, Field, NumberInput, Page } from './ui';

// Children before parents, so deletes never trip over a foreign key.
const TABLES = ['set_logs', 'workout_sessions', 'schedule', 'workout_exercises', 'workouts', 'exercise_media', 'exercises', 'intake_logs', 'meal_items', 'meals', 'diet_plans', 'foods', 'weight_logs'] as const;

function SettingsScreen({ userId, email, profile, saveProfile }: Ctx) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    fn().catch((e) => setError(e.message));
  };

  const set = (patch: Partial<Profile>) =>
    run(async () => {
      await saveProfile(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });

  const exportAll = () =>
    run(async () => {
      const dump: Record<string, unknown> = { exported_at: new Date().toISOString(), profile };
      for (const table of TABLES) dump[table] = must(await supabase.from(table).select('*'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }));
      a.download = `protein-and-lifts-${today()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

  const wipe = () =>
    run(async () => {
      const uploads = must(await supabase.from('exercise_media').select('storage_path').not('storage_path', 'is', null)) as { storage_path: string }[];
      if (uploads.length) must(await supabase.storage.from(MEDIA_BUCKET).remove(uploads.map((u) => u.storage_path)));
      for (const table of TABLES) must(await supabase.from(table).delete().eq('user_id', userId));
      must(await supabase.from('profiles').delete().eq('user_id', userId));
      await supabase.auth.signOut();
    });

  return (
    <Page title="Settings" action={saved ? <span class="text-sm text-good" role="status">Saved</span> : undefined}>
      <ErrorNote error={error} />

      <Card title="Targets">
        <div class="grid gap-4 sm:grid-cols-2">
          <Field label="Daily protein target (g)">
            <NumberInput label="Daily protein target in grams" value={profile.protein_target_g} min={1} onCommit={(n) => set({ protein_target_g: n })} />
          </Field>
          <Field label="Evening shortfall alert (g)" hint="After 6 pm, warn when you are at least this far under target.">
            <NumberInput label="Shortfall alert in grams" value={profile.gap_alert_g} onCommit={(n) => set({ gap_alert_g: n })} />
          </Field>
          <Field label="Weight change target (kg per week)" hint="Lean bulk: about 0.3. Fat loss: about -0.5.">
            <NumberInput label="Weight change target in kilograms per week" value={profile.weight_gain_target_kg_week} min={-2} onCommit={(n) => set({ weight_gain_target_kg_week: n })} />
          </Field>
          <Field label="Target weight (kg)">
            <NumberInput label="Target weight in kilograms" value={profile.target_weight_kg} min={1} onCommit={(n) => set({ target_weight_kg: n })} />
          </Field>
          <Field label="Height (cm)">
            <NumberInput label="Height in centimetres" value={profile.height_cm} min={1} onCommit={(n) => set({ height_cm: n })} />
          </Field>
        </div>
      </Card>

      <Card title="Progression rule">
        <p class="mb-4 text-sm">When every set of an exercise reaches the rep target, the next session suggests more weight.</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <Field label="Rep target">
            <NumberInput label="Rep target" value={profile.progression_reps} min={1} step={1} onCommit={(n) => set({ progression_reps: Math.round(n) })} />
          </Field>
          <Field label="Weight to add (kg)">
            <NumberInput label="Weight to add in kilograms" value={profile.progression_increment_kg} onCommit={(n) => set({ progression_increment_kg: n })} />
          </Field>
        </div>
      </Card>

      <Card title="Account">
        <p class="text-sm">
          Signed in as <span class="text-ink">{email}</span>
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="btn" onClick={() => run(async () => void (await supabase.auth.signOut()))}>Sign out</button>
          <button type="button" class="btn" onClick={exportAll}>Export all data (JSON)</button>
        </div>
      </Card>

      <Card title="Delete everything">
        <p class="mb-4 text-sm">Removes every workout, exercise, photo, food, plan and log in this account, then signs you out. This cannot be undone. Export first if you want a copy.</p>
        <ConfirmButton label="Delete all my data" confirm="Yes, delete everything" onConfirm={wipe} />
      </Card>
    </Page>
  );
}

export default function Settings() {
  return <Gate>{(ctx) => <SettingsScreen {...ctx} />}</Gate>;
}
