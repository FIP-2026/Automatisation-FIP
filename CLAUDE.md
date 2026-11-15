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
4. **Version** : `CALC_VERSION` dans `commun/apps.js` et tous les `?v=` (cache) des pages ; fiche de l'outil dans `commun/apps.js` (titre, description, vignette) si besoin.

## Autres règles

- Données confidentielles (base de prix, données client) : jamais dans ce dépôt public ; elles restent sur le réseau FIP / SharePoint.
- Valeurs normatives non vérifiées sur le texte : les signaler « à vérifier » dans l'outil et dans le manuel.
- Phase APS/APD : les plans et descentes de charges portent la mention « non valable pour exécution ».
- Tester chaque page modifiée dans le navigateur (Playwright) sans erreur console avant de committer.
