import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "./supabaseClient";

/**
 * Auth par lien magique (email, sans mot de passe) — le plus simple à
 * mettre en place côté Supabase (Authentication > Providers > Email).
 * Fonctionne aussi bien pour l'inscription que la connexion : Supabase
 * crée le compte automatiquement au premier lien cliqué.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email) => {
    if (!supabaseConfigured) {
      return { error: { message: "Supabase n'est pas encore configuré (.env.local manquant)." } };
    }
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
  };

  const signOut = () => supabase.auth.signOut();

  return { user, loading, signInWithEmail, signOut };
}
