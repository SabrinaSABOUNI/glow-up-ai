import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import { REAL_PRODUCTS } from "../catalog";

// Convertit une ligne Supabase (snake_case) vers la forme attendue par le
// moteur de matching (camelCase), identique au schéma de catalog.js.
function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    price: Number(row.price),
    priceConfirmed: row.price_confirmed,
    volume: row.volume,
    skinTypes: row.skin_types || [],
    concerns: row.concerns || [],
    pores: row.pores || [],
    categories: row.categories || [],
    styles: row.styles || [],
    ageRange: [row.age_min ?? 0, row.age_max ?? 120],
    lifestyle: row.lifestyle || [],
    keyIngredients: row.key_ingredients || [],
    format: row.format,
    note: row.note,
  };
}

/**
 * Renvoie le catalogue produit : Supabase si configuré et disponible,
 * sinon le catalogue local (catalog.js) — l'app fonctionne dans les deux cas.
 */
export function useProducts() {
  const [products, setProducts] = useState(REAL_PRODUCTS);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [source, setSource] = useState("local");

  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.from("products").select("*");
      if (cancelled) return;

      if (error || !data || data.length === 0) {
        if (error) {
          console.warn(
            "[Supabase] Impossible de charger les produits, on garde le catalogue local :",
            error.message
          );
        }
        setLoading(false);
        return; // on garde le catalogue local déjà en place
      }

      setProducts(data.map(rowToProduct));
      setSource("supabase");
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { products, loading, source };
}
