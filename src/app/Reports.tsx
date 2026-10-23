import { useEffect, useMemo, useState } from 'preact/hooks';
import { addDays, daysBetween, formatDay, today, toIso, weekdayOf } from '../lib/dates';
import { round1 } from '../lib/diet';
import { must, supabase } from '../lib/supabase';
import type { IntakeLog, ScheduleRow, SetLog, WeightLog, WorkoutSession } from '../lib/types';
import { BarChart, Heatmap, LineChart, slopePerDay, type DayValue } from './charts';
import { Gate, type Ctx } from './Gate';
import { Card, cx, Empty, ErrorNote, g, kcal, Loading, Page, Segmented } from './ui';

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
] as const;
type Range = (typeof RANGES)[number]['value'];

type Data = {
  intake: IntakeLog[];
  sessions: WorkoutSession[];
  /** All-time, so personal bests are not limited to the selected range. */
  sets: SetLog[];
  weights: WeightLog[];
  schedule: ScheduleRow[];
};

async function load(from: string): Promise<Data> {
  const [intake, sessions, sets, weights, schedule] = await Promise.all([
    supabase.from('intake_logs').select('*').gte('logged_on', from).order('logged_on').then(must),
    supabase.from('workout_sessions').select('*').gte('performed_on', from).order('performed_on', { ascending: false }).then(must),
    supabase.from('set_logs').select('*').order('performed_on').limit(10000).then(must),
    supabase.from('weight_logs').select('logged_on,kg').gte('logged_on', from).order('logged_on').then(must),
    supabase.from('schedule').select('weekday,workout_id').then(must),
  ]);
  return { intake, sessions, sets, weights, schedule } as Data;
}

function downloadCsv(name: string, header: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => (typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : (v ?? ''));
  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${name}-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'good' | 'warn' }) {
  return (
    <div class="card">
      <p class="text-xs text-mute">{label}</p>
      <p class="num mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p class={cx('mt-0.5 text-xs', tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : 'text-mute')}>{note}</p>
    </div>
  );
}

