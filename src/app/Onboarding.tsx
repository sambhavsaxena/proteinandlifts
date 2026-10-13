import { useState } from 'preact/hooks';
import { DIET_ORDER, dietTotals, goalFor, mealProtein, STARTER_DIETS, STARTER_PROGRAMS, suggestedProtein, type DietPreference } from '../data/starter';
import { WEEKDAYS_LONG } from '../lib/dates';
import { cx, ErrorNote, Field, g } from './ui';

export type Answers = {
  weightKg: number;
  heightCm: number;
  targetKg: number;
  diet: DietPreference;
  proteinTarget: number;
};

const STEPS = ['About you', 'How you eat', 'Your plan'];
const WEIGHT_RANGE = [30, 300] as const;
const HEIGHT_RANGE = [100, 250] as const;

const within = (value: string, [min, max]: readonly [number, number]) => value !== '' && Number(value) >= min && Number(value) <= max;

/** "Gain 8 kg. At about 0.3 kg a week that is roughly 27 weeks." */
function describeGoal(weightKg: number, targetKg: number): string {
  const goal = goalFor(weightKg, targetKg);
  if (goal === 'maintain') return `Stay around ${g(targetKg)} kg and keep getting stronger.`;
  const delta = Math.abs(targetKg - weightKg);
  const pace = Math.abs(STARTER_PROGRAMS[goal].weeklyChangeKg);
  return `${goal === 'gain' ? 'Gain' : 'Lose'} ${g(delta)} kg. At about ${pace} kg a week that is roughly ${Math.round(delta / pace)} weeks.`;
}

