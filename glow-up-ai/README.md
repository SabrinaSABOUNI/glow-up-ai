# Glow Up AI — projet Vite

Ceci est un vrai projet React (Vite + Tailwind), pas un aperçu isolé : les
imports entre fichiers (`GlowUpAI.jsx` → `matching-engine.js` / `catalog.js`)
fonctionnent normalement ici.

L'app fonctionne dans les deux cas :
- **Sans Supabase configuré** → catalogue local (`src/catalog.js`), pas de
  compte, favoris/réponses en mémoire seulement (perdus au refresh).
- **Avec Supabase configuré** → catalogue en direct depuis la base, compte
  par lien magique (email), favoris et réponses au quiz sauvegardés.

## 1. Installer et lancer en local

```bash
npm install
npm run dev
```

Ouvre l'URL affichée (en général http://localhost:5173).

## 2. Brancher Supabase (recommandé)

**a) Crée un projet sur [supabase.com](https://supabase.com)** (gratuit).

**b) Récupère tes clés** : Project Settings → API :
- `Project URL`
- `anon public` key
- `service_role` key (⚠️ secrète, jamais dans le front)

**c)**
```bash
cp .env.example .env.local
```
Remplis `.env.local` avec tes vraies valeurs.

**d) Crée les tables** : Dashboard → SQL Editor → colle `supabase/schema.sql` → Run.
Ça crée `products` (lecture publique), `quiz_answers` et `favorites` (chacune
protégée par RLS, un utilisateur ne voit que ses propres lignes).

**e) Remplis le catalogue :**
```bash
npm run seed
```

**f) Active l'authentification par email** : Dashboard → Authentication →
Providers → active "Email". Le flux utilisé ici est le **lien magique**
(pas de mot de passe) : `supabase.auth.signInWithOtp({ email })`.

**g) Autorise l'URL de redirection** : Authentication → URL Configuration →
ajoute `http://localhost:5173` (dev) et, plus tard, ton URL de prod une fois
déployée — sinon le lien magique redirigera vers une page d'erreur.

## 3. Ce qui est câblé maintenant

✅ **3 parcours d'entrée** :
- Diagnostic complet (à la maison, précis)
- Mode Express (3 questions, pensé pour un usage en magasin)
- Scanner un produit (façon Yuka — voir section 5)

✅ **Catalogue par magasin** — si l'app est ouverte avec `?store=<uuid>` dans
l'URL (le lien encodé dans un QR code affiché en rayon), elle ne recommande
QUE les produits que CE magasin a réellement en stock (table
`store_products`), pas le catalogue national entier. Sans ce paramètre,
comportement inchangé (catalogue complet). Pour créer un magasin de démo :
`npm run seed:stores`.

✅ **Authentification** — écran "Se connecter" (lien magique), état persistant
via `useAuth()` (`src/lib/useAuth.js`), déconnexion depuis l'écran pharmacies.

✅ **Catalogue en direct** — `useProducts()` (`src/lib/useProducts.js`) va
chercher les produits dans Supabase ; si Supabase n'est pas configuré ou
indisponible, l'app retombe automatiquement sur `catalog.js` sans planter.

✅ **Persistance par utilisateur** — dès qu'un compte est connecté :
- les réponses au quiz sont sauvegardées dans `quiz_answers` à l'arrivée sur
  l'écran de félicitations, et rechargées à la reconnexion ;
- chaque like (♥) est écrit/supprimé dans `favorites` en direct.
En mode invité (pas connecté), tout ça reste en mémoire locale uniquement —
rien n'est bloqué, mais rien n'est sauvegardé.

🔜 Pistes pour la suite : remplacer le lien magique par email/mot de passe
classique si tu préfères, ajouter une page "Mes favoris" dédiée, ou notifier
l'utilisateur par email à la fin de sa routine (`calendrier`).

## 5. Le scanner de code-barres (mode "façon Yuka")

Utilise `html5-qrcode` (caméra via le navigateur, fonctionne sur iOS Safari
contrairement à l'API native `BarcodeDetector`). Quand un code-barres est
scanné (ou saisi manuellement en repli si la caméra n'est pas accessible) :

1. Recherche d'abord dans notre catalogue (`products.ean`) → si trouvé,
   redirige directement vers la fiche produit avec le matching personnalisé
   et les produits associés.
2. Sinon, interroge **Open Beauty Facts** (API publique, licence ouverte
   ODbL, réutilisable commercialement) pour au moins identifier le produit.
3. Sinon, message honnête "produit non reconnu".

⚠️ **Point important** : aucun produit du catalogue n'a de vrai code-barres
renseigné pour l'instant (`ean: null` partout) — je n'en ai pas inventé.
Tant que ce champ n'est pas rempli (à la main, ou via l'API Open Beauty
Facts en vérifiant que le bon produit existe), le scanner passera presque
toujours par l'étape 2 ou 3 ci-dessus, jamais l'étape 1. C'est le prochain
vrai chantier de données à faire si tu veux que le scan soit utile en
pratique.

## 6. Déployer

Le projet est prêt pour un déploiement en un clic sur Vercel ou Netlify
(`netlify.toml` et `vercel.json` déjà présents). Le clic final t'appartient
puisqu'il faut lier ton propre compte — voici la procédure exacte.

### Option A — Vercel (recommandé, zero-config pour Vite)
1. Pousse ce dossier sur un repo GitHub.
2. Sur [vercel.com](https://vercel.com) → "Add New Project" → importe le repo.
3. Vercel détecte Vite automatiquement (build `npm run build`, output `dist`).
4. Dans Project Settings → Environment Variables, ajoute :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Déploie. Récupère l'URL générée (ex. `glow-up-ai.vercel.app`).
6. Retourne dans Supabase → Authentication → URL Configuration → ajoute
   cette URL à la liste des redirections autorisées (sinon le lien magique
   ne fonctionnera pas en prod).

Alternative en ligne de commande, depuis ce dossier :
```bash
npx vercel        # suit les instructions interactives, lie ton compte
npx vercel --prod # déploiement en production
```

### Option B — Netlify
- **Le plus rapide (sans compte Git)** : `npm run build` en local, puis
  glisse-dépose le dossier `dist/` généré sur
  [app.netlify.com/drop](https://app.netlify.com/drop).
- **Avec repo GitHub (recommandé pour les mises à jour automatiques)** :
  connecte le repo sur [app.netlify.com](https://app.netlify.com), Netlify
  lit `netlify.toml` automatiquement. Ajoute les mêmes variables d'env dans
  Site settings → Environment variables.
- Pense aussi à ajouter l'URL Netlify aux redirections autorisées dans
  Supabase (même étape que pour Vercel).

## Structure du projet

```
src/
  GlowUpAI.jsx        → le composant principal (tout le parcours utilisateur)
  matching-engine.js  → le moteur de matching à règles pondérées
  catalog.js          → le catalogue de produits (source de vérité locale / fallback)
  lib/
    supabaseClient.js → client Supabase + détection "configuré ou non"
    useAuth.js        → hook d'authentification (lien magique par email)
    useProducts.js    → hook de catalogue (Supabase, national OU par magasin, avec repli local)
    openBeautyFacts.js → repli pour le scanner si un produit scanné n'est pas dans notre catalogue
supabase/schema.sql   → à exécuter une fois dans le SQL Editor de Supabase
scripts/
  seed-products.mjs   → injecte catalog.js dans la table Supabase "products"
  seed-stores.mjs     → crée un magasin de démo + lui assigne des produits
netlify.toml, vercel.json → config de déploiement prêtes à l'emploi
```

