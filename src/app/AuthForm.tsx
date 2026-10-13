import { useEffect, useState } from 'preact/hooks';
import { configured, supabase } from '../lib/supabase';
import { ErrorNote, Field } from './ui';

type Mode = 'login' | 'signup' | 'reset';

const COPY: Record<Mode, { title: string; submit: string }> = {
  login: { title: 'Log in', submit: 'Log in' },
  signup: { title: 'Create your account', submit: 'Sign up' },
  reset: { title: 'Choose a new password', submit: 'Save password' },
};

export default function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!configured || mode === 'reset') return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) location.replace('/app/');
    });
  }, []);

  if (!configured) return <ErrorNote error="The backend is not configured yet." />;

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.assign('/app/');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/app/` } });
        if (error) throw error;
        if (data.session) location.assign('/app/');
        else setNotice('Check your inbox and confirm your email to finish signing up.');
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        location.assign('/app/');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setError(null);
    setNotice(null);
    if (!email) return setError('Enter your email first, then choose "Forgot password?".');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset/` });
    if (error) setError(error.message);
    else setNotice('If that email has an account, a reset link is on its way.');
  }

  return (
    <form onSubmit={submit} class="card flex flex-col gap-4">
      <h1 class="text-2xl tracking-tight">{COPY[mode].title}</h1>
      {mode !== 'reset' && (
        <Field label="Email">
          <input class="input" type="email" name="email" autocomplete="email" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
        </Field>
      )}
      <Field label={mode === 'reset' ? 'New password' : 'Password'} hint={mode === 'login' ? undefined : 'At least 8 characters.'}>
        <input
          class="input"
          type="password"
          name="password"
          autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={mode === 'login' ? undefined : 8}
          required
          value={password}
          onInput={(e) => setPassword(e.currentTarget.value)}
        />
      </Field>
      <ErrorNote error={error} />
      {notice && <p role="status" class="rounded-md border border-hairline px-3 py-2 text-sm text-ink">{notice}</p>}
      <button type="submit" class="btn btn-primary" disabled={busy}>
        {busy ? 'One moment…' : COPY[mode].submit}
      </button>
      {mode === 'login' && (
        <p class="flex flex-wrap justify-between gap-2 text-sm">
          <a href="/signup/" class="text-link">Create an account</a>
          <button type="button" class="cursor-pointer text-link" onClick={sendReset}>Forgot password?</button>
        </p>
      )}
      {mode === 'signup' && (
        <p class="text-sm">
          Already have an account? <a href="/login/" class="text-link">Log in</a>
        </p>
      )}
    </form>
  );
}
