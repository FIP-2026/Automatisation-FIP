# FIP Études — consignes de développement

Site statique (GitHub Pages) d'outils de calcul de structure : Eurocodes + annexes nationales françaises, avec citation des paragraphes.

## Travail à plusieurs sur le dépôt (sessions Claude Code) — à appliquer en premier

Plusieurs personnes font évoluer FIP Études avec Claude, chacune dans sa session. Pour ne pas refaire ni défaire ce qu'un autre a déjà fait, **avant toute modification demandée** :

1. **Vérifier si c'est déjà fait ou en cours** : `git fetch`, puis `outils/deja-fait.sh "mot clé" …` (branches distantes non fusionnées dans `main`, messages de commit, journal des modifications du manuel, ajouts sur les autres branches) et les **pull requests ouvertes** (outils GitHub). Lire aussi le code concerné sur `main` à jour.
2. **Si la modification (ou une modification qui la contredit) existe déjà** sur `main`, sur une autre branche ou dans une PR ouverte : **s'arrêter et alerter** l'utilisateur en citant la référence (commit, branche ou PR, auteur, date, version du journal) et ce qui diffère éventuellement de sa demande. Ne rien modifier, committer ni proposer en pull request sur ce point **sans son accord explicite** dans la conversation.
3. Partir de la dernière version de `main`. Juste avant de pousser ou d'ouvrir une PR, **refaire la vérification** (une autre PR a pu être fusionnée entre-temps) ; numéro de version = suivant du plus élevé entre `main` et les PR ouvertes ; signaler les PR ouvertes qui touchent les mêmes fichiers.
4. Dans le message de commit ou la PR : indiquer la vérification faite (« déjà fait ? non : … » ou « fait en vX.YZ, refait avec l'accord de … »).

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

- **Modules reliés par le projet (collaboratif)** : on travaille sur un projet enregistré ; les données de base sont saisies une fois et tous les modules les récupèrent automatiquement, à la manière des logiciels de CAO / calcul : identification (accueil), climat et séisme (C1 → S1, cahier), chevilles et platines (S1 ↔ AN1 : AN1 définit et vérifie les chevilles, S1 en reprend les entraxes), supports (S1 → cahier), notes de calcul (famille « Rapports de calcul », pas de note dans les modules de calcul). Ne pas redemander dans un module une donnée qu'un autre module du projet fournit : l'afficher en lecture avec un lien vers le module source.
- **Identification (trame)** : l'identification du projet est saisie en haut de l'accueil (`fip.projet.ident`) ; la carte « Identification » d'un module (`commun/ident.js`, `IDENT.init({cible, cle})`) ne porte que ce qui est propre au document (n° de document, indice, date, repère) et reprend le reste ; elle alimente le cartouche Word (`EXPORT.init({affaire:()=>IDENT.lire()})`) et l'en-tête d'impression.
- **Règles de conception et alertes** : chaque module affiche une carte « Règles de conception et alertes » (✔ / ⚠️ / ℹ️) : géométrie (angles de diagonales 30°–60°, nœuds de contreventement dans l'axe des pannes, pinces et entraxes, élancements…), dispositions constructives et limites du domaine.
- **Projet de travail** : chaque page protégée charge `commun/suivi.js` puis `commun/projet.js` juste après `commun/auth.js` (bouton « 💾 Enregistrer » / Ctrl+S, état des modules avec l'auteur de chaque modification, identification globale). Un module qui enregistre des données (`localStorage` « fip.* ») déclare ses clés et sa page dans `SUIVI.MODULES` (`commun/suivi.js`) : état « non renseigné / modifié / enregistré », auteur (utilisateur connecté) et journal, conflits à l'import du fichier projet. Il lit l'identification par `IDENT` ou `CAHIER.affaire()` (jamais `fip.cahier` en direct). Les opérations de changement de projet écrivent par `SUIVI.set0` / `SUIVI.rem0` (écritures non datées).
- **Échanges entre modules** : par `localStorage` (`fip.<module>.pre` pour un envoi ponctuel, avec un lien de retour ; données du projet relues automatiquement). Un module reste utilisable sans le module source (saisie manuelle signalée « pas de données … dans le projet »).
- **Schémas** : vues 2D cotées avec les valeurs des charges du cas affiché, vue 3D avec les profilés, schémas des éléments secondaires (pannes, lisses).

## Autres règles

- Données confidentielles (base de prix, données client) : jamais dans ce dépôt public ; elles restent sur le réseau FIP / SharePoint.
- Valeurs normatives non vérifiées sur le texte : les signaler « à vérifier » dans l'outil et dans le manuel.
- Phase APS/APD : les plans et descentes de charges portent la mention « non valable pour exécution ».
- Tester chaque page modifiée dans le navigateur (Playwright) sans erreur console avant de committer.
