import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Heart,
  Bookmark,
  ShoppingCart,
  MapPin,
  Sparkles,
  Plus,
  Sun,
  Moon,
  Eye,
  Snowflake,
  Recycle,
  Filter,
  ChevronDown,
  MessageCircle,
  Send,
  BadgeCheck,
  Mail,
  LogOut,
  Loader2,
} from "lucide-react";
import { rankProducts, explainMatch, filterByZone } from "./matching-engine";
import { useProducts } from "./lib/useProducts";
import { useAuth } from "./lib/useAuth";
import { supabase } from "./lib/supabaseClient";

// ---------- palette ----------
const GRAD = {
  teal: "linear-gradient(160deg, #57e0cf 0%, #8fd9c9 45%, #cfe0b0 100%)",
  pink: "linear-gradient(160deg, #e39ec2 0%, #eba8ab 55%, #eec49a 100%)",
  sage: "linear-gradient(160deg, #b9d7bd 0%, #d7c7ae 55%, #e2c9a3 100%)",
  mint: "linear-gradient(160deg, #63e2cf 0%, #a9dcc0 100%)",
};

const PINK = "#ec4899";

function Logo() {
  return (
    <div className="relative w-14 h-14 rounded-full bg-black flex items-center justify-center shrink-0 overflow-hidden">
      <div
        className="absolute inset-1 rounded-full"
        style={{
          background:
            "conic-gradient(from 200deg, #6ee7d8, #f2b6c9, #f6dca0, #6ee7d8)",
        }}
      />
      <span className="relative text-[9px] font-extrabold leading-tight text-amber-300 text-center tracking-tight">
        GLOW
        <br />
        UP AI
      </span>
    </div>
  );
}

function Pill({ children, onClick, tone = "solid", className = "" }) {
  const base =
    "px-6 py-3 rounded-full text-sm font-medium transition active:scale-95 shadow-sm";
  const styles =
    tone === "solid"
      ? "text-white"
      : "bg-white text-pink-500";
  return (
    <button
      onClick={onClick}
      className={`${base} ${styles} ${className}`}
      style={tone === "solid" ? { background: PINK } : {}}
    >
      {children}
    </button>
  );
}

function BackArrow({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Retour"
      className="text-white/90 hover:text-white transition p-2 -ml-2"
    >
      <ArrowLeft size={22} />
    </button>
  );
}

function ProgressBar({ step, total }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="w-full h-1.5 rounded-full bg-white/50 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: "#f0a35c" }}
      />
    </div>
  );
}

function ScreenShell({ gradient, children, top, bottom }) {
  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ background: gradient }}
    >
      <div className="flex items-center justify-between px-6 pt-6">{top}</div>
      <div className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
        {children}
      </div>
      {bottom && <div className="px-6 pb-6 pt-2">{bottom}</div>}
    </div>
  );
}

