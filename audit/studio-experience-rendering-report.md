# Studio Lyriks — défauts de rendu Experience / Vector Rally

Rapport du 10 septembre 2026 · Projet `vector-rally-d60551` · Environnement : https://studio.lyriks.io

**Mise à jour du 11 septembre :** les conflits de types des contrôles de replay sont corrigés et les preuves code/spec ont été synchronisées. Les limites du moteur de rendu restent ouvertes. Le [rapport actuel](spec-sync-2026-09-11.md) décrit aussi la validation des champs numériques et les faux écarts de version après synchronisation.

**Le rendu signalé est défectueux. Des contournements ont été enregistrés dans l’Experience, mais la fidélité au jeu n’est pas atteinte. Le dépôt de Studio étant sur un autre ordinateur, aucune correction du moteur Studio n’a été livrée.**

Le code actuel de Vector Rally reste la référence. Ce rapport ne propose pas de redesign du jeu. Il décrit les défauts à corriger dans Studio pour restituer cette référence.

## Reproduction et niveau de preuve

1. Ouvrir Vector Rally, puis Experience et Run.
2. Démarrer sur Race setup : observer le cadre de simulation, les sept mondes et les champs.
3. Choisir un monde, renseigner le pilote et cliquer sur « LET'S RACE → ».
4. Observer la piste, les neuf destinations, la carte et l’indication du tour.
5. Ouvrir l’aide, le menu et le replay, puis revenir à la course.
6. Refaire à une largeur de 390 px.

Les captures « avant » reproduisent les données initiales ; le projet distant contient maintenant les contournements « après ». Pour retrouver l’état initial, utiliser une copie de test de la sauvegarde, sans écraser le projet courant.

**Méthode :** lecture des données par MCP, inspection du JavaScript public déployé et montage local du véritable composant Run de Studio avec les instantanés MCP. Le seul ajout au module téléchargé expose son composant Run pour le test ; sa logique de rendu n’a pas été corrigée. Les trois feuilles CSS déployées ont été chargées. Il ne s’agit pas d’une reconstitution HTML inventée.

**Limite :** ces captures sont celles du composant réel monté localement, sans la session authentifiée ni la totalité de l’interface Studio. Elles complètent les captures fournies par l’utilisateur ; elles ne certifient pas le rendu final dans toutes les configurations de Studio.

Modules publics examinés, dont les noms changeront à la prochaine compilation :

- `/_app/immutable/nodes/18.B6mAASys.js` : rendu Experience.
- `/_app/immutable/chunks/DXEH8G2Z.js` : aides de mise en page.
- CSS : `18.xMAsjqHS.css`, `design-system.Ce_Xtgpp.css`, `0.DtMoEDQQ.css`.

Les fonctions minifiées ci-dessous sont des repères de recherche dans ce déploiement, pas des noms garantis du dépôt source.

## Défauts à corriger dans Studio

### P1 — Les superpositions sortent du cadre de simulation

**Constat vérifié :** le panneau de préparation couvre les commandes et l’interface de Studio. Le rendu des groupes overlay contient `fixed inset-0 z-40 grid place-items-center p-4`. Le positionnement se rapporte à la fenêtre, sans confinement adapté au cadre de prévisualisation.

**Attendu :** la préparation et les autres panneaux restent dans la surface du produit simulé, y compris pendant le défilement et en vue mobile.

**Correction recommandée :** créer une couche de superposition propre au viewport simulé, dans un conteneur positionné et isolé ; utiliser un positionnement local ou un portail vers cette couche. Préserver le défilement interne, la gestion du focus, Échap et les éventuelles actions de fermeture.

**Contournement enregistré :** préparation, aide, menu et victoire utilisent une présentation inline. Cela évite le modal global, mais ne reproduit pas les superpositions natives du jeu.

### P1 — Les images sont tronquées à 4 096 caractères

**Constat vérifié :** les grandes chaînes `media.src` relues dans le modèle comptent exactement 4 096 caractères. La capture originale de piste compte 74 564 caractères ; celle du circuit, 42 368 ; celle de la carte, 30 056. Le résultat affiche seulement une bande supérieure de l’image, ce qui explique la grande zone verte.

**Attention au diagnostic :** un PNG tronqué peut présenter `complete=true` et une largeur naturelle positive. Ces deux propriétés seules ne valident pas l’intégrité de l’image.

**Origine précise non localisée :** le dépôt serveur n’est pas disponible. Le seuil est observé dans les données relues ; il faut examiner la validation/normalisation des médias, leur sauvegarde et leur restitution MCP. Le rapport ne désigne pas une ligne serveur comme cause démontrée.

**Correction recommandée :** passer par un stockage d’assets et des URL durables, ou préserver intégralement les médias autorisés. Si une limite est imposée, rejeter explicitement l’entrée trop longue ; ne jamais couper silencieusement une image.

