import { useEffect, useMemo, useState } from 'preact/hooks';
import { addDays, formatDay, isIsoDay, today, weekdayOf } from '../lib/dates';
import { catalogFoodsFor, type CatalogFood } from '../data/food-catalog';
import type { DietPreference } from '../data/starter';
import { caloriesOf, describeItems, fetchFoods, fetchPlan, intakeFromFood, itemsFor, proteinOf, round1, sumCalories } from '../lib/diet';
import type { PickerFood } from '../lib/food-search';
import { must, supabase } from '../lib/supabase';
import type { DietPlan, Food, IntakeLog, Meal, ScheduleRow, WeightLog, WorkoutSession } from '../lib/types';
import { Gate, type Ctx } from './Gate';
import { FoodPicker } from './FoodPicker';
import { Card, cx, Empty, ErrorNote, g, IconButton, kcal, Loading, Page, param, Ring, Segmented } from './ui';

type WorkoutSummary = { id: string; name: string; workout_exercises: { count: number }[] };
type SessionSummary = WorkoutSession & { set_logs: { count: number }[] };

type Data = {
  workouts: WorkoutSummary[];
  schedule: ScheduleRow[];
  sessions: SessionSummary[];
  plan: DietPlan | null;
  foods: Food[];
  logs: IntakeLog[];
  /** Most recent weigh-in on or before the selected day. */
  weight: WeightLog | null;
};

const EVENING_HOUR = 18;

/** What was actually eaten, which can differ from the plan's current variant. */
const describeLog = (l: IntakeLog) => (l.qty === 1 ? l.food_name : `${l.qty} × ${l.food_name}`);

async function load(date: string, planId: string | null): Promise<Data> {
  const [workouts, schedule, sessions, plan, foods, logs, weight] = await Promise.all([
    supabase.from('workouts').select('id,name,workout_exercises(count)').order('position').then(must),
    supabase.from('schedule').select('weekday,workout_id').then(must),
    supabase.from('workout_sessions').select('*,set_logs(count)').eq('performed_on', date).order('started_at').then(must),
    planId ? fetchPlan(planId) : null,
    fetchFoods(),
    supabase.from('intake_logs').select('*').eq('logged_on', date).order('created_at').then(must),
    supabase.from('weight_logs').select('logged_on,kg').lte('logged_on', date).order('logged_on', { ascending: false }).limit(1).maybeSingle().then(must),
  ]);
  return { workouts, schedule, sessions, plan, foods, logs, weight } as Data;
}

function storedVariant(date: string, plan: DietPlan | null): string | null {
  if (!plan?.variants.length) return null;
  const saved = localStorage.getItem(`trainory-variant:${date}`) ?? localStorage.getItem('trainory-variant:last');
  return saved && plan.variants.includes(saved) ? saved : plan.variants[0];
}

function TodayScreen({ profile }: Ctx) {
  const [date, setDate] = useState(() => {
    const d = param('date');
    return isIsoDay(d) && d <= today() ? d : today();
  });
  const [data, setData] = useState<Data | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    history.replaceState(null, '', date === today() ? location.pathname : `?date=${date}`);
    load(date, profile.active_plan_id)
      .then((d) => {
        setData(d);
        setVariant(storedVariant(date, d.plan));
      })
      .catch((e) => setError(e.message));
  }, [date]);

  /** Runs a mutation and surfaces its failure instead of dropping it. */
  const run = (fn: () => Promise<void>) => {
    setError(null);
    fn().catch((e) => setError(e.message));
  };

  const isToday = date === today();
  const title = isToday ? 'Today' : date === addDays(today(), -1) ? 'Yesterday' : formatDay(date);

  return (
    <Page
      title={title}
      eyebrow={formatDay(date, true)}
      action={
        <div class="flex items-center gap-1">
          <IconButton label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</IconButton>
          <IconButton label="Next day" onClick={() => setDate(addDays(date, 1))} disabled={isToday}>›</IconButton>
          {!isToday && <button type="button" class="btn btn-sm" onClick={() => setDate(today())}>Today</button>}
        </div>
      }
    >
      <ErrorNote error={error} />
      {!data ? (
        <Loading />
      ) : (
        <>
          <WorkoutCard date={date} data={data} run={run} />
          <ProteinCard
            date={date}
            isToday={isToday}
            data={data}
            target={profile.protein_target_g}
            gapAlert={profile.gap_alert_g}
            preference={profile.diet_preference}
            variant={variant}
            onVariant={(v) => {
              setVariant(v);
              localStorage.setItem(`trainory-variant:${date}`, v);
              localStorage.setItem('trainory-variant:last', v);
            }}
            setLogs={(logs) => setData({ ...data, logs })}
            run={run}
          />
          <WeightCard date={date} weight={data.weight} onSaved={(weight) => setData({ ...data, weight })} run={run} />
        </>
      )}
    </Page>
  );
}

