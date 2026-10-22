# Échiquier

Application d’échecs mobile-first, installable comme PWA sur iPhone et jouable hors ligne.

## Lancer le prototype

```bash
npm install
npm run dev
```

Sur l’ordinateur : `http://localhost:5173`  
Sur un iPhone connecté au même Wi‑Fi : `http://192.168.1.13:5173`

L’adresse IP peut changer selon le réseau. Le serveur Vite est configuré pour écouter sur le réseau local (`0.0.0.0`).

## Installer sur iPhone

La première installation doit se faire avec une connexion Internet sur un hébergement HTTPS :

1. ouvrir l’application dans Safari ;
2. utiliser **Partager → Ajouter à l’écran d’accueil** ;
3. lancer ensuite l’application depuis son icône, même en mode avion.

Le service worker met en cache l’interface, les dépendances et les puzzles. Le serveur Vite en HTTP sur le réseau local est pratique pour tester l’interface, mais ne permet pas une installation PWA hors ligne fiable sur iOS.

## Publier avec GitHub Pages

Le workflow GitHub Actions publie automatiquement le dossier `dist` à chaque push sur `main`. Pour ce projet, l’adresse sera `https://ledracarnos.github.io/echiquier-pwa/` une fois le workflow terminé.

## Fonctionnalités

- Échiquier tactile responsive avec Chessground
- Validation des coups avec chess.js
- 500 casse-têtes locaux issus de la base Lichess : 500 mats en 2 avec 3 à 10 pièces
- Le nombre de pièces est calculé depuis le FEN de la position affichée puis conservé dans chaque entrée
- Validation des lignes de solution et défense automatique dans les mats en 2
- Notation des coups, progression, recommencer, passer et retournement de l’échiquier
- Aucun compte Apple ou abonnement développeur requis

## Actualiser les casse-têtes

Le script utilise l’export officiel de la base de puzzles Lichess sous licence CC0 :

```bash
npm run puzzles:fetch
```

Le fichier compressé est décompressé par blocs. Le script conserve les 500 mats en 2 les plus faciles selon leur classement, avec 3 à 10 pièces dans la position présentée au joueur.

## Vérifier la production

```bash
npm run build
```
