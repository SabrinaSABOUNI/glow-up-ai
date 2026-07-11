// Script de seed : crée un magasin de démonstration et lui assigne un
// sous-ensemble du catalogue, pour simuler "le rayon d'une pharmacie type"
// avant même d'avoir un vrai partenaire signé.
//
// Usage :
//   node scripts/seed-stores.mjs
//
// Une fois que tu as un vrai partenaire, duplique/adapte ce script (ou fais-le
// à la main dans le dashboard Supabase) avec le VRAI sous-ensemble de produits
// que cette pharmacie a en rayon.

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

const DEMO_STORE = {
  name: "Pharmacie Démo — Glow Up AI",
  address: "10 Bd de Sébastopol",
  city: "Paris",
  postal_code: "75001",
  phone: "01 42 72 03 23",
  contact_email: "demo@example.com",
  active: true,
};

async function main() {
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .upsert(DEMO_STORE, { onConflict: "name" })
    .select()
    .single();

  if (storeError) {
    console.error("Échec création magasin :", storeError.message);
    process.exit(1);
  }

  console.log(`Magasin créé/mis à jour : ${store.name} (${store.id})`);

  // Pour la démo, on assigne un échantillon représentatif : les produits
  // "classique" toutes zones confondues (pas tout le catalogue — ça simule
  // un vrai rayon de taille normale, pas un supermarché en ligne).
  const sample = REAL_PRODUCTS.filter(
    (p) => p.styles.includes("classique") || p.styles.includes("toutes")
  );

  const rows = sample.map((p) => ({
    store_id: store.id,
    product_id: p.id,
    in_stock: true,
  }));

  const { error: linkError } = await supabase
    .from("store_products")
    .upsert(rows, { onConflict: "store_id,product_id" });

  if (linkError) {
    console.error("Échec association produits :", linkError.message);
    process.exit(1);
  }

  console.log(`${rows.length} produits assignés au magasin démo.`);
}

main();