type Run = (fn: () => Promise<void>) => void;

function WorkoutCard({ date, data, run }: { date: string; data: Data; run: Run }) {
  const scheduledId = data.schedule.find((s) => s.weekday === weekdayOf(date))?.workout_id;
  const scheduled = data.workouts.find((w) => w.id === scheduledId);
  const [pick, setPick] = useState('');

  const start = (workout: WorkoutSummary) =>
    run(async () => {
      const session = must(
        await supabase.from('workout_sessions').insert({ workout_id: workout.id, workout_name: workout.name, performed_on: date }).select('id').single(),
      );
      location.assign(`/app/session/?id=${session.id}`);
    });

  return (
    <Card title="Workout">
      {data.sessions.map((s) => (
        <div key={s.id} class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-lg font-semibold tracking-tight text-ink">{s.workout_name}</p>
            <p class={cx('text-sm', s.finished_at ? 'text-good' : 'text-mute')}>
              {s.finished_at ? 'Done' : 'In progress'} · {s.set_logs[0]?.count ?? 0} sets logged
            </p>
          </div>
          <a class={cx('btn', !s.finished_at && 'btn-primary')} href={`/app/session/?id=${s.id}`}>
            {s.finished_at ? 'View' : 'Continue'}
          </a>
        </div>
      ))}
      {!data.sessions.length && scheduled && (
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-lg font-semibold tracking-tight text-ink">{scheduled.name}</p>
            <p class="text-sm text-mute">{scheduled.workout_exercises[0]?.count ?? 0} exercises</p>
          </div>
          <button type="button" class="btn btn-primary" onClick={() => start(scheduled)}>Start session</button>
        </div>
      )}
      {!data.sessions.length && !scheduled && (
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-lg font-semibold tracking-tight text-ink">Rest day</p>
            <p class="text-sm text-mute">Walk, eat, sleep. Recovery is where the muscle is built.</p>
          </div>
          {data.workouts.length > 0 && (
            <div class="flex gap-2">
              <select class="input w-36" aria-label="Train anyway" value={pick} onChange={(e) => setPick(e.currentTarget.value)}>
                <option value="">Train anyway…</option>
                {data.workouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              {pick && <button type="button" class="btn" onClick={() => start(data.workouts.find((w) => w.id === pick)!)}>Start</button>}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

type ProteinProps = {
  date: string;
  isToday: boolean;
  data: Data;
  target: number;
  gapAlert: number;
  preference: DietPreference | null;
  variant: string | null;
  onVariant: (v: string) => void;
  setLogs: (logs: IntakeLog[]) => void;
  run: Run;
};

function ProteinCard({ date, isToday, data, target, gapAlert, preference, variant, onVariant, setLogs, run }: ProteinProps) {
  const { plan, logs } = data;
  const foods = useMemo(() => new Map(data.foods.map((f) => [f.id, f])), [data.foods]);
  // Shared foods suited to the diet that are not in the account's list; logged by name, not copied.
  const shared = useMemo(() => catalogFoodsFor(preference, data.foods.map((f) => f.name)), [preference, data.foods]);
  const total = round1(logs.reduce((sum, l) => sum + l.protein_g, 0));
  const calories = sumCalories(logs);
  const remaining = round1(Math.max(target - total, 0));
  const extras = logs.filter((l) => !l.meal_name);
  const showGap = isToday && new Date().getHours() >= EVENING_HOUR && remaining >= gapAlert;
  const backups = data.foods.filter((f) => f.is_backup);

  const insert = (rows: Omit<IntakeLog, 'id' | 'logged_on'>[]) =>
    run(async () => {
      const added = must(await supabase.from('intake_logs').insert(rows.map((r) => ({ ...r, logged_on: date }))).select()) as IntakeLog[];
      setLogs([...logs, ...added]);
    });

  const logFood = (food: PickerFood | Food, qty: number) => insert([intakeFromFood({ ...food, id: 'shared' in food && food.shared ? null : food.id }, qty)]);

  const logMeal = (meal: Meal) =>
    insert(
      itemsFor(meal, variant)
        .filter((i) => foods.has(i.food_id))
        .map((i) => intakeFromFood(foods.get(i.food_id)!, i.qty, meal.name)),
    );

  const undoMeal = (meal: Meal) =>
    run(async () => {
      must(await supabase.from('intake_logs').delete().eq('logged_on', date).eq('meal_name', meal.name));
      setLogs(logs.filter((l) => l.meal_name !== meal.name));
    });

  const removeLog = (log: IntakeLog) =>
    run(async () => {
      must(await supabase.from('intake_logs').delete().eq('id', log.id));
      setLogs(logs.filter((l) => l.id !== log.id));
    });

  return (
    <Card title="Protein" action={plan && plan.variants.length > 1 && variant ? <Segmented label="Diet variant" options={plan.variants} value={variant} onChange={onVariant} /> : undefined}>
      <div class="flex items-center gap-5">
        <Ring value={total} max={target}>
          <span class="num text-3xl font-semibold tracking-tight text-ink">{g(total)}</span>
          <span class="num text-xs text-mute">of {g(target)} g</span>
        </Ring>
        <div class="min-w-0">
          <p class="text-lg font-semibold tracking-tight text-ink">{remaining === 0 ? 'Target hit' : `${g(remaining)} g to go`}</p>
          <p class="num text-sm text-mute">{kcal(calories)} kcal · {plan ? plan.name : 'No diet plan selected'}</p>
        </div>
      </div>

      {showGap && (
        <div class="mt-4 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2.5 text-sm text-ink" role="status">
          <p>
            <strong class="font-semibold">{g(remaining)} g short</strong> with the day nearly over.
          </p>
          {backups.length > 0 && (
            <div class="mt-2 flex flex-wrap gap-2">
              {backups.map((f) => (
                <button key={f.id} type="button" class="btn btn-sm" onClick={() => logFood(f, 1)}>
                  Log {f.name} · {g(f.protein_g)} g{f.calories === null ? '' : ` · ${kcal(f.calories)} kcal`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {plan && (
        <ul class="mt-4 divide-y divide-hairline border-t border-hairline">
          {plan.meals.map((meal) => {
            const items = itemsFor(meal, variant);
            const logged = logs.filter((l) => l.meal_name === meal.name);
            const done = logged.length > 0;
            return (
              <li key={meal.id} class="flex items-center gap-3 py-3">
                <div class="min-w-0 flex-1">
                  <p class={cx('truncate text-sm font-medium', done ? 'text-mute line-through' : 'text-ink')}>{meal.name}</p>
                  <p class="truncate text-xs text-mute">{done ? logged.map(describeLog).join(', ') : describeItems(items, foods)}</p>
                </div>
                <span class="num shrink-0 text-right text-sm text-ink">
                  {g(done ? logged.reduce((s, l) => s + l.protein_g, 0) : proteinOf(items, foods))} g
                  <span class="block text-xs text-mute">{kcal(done ? sumCalories(logged) : caloriesOf(items, foods))} kcal</span>
                </span>
                {done ? (
                  <button type="button" class="btn btn-sm w-16" onClick={() => undoMeal(meal)}>Undo</button>
                ) : (
                  <button type="button" class="btn btn-sm btn-primary w-16" onClick={() => logMeal(meal)} disabled={!items.length}>Log</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!plan && <Empty>Pick a diet plan under Diet to get one-tap meals here.</Empty>}

      {extras.length > 0 && (
        <ul class="divide-y divide-hairline border-t border-hairline">
          {extras.map((l) => (
            <li key={l.id} class="flex items-center gap-3 py-2">
              <p class="min-w-0 flex-1 truncate text-sm text-ink">{describeLog(l)}</p>
              <span class="num text-sm text-ink">{g(l.protein_g)} g{l.calories === null ? '' : ` · ${kcal(l.calories)} kcal`}</span>
              <IconButton label={`Remove ${l.food_name}`} onClick={() => removeLog(l)}>×</IconButton>
            </li>
          ))}
        </ul>
      )}

      <QuickAdd
        foods={data.foods}
        shared={shared}
        onFood={(food, qty) => logFood(food, qty)}
        onCustom={(name, protein, calories) => insert([{ food_id: null, food_name: name, qty: 1, protein_g: protein, calories, meal_name: null }])}
      />
    </Card>
  );
}

type QuickAddProps = {
  foods: Food[];
  shared: CatalogFood[];
  onFood: (food: PickerFood, qty: number) => void;
  onCustom: (name: string, protein: number, calories: number | null) => void;
};

function QuickAdd({ foods, shared, onFood, onCustom }: QuickAddProps) {
  const [mode, setMode] = useState<'closed' | 'food' | 'custom'>('closed');
  const [food, setFood] = useState<PickerFood | null>(null);
  const [qty, setQty] = useState('1');
  const [name, setName] = useState('');
  const [protein, setProtein] = useState('');
  const [calories, setCalories] = useState('');

  const close = () => {
    setMode('closed');
    setFood(null);
    setQty('1');
    setName('');
    setProtein('');
    setCalories('');
  };

  const submit = (e: Event) => {
    e.preventDefault();
    if (mode === 'custom') {
      // Calories are optional: left empty, the entry has none.
      const kcalValue = calories === '' ? null : Number(calories);
      if (!name.trim() || protein === '' || !(Number(protein) >= 0) || (kcalValue !== null && !(kcalValue >= 0))) return;
      onCustom(name.trim(), Number(protein), kcalValue === null ? null : Math.round(kcalValue));
    } else if (food && Number(qty) > 0) {
      onFood(food, Number(qty));
    } else return;
    close();
  };

  if (mode === 'closed') {
    return (
      <div class="flex flex-wrap gap-2 border-t border-hairline pt-4">
        <button type="button" class="btn" onClick={() => setMode('food')}>Add food</button>
        <button type="button" class="btn btn-quiet" onClick={() => setMode('custom')}>Something not in my list</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} class="flex flex-col gap-3 border-t border-hairline pt-4">
      {mode === 'food' ? (
        <>
          <FoodPicker own={foods} shared={shared} isSelected={(f) => f.id === food?.id} onPick={setFood} empty="No matching foods. Try another word, or add something not in your list." />
          {food && (
            <div class="flex flex-wrap items-center gap-2">
              <p class="min-w-0 flex-1 truncate text-sm text-ink">Servings of {food.name}</p>
              <input class="input num w-20" type="number" inputMode="decimal" min="0" step="any" aria-label="Servings" value={qty} onInput={(e) => setQty(e.currentTarget.value)} />
            </div>
          )}
        </>
      ) : (
        <div class="flex flex-wrap gap-2">
          <input class="input w-36 flex-1" aria-label="What you ate" placeholder="What you ate" value={name} onInput={(e) => setName(e.currentTarget.value)} />
          <input class="input num w-24" type="number" inputMode="decimal" min="0" step="any" aria-label="Protein in grams" placeholder="Protein g" value={protein} onInput={(e) => setProtein(e.currentTarget.value)} />
          <input class="input num w-28" type="number" inputMode="decimal" min="0" step="1" aria-label="Calories, optional" placeholder="kcal (optional)" value={calories} onInput={(e) => setCalories(e.currentTarget.value)} />
        </div>
      )}
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="btn btn-quiet" onClick={close}>Cancel</button>
        <button type="submit" class="btn btn-primary" disabled={mode === 'food' ? !food : !name.trim() || protein === ''}>
          {mode === 'food' && food
            ? `Add ${g(round1(Number(qty) * food.protein_g))} g${food.calories === null ? '' : ` · ${kcal(Number(qty) * food.calories)} kcal`}`
            : 'Add'}
        </button>
      </div>
    </form>
  );
}

function WeightCard({ date, weight, onSaved, run }: { date: string; weight: WeightLog | null; onSaved: (w: WeightLog) => void; run: Run }) {
  const [kg, setKg] = useState('');
  const loggedHere = weight?.logged_on === date;

  const save = (e: Event) => {
    e.preventDefault();
    const value = Number(kg);
    if (!(value > 0)) return;
    run(async () => {
      must(await supabase.from('weight_logs').upsert({ logged_on: date, kg: value }, { onConflict: 'user_id,logged_on' }));
      onSaved({ logged_on: date, kg: value });
      setKg('');
    });
  };

  return (
    <Card title="Body weight">
      <form onSubmit={save} class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm">
          {weight ? (
            <>
              <span class="num text-lg font-semibold tracking-tight text-ink">{g(weight.kg)} kg</span>{' '}
              <span class="text-mute">{loggedHere ? 'logged this day' : `on ${formatDay(weight.logged_on)}`}</span>
            </>
          ) : (
            <span class="text-mute">No weigh-in yet. Once a week is enough.</span>
          )}
        </p>
        <div class="flex gap-2">
          <input class="input num w-24" type="number" inputMode="decimal" min="1" step="0.1" aria-label="Weight in kilograms" placeholder="kg" value={kg} onInput={(e) => setKg(e.currentTarget.value)} />
          <button type="submit" class="btn" disabled={!kg}>{loggedHere ? 'Update' : 'Log'}</button>
        </div>
      </form>
    </Card>
  );
}

export default function Today() {
  return <Gate>{(ctx) => <TodayScreen {...ctx} />}</Gate>;
}
