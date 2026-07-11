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
  zones             text[] default '{}',
  ean               text,        -- code-barres, pour le mode "scanner en rayon"
  note              text,
  updated_at        timestamptz default now()
);

create unique index if not exists products_ean_idx on products (ean) where ean is not null;

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
  zone        text,
  budget      text,
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
-- 4) Magasins partenaires (pharmacies/parapharmacies) — modèle B2B2C
-- ------------------------------------------------------------
-- Chaque magasin partenaire a SON PROPRE sous-ensemble du catalogue (ce
-- qu'il a réellement en rayon), pas le catalogue national entier. C'est ce
-- qui permet au "mode express en magasin" de ne recommander que des
-- produits que la cliente peut acheter là, tout de suite, sans avoir à
-- gérer un stock en temps réel dès le départ (ça, c'est pour une V2).
create table if not exists stores (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  city        text,
  postal_code text,
  phone       text,
  contact_email text,
  active      boolean default true,   -- pilote en cours vs partenariat suspendu
  created_at  timestamptz default now()
);

create table if not exists store_products (
  store_id    uuid references stores(id) on delete cascade,
  product_id  text references products(id) on delete cascade,
  in_stock    boolean default true,   -- simple oui/non pour le pilote ; quantité réelle = V2
  added_at    timestamptz default now(),
  primary key (store_id, product_id)
);

-- Lecture publique (l'app doit pouvoir savoir ce qu'un magasin a en rayon
-- sans que la cliente soit connectée) ; écriture réservée au service_role
-- (toi, en tant qu'admin, ou plus tard une interface dédiée au pharmacien).
alter table stores enable row level security;
alter table store_products enable row level security;

create policy "Les magasins actifs sont visibles par tous"
  on stores for select
  using (active = true);

create policy "Le contenu d'un magasin est visible par tous"
  on store_products for select
  using (true);

-- ------------------------------------------------------------
-- Notes
-- ------------------------------------------------------------
-- - Le catalogue est rempli via `node scripts/seed-products.mjs` (clé
--   service_role, jamais exposée côté front) plutôt que manuellement ici.
-- - Pour l'auth utilisateur, active "Email" (ou le provider de ton choix)
--   dans Authentication > Providers sur le dashboard Supabase.
-- - Si tu as déjà exécuté ce script une première fois AVANT l'ajout de la
--   colonne `zones` (zone du corps/visage ciblée), lance juste cette ligne
--   en plus pour mettre ta table à jour sans tout recréer :
--
--   alter table products add column if not exists zones text[] default '{}';
--   alter table quiz_answers add column if not exists zone text;
--   alter table products add column if not exists ean text;
--   alter table quiz_answers add column if not exists budget text;
--   (puis relance tout le bloc "4) Magasins partenaires" ci-dessus si tu
--   n'avais pas encore les tables stores / store_products)
