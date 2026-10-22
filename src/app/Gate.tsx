import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { goalFor, STARTER_PROGRAMS } from '../data/starter';
import { today } from '../lib/dates';
import { seedStarter } from '../lib/seed';
import { configured, must, supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import { Onboarding, type Answers } from './Onboarding';
import { ErrorNote, Loading } from './ui';

export type Ctx = {
  userId: string;
  email: string;
  profile: Profile;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
};

type State =
  | { status: 'loading' | 'building' | 'unconfigured' }
  | { status: 'error'; error: string }
  | { status: 'onboarding'; userId: string; email: string }
  | { status: 'ready'; userId: string; email: string; profile: Profile };

const UNIQUE_VIOLATION = '23505';
// A profile that has sat unfinished this long belongs to a build that died.
const STALE_BUILD_MS = 2 * 60 * 1000;
const RECHECK_MS = 3000;

/** Removes a half-built plan so onboarding can start again from nothing. */
async function discardPlan(userId: string) {
  // Workouts, exercises and plans take their child rows with them.
  for (const table of ['schedule', 'workouts', 'exercises', 'diet_plans', 'foods', 'profiles']) {
    await supabase.from(table).delete().eq('user_id', userId);
  }
}

/** Turns the onboarding answers into a profile and a seeded plan. */
async function buildPlan(userId: string, answers: Answers): Promise<Profile> {
  const goal = goalFor(answers.weightKg, answers.targetKg);

  // Inserting the profile row claims the account: if another tab got there
  // first, its plan wins and this one just reads the result.
  const claim = await supabase
    .from('profiles')
    .insert({
      height_cm: answers.heightCm,
      start_weight_kg: answers.weightKg,
      target_weight_kg: answers.targetKg,
      diet_preference: answers.diet,
      goal,
      protein_target_g: answers.proteinTarget,
      weight_gain_target_kg_week: STARTER_PROGRAMS[goal].weeklyChangeKg,
    })
    .select()
    .maybeSingle();
  if (claim.error && claim.error.code !== UNIQUE_VIOLATION) throw new Error(claim.error.message);
  if (!claim.data) return must(await supabase.from('profiles').select('*').single()) as Profile;

  try {
    const planId = await seedStarter(supabase, goal);
    must(await supabase.from('weight_logs').upsert({ logged_on: today(), kg: answers.weightKg }, { onConflict: 'user_id,logged_on' }));
    const now = new Date().toISOString();
    return must(
      await supabase.from('profiles').update({ active_plan_id: planId, seeded_at: now, onboarded_at: now }).eq('user_id', userId).select().single(),
    ) as Profile;
  } catch (e) {
    await discardPlan(userId);
    throw e;
  }
}

/** Wraps every signed-in screen: requires a session, then a profile (onboarding creates it). */
export function Gate({ children }: { children: (ctx: Ctx) => ComponentChildren }) {
  const [state, setState] = useState<State>({ status: configured ? 'loading' : 'unconfigured' });

  useEffect(() => {
    if (!configured) return;
    let recheck: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        location.replace('/login/');
        return;
      }
      const account = { userId: user.id, email: user.email ?? '' };
      const profile = must(await supabase.from('profiles').select('*').maybeSingle()) as Profile | null;

      if (profile?.onboarded_at) return setState({ status: 'ready', ...account, profile });
      if (!profile) return setState({ status: 'onboarding', ...account });

      // Another tab is part-way through building the plan, or died doing so.
      if (Date.now() - Date.parse(profile.created_at) < STALE_BUILD_MS) {
        setState({ status: 'building' });
        recheck = setTimeout(() => load().catch(fail), RECHECK_MS);
      } else {
        await discardPlan(user.id);
        setState({ status: 'onboarding', ...account });
      }
    };
    const fail = (e: Error) => setState({ status: 'error', error: e.message });
    load().catch(fail);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') location.replace('/');
    });
    return () => {
      clearTimeout(recheck);
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state.status === 'error') {
    return (
      <div class="mx-auto w-full max-w-md px-4 py-24">
        <ErrorNote error={state.error} />
      </div>
    );
  }
  if (state.status === 'onboarding') {
    const { userId, email } = state;
    return (
      <Onboarding
        onSubmit={async (answers) => {
          const profile = await buildPlan(userId, answers);
          setState({ status: 'ready', userId, email, profile });
        }}
      />
    );
  }
  if (state.status !== 'ready') {
    if (state.status === 'unconfigured') {
      return (
        <div class="mx-auto max-w-md px-4 py-24 text-center text-sm">
          The backend is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY, then rebuild.
        </div>
      );
    }
    return <Loading label={state.status === 'building' ? 'Setting up your plan' : undefined} />;
  }

  const { userId, email, profile } = state;
  const saveProfile = async (patch: Partial<Profile>) => {
    const next = must(await supabase.from('profiles').update(patch).eq('user_id', userId).select().single()) as Profile;
    setState({ status: 'ready', userId, email, profile: next });
  };
  return <>{children({ userId, email, profile, saveProfile })}</>;
}
