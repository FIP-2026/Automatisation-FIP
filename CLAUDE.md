# FIP Études — consignes de développement

Site statique (GitHub Pages) d'outils de calcul de structure : Eurocodes + annexes nationales françaises, avec citation des paragraphes.

## Règle permanente : à chaque modification

Toute modification d'un outil (formule, valeur, nouvel outil, nouvelle option, changement d'interface) s'accompagne, dans le même commit, de la mise à jour de :

1. **Aide (« ? ») de l'outil** : `*/aide-*.js` ou le bloc `AIDE.init({...})` de la page (étapes, FAQ, lien `manuel`).
2. **Référentiel** : `referentiel/fiches.js` (fiches vulgarisées, table des normes) et `referentiel/schemas.js` si un schéma aide.
3. **Manuel technique / qualification** : `manuel/index.html` :
   - formules et exemples de contrôle du chapitre de l'outil ;
   - tests de validation en direct (fonction `tests()`) si un calcul change ou apparaît ;
   - ligne du **journal des modifications** (version, outil, nature, impact sur les résultats).
4. **Familles d'outils (accueil)** : à chaque ajout ou changement d'un outil, relire le nom et le résumé (`nom`, `sousTitre`) de sa famille dans `CALC_CATEGORIES` (`commun/apps.js`) et les renommer s'ils ne couvrent plus tous les outils (ex. « Tuyauterie » → « Tuyauterie et fluides » avec H1 ; « Actions climatiques et sismiques » → « Hypothèses de charges » avec G1, Q1, NH).
5. **Version** : `CALC_VERSION` dans `commun/apps.js` et tous les `?v=` (cache) des pages ; fiche de l'outil dans `commun/apps.js` (titre, description, vignette) si besoin.

## Règles pour les modules de calcul (ossature, assemblages et suivants)

- **Identification (trame)** : chaque module a une carte « Identification » saisissable dans le module (`commun/ident.js`, `IDENT.init({cible, cle})`), reprise dans le cartouche Word (`EXPORT.init({affaire:()=>IDENT.lire()})`) et l'en-tête d'impression ; pas de dépendance au cahier de supportage (reprise facultative par bouton).
- **Règles de conception et alertes** : chaque module affiche une carte « Règles de conception et alertes » (✔ / ⚠️ / ℹ️) : géométrie (angles de diagonales 30°–60°, nœuds de contreventement dans l'axe des pannes, pinces et entraxes, élancements…), dispositions constructives et limites du domaine.
- **Modules autonomes ou reliés** (à l'image de Robot) : un module (ex. assemblages) fonctionne seul et peut recevoir ses données d'un autre (A1 auvent, futur bâtiment fermé) par `localStorage` (`fip.<module>.pre`), avec un lien de retour.
- **Schémas** : vues 2D cotées avec les valeurs des charges du cas affiché, vue 3D avec les profilés, schémas des éléments secondaires (pannes, lisses).

## Autres règles

- Données confidentielles (base de prix, données client) : jamais dans ce dépôt public ; elles restent sur le réseau FIP / SharePoint.
- Valeurs normatives non vérifiées sur le texte : les signaler « à vérifier » dans l'outil et dans le manuel.
- Phase APS/APD : les plans et descentes de charges portent la mention « non valable pour exécution ».
- Tester chaque page modifiée dans le navigateur (Playwright) sans erreur console avant de committer.
