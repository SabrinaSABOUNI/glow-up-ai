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
    zones: row.zones || [],
    ean: row.ean || null,
    note: row.note,
  };
}

/**
 * Lit l'identifiant du magasin partenaire depuis l'URL (?store=<uuid>),
 * celui qu'on met dans le QR code affiché en rayon. Absent = catalogue
 * national complet (usage grand public classique).
 */
export function getStoreIdFromUrl() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("store");
}

/**
 * Renvoie le catalogue produit :
 * - si un `storeId` est fourni (via QR code en magasin) ET Supabase configuré :
 *   uniquement les produits que CE magasin a en rayon (table store_products) ;
 * - sinon, si Supabase est configuré : le catalogue national complet ;
 * - sinon (pas de Supabase) : le catalogue local (catalog.js).
 * Dans tous les cas de repli/erreur, l'app reste utilisable.
 */
export function useProducts(storeId) {
  const [products, setProducts] = useState(REAL_PRODUCTS);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [source, setSource] = useState("local");
  const [storeName, setStoreName] = useState(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;

    (async () => {
      // --- Cas 1 : un magasin précis est demandé (QR code en rayon) ---
      if (storeId) {
        const { data: store, error: storeError } = await supabase
          .from("stores")
          .select("id, name, active")
          .eq("id", storeId)
          .maybeSingle();

        if (cancelled) return;

        if (storeError || !store || !store.active) {
          console.warn(
            "[Supabase] Magasin introuvable ou inactif, repli sur le catalogue national.",
            storeError?.message
          );
          // on continue vers le cas 2 (catalogue national) plutôt que de bloquer
        } else {
          const { data: rows, error: linkError } = await supabase
            .from("store_products")
            .select("products(*)")
            .eq("store_id", storeId)
            .eq("in_stock", true);

          if (!cancelled && !linkError && rows?.length) {
            setProducts(rows.map((r) => rowToProduct(r.products)));
            setStoreName(store.name);
            setSource("supabase-store");
            setLoading(false);
            return;
          }
          if (linkError) {
            console.warn(
              "[Supabase] Impossible de charger le rayon de ce magasin, repli sur le catalogue national :",
              linkError.message
            );
          }
        }
      }

      // --- Cas 2 : catalogue national complet ---
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
  }, [storeId]);

  return { products, loading, source, storeName };
}
