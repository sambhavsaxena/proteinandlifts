import { useEffect, useState } from 'preact/hooks';
import { formatDay, today } from '../lib/dates';
import { mediaUrls } from '../lib/media';
import { must, supabase } from '../lib/supabase';
import type { Exercise, Profile, SetLog, Workout, WorkoutExercise, WorkoutSession } from '../lib/types';
import { Gate, type Ctx } from './Gate';
import { Card, ConfirmButton, cx, ErrorNote, g, IconButton, Loading, Page, param } from './ui';

type Data = {
  session: WorkoutSession;
  workout: Workout | null;
  items: WorkoutExercise[];
  exercises: Map<string, Exercise>;
  urls: Record<string, string>;
  /** Sets from the most recent earlier session, per exercise id. */
  previous: Map<string, SetLog[]>;
};

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

async function load(id: string): Promise<{ data: Data; logs: SetLog[] }> {
  const session = must(await supabase.from('workout_sessions').select('*').eq('id', id).single()) as WorkoutSession;
  const [workout, logs] = (await Promise.all([
    session.workout_id ? supabase.from('workouts').select('*,workout_exercises(*)').eq('id', session.workout_id).maybeSingle().then(must) : null,
    supabase.from('set_logs').select('*').eq('session_id', id).order('set_no').then(must),
  ])) as [Workout | null, SetLog[]];

  const items = [...(workout?.workout_exercises ?? [])].sort(byPosition);
  const ids = [...new Set(items.flatMap((i) => [i.exercise_id, i.alt_exercise_id]).filter((x): x is string => !!x))];
  const [exerciseRows, history] = (await Promise.all([
    ids.length ? supabase.from('exercises').select('*,exercise_media(*)').in('id', ids).then(must) : [],
    ids.length
      ? supabase.from('set_logs').select('*').in('exercise_id', ids).neq('session_id', id).lte('performed_on', session.performed_on).order('performed_on', { ascending: false }).order('set_no').limit(400).then(must)
      : [],
  ])) as [Exercise[], SetLog[]];

  // History is newest first, so the first session seen for an exercise is its latest.
  const previous = new Map<string, SetLog[]>();
  for (const log of history) {
    const seen = previous.get(log.exercise_id!);
    if (!seen) previous.set(log.exercise_id!, [log]);
    else if (seen[0].session_id === log.session_id) seen.push(log);
  }

  const urls = await mediaUrls(exerciseRows.flatMap((e) => e.exercise_media ?? []));
  return { data: { session, workout, items, exercises: new Map(exerciseRows.map((e) => [e.id, e])), urls, previous }, logs };
}

