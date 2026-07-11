/**
 * Repli Open Beauty Facts : si un code-barres scanné n'est pas dans notre
 * catalogue (très probable au début, vu le peu de produits qu'on a), on
 * regarde si Open Beauty Facts connaît au moins le produit — mieux qu'un
 * échec sec pour la cliente.
 *
 * Licence ODbL (réutilisation commerciale autorisée), API publique gratuite :
 * https://world.openbeautyfacts.org/api/v2/product/<code>.json
 */
export async function lookupOpenBeautyFacts(ean) {
  try {
    const res = await fetch(
      `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(
        ean
      )}.json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    return {
      ean,
      name: p.product_name || p.generic_name || "Produit non identifié",
      brand: p.brands || null,
      image: p.image_front_url || p.image_url || null,
      ingredients: p.ingredients_text_fr || p.ingredients_text || null,
    };
  } catch (e) {
    console.warn("[OpenBeautyFacts] Recherche impossible :", e.message);
    return null;
  }
}
