// Script de seed : injecte src/catalog.js dans la table Supabase "products".
//
// Usage :
//   1. npm install dotenv (déjà listé en devDependency)
//   2. Renseigne SUPABASE_SERVICE_ROLE_KEY et VITE_SUPABASE_URL dans .env.local
//   3. node scripts/seed-products.mjs
//
// ⚠️ La clé service_role contourne les policies RLS — ne jamais l'exposer
// côté front, uniquement utilisée ici en local / CI pour peupler la base.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { REAL_PRODUCTS } from "../src/catalog.js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Il manque VITE_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY dans .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

function toRow(p) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: p.price,
    price_confirmed: p.priceConfirmed ?? true,
    volume: p.volume ?? null,
    skin_types: p.skinTypes ?? [],
    concerns: p.concerns ?? [],
    pores: p.pores ?? [],
    categories: p.categories ?? [],
    styles: p.styles ?? [],
    age_min: p.ageRange?.[0] ?? 0,
    age_max: p.ageRange?.[1] ?? 120,
    lifestyle: p.lifestyle ?? [],
    key_ingredients: p.keyIngredients ?? [],
    format: p.format ?? null,
    note: p.note ?? null,
  };
}

async function main() {
  const rows = REAL_PRODUCTS.map(toRow);
  const { data, error } = await supabase
    .from("products")
    .upsert(rows, { onConflict: "id" })
    .select("id, name");

  if (error) {
    console.error("Échec du seed :", error.message);
    process.exit(1);
  }

  console.log(`${data.length} produits insérés/mis à jour :`);
  data.forEach((p) => console.log(" -", p.name));
}

main();
