/**
 * GLOW UP AI — Moteur de matching produit
 * ----------------------------------------
 * Système à base de règles pondérées (pas de ML) : suffisant pour un MVP,
 * transparent, et facile à ajuster à la main au fur et à mesure des retours.
 *
 * Principe : chaque produit porte des "tags" décrivant à qui il s'adresse.
 * On compare ces tags aux réponses du quiz utilisateur, on pondère selon
 * l'importance de chaque critère, et on obtient un score de 0 à 98%.
 */

// ---------------------------------------------------------------------------
// 1) Schéma produit — chaque produit du catalogue doit respecter cette forme
// ---------------------------------------------------------------------------
/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {number} price
 * @property {string[]} skinTypes     - ["grasse","seche","mixte"] ou ["toutes"]
 * @property {string[]} concerns      - ["acne","points_noirs","rougeurs","rides","taches","exces_sebum"]
 * @property {string[]} pores         - ["dilates","normaux"] ou ["toutes"]
 * @property {string[]} categories    - ["traitement","nettoyage","hydratation"]
 * @property {string[]} styles        - ["classique","coreenne","age_perfect"] ou ["toutes"]
 * @property {[number, number]} ageRange - ex. [25, 45], utiliser [0,120] si non pertinent
 * @property {string[]} lifestyle     - ["sans_gluten","sans_silicone","grossesse_ok"] (optionnel, pour affichage)
 * @property {string} [format]       - "serum" | "creme" | "gel" | "lotion" (texture/format du produit)
 * @property {string[]} [zones]      - ["visage","yeux","zone_t","cou","mains","pieds"]
 * @property {string} [ean]          - Code-barres EAN (pour le mode "scanner en rayon", V2)
 */

// ---------------------------------------------------------------------------
// 2) Catalogue d'exemple (à remplacer par ta vraie base produit / Supabase)
// ---------------------------------------------------------------------------
export const SAMPLE_PRODUCTS = [
  {
    id: "p1",
    name: "Beauty Serum",
    price: 15,
    skinTypes: ["mixte", "grasse"],
    concerns: ["points_noirs", "exces_sebum"],
    pores: ["dilates"],
    categories: ["traitement"],
    styles: ["classique", "toutes"],
    ageRange: [18, 45],
    lifestyle: ["sans_gluten", "sans_silicone"],
    format: "serum",
  },
  {
    id: "p2",
    name: "Sérum Rétinol Nuit",
    price: 28,
    skinTypes: ["toutes"],
    concerns: ["rides", "taches"],
    pores: ["normaux"],
    categories: ["traitement"],
    styles: ["age_perfect"],
    ageRange: [30, 70],
    lifestyle: ["grossesse_interdit"], // à afficher comme alerte, pas dans le score
    format: "serum",
  },
  {
    id: "p3",
    name: "Essence Fermentée",
    price: 22,
    skinTypes: ["seche", "mixte"],
    concerns: ["rougeurs", "exces_sebum"],
    pores: ["toutes"],
    categories: ["hydratation"],
    styles: ["coreenne"],
    ageRange: [18, 60],
    lifestyle: ["sans_silicone"],
    format: "serum",
  },
  {
    id: "p4",
    name: "Huile Démaquillante",
    price: 18,
    skinTypes: ["toutes"],
    concerns: ["points_noirs", "acne"],
    pores: ["dilates", "normaux"],
    categories: ["nettoyage"],
    styles: ["coreenne", "toutes"],
    ageRange: [15, 60],
    lifestyle: ["sans_gluten"],
    format: "gel",
  },
];

// ---------------------------------------------------------------------------
// 3) Poids des critères — à ajuster selon ce que montrent tes retours réels
// ---------------------------------------------------------------------------
export const WEIGHTS = {
  concerns: 0.33,
  skinType: 0.23,
  style: 0.14,
  category: 0.09,
  pores: 0.07,
  age: 0.02,
  format: 0.08,
  zone: 0.04,
};

// ---------------------------------------------------------------------------
// 4) Sous-scores (chacun retourne une valeur entre 0 et 1)
// ---------------------------------------------------------------------------

function scoreConcerns(product, userConcerns) {
  if (!userConcerns || userConcerns.length === 0) return 0.7; // neutre si pas répondu
  const matched = userConcerns.filter((c) => product.concerns.includes(c));
  return matched.length / userConcerns.length;
}

