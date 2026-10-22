import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const key = import.meta.env.PUBLIC_SUPABASE_KEY as string | undefined;

export const configured = Boolean(url && key);

// The storage key is fixed so the layout's inline script can tell, before
// first paint, whether someone is signed in.
export const supabase: SupabaseClient = configured
  ? createClient(url!, key!, { auth: { storageKey: 'trainory-auth' } })
  : (null as unknown as SupabaseClient);

/**
 * Unwraps a Supabase response, turning its error into a thrown Error. The
 * client is untyped, so callers name the row type they expect.
 */
export function must<T = any>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const MEDIA_BUCKET = 'exercise-media';