function ReportsScreen({ profile }: Ctx) {
  const [range, setRange] = useState<Range>('30');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exercise, setExercise] = useState('');
  const to = today();
  const from = addDays(to, -(Number(range) - 1));

  useEffect(() => {
    setData(null);
    load(from)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [range]);

  const view = useMemo(() => {
    if (!data) return null;
    const days = daysBetween(from, to);
    const target = profile.protein_target_g;

    const byDay = new Map<string, number>();
    for (const l of data.intake) byDay.set(l.logged_on, (byDay.get(l.logged_on) ?? 0) + l.protein_g);
    const protein: DayValue[] = days.map((date) => ({ date, value: round1(byDay.get(date) ?? 0) }));
    const logged = protein.filter((d) => d.value > 0);
    const kcalByDay = new Map<string, number>();
    for (const l of data.intake) kcalByDay.set(l.logged_on, (kcalByDay.get(l.logged_on) ?? 0) + Number(l.calories ?? 0));
    const calories: DayValue[] = days.map((date) => ({ date, value: Math.round(kcalByDay.get(date) ?? 0) }));
    // Over the days that have calories, since older entries and some foods have none.
    const withCalories = calories.filter((d) => d.value > 0);
    const averageCalories = withCalories.length ? Math.round(withCalories.reduce((s, d) => s + d.value, 0) / withCalories.length) : null;
    const average = logged.length ? round1(logged.reduce((s, d) => s + d.value, 0) / logged.length) : null;
    const onTarget = logged.filter((d) => d.value >= target).length;

    // Planned sessions only count from the day the account existed (or the
    // first session in range, if earlier ones were backfilled).
    const created = toIso(new Date(profile.created_at));
    const since = data.sessions.reduce((min, s) => (s.performed_on < min ? s.performed_on : min), created);
    const trainingDays = new Set(data.schedule.map((s) => s.weekday));
    const planned = days.filter((d) => d >= since && trainingDays.has(weekdayOf(d))).length;
    const trainedOn = new Set(data.sessions.map((s) => s.performed_on));

    const rangeSets = data.sets.filter((s) => s.performed_on >= from);
    const sessionStats = new Map<string, { sets: number; volume: number }>();
    for (const s of rangeSets) {
      const stat = sessionStats.get(s.session_id) ?? { sets: 0, volume: 0 };
      stat.sets += 1;
      stat.volume += s.weight_kg * s.reps;
      sessionStats.set(s.session_id, stat);
    }

    // Best lift per exercise: heaviest weight, more reps breaking ties.
    const bests = new Map<string, SetLog>();
    for (const s of data.sets) {
      const best = bests.get(s.exercise_name);
      if (!best || s.weight_kg > best.weight_kg || (s.weight_kg === best.weight_kg && s.reps > best.reps)) bests.set(s.exercise_name, s);
    }
    const exercises = [...bests.keys()].sort();

    const weights: DayValue[] = data.weights.map((w) => ({ date: w.logged_on, value: w.kg }));
    const slope = slopePerDay(weights);

    return { days, target, protein, calories, averageCalories, logged, average, onTarget, planned, trainedOn, rangeSets, sessionStats, bests, exercises, weights, weeklyGain: slope === null ? null : slope * 7 };
  }, [data]);

  if (!view || !data) {
    return (
      <Page title="Reports" action={<Segmented<Range> label="Date range" options={RANGES} value={range} onChange={setRange} />}>
        {error ? <ErrorNote error={error} /> : <Loading />}
      </Page>
    );
  }

  const selected = view.exercises.includes(exercise) ? exercise : (view.exercises[0] ?? '');
  // One point per day: the heaviest set of the selected exercise.
  const liftByDay = new Map<string, number>();
  for (const s of view.rangeSets) if (s.exercise_name === selected) liftByDay.set(s.performed_on, Math.max(liftByDay.get(s.performed_on) ?? 0, s.weight_kg));
  const lift: DayValue[] = [...liftByDay].map(([date, value]) => ({ date, value }));

  const gainTarget = profile.weight_gain_target_kg_week;
  const latestWeight = view.weights[view.weights.length - 1]?.value;
  const toGo = profile.target_weight_kg !== null && latestWeight !== undefined ? Math.abs(profile.target_weight_kg - latestWeight) : null;
  const weightGoalNote = toGo === null ? '' : ` · target ${g(profile.target_weight_kg!)} kg, ${toGo < 0.5 ? 'reached' : `${g(toGo)} kg to go`}`;
  const gain = view.weeklyGain;
  const signed = (n: number) => `${n > 0 ? '+' : ''}${(Math.round(n * 100) / 100).toFixed(2)}`;

  return (
    <Page title="Reports" action={<Segmented<Range> label="Date range" options={RANGES} value={range} onChange={setRange} />}>
      <ErrorNote error={error} />

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Average protein"
          value={view.average === null ? '–' : `${g(view.average)} g`}
          note={view.average === null ? 'Nothing logged yet' : `per logged day · target ${g(view.target)} g`}
          tone={view.average === null ? undefined : view.average >= view.target ? 'good' : 'warn'}
        />
        <Stat label="Days on target" value={`${view.onTarget}/${view.logged.length}`} note="of the days you logged" />
        <Stat label="Sessions" value={`${data.sessions.length}`} note={view.planned ? `of ${view.planned} planned` : 'none planned in range'} tone={view.planned && data.sessions.length >= view.planned ? 'good' : undefined} />
        <Stat
          label="Weight trend"
          value={gain === null ? '–' : `${signed(gain)} kg`}
          note={gain === null ? 'Needs two weigh-ins' : `per week · target ${signed(gainTarget)}`}
        />
      </div>

      <Card title="Protein per day">
        {view.logged.length ? <BarChart data={view.protein} target={view.target} unit="g" /> : <Empty>Log a meal on the Today screen and it shows up here.</Empty>}
      </Card>

      <Card title="Calories per day">
        {view.averageCalories !== null ? (
          <>
            <p class="num mb-2 text-sm text-mute">{kcal(view.averageCalories)} kcal on average, over the days with calories logged</p>
            <BarChart data={view.calories} unit="kcal" />
          </>
        ) : (
          <Empty>Foods with calories add them when you log them on the Today screen.</Empty>
        )}
      </Card>

      <Card title="Consistency">
        <Heatmap
          days={view.protein.map((d) => ({
            date: d.date,
            ratio: view.target > 0 ? d.value / view.target : 0,
            trained: view.trainedOn.has(d.date),
            label: `${g(d.value)} g protein${view.trainedOn.has(d.date) ? ' · trained' : ''}`,
          }))}
        />
      </Card>

      <Card
        title="Strength progress"
        action={
          view.exercises.length > 0 ? (
            <select class="input h-8 w-44 text-[13px]" aria-label="Exercise" value={selected} onChange={(e) => setExercise(e.currentTarget.value)}>
              {view.exercises.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          ) : undefined
        }
      >
        {lift.length ? (
          <>
            <p class="mb-2 text-xs text-mute">Heaviest set per session, kg</p>
            <LineChart data={lift} unit="kg" />
          </>
        ) : (
          <Empty>{view.exercises.length ? 'No sets for this exercise in the selected range.' : 'Finish a session and your lifts are charted here.'}</Empty>
        )}
        {view.exercises.length > 0 && (
          <details class="mt-4 border-t border-hairline pt-3">
            <summary class="cursor-pointer text-sm font-medium text-ink">Personal bests</summary>
            <table class="mt-2 w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-mute">
                  <th class="py-1 font-normal">Exercise</th>
                  <th class="py-1 text-right font-normal">Best set</th>
                  <th class="hidden py-1 text-right font-normal sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-hairline">
                {view.exercises.map((name) => {
                  const best = view.bests.get(name)!;
                  return (
                    <tr key={name}>
                      <td class="py-1.5 text-ink">{name}</td>
                      <td class="num py-1.5 text-right text-ink">{g(best.weight_kg)} kg × {best.reps}</td>
                      <td class="hidden py-1.5 text-right text-mute sm:table-cell">{formatDay(best.performed_on)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        )}
      </Card>

      <Card title="Body weight">
        {view.weights.length ? (
          <>
            <p class="num mb-2 text-xs text-mute">Weigh-ins, kg{weightGoalNote}</p>
            <LineChart data={view.weights} unit="kg" />
          </>
        ) : (
          <Empty>Log your weight once a week on the Today screen to see the trend.</Empty>
        )}
      </Card>

      <Card title="Sessions">
        {data.sessions.length === 0 && <Empty>No sessions in this range.</Empty>}
        <ul class="divide-y divide-hairline">
          {data.sessions.map((s) => {
            const stat = view.sessionStats.get(s.id);
            return (
              <li key={s.id}>
                <a href={`/app/session/?id=${s.id}`} class="flex items-center gap-3 py-2.5 no-underline">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-ink">{s.workout_name}</p>
                    <p class="text-xs text-mute">{formatDay(s.performed_on)}{s.finished_at ? '' : ' · not finished'}</p>
                  </div>
                  <p class="num text-right text-sm text-ink">
                    {stat?.sets ?? 0} sets
                    <span class="block text-xs text-mute">{Math.round(stat?.volume ?? 0).toLocaleString('en')} kg lifted</span>
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Export">
        <p class="mb-3 text-sm">Download the logs behind these charts as CSV, for the selected range.</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm" onClick={() => downloadCsv('food-log', ['date', 'meal', 'food', 'servings', 'protein_g', 'calories'], data.intake.map((l) => [l.logged_on, l.meal_name, l.food_name, l.qty, l.protein_g, l.calories]))}>Food log</button>
          <button type="button" class="btn btn-sm" onClick={() => downloadCsv('workout-log', ['date', 'exercise', 'set', 'weight_kg', 'reps'], view.rangeSets.map((s) => [s.performed_on, s.exercise_name, s.set_no, s.weight_kg, s.reps]))}>Workout log</button>
          <button type="button" class="btn btn-sm" onClick={() => downloadCsv('weight-log', ['date', 'kg'], data.weights.map((w) => [w.logged_on, w.kg]))}>Weight log</button>
        </div>
      </Card>
    </Page>
  );
}

export default function Reports() {
  return <Gate>{(ctx) => <ReportsScreen {...ctx} />}</Gate>;
}
