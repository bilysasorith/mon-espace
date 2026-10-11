# Mon espace

Site perso : pense-bête, objectifs, finances mensuelles et recherches (benchmarks).

- Site statique (HTML/CSS/JS, sans build), prévu pour GitHub Pages.
- Les données restent dans le navigateur (localStorage). Page « Données » : export/import JSON pour sauvegarder ou consulter sur le téléphone, export CSV des finances.
- Finances : saisie à la main, ou import d'un relevé bancaire CSV (colonnes choisies à l'import, catégories devinées par mots-clés, doublons ignorés).

## Lancer en local

Ouvrir `index.html` dans le navigateur, ou `python3 -m http.server 8000`.

## Publier sur GitHub Pages

Settings → Pages → Source « Deploy from a branch » → branche `main`, dossier `/ (root)`.
