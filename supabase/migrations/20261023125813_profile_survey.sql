-- Answers to the app's last onboarding step: who signs up and how they found
-- Trainory. Every answer is optional; accounts from before have none.

alter table public.profiles
  add column age_range text check (age_range in ('under_18', '18_24', '25_34', '35_44', '45_54', '55_plus')),
  add column training_experience text check (training_experience in ('new', 'under_1y', '1_3y', 'over_3y')),
  add column heard_from text check (heard_from in ('social_media', 'friend', 'search', 'app_store', 'gym', 'youtube', 'ad', 'other')),
  add column aims text[] check (
    aims <@ array['stay_fit', 'track_diet', 'maintain_weight', 'build_muscle', 'lose_fat', 'get_stronger', 'more_protein', 'build_habit', 'other']::text[]
  );
