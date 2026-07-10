-- ============================================================
-- GLOW UP AI — Schéma Supabase de démarrage
-- ============================================================
-- À exécuter dans Supabase : Dashboard > SQL Editor > New query
-- (colle tout ce fichier, puis "Run")

-- ------------------------------------------------------------
-- 1) Catalogue produits (miroir de src/catalog.js)
-- ------------------------------------------------------------
create table if not exists products (
  id                text primary key,
  name              text not null,
  brand             text,
  price             numeric(10, 2) not null,
  price_confirmed   boolean default true,
  volume            text,
  skin_types        text[] default '{}',
  concerns          text[] default '{}',
  pores             text[] default '{}',
  categories        text[] default '{}',
  styles            text[] default '{}',
  age_min           int default 0,
  age_max           int default 120,
  lifestyle         text[] default '{}',
  key_ingredients   text[] default '{}',
  format            text,
  note              text,
  updated_at        timestamptz default now()
);

-- Le catalogue est public en lecture (n'importe qui peut voir les produits),
-- mais seul le rôle "service_role" (utilisé par le script de seed) peut écrire.
alter table products enable row level security;

create policy "Le catalogue est visible par tous"
  on products for select
  using (true);

-- ------------------------------------------------------------
-- 2) Réponses au quiz, une ligne par utilisateur (mise à jour à chaque quiz)
-- ------------------------------------------------------------
create table if not exists quiz_answers (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  age         int,
  skin_tone   text,
  skin_type   text,
  pores       text,
  concerns    text[] default '{}',
  routine     text[] default '{}',
  style       text default 'classique',
  format      text,
  updated_at  timestamptz default now()
);

alter table quiz_answers enable row level security;

create policy "Chacun lit uniquement ses propres réponses"
  on quiz_answers for select
  using (auth.uid() = user_id);

create policy "Chacun écrit uniquement ses propres réponses"
  on quiz_answers for insert
  with check (auth.uid() = user_id);

create policy "Chacun met à jour uniquement ses propres réponses"
  on quiz_answers for update
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3) Favoris (le petit cœur sur l'écran produits)
-- ------------------------------------------------------------
create table if not exists favorites (
  user_id     uuid references auth.users(id) on delete cascade,
  product_id  text references products(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (user_id, product_id)
);

alter table favorites enable row level security;

create policy "Chacun gère uniquement ses propres favoris"
  on favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Notes
-- ------------------------------------------------------------
-- - Le catalogue est rempli via `node scripts/seed-products.mjs` (clé
--   service_role, jamais exposée côté front) plutôt que manuellement ici.
-- - Pour l'auth utilisateur, active "Email" (ou le provider de ton choix)
--   dans Authentication > Providers sur le dashboard Supabase.