export function Onboarding({ onSubmit }: { onSubmit: (answers: Answers) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [target, setTarget] = useState('');
  const [diet, setDiet] = useState<DietPreference | null>(null);
  // null until the user overrides the suggestion.
  const [protein, setProtein] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyValid = within(weight, WEIGHT_RANGE) && within(height, HEIGHT_RANGE) && within(target, WEIGHT_RANGE);
  const canContinue = step === 0 ? bodyValid : step === 1 ? diet !== null : true;
  const suggested = bodyValid ? suggestedProtein(Number(target)) : 0;
  const proteinTarget = protein === null ? suggested : Number(protein);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!canContinue) return;
    if (step < STEPS.length - 1) return setStep(step + 1);
    if (!diet || !(proteinTarget > 0)) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ weightKg: Number(weight), heightCm: Number(height), targetKg: Number(target), diet, proteinTarget });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} class="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 sm:py-12">
      <div>
        <p class="eyebrow">Step {step + 1} of {STEPS.length}</p>
        <h1 class="mt-1 text-2xl tracking-tight">{step === 0 ? 'First, a few numbers' : step === 1 ? 'How do you eat?' : 'Your starting plan'}</h1>
        <div class="mt-4 flex gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => <span key={s} class={cx('h-1 flex-1 rounded-full', i <= step ? 'bg-ink' : 'bg-hairline')} />)}
        </div>
      </div>

      {step === 0 && (
        <div class="card flex flex-col gap-4">
          <p class="text-sm">These set your goal and a sensible protein target. You can change all of it later.</p>
          <div class="grid gap-4 sm:grid-cols-3">
            <Field label="Current weight (kg)">
              <input class="input num" type="number" inputMode="decimal" step="0.1" min={WEIGHT_RANGE[0]} max={WEIGHT_RANGE[1]} required autofocus value={weight} onInput={(e) => setWeight(e.currentTarget.value)} />
            </Field>
            <Field label="Height (cm)">
              <input class="input num" type="number" inputMode="decimal" step="0.5" min={HEIGHT_RANGE[0]} max={HEIGHT_RANGE[1]} required value={height} onInput={(e) => setHeight(e.currentTarget.value)} />
            </Field>
            <Field label="Target weight (kg)">
              <input class="input num" type="number" inputMode="decimal" step="0.1" min={WEIGHT_RANGE[0]} max={WEIGHT_RANGE[1]} required value={target} onInput={(e) => setTarget(e.currentTarget.value)} />
            </Field>
          </div>
          {bodyValid && <p class="border-t border-hairline pt-4 text-sm text-ink" role="status">{describeGoal(Number(weight), Number(target))}</p>}
        </div>
      )}

      {step === 1 && (
        <div role="radiogroup" aria-label="Diet" class="flex flex-col gap-3">
          {DIET_ORDER.map((key) => {
            const option = STARTER_DIETS[key];
            const totals = dietTotals(option);
            return (
              <button
                type="button"
                key={key}
                role="radio"
                aria-checked={diet === key}
                onClick={() => setDiet(key)}
                class="card cursor-pointer text-left transition-colors hover:border-mute aria-checked:border-ink aria-checked:ring-1 aria-checked:ring-ink"
              >
                <span class="flex items-baseline justify-between gap-3">
                  <span class="font-semibold tracking-tight text-ink">{option.label}</span>
                  <span class="num shrink-0 text-sm text-mute">about {g(Math.min(...totals))} g a day</span>
                </span>
                <span class="mt-1 block text-sm">{option.blurb}</span>
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && diet && <Review weightKg={Number(weight)} targetKg={Number(target)} diet={diet} protein={protein} suggested={suggested} onProtein={setProtein} />}

      <ErrorNote error={error} />

      <div class="flex items-center justify-between gap-3">
        {step > 0 ? <button type="button" class="btn" disabled={busy} onClick={() => setStep(step - 1)}>Back</button> : <span />}
        <button type="submit" class="btn btn-primary" disabled={!canContinue || busy}>
          {step < STEPS.length - 1 ? 'Continue' : busy ? 'Building your plan…' : 'Create my plan'}
        </button>
      </div>
    </form>
  );
}

type ReviewProps = { weightKg: number; targetKg: number; diet: DietPreference; protein: string | null; suggested: number; onProtein: (v: string) => void };

function Review({ weightKg, targetKg, diet, protein, suggested, onProtein }: ReviewProps) {
  const program = STARTER_PROGRAMS[goalFor(weightKg, targetKg)];
  const plan = STARTER_DIETS[diet];
  const totals = dietTotals(plan);

  return (
    <>
      <section class="card">
        <p class="eyebrow">Training · {program.label}</p>
        <p class="mt-2 text-sm">{program.blurb}</p>
        <ul class="mt-3 divide-y divide-hairline border-t border-hairline text-sm">
          {program.workouts.map((w) => (
            <li key={w.name} class="flex items-center justify-between gap-3 py-2">
              <span class="text-mute">{WEEKDAYS_LONG[w.weekday]}</span>
              <span class="text-right">
                <span class="font-medium text-ink">{w.name}</span> <span class="text-mute">· {w.exercises.length} exercises</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section class="card">
        <p class="eyebrow">Diet · {plan.label}</p>
        <ul class="mt-3 divide-y divide-hairline border-y border-hairline text-sm">
          {plan.meals.map((m) => (
            <li key={m.name} class="flex items-center justify-between gap-3 py-2">
              <span class="text-ink">{m.name}</span>
              <span class="num">{g(mealProtein(m))} g</span>
            </li>
          ))}
        </ul>
        <p class="num mt-3 text-sm text-ink">
          {plan.variants.length ? plan.variants.map((v, i) => `${v}: ${g(totals[i])} g`).join('  ·  ') : `Daily total: ${g(totals[0])} g`}
        </p>
      </section>

      <section class="card">
        <Field label="Daily protein target (g)" hint={`Suggested from your target weight, at about 1.8 g per kg: ${suggested} g. General guidance, not medical advice.`}>
          <input class="input num sm:w-40" type="number" inputMode="decimal" min="1" step="1" required value={protein ?? suggested} onInput={(e) => onProtein(e.currentTarget.value)} />
        </Field>
        <p class="mt-3 text-sm">Every workout, exercise, meal and food can be changed once you are in.</p>
      </section>
    </>
  );
}