function OptionCircle({ label, selected, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
    >
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition ${
          selected
            ? "border-white bg-white/30 scale-105"
            : "border-white/40 bg-white/10"
        }`}
      >
        {children}
      </div>
      <span className="text-white text-sm">{label}</span>
    </button>
  );
}

const SKIN_TONES = ["Claire", "Mat", "Foncé"];
const SKIN_TYPES = ["Grasse", "Sèche", "Mixte"];
const PORES = ["Dilatés", "Normaux"];
const CONCERN_OPTIONS = ["L'acnés", "Points noirs", "Rougeurs"];
// Version étendue utilisée par le parcours "par type de produit", qui n'a pas
// de diagnostic peau complet pour deviner les problématiques probables.
const QUICK_CONCERN_OPTIONS = [
  "L'acnés",
  "Points noirs",
  "Rougeurs",
  "Rides",
  "Taches",
  "Excès de sébum",
];
const ROUTINE_OPTIONS = [
  "Traitements et Soins",
  "Nettoyage et Démaquillage",
  "Hydratation et Protection",
];

// Choix d'entrée : diagnostic peau complet, ou raccourci par type de produit
const FORMAT_OPTIONS = [
  { key: "serum", label: "Sérum", emoji: "💧" },
  { key: "creme", label: "Crème", emoji: "🫙" },
  { key: "gel", label: "Gel", emoji: "🧴" },
  { key: "lotion", label: "Lotion", emoji: "🍶" },
];

// Zone du corps/visage à traiter
const ZONE_OPTIONS = [
  { key: "visage", label: "Visage complet", emoji: "🙂" },
  { key: "yeux", label: "Contours des yeux", emoji: "👁️" },
  { key: "zone_t", label: "Nez et zone T", emoji: "👃" },
  { key: "cou", label: "Cou / Décolleté", emoji: "🧣" },
  { key: "aisselles", label: "Aisselles", emoji: "🙋" },
  { key: "mains", label: "Mains", emoji: "🤲" },
  { key: "pieds", label: "Pieds", emoji: "🦶" },
];

// Modernized routine "styles" — the philosophy/method the user wants to follow
const STYLE_OPTIONS = [
  { key: "classique", label: "Classique", emoji: "🤍" },
  { key: "coreenne", label: "Routine Coréenne", emoji: "🌸" },
  { key: "age_perfect", label: "Age Perfect", emoji: "⏳" },
];

// Routine step counts + labels vary by style (Korean = plus d'étapes, Age Perfect = ciblé anti-âge)
const ROUTINE_META = {
  classique: {
    duration: "3 M",
    steps: 3,
    tip: "Une base simple et efficace, matin et soir.",
  },
  coreenne: {
    duration: "2 M",
    steps: 5,
    tip: "Double nettoyage, essence, sérum, masque, crème — la routine coréenne en 5 temps.",
  },
  age_perfect: {
    duration: "4 M",
    steps: 4,
    tip: "Ciblée anti-âge : rétinol, peptides et protection renforcée.",
  },
};

const FORMAT_LABELS = {
  serum: "Sérum",
  creme: "Crème",
  gel: "Gel",
  lotion: "Lotion",
};

const STORES = [
  {
    name: "Pharmacie Lafayette Des Halles",
    addr: "10 Bd de Sébastopol · 01 42 72 03 23",
    hours: "Ouvert · Ferme à 20:45",
  },
  {
    name: "Univers Pharmacie – Grande Pharmacie Première",
    addr: "24 Bd de Sébastopol · 01 48 87 62 30",
    hours: "Ouvert · Ferme à 19:45",
  },
  {
    name: "Pharmacie du Forum Des Halles",
    addr: "1 Rue Pierre Lescot Étage -2 · 01 40 41 90 80",
    hours: "Ouvert · Ferme à 20:20",
  },
];

// Construit un lien Google Maps "itinéraire" fonctionnel à partir du nom + de
// l'adresse (on retire le numéro de téléphone accolé après le " · ").
function directionsUrl(store) {
  const streetAddr = store.addr.split(" · ")[0];
  const query = encodeURIComponent(`${store.name}, ${streetAddr}, Paris`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

const CHAT_QUICK_REPLIES = [
  "Ce produit convient-il à ma peau ?",
  "Puis-je parler à une humaine ?",
  "Quel ordre d'application ?",
];

function botReply(userText, answers) {
  const t = userText.toLowerCase();
  if (t.includes("humain") || t.includes("conseillère") || t.includes("rdv") || t.includes("rendez")) {
    return "Bien sûr ! Je vous mets en relation avec une conseillère cosmétique certifiée. Un message vous sera envoyé sous 24h avec un créneau de rendez-vous vidéo gratuit.";
  }
  if (t.includes("prix") || t.includes("tarif") || t.includes("coût")) {
    return "Nos produits recommandés sont entre 4€ et 28€. Vous pouvez comparer les tarifs directement sur la fiche de chaque produit.";
  }
  if (t.includes("ordre") || t.includes("applique") || t.includes("étape")) {
    return "En général : nettoyant → essence/tonique → sérum → contour des yeux → crème → SPF le matin. L'onglet 'Votre routine' vous montre l'ordre exact selon vos réponses.";
  }
  if (t.includes("rides") || t.includes("âge") || t.includes("anti-age") || t.includes("anti-âge")) {
    return "Pour les rides, je recommande le rétinol en soin du soir (en montant progressivement) et un SPF 50 le matin — c'est le duo le plus efficace validé scientifiquement.";
  }
  if (t.includes("convient") || t.includes("adapté")) {
    const skin = answers.type || "votre type de peau";
    return `D'après vos réponses (peau ${skin.toLowerCase() || "—"}), ce produit est compatible à ${
      answers.style === "coreenne" ? 96 : answers.style === "age_perfect" ? 95 : 97
    }%. Je peux tout de même vérifier un ingrédient précis si besoin.`;
  }
  return "Merci pour votre message ! Je note votre question et une conseillère beauté formée pourra vous répondre plus en détail si besoin — souhaitez-vous être mise en relation ?";
}

function FloatingChatButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Discuter avec une conseillère beauté"
      className="absolute right-5 bottom-24 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-20 active:scale-95 transition"
      style={{ background: PINK }}
    >
      <MessageCircle size={24} className="text-white" />
    </button>
  );
}

const QUIZ_STEPS = [
  "age",
  "tone",
  "type",
  "pores",
  "concerns",
  "routine",
  "style",
];

export default function GlowUpAI() {
  const [history, setHistory] = useState(["landing"]);
  const screen = history[history.length - 1];
  const goTo = (next) => setHistory((h) => [...h, next]);
  const goBack = () =>
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const restart = () => {
    setHistory(["landing"]);
    setAnswers({
      age: "",
      tone: "",
      type: "",
      pores: "",
      concerns: [],
      routine: [],
      style: "classique",
      format: "",
      zone: "",
      entryPath: "",
      firstName: "Camille",
    });
  };

  const [answers, setAnswers] = useState({
    age: "",
    tone: "",
    type: "",
    pores: "",
    concerns: [],
    routine: [],
    style: "classique",
    format: "",
    zone: "",
    entryPath: "",
    firstName: "Camille",
  });
  const [liked, setLiked] = useState({});
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [city, setCity] = useState("");
  const searchStoresNearby = () => {
    if (!city.trim()) return;
    const query = encodeURIComponent(`pharmacie ${city.trim()}`);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      "_blank"
    );
  };
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Bonjour 👋 je suis Léa, votre conseillère beauté (assistée par IA). Une question sur vos produits ou votre routine ?",
    },
  ]);
  const chatEndRef = useRef(null);

  // --- Compte utilisateur (lien magique par email) et catalogue en direct ---
  const { user, loading: authLoading, signInWithEmail, signOut } = useAuth();
  const { products, loading: productsLoading, source: productsSource } =
    useProducts();
  const [authEmail, setAuthEmail] = useState("");
  const [authStatus, setAuthStatus] = useState("idle"); // idle | sending | sent | error
  const [authError, setAuthError] = useState("");

  const sendMagicLink = async () => {
    if (!authEmail.trim()) return;
    setAuthStatus("sending");
    const { error } = await signInWithEmail(authEmail.trim());
    if (error) {
      setAuthError(error.message);
      setAuthStatus("error");
    } else {
      setAuthStatus("sent");
    }
  };

  // Au login, on récupère les réponses au quiz et les favoris déjà sauvegardés
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: qa } = await supabase
        .from("quiz_answers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (qa) {
        setAnswers((a) => ({
          ...a,
          age: qa.age ? String(qa.age) : a.age,
          tone: qa.skin_tone || a.tone,
          type: qa.skin_type || a.type,
          pores: qa.pores || a.pores,
          concerns: qa.concerns?.length ? qa.concerns : a.concerns,
          routine: qa.routine?.length ? qa.routine : a.routine,
          style: qa.style || a.style,
          format: qa.format || a.format,
          zone: qa.zone || a.zone,
        }));
      }
      const { data: favs } = await supabase
        .from("favorites")
        .select("product_id")
        .eq("user_id", user.id);
      if (favs?.length) {
        const likedMap = {};
        favs.forEach((f) => {
          likedMap[f.product_id] = true;
        });
        setLiked(likedMap);
      }
    })();
  }, [user]);

  // Sauvegarde les réponses du quiz dès qu'on arrive sur l'écran de félicitations
  useEffect(() => {
    if (screen !== "congrats" || !user) return;
    supabase.from("quiz_answers").upsert({
      user_id: user.id,
      age: answers.age ? Number(answers.age) : null,
      skin_tone: answers.tone || null,
      skin_type: answers.type || null,
      pores: answers.pores || null,
      concerns: answers.concerns,
      routine: answers.routine,
      style: answers.style,
      format: answers.format || null,
      zone: answers.zone || null,
      updated_at: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, user]);

  const toggleLike = async (productId) => {
    const nowLiked = !liked[productId];
    setLiked((l) => ({ ...l, [productId]: nowLiked }));
    if (!user) return; // mode invité : favoris gardés en mémoire seulement
    if (nowLiked) {
      await supabase
        .from("favorites")
        .upsert({ user_id: user.id, product_id: productId });
    } else {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);
    }
  };

  const openChat = () => goTo("chat");

  const sendMessage = (text) => {
    const clean = text.trim();
    if (!clean) return;
    setMessages((m) => [
      ...m,
      { from: "user", text: clean },
      { from: "bot", text: botReply(clean, answers) },
    ]);
    setChatInput("");
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, screen]);

  const toggleMulti = (key, value) => {
    setAnswers((a) => {
      const list = a[key];
      const next = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      return { ...a, [key]: next };
    });
  };

  const quizIndex = QUIZ_STEPS.indexOf(screen);

  // Filtre STRICT par zone d'abord (une crème mains n'apparaît jamais si la
  // personne veut traiter son visage), puis classement par pertinence sur
  // ce qui reste.
  const zoneProducts = useMemo(
    () => filterByZone(products, answers.zone),
    [products, answers.zone]
  );
  const rankedProducts = useMemo(
    () => rankProducts(zoneProducts, answers),
    [answers, zoneProducts]
  );

  // --- Tri et filtres sur l'écran produits ---
  const priceCeiling = useMemo(
    () =>
      zoneProducts.length
        ? Math.ceil(Math.max(...zoneProducts.map((p) => p.price)) / 5) * 5
        : 40,
    [zoneProducts]
  );
  const [sortBy, setSortBy] = useState("pertinence"); // pertinence | prix_asc | prix_desc
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterCategories, setFilterCategories] = useState([]);
  const [filterFormats, setFilterFormats] = useState([]);
  const [maxPrice, setMaxPrice] = useState(priceCeiling);

  const activeFilterCount =
    filterCategories.length +
    filterFormats.length +
    (maxPrice < priceCeiling ? 1 : 0);

  const resetFilters = () => {
    setFilterCategories([]);
    setFilterFormats([]);
    setMaxPrice(priceCeiling);
  };

  const toggleFilter = (setter) => (value) =>
    setter((list) =>
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );

  const displayedProducts = useMemo(() => {
    let list = rankedProducts.filter(({ product: p }) => {
      if (
        filterCategories.length &&
        !p.categories.some((c) => filterCategories.includes(c))
      )
        return false;
      if (filterFormats.length && !filterFormats.includes(p.format))
        return false;
      if (p.price > maxPrice) return false;
      return true;
    });
    const sorted = [...list];
    if (sortBy === "prix_asc") {
      sorted.sort((a, b) => a.product.price - b.product.price);
    } else if (sortBy === "prix_desc") {
      sorted.sort((a, b) => b.product.price - a.product.price);
    } else {
      sorted.sort((a, b) => b.pct - a.pct);
    }
    return sorted;
  }, [rankedProducts, sortBy, filterCategories, filterFormats, maxPrice]);

  const SORT_OPTIONS = [
    { key: "pertinence", label: "Pertinence" },
    { key: "prix_asc", label: "Prix croissant" },
    { key: "prix_desc", label: "Prix décroissant" },
  ];
  const CATEGORY_FILTER_OPTIONS = [
    { key: "nettoyage", label: "Nettoyage" },
    { key: "hydratation", label: "Hydratation" },
    { key: "traitement", label: "Traitement" },
  ];

  const selectedEntry =
    rankedProducts.find((r) => r.product.id === selectedProductId) ||
    rankedProducts[0];
  const selectedProduct = selectedEntry?.product;
  const relatedProducts = rankedProducts
    .filter((r) => r.product.id !== selectedProduct?.id)
    .slice(0, 3);

  // Assigne un vrai produit du classement à chaque étape de la routine
  // (nettoyage → traitement → hydratation, en boucle si plus d'étapes).
  const ROUTINE_CATEGORY_CYCLE = [
    "nettoyage",
    "traitement",
    "hydratation",
    "traitement",
    "hydratation",
  ];
  const routineSteps = (ROUTINE_META[answers.style] || ROUTINE_META.classique)
    .steps;
  const routineProductPicks = useMemo(() => {
    const used = new Set();
    const picks = [];
    for (let i = 0; i < routineSteps; i++) {
      const cat = ROUTINE_CATEGORY_CYCLE[i % ROUTINE_CATEGORY_CYCLE.length];
      let match = rankedProducts.find(
        (r) => r.product.categories.includes(cat) && !used.has(r.product.id)
      );
      if (!match) {
        match = rankedProducts.find((r) => !used.has(r.product.id));
      }
      if (match) used.add(match.product.id);
      picks.push(match ? match.product : null);
    }
    return picks;
  }, [rankedProducts, routineSteps]);

  const formatEmoji = (product) =>
    FORMAT_OPTIONS.find((f) => f.key === product?.format)?.emoji || "🧴";

  return (
    <div className="w-full flex items-center justify-center bg-neutral-100 py-6">
      <div
        className="relative w-[360px] h-[720px] rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-black bg-white font-sans"
        style={{ fontFamily: "'Poppins', ui-sans-serif, system-ui" }}
      >
        {screen === "landing" && (
          <ScreenShell
            gradient={GRAD.teal}
            top={<div />}
            bottom={
              <div className="flex gap-3">
                <Pill
                  onClick={() => goTo(user ? "intro" : "auth")}
                  className="flex-1 text-center"
                >
                  rejoignez-nous
                </Pill>
                <Pill
                  tone="ghost"
                  onClick={() => goTo(user ? "intro" : "auth")}
                  className="flex-1 text-center"
                >
                  se connecter
                </Pill>
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-6 mt-2">
              <div
                className="w-52 h-52 rounded-full flex items-center justify-center border-8 border-black overflow-hidden"
                style={{
                  background:
                    "conic-gradient(from 210deg, #6ee7d8, #f2b6c9 40%, #f6dca0 70%, #6ee7d8)",
                }}
              >
                <span className="text-3xl font-extrabold text-amber-300 leading-tight">
                  GLOW
                  <br />
                  UP AI
                </span>
              </div>
              <h1 className="text-white text-3xl font-semibold leading-tight">
                Glow Up Ai votre
                <br />
                allié beauté
              </h1>
              <p className="text-white/95 text-sm leading-relaxed px-1">
                Notre application vous propose des recommandations
                personnalisées en quelques clics, grâce à son algorithme qui
                analyse votre type de peau et vos préférences pour vous
                proposer les produits et les routines qui vous correspondent
                le mieux.
              </p>
            </div>
          </ScreenShell>
        )}

        {screen === "auth" && (
          <ScreenShell
            gradient={GRAD.mint}
            top={<Logo />}
            bottom={
              <div className="flex items-center gap-4">
                <BackArrow onClick={goBack} />
                <button
                  onClick={() => goTo("intro")}
                  className="flex-1 text-center text-white/90 text-sm underline"
                >
                  continuer sans compte
                </button>
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-6 mt-8 px-2">
              <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <Mail size={36} className="text-white" />
              </div>
              <h2 className="text-white text-2xl font-semibold">
                Se connecter
              </h2>
              <p className="text-white/90 text-sm">
                Reçois un lien magique par email — pas de mot de passe. Ton
                diagnostic et tes favoris seront sauvegardés d'une visite à
                l'autre.
              </p>

              {authStatus === "sent" ? (
                <p className="bg-white/90 rounded-xl px-4 py-3 text-sm text-neutral-800">
                  Vérifie ta boîte mail ({authEmail}) et clique sur le lien
                  reçu pour te connecter.
                </p>
              ) : (
                <>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="ton@email.com"
                    className="w-full px-4 py-3 rounded-full text-center text-neutral-800 outline-none"
                  />
                  {authStatus === "error" && (
                    <p className="text-white text-xs bg-red-500/70 rounded-lg px-3 py-2">
                      {authError}
                    </p>
                  )}
                  <Pill
                    onClick={sendMagicLink}
                    className="w-full text-center flex items-center justify-center gap-2"
                  >
                    {authStatus === "sending" && (
                      <Loader2 size={16} className="animate-spin" />
                    )}
                    Recevoir le lien magique
                  </Pill>
                </>
              )}
            </div>
          </ScreenShell>
        )}

        {screen === "intro" && (
          <ScreenShell
            gradient={GRAD.pink}
            top={<Logo />}
            bottom={
              <div className="flex items-center gap-4">
                <BackArrow onClick={goBack} />
                <Pill onClick={() => goTo("entryChoice")} className="flex-1 text-center">
                  page suivante
                </Pill>
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-6 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <Sparkles size={64} className="text-white" />
              </div>
              <h2 className="text-white text-2xl font-semibold leading-tight">
                Répondez à quelques
                <br />
                questions
              </h2>
              <p className="text-white/95 text-sm leading-relaxed">
                Notre algorithme analyse votre type de peau et vos
                préférences pour vous proposer les produits et les routines
                soins du visage, qui vous correspondent le mieux.
              </p>
            </div>
          </ScreenShell>
        )}

        {screen === "entryChoice" && (
          <ScreenShell
            gradient={GRAD.mint}
            top={<Logo />}
            bottom={
              <div className="flex items-center gap-4">
                <BackArrow onClick={goBack} />
                <div className="flex-1" />
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-8 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <span className="text-white text-4xl">🧭</span>
              </div>
              <h2 className="text-white text-2xl font-semibold leading-tight">
                Comment souhaitez-vous
                <br />
                commencer ?
              </h2>
              <div className="flex flex-col gap-4 w-full px-2">
                <button
                  onClick={() => {
                    setAnswers((a) => ({ ...a, entryPath: "diagnostic" }));
                    goTo("zone");
                  }}
                  className="bg-white/90 rounded-2xl px-5 py-4 text-left shadow-sm active:scale-95 transition"
                >
                  <p className="font-semibold text-neutral-900">
                    Diagnostic peau complet
                  </p>
                  <p className="text-xs text-neutral-600 mt-1">
                    Quelques questions sur votre peau pour la routine la plus
                    précise.
                  </p>
                </button>
                <button
                  onClick={() => {
                    setAnswers((a) => ({ ...a, entryPath: "produit" }));
                    goTo("zone");
                  }}
                  className="bg-white/90 rounded-2xl px-5 py-4 text-left shadow-sm active:scale-95 transition"
                >
                  <p className="font-semibold text-neutral-900">
                    Par type de produit
                  </p>
                  <p className="text-xs text-neutral-600 mt-1">
                    Sérum, crème, gel... partez du produit que vous cherchez.
                  </p>
                </button>
              </div>
            </div>
          </ScreenShell>
        )}

        {screen === "zone" && (
          <ScreenShell
            gradient={GRAD.sage}
            top={<Logo />}
            bottom={
              <div className="flex items-center gap-4">
                <BackArrow onClick={goBack} />
                <Pill
                  onClick={() =>
                    goTo(answers.entryPath === "produit" ? "format" : "age")
                  }
                  className="flex-1 text-center"
                >
                  page suivante
                </Pill>
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-8 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <span className="text-white text-4xl">🎯</span>
              </div>
              <h2 className="text-white text-2xl font-semibold leading-tight">
                Quelle zone souhaitez-vous
                <br />
                traiter ?
              </h2>
              <div className="flex gap-4 flex-wrap justify-center">
                {ZONE_OPTIONS.map((z) => (
                  <OptionCircle
                    key={z.key}
                    label={z.label}
                    selected={answers.zone === z.key}
                    onClick={() => setAnswers((a) => ({ ...a, zone: z.key }))}
                  >
                    <span className="text-2xl">{z.emoji}</span>
                  </OptionCircle>
                ))}
              </div>
            </div>
          </ScreenShell>
        )}

        {screen === "format" && (
          <ScreenShell
            gradient={GRAD.pink}
            top={<Logo />}
            bottom={
              <div className="flex items-center gap-4">
                <BackArrow onClick={goBack} />
                <Pill onClick={() => goTo("quickConcern")} className="flex-1 text-center">
                  page suivante
                </Pill>
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-8 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <span className="text-white text-4xl">🧴</span>
              </div>
              <h2 className="text-white text-2xl font-semibold leading-tight">
                Quel type de produit
                <br />
                cherchez-vous ?
              </h2>
              <div className="flex gap-4 flex-wrap justify-center">
                {FORMAT_OPTIONS.map((f) => (
                  <OptionCircle
                    key={f.key}
                    label={f.label}
                    selected={answers.format === f.key}
                    onClick={() =>
                      setAnswers((a) => ({ ...a, format: f.key }))
                    }
                  >
                    <span className="text-2xl">{f.emoji}</span>
                  </OptionCircle>
                ))}
              </div>
            </div>
          </ScreenShell>
        )}

        {screen === "quickConcern" && (
          <ScreenShell
            gradient={GRAD.teal}
            top={<Logo />}
            bottom={
              <div className="flex items-center gap-4">
                <BackArrow onClick={goBack} />
                <Pill onClick={() => goTo("congrats")} className="flex-1 text-center">
                  page suivante
                </Pill>
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-8 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <span className="text-white text-4xl">✦</span>
              </div>
              <h2 className="text-white text-2xl font-semibold leading-tight">
                Quelle problématique
                <br />
                souhaitez-vous traiter ?
              </h2>
              <div className="flex gap-4 flex-wrap justify-center">
                {QUICK_CONCERN_OPTIONS.map((t) => (
                  <OptionCircle
                    key={t}
                    label={t}
                    selected={answers.concerns.includes(t)}
                    onClick={() => toggleMulti("concerns", t)}
                  >
                    <Sun size={22} className="text-white" />
                  </OptionCircle>
                ))}
              </div>
            </div>
          </ScreenShell>
        )}

        {screen === "age" && (
          <ScreenShell
            gradient={GRAD.sage}
            top={<Logo />}
            bottom={
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <BackArrow onClick={goBack} />
                  <Pill onClick={() => goTo("tone")} className="flex-1 text-center">
                    page suivante
                  </Pill>
                </div>
                <ProgressBar step={quizIndex + 1} total={QUIZ_STEPS.length} />
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-8 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <Eye size={56} className="text-white" />
              </div>
              <h2 className="text-white text-2xl font-semibold">
                Quel est votre âge:
              </h2>
              <input
                value={answers.age}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, age: e.target.value }))
                }
                placeholder="ex. 28"
                className="w-48 text-center px-4 py-3 rounded-2xl border-2 border-black/70 outline-none text-neutral-800"
              />
            </div>
          </ScreenShell>
        )}

        {screen === "tone" && (
          <ScreenShell
            gradient={GRAD.teal}
            top={<Logo />}
            bottom={
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <BackArrow onClick={goBack} />
                  <Pill onClick={() => goTo("type")} className="flex-1 text-center">
                    page suivante
                  </Pill>
                </div>
                <ProgressBar step={quizIndex + 1} total={QUIZ_STEPS.length} />
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-8 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <Sun size={56} className="text-white" />
              </div>
              <h2 className="text-white text-2xl font-semibold">
                Votre peau est:
              </h2>
              <div className="flex gap-6">
                {SKIN_TONES.map((t) => (
                  <OptionCircle
                    key={t}
                    label={t}
                    selected={answers.tone === t}
                    onClick={() => setAnswers((a) => ({ ...a, tone: t }))}
                  >
                    <Sun size={26} className="text-white" />
                  </OptionCircle>
                ))}
              </div>
            </div>
          </ScreenShell>
        )}

        {screen === "type" && (
          <ScreenShell
            gradient={GRAD.pink}
            top={<Logo />}
            bottom={
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <BackArrow onClick={goBack} />
                  <Pill
                    onClick={() =>
                      goTo(
                        answers.zone === "visage" || answers.zone === "zone_t"
                          ? "pores"
                          : "concerns"
                      )
                    }
                    className="flex-1 text-center"
                  >
                    page suivante
                  </Pill>
                </div>
                <ProgressBar step={quizIndex + 1} total={QUIZ_STEPS.length} />
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-8 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <span className="text-white text-6xl font-bold">T</span>
              </div>
              <h2 className="text-white text-2xl font-semibold">
                Votre peau a tendance à être:
              </h2>
              <div className="flex gap-6">
                {SKIN_TYPES.map((t) => (
                  <OptionCircle
                    key={t}
                    label={t}
                    selected={answers.type === t}
                    onClick={() => setAnswers((a) => ({ ...a, type: t }))}
                  >
                    <Sun size={26} className="text-white" />
                  </OptionCircle>
                ))}
              </div>
            </div>
          </ScreenShell>
        )}

        {screen === "pores" && (
          <ScreenShell
            gradient={GRAD.sage}
            top={<Logo />}
            bottom={
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <BackArrow onClick={goBack} />
                  <Pill onClick={() => goTo("concerns")} className="flex-1 text-center">
                    page suivante
                  </Pill>
                </div>
                <ProgressBar step={quizIndex + 1} total={QUIZ_STEPS.length} />
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-8 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <span className="text-white text-4xl">◍</span>
              </div>
              <h2 className="text-white text-2xl font-semibold">
                Votre peau a les pores:
              </h2>
              <div className="flex gap-6">
                {PORES.map((t) => (
                  <OptionCircle
                    key={t}
                    label={t}
                    selected={answers.pores === t}
                    onClick={() => setAnswers((a) => ({ ...a, pores: t }))}
                  >
                    <Sun size={26} className="text-white" />
                  </OptionCircle>
                ))}
              </div>
            </div>
          </ScreenShell>
        )}

        {screen === "concerns" && (
          <ScreenShell
            gradient={GRAD.teal}
            top={<Logo />}
            bottom={
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <BackArrow onClick={goBack} />
                  <Pill onClick={() => goTo("routine")} className="flex-1 text-center">
                    page suivante
                  </Pill>
                </div>
                <ProgressBar step={quizIndex + 1} total={QUIZ_STEPS.length} />
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-8 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <span className="text-white text-4xl">✦</span>
              </div>
              <h2 className="text-white text-2xl font-semibold">
                Votre peau est sujette à:
              </h2>
              <div className="flex gap-6 flex-wrap justify-center">
                {CONCERN_OPTIONS.map((t) => (
                  <OptionCircle
                    key={t}
                    label={t}
                    selected={answers.concerns.includes(t)}
                    onClick={() => toggleMulti("concerns", t)}
                  >
                    <Sun size={26} className="text-white" />
                  </OptionCircle>
                ))}
              </div>
            </div>
          </ScreenShell>
        )}

        {screen === "routine" && (
          <ScreenShell
            gradient={GRAD.pink}
            top={<Logo />}
            bottom={
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <BackArrow onClick={goBack} />
                  <Pill onClick={() => goTo("style")} className="flex-1 text-center">
                    page suivante
                  </Pill>
                </div>
                <ProgressBar step={quizIndex + 1} total={QUIZ_STEPS.length} />
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-8 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <span className="text-white text-4xl">🧴</span>
              </div>
              <h2 className="text-white text-2xl font-semibold leading-tight">
                Que souhaitez-vous
                <br />
                pour votre peau ?
              </h2>
              <div className="flex gap-4 flex-wrap justify-center">
                {ROUTINE_OPTIONS.map((t) => (
                  <OptionCircle
                    key={t}
                    label={t}
                    selected={answers.routine.includes(t)}
                    onClick={() => toggleMulti("routine", t)}
                  >
                    <Sun size={24} className="text-white" />
                  </OptionCircle>
                ))}
              </div>
            </div>
          </ScreenShell>
        )}

        {screen === "style" && (
          <ScreenShell
            gradient={GRAD.mint}
            top={<Logo />}
            bottom={
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <BackArrow onClick={goBack} />
                  <Pill onClick={() => goTo("congrats")} className="flex-1 text-center">
                    page suivante
                  </Pill>
                </div>
                <ProgressBar step={quizIndex + 1} total={QUIZ_STEPS.length} />
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-8 mt-6">
              <div className="w-52 h-52 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center">
                <span className="text-white text-4xl">✨</span>
              </div>
              <h2 className="text-white text-2xl font-semibold leading-tight">
                Quel style de routine
                <br />
                vous inspire ?
              </h2>
              <div className="flex gap-4 flex-wrap justify-center">
                {STYLE_OPTIONS.map((s) => (
                  <OptionCircle
                    key={s.key}
                    label={s.label}
                    selected={answers.style === s.key}
                    onClick={() =>
                      setAnswers((a) => ({ ...a, style: s.key }))
                    }
                  >
                    <span className="text-2xl">{s.emoji}</span>
                  </OptionCircle>
                ))}
              </div>
              <p className="text-white/90 text-xs px-2">
                {ROUTINE_META[answers.style].tip}
              </p>
            </div>
          </ScreenShell>
        )}

        {screen === "congrats" && (
          <ScreenShell
            gradient={GRAD.mint}
            top={<Logo />}
            bottom={
              <div className="flex items-center gap-4">
                <BackArrow onClick={goBack} />
                <Pill onClick={() => goTo("products")} className="flex-1 text-center">
                  page suivante
                </Pill>
              </div>
            }
          >
            <div className="flex flex-col items-center text-center gap-6 mt-6">
              <div className="w-40 h-52 rounded-[2rem] bg-white flex items-center justify-center overflow-hidden shadow-lg">
                <Sparkles size={56} className="text-pink-400" />
              </div>
              <h2 className="text-white text-2xl font-semibold">
                Félicitations {answers.firstName} !
              </h2>
              <p className="text-white/95 text-sm leading-relaxed">
                D'après vos réponses, voici une sélection de produits
                spécialement conçus pour vous.
              </p>
              <p className="text-white/95 text-sm leading-relaxed">
                Vous trouverez également tous nos conseils pour prendre soin
                de votre peau au quotidien.
              </p>
            </div>
          </ScreenShell>
        )}

        {screen === "products" && (
          <div className="w-full h-full flex flex-col bg-gradient-to-b from-[#e6a9c2] to-[#f0c79a] relative">
            <div className="flex items-center justify-between px-6 pt-6">
              <Logo />
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-lg">
                🙂
              </div>
            </div>
            <div className="px-6 pt-5">
              <div className="bg-[#bfe9dd] text-pink-500 font-bold text-center py-3 rounded-full text-lg">
                {zoneProducts.length === 0 && answers.zone
                  ? "Aucun produit pour cette zone"
                  : `${displayedProducts[0]?.pct ?? rankedProducts[0]?.pct ?? 0}% match`}
              </div>
              <p className="text-center text-sm text-neutral-800 mt-2">
                Nos produits{" "}
                {answers.zone &&
                  `— ${ZONE_OPTIONS.find((z) => z.key === answers.zone)?.label} — `}
                {answers.style !== "classique" &&
                  `— ${STYLE_OPTIONS.find((s) => s.key === answers.style)?.label} — `}
                {answers.format &&
                  `— ${FORMAT_LABELS[answers.format]} — `}
                recommandés selon le pourcentage de pertinence.
              </p>
              <div className="flex items-center justify-between mt-4 text-neutral-800 relative">
                <button
                  onClick={() => {
                    setShowSortMenu((v) => !v);
                    setShowFilterPanel(false);
                  }}
                  className="flex items-center gap-1 text-sm"
                >
                  <span>Trier par</span>
                  <span className="font-serif italic">
                    {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}
                  </span>
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => {
                    setShowFilterPanel((v) => !v);
                    setShowSortMenu(false);
                  }}
                  className="relative w-9 h-9 rounded-md bg-black flex items-center justify-center"
                >
                  <Filter size={16} className="text-white" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {showSortMenu && (
                  <div className="absolute left-0 top-8 z-30 bg-white rounded-xl shadow-lg py-1 w-44 text-sm">
                    {SORT_OPTIONS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => {
                          setSortBy(s.key);
                          setShowSortMenu(false);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-pink-50 ${
                          sortBy === s.key
                            ? "text-pink-600 font-semibold"
                            : "text-neutral-800"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 mt-3 space-y-5">
              {zoneProducts.length === 0 && answers.zone ? (
                <div className="text-center mt-8 px-2">
                  <p className="text-sm text-neutral-800 mb-3">
                    Nous n'avons pas encore de produits dédiés à «{" "}
                    {ZONE_OPTIONS.find((z) => z.key === answers.zone)?.label}{" "}
                    » dans notre catalogue.
                  </p>
                  <button
                    onClick={() => goTo("zone")}
                    className="underline text-pink-600 text-sm font-medium"
                  >
                    Choisir une autre zone
                  </button>
                </div>
              ) : (
                displayedProducts.length === 0 && (
                  <p className="text-center text-sm text-neutral-700 mt-8">
                    Aucun produit ne correspond à ces filtres.{" "}
                    <button
                      onClick={resetFilters}
                      className="underline text-pink-600"
                    >
                      Réinitialiser
                    </button>
                  </p>
                )
              )}
              {displayedProducts.map(({ product: p, pct }) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProductId(p.id);
                    goTo("detail");
                  }}
                  className="w-full flex items-center gap-4 text-left"
                >
                  <div className="w-16 h-20 rounded-md bg-white shadow flex items-center justify-center shrink-0 text-2xl">
                    🧴
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-serif text-lg text-neutral-900 leading-tight">
                        {p.name}
                      </p>
                      <span className="text-[10px] font-bold text-pink-600 bg-pink-100 rounded-full px-2 py-0.5 shrink-0">
                        {pct}%
                      </span>
                    </div>
                    <p className="text-xs text-neutral-700">{p.brand}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-neutral-900">
                      <ShoppingCart size={14} />
                      <span>Add to List</span>
                      <span className="ml-auto font-medium">
                        {p.price.toFixed(2)}€
                      </span>
                    </div>
                  </div>
                  <div
                    className="flex flex-col items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button onClick={() => toggleLike(p.id)}>
                      <Heart
                        size={20}
                        className={
                          liked[p.id]
                            ? "text-red-500 fill-red-500"
                            : "text-neutral-700"
                        }
                      />
                    </button>
                    <Bookmark size={18} className="text-neutral-700" />
                  </div>
                </button>
              ))}
            </div>
            <div className="px-6 pb-6 pt-3 flex items-center gap-4">
              <BackArrow onClick={goBack} />
              {zoneProducts.length === 0 && answers.zone ? (
                <Pill onClick={() => goTo("zone")} className="flex-1 text-center">
                  Choisir une autre zone
                </Pill>
              ) : (
                <Pill
                  onClick={() => {
                    setSelectedProductId(
                      (displayedProducts[0] || rankedProducts[0])?.product.id
                    );
                    goTo("detail");
                  }}
                  className="flex-1 text-center"
                >
                  page suivante
                </Pill>
              )}
            </div>

            {showFilterPanel && (
              <div className="absolute inset-0 z-40 flex flex-col justify-end">
                <div
                  className="absolute inset-0 bg-black/30"
                  onClick={() => setShowFilterPanel(false)}
                />
                <div className="relative bg-white rounded-t-3xl px-6 pt-5 pb-6 max-h-[80%] overflow-y-auto">
                  <div className="w-10 h-1.5 bg-neutral-300 rounded-full mx-auto mb-4" />
                  <p className="font-semibold text-neutral-900 mb-3">
                    Catégorie
                  </p>
                  <div className="flex gap-2 flex-wrap mb-5">
                    {CATEGORY_FILTER_OPTIONS.map((c) => (
                      <button
                        key={c.key}
                        onClick={() =>
                          toggleFilter(setFilterCategories)(c.key)
                        }
                        className={`px-3 py-1.5 rounded-full text-xs border ${
                          filterCategories.includes(c.key)
                            ? "bg-pink-500 text-white border-pink-500"
                            : "border-neutral-300 text-neutral-700"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  <p className="font-semibold text-neutral-900 mb-3">
                    Format
                  </p>
                  <div className="flex gap-2 flex-wrap mb-5">
                    {FORMAT_OPTIONS.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => toggleFilter(setFilterFormats)(f.key)}
                        className={`px-3 py-1.5 rounded-full text-xs border ${
                          filterFormats.includes(f.key)
                            ? "bg-pink-500 text-white border-pink-500"
                            : "border-neutral-300 text-neutral-700"
                        }`}
                      >
                        {f.emoji} {f.label}
                      </button>
                    ))}
                  </div>

                  <p className="font-semibold text-neutral-900 mb-2">
                    Prix maximum : {maxPrice}€
                  </p>
                  <input
                    type="range"
                    min={0}
                    max={priceCeiling}
                    step={1}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full accent-pink-500 mb-6"
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={resetFilters}
                      className="flex-1 py-3 rounded-full border border-neutral-300 text-neutral-700 text-sm font-medium"
                    >
                      Réinitialiser
                    </button>
                    <Pill
                      onClick={() => setShowFilterPanel(false)}
                      className="flex-1 text-center"
                    >
                      Voir {displayedProducts.length} résultat
                      {displayedProducts.length > 1 ? "s" : ""}
                    </Pill>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {screen === "detail" && selectedProduct && (
          <div className="w-full h-full flex flex-col bg-gradient-to-b from-[#8fd9c9] to-[#d9c79f] overflow-y-auto">
            <div className="px-6 pt-6">
              <Logo />
            </div>
            <div className="px-6 pt-4">
              <h2 className="text-2xl font-serif text-neutral-900">
                Détail du produit
              </h2>
              <div className="flex gap-4 mt-4">
                <div className="w-24 h-32 rounded-md bg-white shadow flex items-center justify-center text-3xl shrink-0">
                  🧴
                </div>
                <div>
                  <p className="font-serif text-xl text-neutral-900 leading-tight">
                    {selectedProduct.name}
                  </p>
                  <p className="text-xs text-neutral-700">
                    {selectedProduct.brand} ·{" "}
                    {FORMAT_LABELS[selectedProduct.format] || "Soin"} ·{" "}
                    {selectedProduct.price.toFixed(2)}€
                    {selectedProduct.priceConfirmed === false && " (prix à confirmer)"}
                  </p>
                  {selectedProduct.keyIngredients?.length > 0 && (
                    <>
                      <p className="text-sm text-neutral-700 mt-2">
                        Ingrédients remarquables
                      </p>
                      <p className="font-semibold text-neutral-900 text-sm">
                        {selectedProduct.keyIngredients.join(", ")}
                      </p>
                    </>
                  )}
                  <div className="flex items-center gap-2 mt-4 text-blue-800 text-sm">
                    <Sparkles size={16} />
                    <button
                      className="underline"
                      onClick={() => goTo("myRoutine")}
                    >
                      Votre routine personnalisée
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-blue-800 text-sm">
                    <ShoppingCart size={16} />
                    <button
                      className="underline"
                      onClick={() => goTo("stores")}
                    >
                      Où l'acheter
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-6 text-neutral-900 gap-4">
                <div>
                  <p className="font-semibold mb-2">Pourquoi ce match ?</p>
                  {explainMatch(selectedProduct, answers).map((reason, i) => (
                    <p key={i} className="text-sm flex items-start gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      {reason}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="font-semibold mb-2">Style de vie</p>
                  {selectedProduct.lifestyle?.length > 0 ? (
                    selectedProduct.lifestyle.map((l) => (
                      <p key={l} className="text-sm flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        {l.replace(/_/g, " ")}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-neutral-600">
                      Non renseigné pour ce produit
                    </p>
                  )}
                </div>
              </div>

              {selectedProduct.note && (
                <p className="mt-4 text-xs text-neutral-700 italic">
                  {selectedProduct.note}
                </p>
              )}

              <p className="mt-6 text-sm text-neutral-800 font-bold">
                Produits associés avec pourcentage de pertinence
              </p>
              <div className="flex gap-3 mt-2">
                {relatedProducts.map(({ product: r, pct }) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedProductId(r.id)}
                    className="relative w-20 h-24 rounded-lg bg-white shadow flex items-center justify-center text-[10px] text-center px-1"
                  >
                    <span className="absolute -top-2 -right-2 text-[10px] font-bold text-white w-8 h-8 rounded-full flex items-center justify-center bg-pink-500">
                      {pct}%
                    </span>
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6 pt-6 flex items-center gap-4">
              <BackArrow onClick={goBack} />
              <Pill onClick={() => goTo("myRoutine")} className="flex-1 text-center">
                page suivante
              </Pill>
            </div>
          </div>
        )}

        {screen === "myRoutine" && (
          <div className="w-full h-full flex flex-col bg-gradient-to-b from-[#63e2cf] to-[#a9dcc0] overflow-y-auto">
            <div className="px-6 pt-6">
              <Logo />
            </div>
            <div className="px-6 pt-4 text-center">
              <h2 className="text-2xl font-serif text-neutral-900">
                Votre routine
                <br />
                {STYLE_OPTIONS.find((s) => s.key === answers.style)?.label ||
                  "personnalisée"}
              </h2>
              <a
                href="https://www.youtube.com/watch?v=hKmkPSsrcaM"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 rounded-xl overflow-hidden relative block aspect-video group"
              >
                <img
                  src="https://img.youtube.com/vi/hKmkPSsrcaM/hqdefault.jpg"
                  alt="Vidéo : les bases d'une routine de nettoyage du visage"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-active:bg-black/40">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <span className="text-2xl text-neutral-900 ml-0.5">▶</span>
                  </div>
                </div>
                <span className="absolute bottom-1.5 left-2 text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded">
                  Routine de nettoyage — les bases
                </span>
              </a>
              <div className="flex justify-around mt-4 text-xs text-neutral-800">
                <button
                  className="flex flex-col items-center gap-1"
                  onClick={() => goTo("detail")}
                >
                  <Plus size={20} className="text-lime-500" />
                  Spécificité
                </button>
                <div className="flex flex-col items-center gap-1">
                  <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[10px] font-bold">
                    {(ROUTINE_META[answers.style] || ROUTINE_META.classique).duration}
                  </span>
                  Durée routine
                </div>
                <button
                  className="flex flex-col items-center gap-1"
                  onClick={() => goTo("calendar")}
                >
                  <span>📅</span>
                  Votre calendrier
                </button>
              </div>
              <p className="text-[11px] text-neutral-700 mt-3 px-2">
                {(ROUTINE_META[answers.style] || ROUTINE_META.classique).tip}
              </p>

              <div className="grid grid-cols-3 gap-3 mt-6 text-left">
                <div>
                  <p className="bg-pink-300 text-white text-center rounded-full py-1 font-bold text-sm mb-2">
                    Matin
                  </p>
                  {routineProductPicks.map((p, i) => (
                    <div key={i} className="mb-2.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-4 h-4 rounded-full border border-neutral-700 flex items-center justify-center text-[9px] shrink-0">
                          {i + 1}
                        </span>
                        <div className="w-9 h-11 bg-white rounded shadow overflow-hidden flex items-center justify-center shrink-0">
                          {p?.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-base">{formatEmoji(p)}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[8px] text-neutral-700 leading-tight line-clamp-2">
                        {p?.name || "—"}
                      </p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="bg-pink-300 text-white text-center rounded-full py-1 font-bold text-sm mb-2">
                    Soir
                  </p>
                  {routineProductPicks.map((p, i) => (
                    <div key={i} className="mb-2.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-4 h-4 rounded-full border border-neutral-700 flex items-center justify-center text-[9px] shrink-0">
                          {i + 1}
                        </span>
                        <div className="w-9 h-11 bg-white rounded shadow overflow-hidden flex items-center justify-center shrink-0">
                          {p?.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-base">{formatEmoji(p)}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[8px] text-neutral-700 leading-tight line-clamp-2">
                        {p?.name || "—"}
                      </p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="bg-pink-300 text-white text-center rounded-full py-1 font-bold text-sm mb-2">
                    Extra
                  </p>
                  <div className="flex flex-col items-center gap-1 text-[10px] text-neutral-800 mb-3">
                    <Eye size={18} />
                    éviter contours oeil
                  </div>
                  <div className="flex flex-col items-center gap-1 text-[10px] text-neutral-800 mb-3">
                    <Snowflake size={18} />
                    Conserver au frais
                  </div>
                  <div className="flex flex-col items-center gap-1 text-[10px] text-neutral-800">
                    <Recycle size={18} />
                    Bac tri jaune
                  </div>
                </div>
              </div>
              <p className="text-xs text-neutral-800 mt-4">
                En cas de problèmes consulter rapidement votre médecin
                traitant.
              </p>
            </div>
            <div className="px-6 pb-6 pt-6 flex items-center gap-4">
              <BackArrow onClick={goBack} />
              <Pill onClick={() => goTo("calendar")} className="flex-1 text-center">
                page suivante
              </Pill>
            </div>
          </div>
        )}

        {screen === "calendar" && (
          <ScreenShell
            gradient={GRAD.pink}
            top={<Logo />}
            bottom={
              <div className="flex items-center gap-4">
                <BackArrow onClick={goBack} />
                <Pill onClick={() => goTo("stores")} className="flex-1 text-center">
                  page suivante
                </Pill>
              </div>
            }
          >
            <div className="flex flex-col gap-5 mt-2">
              <h2 className="text-white text-xl font-semibold">
                votre calendrier
              </h2>
              <p className="text-white/95 text-sm">
                Saisissez la date de début et la date prévue de fin de
                routine.
              </p>
              <div className="flex flex-col gap-3">
                <label className="text-white text-sm">
                  Début
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl text-neutral-800"
                  />
                </label>
                <label className="text-white text-sm">
                  Fin
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl text-neutral-800"
                  />
                </label>
              </div>
              <div className="flex items-start gap-2 mt-4">
                <div className="bg-pink-200 rounded-2xl rounded-bl-none px-3 py-2 text-xs text-neutral-800">
                  •••
                </div>
                <div className="bg-teal-200 rounded-2xl rounded-br-none px-3 py-2 text-xs text-neutral-800 flex-1">
                  Vous recevrez une notification pour vous rappeler de suivre
                  votre routine et pour vous rappeler la date de fin du
                  protocole de soin.
                </div>
              </div>
            </div>
          </ScreenShell>
        )}

        {screen === "stores" && (
          <ScreenShell
            gradient={GRAD.sage}
            top={<Logo />}
            bottom={
              <div className="flex items-center gap-4">
                <BackArrow onClick={goBack} />
                <Pill onClick={restart} className="flex-1 text-center">
                  recommencer
                </Pill>
              </div>
            }
          >
            <div className="flex flex-col gap-4">
              <h2 className="text-neutral-900 text-xl font-semibold">
                Où shoper tes produits
              </h2>
              <div className="flex items-center gap-2 bg-white/80 rounded-full px-4 py-3">
                <MapPin size={16} className="text-neutral-600 shrink-0" />
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchStoresNearby()}
                  placeholder="Chercher ville, rue, code postal..."
                  className="bg-transparent outline-none text-sm flex-1 text-neutral-800"
                />
                <button
                  onClick={searchStoresNearby}
                  disabled={!city.trim()}
                  className="text-xs font-medium text-pink-600 disabled:text-neutral-400 shrink-0"
                >
                  Rechercher
                </button>
              </div>
              <p className="text-xs text-neutral-800">
                Localiser un magasin dans un rayon de 30 Km
              </p>
              <div className="rounded-xl bg-neutral-900 text-white divide-y divide-white/10 overflow-hidden">
                {STORES.map((s) => (
                  <div key={s.name} className="p-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-xs text-white/70">{s.addr}</p>
                      <p className="text-xs text-green-400">{s.hours}</p>
                    </div>
                    <a
                      href={directionsUrl(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-300 underline shrink-0"
                    >
                      Itinéraire
                    </a>
                  </div>
                ))}
              </div>

              {user && (
                <div className="flex items-center justify-between bg-white/70 rounded-xl px-4 py-2.5 mt-2">
                  <p className="text-xs text-neutral-800">
                    Connecté(e) en tant que <strong>{user.email}</strong>
                  </p>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-1 text-xs text-neutral-700 shrink-0"
                  >
                    <LogOut size={14} />
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </ScreenShell>
        )}
        {["products", "detail", "myRoutine", "calendar", "stores"].includes(
          screen
        ) && <FloatingChatButton onClick={openChat} />}

        {screen === "chat" && (
          <div className="w-full h-full flex flex-col bg-gradient-to-b from-[#f6dfe8] to-[#fbeedd]">
            <div className="flex items-center gap-3 px-5 pt-6 pb-4 bg-white/60 backdrop-blur">
              <BackArrow onClick={goBack} />
              <div className="w-10 h-10 rounded-full bg-pink-400 flex items-center justify-center text-white font-semibold">
                L
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900 flex items-center gap-1">
                  Léa · Conseillère beauté
                  <BadgeCheck size={14} className="text-pink-500" />
                </p>
                <p className="text-[11px] text-neutral-600">
                  Assistée par IA · formée en cosmétique
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${
                    m.from === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm leading-snug ${
                      m.from === "user"
                        ? "bg-pink-400 text-white rounded-br-none"
                        : "bg-white text-neutral-800 rounded-bl-none shadow-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
              {CHAT_QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="shrink-0 text-xs px-3 py-2 rounded-full bg-white text-neutral-700 shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="px-4 pb-6 pt-2 flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(chatInput)}
                placeholder="Écrivez votre question..."
                className="flex-1 px-4 py-3 rounded-full bg-white text-sm text-neutral-800 outline-none shadow-sm"
              />
              <button
                onClick={() => sendMessage(chatInput)}
                className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ background: PINK }}
                aria-label="Envoyer"
              >
                <Send size={18} className="text-white" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
