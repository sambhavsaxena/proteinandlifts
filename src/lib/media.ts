import { MEDIA_BUCKET, must, supabase } from './supabase';
import type { ExerciseMedia, MediaKind } from './types';

const MAX_EDGE = 1280;

/** Display URLs by media id. Uploads sit in a private bucket and need signing. */
export async function mediaUrls(media: ExerciseMedia[]): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  const stored = media.filter((m) => m.storage_path);
  for (const m of media) if (m.url) urls[m.id] = m.url;
  if (stored.length) {
    const signed = must(
      await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(
        stored.map((m) => m.storage_path!),
        60 * 60,
      ),
    );
    signed.forEach((s: { signedUrl: string | null }, i: number) => {
      if (s.signedUrl) urls[stored[i].id] = s.signedUrl;
    });
  }
  return urls;
}

/** Downscales a photo in the browser so phone pictures don't eat the storage quota. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image.'))), 'image/jpeg', 0.82),
  );
}

export async function uploadMedia(userId: string, exerciseId: string, kind: MediaKind, file: File, position: number): Promise<ExerciseMedia> {
  const blob = await shrink(file);
  const path = `${userId}/${exerciseId}/${crypto.randomUUID()}.jpg`;
  must(await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: 'image/jpeg' }));
  return must(
    await supabase.from('exercise_media').insert({ exercise_id: exerciseId, kind, storage_path: path, position }).select().single(),
  ) as ExerciseMedia;
}

export async function deleteMedia(m: ExerciseMedia) {
  if (m.storage_path) must(await supabase.storage.from(MEDIA_BUCKET).remove([m.storage_path]));
  must(await supabase.from('exercise_media').delete().eq('id', m.id));
}