**Contournement enregistré :** images issues du jeu converties en WebP sous 4 000 caractères. La piste est réduite à 360 × 225 ; la carte à 248 × 168 ; l’aperçu à 480 × 220. La piste est maintenant reconnaissable, mais reste floue à grande taille.

### P1 — Les images des lignes répétées ne résolvent pas leurs variables

**Constat vérifié :** les miniatures sont cassées et le texte alternatif contient littéralement `{name} pixel world preview`. Le renderer affecte directement `media.src` et `media.alt` à l’image. Les libellés passent, eux, par le résolveur de contexte.

**Attendu :** chaque ligne affiche l’image et le nom du monde correspondant, selon les mêmes règles de liaison que ses textes et actions.

**Correction recommandée :** résoudre src et alt dans le contexte de la ligne et de l’état courant avant de rendre l’image, avec validation de l’URL résultante. Aligner le simulateur visuel et les vérifications sans navigateur.

**Contournement enregistré :** sept images explicites, conditionnées par l’identifiant du monde dans le composant réutilisable. Les actions de sélection restent reliées aux lignes.

### P1 — Les neuf destinations deviennent une colonne de boutons « Action »

**Constat vérifié :** les neuf cellules vides du jeu deviennent neuf gros contrôles empilés. Deux mécanismes se cumulent :

- L’aide `hf(t)` émet `flex-wrap` dès que la direction vaut row : `t.direction==="row"||t.wrap`. Un `wrap:false` explicite ne produit donc pas nowrap.
- Le libellé vide reçoit une valeur de secours « Action ». La largeur et les marges internes des contrôles entraînent leur passage à la ligne.

**Attendu :** neuf destinations disposées en 3 × 3, vides visuellement comme dans le jeu, et placées par rapport à la piste. Leur nom accessible doit expliquer leur action sans ajouter du texte à chaque case.

**Correction recommandée :** respecter nowrap explicite, proposer une vraie grille de dimensions maîtrisées et séparer libellé accessible et contenu visible. La fidélité complète requiert également une surface de rendu permettant le placement des cellules dans les coordonnées du circuit.

**Contournement enregistré :** les neuf nœuds existants utilisent des visuels SVG de 44 px, avec noms accessibles et branchements d’action conservés. Ils forment une matrice 3 × 3. **Ils restent hors du circuit : la géométrie interactive du jeu n’est pas reproduite.**

### P2 — La typographie déclarée n’atteint pas le texte rendu

**Constat vérifié :** `xe(appearance)` applique fontSize/fontWeight au conteneur, tandis que le titre fixe sa taille avec `--sim-heading-size` et ses propres styles. `Ee(appearance)`, appliqué au texte, ne transporte pas ces propriétés. Une taille acceptée dans le modèle peut donc être ignorée visuellement.

**Attendu :** le titre reprend la typographie du code du jeu, dont la taille de 37 px et la police Arial sur cette vue ; les textes courants conservent leur propre famille.

**Correction recommandée :** définir clairement le contrat typographique et appliquer les propriétés sur le nœud texte ou sur les variables qu’il consomme. Vérifier les styles calculés, pas seulement la sauvegarde du modèle.

**Contournement enregistré :** titre restitué en SVG avec texte alternatif. C’est une solution provisoire ; un titre natif correctement stylé reste préférable.

### P2 — Le nombre de colonnes est transformé en largeur minimale

**Constat vérifié :** `Be(m)` convertit 1/2/3/4 en 640/320/220/170 px, ensuite utilisés avec `repeat(auto-fit,minmax(...))`. Une déclaration de quatre colonnes n’impose donc pas quatre colonnes.

**Conséquence :** les cartes de mondes sont encore sur deux colonnes dans la capture desktop et une colonne sur mobile, au lieu de la disposition du jeu (quatre / trois).

**Correction recommandée :** distinguer un nombre exact de colonnes d’une grille auto-adaptative et permettre des règles selon la largeur. Documenter les deux modes.

### P2 — Débordement horizontal en vue étroite

**Constat reproduit localement :** pour un viewport demandé de 390 × 844, la largeur du document atteint 434 px. Les champs sont redevenus lisibles après correction du modèle, mais le cadre Run dépasse encore la largeur disponible.

**Limite du diagnostic :** la règle source responsable du débordement résiduel n’a pas été isolée ; reproduire dans l’interface authentifiée avant de conclure sur son origine exacte.

**Correction recommandée :** contrôler les largeurs minimales du cadre navigateur, des barres d’outils et des formulaires, puis valider à 390 px sans défilement horizontal de la page.

## Corrections déjà enregistrées dans l’Experience

