import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

// En dev, si les variables ne sont pas encore configurées, on log un avertissement
// clair plutôt que de planter silencieusement — pratique pendant la mise en place.
if (!supabaseConfigured) {
  console.warn(
    "[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes. " +
      "L'app fonctionne quand même en mode local (catalogue statique, pas de compte)." +
      " Copie .env.example vers .env.local et renseigne tes clés pour activer Supabase."
  );
}

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key"
);