function scoreSkinType(product, userType) {
  if (!userType) return 0.7;
  if (product.skinTypes.includes("toutes")) return 0.85;
  if (product.skinTypes.includes(userType)) return 1;
  // mixte est partiellement compatible avec grasse et sèche
  if (userType === "mixte" && (product.skinTypes.includes("grasse") || product.skinTypes.includes("seche"))) {
    return 0.5;
  }
  return 0.15;
}

function scoreStyle(product, userStyle) {
  if (!userStyle) return 0.7;
  if (product.styles.includes("toutes")) return 0.8;
  if (product.styles.includes(userStyle)) return 1;
  return 0.2; // le produit existe pour un autre style, pas idéal mais pas éliminatoire
}

function scoreCategory(product, userCategories) {
  if (!userCategories || userCategories.length === 0) return 0.7;
  const matched = userCategories.filter((c) => product.categories.includes(c));
  return matched.length > 0 ? matched.length / userCategories.length : 0.2;
}

function scorePores(product, userPores) {
  if (!userPores) return 0.7;
  if (product.pores.includes("toutes")) return 0.85;
  return product.pores.includes(userPores) ? 1 : 0.4;
}

function scoreFormat(product, userFormat) {
  if (!userFormat) return 0.7; // neutre si l'utilisateur n'est pas passé par le parcours "par produit"
  if (!product.format) return 0.5; // produit du catalogue pas encore renseigné sur ce champ
  return product.format === userFormat ? 1 : 0.3;
}

function scoreZone(product, userZone) {
  if (!userZone) return 0.7;
  if (!product.zones || product.zones.length === 0) return 0.5;
  return product.zones.includes(userZone) ? 1 : 0.3;
}

function scoreAge(product, userAge) {
  const age = Number(userAge);
  if (!age || Number.isNaN(age)) return 0.7;
  const [min, max] = product.ageRange || [0, 120];
  if (age >= min && age <= max) return 1;
  const distance = age < min ? min - age : age - max;
  return distance <= 5 ? 0.5 : 0.2; // tolérance de 5 ans aux bords
}

// ---------------------------------------------------------------------------
// 5) Mapping des réponses UI -> clés internes (garde le quiz lisible en front)
// ---------------------------------------------------------------------------
const CONCERN_MAP = {
  "L'acnés": "acne",
  "Points noirs": "points_noirs",
  Rougeurs: "rougeurs",
  Rides: "rides",
  Taches: "taches",
  "Excès de sébum": "exces_sebum",
  // Préoccupations spécifiques pieds
  "Callosités / talons secs": "callosites",
  Crevasses: "crevasses",
  Mycoses: "mycoses",
  Odeurs: "odeurs",
  // Préoccupations spécifiques mains
  "Sécheresse / gerçures": "secheresse",
  "Signes de l'âge": "rides", // réutilise "rides", même concept que pour le visage
  "Ongles fragiles": "ongles",
  "Mains abîmées": "secheresse", // même famille que "sécheresse/gerçures"
  // Préoccupations spécifiques contour des yeux
  Cernes: "cernes",
  Poches: "poches",
  "Rides / ridules": "rides",
};
const CATEGORY_MAP = {
  "Traitements et Soins": "traitement",
  "Nettoyage et Démaquillage": "nettoyage",
  "Hydratation et Protection": "hydratation",
};
const TYPE_MAP = {
  Grasse: "grasse",
  Sèche: "seche",
  Mixte: "mixte",
  // Variante pieds/mains (options différentes pour ces zones)
  Normale: "normale",
  "Très sèche": "tres_seche",
  // Variante contour des yeux
  Déshydratée: "deshydratee",
  // Variante cou/décolleté
  Fine: "fine",
  Mature: "mature",
};
const PORES_MAP = { Dilatés: "dilates", Normaux: "normaux" };