- Panneaux contenus dans le Run par présentation inline.
- Médias complets sous le seuil observé ; sept miniatures utilisables.
- Champs de pilotes et réglages redisposés ; bouton de démarrage après les informations nécessaires.
- Neuf cellules regroupées en matrice, avec conservation des identifiants et actions.
- Piste visible, carte et informations du tour regroupées ; indication de départ reprise du produit.
- Six écrans conservés. Le code du jeu n’a pas été modifié.

**Écarts assumés :** circuit statique et compressé, matrice hors de la piste, préparation trop longue, colonnes différentes, titre en SVG et débordement mobile. Ces changements améliorent la lisibilité mais ne constituent pas une transcription visuelle terminée. Les déplacements, IA, effets, caméra et horloge réelle du replay restent exécutés dans le jeu, pas dans cette maquette statique.

## Contrôles effectués

| Contrôle | Résultat |
| --- | --- |
| Choix de monde → démarrage → destination → replay → pause → retour | Passe, aucune erreur ni alerte inattendue |
| Nom du premier pilote vide → démarrage | Refus attendu, maintien sur la préparation |
| Trois parcours Experience | Tous passent |
| Images après correction, préparation desktop | 9 images chargées |
| Images après correction, course | 11 images chargées |
| Superposition fixe sur la préparation corrigée | Aucune dans le montage local |
| Contrôle mobile à 390 px | Débordement résiduel à 434 px |
| Audit global rafraîchi le 10 septembre 2026 à 13:24 UTC | Bloqué, score 94, 19/19 capacités reliées, 9/10 sections prêtes |

Les tests de parcours ne prouvent pas la fidélité visuelle ni l’exécution du moteur du jeu. Le dernier audit global garde Experience non prête et deux incompatibilités de cohérence. Les scénarios de comportement de la revue précédente passaient à 119/119 ; les 36 tests du jeu avaient également passé. Ils n’ont pas été relancés uniquement pour produire ce rapport.

**Autre défaut Studio déjà identifié :** les états du replay sont `vr.replayTime` / `vr.replaySpeed`, mais deux paramètres générés conservent `replay.time` / `replay.speed`. La projection doit être régénérée sans références obsolètes. Ce point reste distinct des défauts de rendu.

## Critères de validation pour la correction Studio

1. Les panneaux restent dans le viewport simulé en desktop, mobile et plein écran ; focus, fermeture et défilement fonctionnent.
2. Une image supérieure à 4 096 caractères est conservée intégralement à l’aller-retour ou rejetée avec une erreur explicite. Vérifier le contenu complet et les pixels du bas de l’image.
3. Les sept lignes résolvent src et alt sans variables littérales ; changer de monde conserve la sélection et les actions.
4. Les neuf cellules restent en 3 × 3 ; un libellé visuel vide n’affiche pas « Action » ; les commandes disposent d’un nom accessible.
5. Le titre respecte les styles calculés attendus ; les grilles respectent les colonnes desktop/mobile du jeu.
6. À 390 px, aucune largeur de page excédentaire et aucun champ comprimé.
7. Le nom obligatoire, le démarrage, l’aide, le menu et les commandes de replay conservent leur fonctionnement.
8. La projection générée utilise les chemins actuels du replay ; l’audit global est relancé après les corrections.
9. Comparer visuellement au jeu réel. Ne déclarer l’Experience fidèle qu’après résolution des écarts de disposition et clarification de la surface interactive nécessaire au circuit.

## Pièces jointes

Les captures sont des pages entières ; les zones sous le premier écran permettent de voir les champs et contrôles.

- [Avant : préparation](../artifacts/studio-before-setup.png)
- [Après : préparation](../artifacts/studio-after-setup.png)
- [Avant : course](../artifacts/studio-before-race.png)
- [Après : course](../artifacts/studio-after-race.png)
- [Avant : mobile](../artifacts/studio-before-mobile-setup.png)
- [Après : mobile](../artifacts/studio-after-mobile-setup.png)
- [Extraits du renderer déployé](../artifacts/studio-renderer-evidence.json)
- [Contrôles visuels avant](../artifacts/studio-before-visual-check.json) et [après](../artifacts/studio-after-visual-check.json)
- [Vérifications MCP détaillées](../artifacts/studio-experience-verification.json)
- [État global final](../artifacts/studio-visual-completeness.json)

La métrique automatique `actionLabels` des contrôles visuels ne détecte que les boutons HTML ; elle ne mesure pas correctement les libellés de secours du renderer. La présence initiale de « Action » et sa disparition sont vérifiées dans les captures.

Les instantanés MCP et le montage du renderer sont conservés dans les artifacts du workspace pour approfondissement. L’archive de transmission contient ce rapport, les captures et les résultats ; elle ne contient pas le code source du jeu ni de données d’authentification.
