#!/usr/bin/env bash
# =====================================================================
# DÉJÀ FAIT ? — à lancer avant toute modification demandée (sessions Claude Code, voir CLAUDE.md)
# Cherche si une modification a déjà été faite ou est en cours :
#   1. branches distantes non fusionnées dans origin/main (travail en cours d'un collègue) ;
#   2. messages de commit (toutes branches) contenant les mots clés ;
#   3. lignes du journal des modifications du manuel (origin/main) contenant les mots clés ;
#   4. ajouts contenant les mots clés sur les branches non fusionnées.
# Les pull requests ouvertes se vérifient en plus avec les outils GitHub.
# Usage : outils/deja-fait.sh "mot clé" ["autre mot clé" …]      (insensible à la casse)
# =====================================================================
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
git fetch -q --prune origin 2>/dev/null || echo "⚠ git fetch impossible : résultats sur l'état local du dépôt"
base=origin/main
branches=$(git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -v -x -e 'origin/HEAD' -e 'origin' -e "$base")
echo "== Branches distantes non fusionnées dans $base"
aucune=1
for b in $branches; do
  n=$(git rev-list --count "$base..$b" 2>/dev/null || echo 0)
  if [ "$n" -gt 0 ]; then aucune=0; git log -1 --format="  $b : $n commit(s) en avance – dernier %h, %an, %ad : %s" --date=short "$b"; fi
done
[ $aucune -eq 1 ] && echo "  aucune"
[ $# -eq 0 ] && { echo; echo "Ajouter des mots clés pour chercher une modification précise (ex. outils/deja-fait.sh cornière guidage)."; exit 0; }
for mot in "$@"; do
  echo; echo "== « $mot » – messages de commit (toutes branches)"
  r=$(git log --remotes -i --grep="$mot" --format='  %h %ad %an : %s' --date=short | head -15); echo "${r:-  rien}"
  echo "== « $mot » – journal des modifications du manuel ($base)"
  r=$(git show "$base:manuel/index.html" 2>/dev/null | grep -E '^<tr><td>[0-9]+\.[0-9]+</td>' | sed 's/<[^>]*>/ /g; s/  */ /g' | grep -i -- "$mot" | while IFS= read -r l; do v=$(echo "$l" | grep -o -E '[0-9]+\.[0-9]+' | head -1); c=$(echo "$l" | grep -o -i -E ".{0,70}$mot.{0,70}" | head -1); echo "  v$v : …$c…"; done | head -10); echo "${r:-  rien}"
  echo "== « $mot » – ajouts sur les branches non fusionnées"
  trouve=0
  for b in $branches; do
    [ "$(git rev-list --count "$base..$b" 2>/dev/null || echo 0)" -gt 0 ] || continue
    r=$(git diff "$base...$b" 2>/dev/null | grep -i -- "^+.*$mot" | grep -v '^+++' | cut -c1-160 | head -3)
    [ -n "$r" ] && { trouve=1; echo "  $b :"; echo "$r" | sed 's/^/    /'; }
  done
  [ $trouve -eq 0 ] && echo "  rien"
done
echo; echo "Si un résultat correspond à la demande : s'arrêter, citer la référence et attendre l'accord de l'utilisateur (CLAUDE.md)."
