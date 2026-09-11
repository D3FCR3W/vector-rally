# Vector Rally — rapprochement du code et de Lyriks

Revue du 10 septembre 2026. Projet `vector-rally-d60551`.

**Spécifications mises à jour ; Experience partiellement alignée, validation globale bloquée.** La connexion MCP fonctionne en lecture et en écriture. Le code actuel est la référence ; les 18 fichiers de la capture initiale ont conservé leur SHA-256.

## Changements enregistrés dans Studio

- 19 capacités recensées, toutes reliées à 11 fonctionnalités. Les 9 fonctionnalités existantes ont été corrigées ; replay et effets de conduite ont été ajoutés.
- Règles corrigées : accélération vectorielle, centre/S/Espace pour conserver la vitesse, freinage opposé, collisions sur toute la trajectoire, dernier emplacement sûr et trois tours jouables à vitesse limitée.
- Compléments : sept mondes, faune au point d'arrivée, trois options de circuit, raccourcis, aperçu des destinations, préférences, pause, caméra, replay intégral, traces et effets, mouvement réduit et secours graphique.
- 12 entités reliées, vocabulaire et architecture adaptés au jeu actuel. Les décisions historiques contradictoires sont signalées comme remplacées.
- 6 écrans et 14 composants réutilisables : préparation, piste, menu, aide, victoire et replay. Textes anglais, couleurs et références typographiques repris du produit ; illustrations capturées depuis le jeu.
- Sources et sauvegardes avant modification conservées. Aucun code source envoyé comme preuve d'implémentation ; aucune nouvelle correspondance sans preuve déclarée vérifiée.

## Vérifications

| Contrôle | Résultat |
| --- | --- |
| Tests existants du jeu | 36/36 passent |
| Empreintes du code après les écritures | 18/18 inchangées |
| Scénarios de comportement Lyriks | 119/119 passent sur 11 fonctionnalités |
| Navigation Experience | 3 parcours passent |
| Interactions ciblées | Préparation, nom obligatoire, monde/néon, aide/pause et replay : sans erreur inattendue ni avertissement |
| Inventaire de capacités | 19/19 reliées |
| Audit global final | Bloqué, audit à jour ; 9/10 sections évaluées prêtes |

Les tests du jeu et le smoke desktop/mobile ont été exécutés pendant cette revue. Les vérifications de modèle pour momentum et replay ont atteint une limite d'exploration : les scénarios passent, sans prétendre à une preuve exhaustive. Le contrôle automatique des entités comportementales annonce « 0 checked » ; sa réussite seule ne prouve pas la complétude des données.

## Écarts restants

1. **Rendu et exécution.** Le constructeur Experience utilisé expose images, formulaires et transitions ; il ne fait pas tourner le moteur Canvas. Circuit, carte et piste sont des captures statiques. Régénération selon la graine, géométrie réelle des destinations, déplacements, IA, caméra, effets animés et horloge du replay restent exécutables dans le jeu local. La victoire automatique est spécifiée et son écran existe, mais demeure inaccessible via la navigation générée. Les contrôles de transport du prototype ne certifient pas les bornes et arrondis du replay ; ceux-ci sont spécifiés et testés dans le modèle de comportement et dans le code.
2. **Fidélité visuelle partielle, contrôlée depuis.** Un comparatif desktop/mobile du véritable composant Run déployé, monté localement avec les données MCP, a désormais été réalisé. Des défauts de confinement, de médias et de mise en page ont été reproduits ; des contournements sont enregistrés. Le rendu reste différent du jeu et déborde encore sur mobile. Voir le [rapport de rendu Studio](studio-experience-rendering-report.md), qui remplace le constat antérieur d’absence de contrôle visuel.
3. **Projection Studio obsolète.** Les états actuels du replay utilisent `vr.replayTime` et `vr.replaySpeed`, mais deux paramètres du comportement généré conservent `replay.time` et `replay.speed`. Deux incompatibilités de types bloquent la cohérence globale. Les simulations directes du prototype fonctionnent. Les paramètres générés ne fournissent pas d'identifiants permettant leur correction ciblée avec l'API disponible ; le rafraîchissement de projection doit être corrigé côté Studio.
4. **Traçabilité historique.** L'ancien index retourne 71 correspondances manquantes sur 163 attendues, 140 entrées obsolètes et 6 orphelines. Ces chiffres concernent les liens de preuves, pas des fonctionnalités absentes du jeu. Le code restant local, aucune adoption automatique fondée sur son contenu n'a été certifiée.

Les problèmes de rendu et de projection sont ouverts dans les règles de Studio ; l'Experience est conservée `in_progress`. Aucun `finish_project` n'a été demandé ni exécuté. Le statut global persistant est `blocked`, malgré les capacités documentées et les scénarios réussis.

## Connexion

Une nouvelle autorisation Codex a abouti, puis les appels MCP authentifiés ont réussi. Le texte « Authentication complete. You may close this window. » vient de la page de retour locale de Codex ; Claude fournit sa propre présentation. Une modification de Studio ne personnalise pas cette page Codex. Les anciennes erreurs d'origine et de consentement sont historiques ; leur cause exacte n'a pas été démontrée.

## Preuves locales

- [Référence de design et de comportement](design-code-reference.md)
- [Inventaire des sources et contrôles](design-code-inventory.json)
- [Résultats détaillés et audit distant](design-code-reconciliation.json)
- [Sauvegarde des sections avant rapprochement](../artifacts/studio-before-reconciliation.json)
- [Sauvegarde de l'Experience avant rapprochement](../artifacts/studio-experience-before.json)
- [Captures de référence produites par le jeu](../artifacts/studio-design-assets.json)

Les anciens `report.json` et `.unspa.json` sont conservés comme traces historiques ; ce rapport remplace leurs indications « pending authentication » pour l'état de connexion et de rédaction distante.