function SessionScreen({ profile }: Ctx) {
  const id = param('id');
  const [data, setData] = useState<Data | null>(null);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restUntil, setRestUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return setError('No session selected.');
    load(id)
      .then((r) => {
        setData(r.data);
        setLogs(r.logs);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (!data) return <Page title="Session">{error ? <ErrorNote error={error} /> : <Loading />}</Page>;
  const { session, workout, items } = data;
  const restSeconds = workout?.rest_seconds ?? 120;

  const run = (fn: () => Promise<void>) => {
    setError(null);
    fn().catch((e) => setError(e.message));
  };

  const saveSet = (exercise: Exercise, setNo: number, weight: number, reps: number, existing?: SetLog) =>
    run(async () => {
      if (existing) {
        must(await supabase.from('set_logs').update({ weight_kg: weight, reps }).eq('id', existing.id));
        setLogs(logs.map((l) => (l.id === existing.id ? { ...l, weight_kg: weight, reps } : l)));
        return;
      }
      const created = must(
        await supabase
          .from('set_logs')
          .insert({ session_id: session.id, exercise_id: exercise.id, exercise_name: exercise.name, performed_on: session.performed_on, set_no: setNo, weight_kg: weight, reps })
          .select()
          .single(),
      ) as SetLog;
      setLogs([...logs, created]);
      setRestUntil(Date.now() + restSeconds * 1000);
    });

  const removeSet = (log: SetLog) =>
    run(async () => {
      must(await supabase.from('set_logs').delete().eq('id', log.id));
      setLogs(logs.filter((l) => l.id !== log.id));
    });

  const patchSession = (patch: Partial<WorkoutSession>, then?: () => void) =>
    run(async () => {
      must(await supabase.from('workout_sessions').update(patch).eq('id', session.id));
      setData({ ...data, session: { ...session, ...patch } });
      then?.();
    });

  const backToDay = () => location.assign(session.performed_on === today() ? '/app/' : `/app/?date=${session.performed_on}`);

  const destroy = () =>
    run(async () => {
      must(await supabase.from('workout_sessions').delete().eq('id', session.id));
      backToDay();
    });

  // Sets logged against exercises that are no longer part of the workout.
  const planned = new Set(items.flatMap((i) => [i.exercise_id, i.alt_exercise_id]));
  const orphans = logs.filter((l) => !l.exercise_id || !planned.has(l.exercise_id));

  return (
    <Page title={session.workout_name} eyebrow={`${formatDay(session.performed_on, true)}${session.finished_at ? ' · finished' : ''}`}>
      <ErrorNote error={error} />
      {workout?.notes && <p class="text-sm text-mute">{workout.notes}</p>}

      {items.map((item) => (
        <ExerciseCard key={item.id} item={item} data={data} logs={logs} profile={profile} onSave={saveSet} onRemove={removeSet} />
      ))}

      {orphans.length > 0 && (
        <Card title="Other sets in this session">
          <ul class="text-sm">
            {orphans.map((l) => (
              <li key={l.id} class="flex items-center justify-between py-1">
                <span class="text-ink">{l.exercise_name}</span>
                <span class="num">{g(l.weight_kg)} kg × {l.reps}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Notes">
        <textarea class="input" rows={2} aria-label="Session notes" placeholder="How did it feel?" value={session.notes ?? ''} onChange={(e) => patchSession({ notes: e.currentTarget.value.trim() || null })} />
      </Card>

      <div class={cx('flex items-center justify-between gap-3', restUntil !== null && 'pb-20')}>
        <ConfirmButton label="Delete session" onConfirm={destroy} />
        {session.finished_at ? (
          <button type="button" class="btn" onClick={backToDay}>Back to day</button>
        ) : (
          <button type="button" class="btn btn-primary" onClick={() => patchSession({ finished_at: new Date().toISOString() }, backToDay)}>Finish session</button>
        )}
      </div>

      {restUntil !== null && <RestTimer until={restUntil} total={restSeconds} onChange={setRestUntil} />}
    </Page>
  );
}

type CardProps = {
  item: WorkoutExercise;
  data: Data;
  logs: SetLog[];
  profile: Profile;
  onSave: (exercise: Exercise, setNo: number, weight: number, reps: number, existing?: SetLog) => void;
  onRemove: (log: SetLog) => void;
};

function ExerciseCard({ item, data, logs, profile, onSave, onRemove }: CardProps) {
  const main = data.exercises.get(item.exercise_id);
  const alt = item.alt_exercise_id ? data.exercises.get(item.alt_exercise_id) : undefined;
  const altHasLogs = !!alt && logs.some((l) => l.exercise_id === alt.id);
  const [useAlt, setUseAlt] = useState(altHasLogs);
  const [extra, setExtra] = useState(0);
  const exercise = useAlt && alt ? alt : main;
  if (!exercise) return null;

  const mine = logs.filter((l) => l.exercise_id === exercise.id).sort((a, b) => a.set_no - b.set_no);
  const last = data.previous.get(exercise.id) ?? [];
  const lastTop = last.length ? Math.max(...last.map((l) => l.weight_kg)) : null;
  // Progression rule: every set last time reached the rep target, so go heavier.
  const progress = last.length >= 2 && last.every((l) => l.reps >= profile.progression_reps);
  const suggested = lastTop === null ? null : progress ? lastTop + profile.progression_increment_kg : lastTop;

  const highest = mine.length ? mine[mine.length - 1].set_no : 0;
  const rows = Math.max(item.target_sets, highest) + extra;
  const other = useAlt ? main : alt;

  return (
    <Card>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-lg tracking-tight">{exercise.name}</h2>
          <p class="text-sm text-mute">
            {item.target_sets} sets · {item.rep_min}–{item.rep_max} reps{exercise.equipment ? ` · ${exercise.equipment}` : ''}
          </p>
        </div>
        {other && (
          <button type="button" class="btn btn-sm shrink-0" disabled={mine.length > 0} onClick={() => setUseAlt(!useAlt)} title={mine.length > 0 ? 'Remove the logged sets to switch' : undefined}>
            Use {other.name.toLowerCase()}
          </button>
        )}
      </div>

      <p class="mt-2 text-sm">
        {last.length ? (
          <>
            <span class="text-mute">Last time ({formatDay(last[0].performed_on)}): </span>
            <span class="num text-ink">{last.map((l) => `${g(l.weight_kg)} × ${l.reps}`).join(', ')}</span>
          </>
        ) : (
          <span class="text-mute">First time logging this. Start light and focus on form.</span>
        )}
      </p>
      {progress && suggested !== null && (
        <p class="mt-2 rounded-md border border-good/40 px-3 py-2 text-sm text-ink">
          You hit {profile.progression_reps} reps on every set. Go up to <strong class="num font-semibold">{g(suggested)} kg</strong> today.
        </p>
      )}

      <div class="mt-3 flex gap-2 text-xs text-mute" aria-hidden="true">
        <span class="w-5 shrink-0 text-center">Set</span>
        <span class="flex-1 pl-3">Weight (kg)</span>
        <span class="flex-1 pl-3">Reps</span>
        <span class="w-16 shrink-0" />
        <span class="w-8 shrink-0" />
      </div>
      <ul class="mt-1.5 flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => i + 1).map((setNo) => {
          const log = mine.find((l) => l.set_no === setNo);
          return (
            <SetRow
              // Empty rows remount after each logged set so they pick up its weight.
              key={`${exercise.id}:${setNo}:${log?.id ?? `new-${mine.length}`}`}
              setNo={setNo}
              log={log}
              weightHint={suggested ?? last[setNo - 1]?.weight_kg ?? null}
              repsHint={`${item.rep_min}–${item.rep_max}`}
              carryWeight={mine.length ? mine[mine.length - 1].weight_kg : suggested}
              onSave={(weight, reps) => onSave(exercise, setNo, weight, reps, log)}
              onRemove={log ? () => onRemove(log) : undefined}
            />
          );
        })}
      </ul>
      <button type="button" class="btn btn-sm btn-quiet mt-2 -ml-2.5" onClick={() => setExtra(extra + 1)}>+ Add set</button>

      <HowTo exercise={exercise} urls={data.urls} />
    </Card>
  );
}

type RowProps = {
  setNo: number;
  log?: SetLog;
  weightHint: number | null;
  repsHint: string;
  /** Weight to prefill: the previous set's, or today's suggestion. */
  carryWeight: number | null;
  onSave: (weight: number, reps: number) => void;
  onRemove?: () => void;
};

function SetRow({ setNo, log, weightHint, repsHint, carryWeight, onSave, onRemove }: RowProps) {
  const [weight, setWeight] = useState(log ? String(log.weight_kg) : carryWeight === null ? '' : String(carryWeight));
  const [reps, setReps] = useState(log ? String(log.reps) : '');
  const dirty = !log || Number(weight) !== log.weight_kg || Number(reps) !== log.reps;
  const valid = weight !== '' && Number(weight) >= 0 && Number(reps) > 0;

  const submit = (e: Event) => {
    e.preventDefault();
    if (valid && dirty) onSave(Number(weight), Math.round(Number(reps)));
  };

  return (
    <li>
      <form onSubmit={submit} class="flex items-center gap-2">
        <span class="num w-5 shrink-0 text-center text-sm text-mute">{setNo}</span>
        <input class="input num flex-1" type="number" inputMode="decimal" min="0" step="any" aria-label={`Set ${setNo} weight in kilograms`} placeholder={weightHint === null ? '0' : g(weightHint)} value={weight} onInput={(e) => setWeight(e.currentTarget.value)} />
        <input class="input num flex-1" type="number" inputMode="numeric" min="1" step="1" aria-label={`Set ${setNo} reps`} placeholder={repsHint} value={reps} onInput={(e) => setReps(e.currentTarget.value)} />
        <button type="submit" class={cx('btn w-16 shrink-0', dirty ? 'btn-primary' : 'text-good')} disabled={!valid || !dirty}>
          {!log ? 'Log' : dirty ? 'Save' : '✓'}
        </button>
        <span class="w-8 shrink-0">{onRemove && <IconButton label={`Remove set ${setNo}`} onClick={onRemove}>×</IconButton>}</span>
      </form>
    </li>
  );
}

function HowTo({ exercise, urls }: { exercise: Exercise; urls: Record<string, string> }) {
  const media = [...(exercise.exercise_media ?? [])].sort(byPosition).filter((m) => urls[m.id]);
  const steps = (exercise.instructions ?? '').split('\n').filter(Boolean);
  if (!media.length && !steps.length) return null;
  return (
    <details class="mt-3 border-t border-hairline pt-3">
      <summary class="cursor-pointer text-sm font-medium text-ink">How to do it</summary>
      {media.length > 0 && (
        <ul class="mt-3 grid grid-cols-2 gap-2">
          {media.map((m) => (
            <li key={m.id}>
              <img src={urls[m.id]} alt={m.caption ?? exercise.name} loading="lazy" class="aspect-[3/2] w-full rounded-lg border border-hairline object-cover" />
              <p class="mt-1 text-xs text-mute">{m.kind === 'machine' ? 'Machine' : 'Step'}{m.caption ? ` · ${m.caption}` : ''}</p>
            </li>
          ))}
        </ul>
      )}
      {steps.length > 0 && (
        <ol class="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6">
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}
    </details>
  );
}

function RestTimer({ until, total, onChange }: { until: number; total: number; onChange: (until: number | null) => void }) {
  const [now, setNow] = useState(Date.now());
  const left = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (left > 0) return;
    navigator.vibrate?.([200, 100, 200]);
    const t = setTimeout(() => onChange(null), 4000);
    return () => clearTimeout(t);
  }, [left === 0]);

  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <div class="fixed inset-x-0 bottom-14 z-20 border-t border-hairline bg-elevated md:bottom-0" role="timer" aria-live="off">
      <div class="h-0.5 bg-ink transition-[width] duration-300 ease-linear" style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
      <div class="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
        <span class="text-sm text-mute">{left > 0 ? 'Rest' : 'Rest over'}</span>
        <span class="num text-xl font-semibold tracking-tight text-ink">{left > 0 ? clock : 'Go'}</span>
        <div class="ml-auto flex gap-2">
          {left > 0 && <button type="button" class="btn btn-sm" onClick={() => onChange(until + 30_000)}>+30 s</button>}
          <button type="button" class="btn btn-sm" onClick={() => onChange(null)}>{left > 0 ? 'Skip' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Session() {
  return <Gate>{(ctx) => <SessionScreen {...ctx} />}</Gate>;
}