function normalizeAnswers(answers) {
  return {
    concerns: (answers.concerns || []).map((c) => CONCERN_MAP[c] || c),
    // answers.routine contient déjà des clés stables ("nettoyage", "traitement",
    // "hydratation") depuis le refactor multi-zone — CATEGORY_MAP reste en
    // repli si jamais une ancienne valeur en toutes lettres arrive encore.
    categories: (answers.routine || []).map((c) => CATEGORY_MAP[c] || c),
    type: TYPE_MAP[answers.type] || answers.type,
    pores: PORES_MAP[answers.pores] || answers.pores,
    style: answers.style,
    age: answers.age,
    // Déjà normalisé côté UI : "serum" | "creme" | "gel" | "lotion" | "baume" | undefined
    format: answers.format || null,
    // Déjà normalisé côté UI : "visage" | "yeux" | "zone_t" | "cou" | "mains" | "pieds"
    zone: answers.zone || null,
  };
}

// ---------------------------------------------------------------------------
// 6) Score final (0 à 98%) + fonctions publiques
// ---------------------------------------------------------------------------

export function computeMatchScore(product, rawAnswers) {
  const a = normalizeAnswers(rawAnswers);

  const sub = {
    concerns: scoreConcerns(product, a.concerns),
    skinType: scoreSkinType(product, a.type),
    style: scoreStyle(product, a.style),
    category: scoreCategory(product, a.categories),
    pores: scorePores(product, a.pores),
    age: scoreAge(product, a.age),
    format: scoreFormat(product, a.format),
    zone: scoreZone(product, a.zone),
  };

  const raw =
    sub.concerns * WEIGHTS.concerns +
    sub.skinType * WEIGHTS.skinType +
    sub.style * WEIGHTS.style +
    sub.category * WEIGHTS.category +
    sub.pores * WEIGHTS.pores +
    sub.age * WEIGHTS.age +
    sub.format * WEIGHTS.format +
    sub.zone * WEIGHTS.zone;

  const pct = Math.min(98, Math.round(raw * 100));
  return { pct, sub };
}

/**
 * Filtre STRICT par zone : contrairement aux autres critères (qui pondèrent
 * sans exclure), la zone élimine les produits non pertinents. Une crème
 * mains n'a rien à faire dans les résultats si la personne veut traiter son
 * visage ou ses yeux — et certains actifs visage sont même déconseillés
 * autour des yeux, donc pas de repli "généreux" ici, seulement une
 * correspondance exacte avec les tags `zones` du produit.
 */
export function filterByZone(products, userZone) {
  if (!userZone) return products; // pas de zone précisée = pas de filtre
  return products.filter((p) => (p.zones || []).includes(userZone));
}

/** Classe tout le catalogue par pertinence décroissante */
export function rankProducts(products, answers) {
  return products
    .map((p) => ({ product: p, ...computeMatchScore(p, answers) }))
    .sort((x, y) => y.pct - x.pct);
}

/** Explique en langage clair pourquoi un produit matche (pour l'UI ou le debug) */
export function explainMatch(product, answers) {
  const a = normalizeAnswers(answers);
  const reasons = [];

  if (a.concerns.some((c) => product.concerns.includes(c))) {
    reasons.push("Cible une ou plusieurs de vos préoccupations peau");
  }
  if (product.skinTypes.includes(a.type) || product.skinTypes.includes("toutes")) {
    reasons.push("Adapté à votre type de peau");
  }
  if (product.styles.includes(a.style) || product.styles.includes("toutes")) {
    reasons.push("Correspond au style de routine choisi");
  }
  if (a.categories.some((c) => product.categories.includes(c))) {
    reasons.push("Répond à la catégorie de routine souhaitée");
  }
  if (a.format && product.format === a.format) {
    reasons.push("Exactement le format de produit recherché");
  }
  if (a.zone && product.zones?.includes(a.zone)) {
    reasons.push("Formulé pour la zone que vous souhaitez traiter");
  }
  if (reasons.length === 0) {
    reasons.push("Sélection générale, moins ciblée sur vos critères");
  }
  return reasons;
}

// ---------------------------------------------------------------------------
// 7) Exemple d'utilisation
// ---------------------------------------------------------------------------
/*
import { SAMPLE_PRODUCTS, rankProducts, explainMatch } from "./matching-engine";

const answers = {
  age: "32",
  type: "Mixte",
  pores: "Dilatés",
  concerns: ["Points noirs", "L'acnés"],
  routine: ["Traitements et Soins"],
  style: "classique",
};

const ranked = rankProducts(SAMPLE_PRODUCTS, answers);
ranked.forEach(({ product, pct }) => {
  console.log(product.name, pct + "%", explainMatch(product, answers));
});
*/
