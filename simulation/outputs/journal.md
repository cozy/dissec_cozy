# Journal d'expériences

## Liste

- `run27000_stratEAGER-3-PESS_maxR10_lat100_crypto100_compute100_failureRate0-6-0.0002_depth3-3-5_fanout4_groupSize3-5-7`
  - Simulations sur un large espace de paramètres.
  - Contrairement aux dernières simulations, la proba de panne maximale est ignoré est un la zone de 0 à 200µ est mieux explorée.
  - De nouvelles stats sont ajoutées
- `run27000_stratEAGER-3-PESS_maxR10_lat100_crypto100_compute100_failureRate0-6-0.0002_depth3-4-6_fanout4_groupSize3-4-6`
  - Similaire à la précédente mais des profondeurs plus profonde sont explorées
  - Pour des raisons de mémoire, la taille de groupe est limitée à 6
- `run6_stratEAGER-3-PESS_maxR10_lat100_crypto100_compute100_failureRate0-2-0.0002_depth3_fanout4_groupSize3_randomfalse.csv`
  - Test du monde avec moins d'aléatoire et l'export de plus stats
- `run12_stratEAGER-3-PESS_maxR10_lat100_crypto100_compute100_failureRate0-4-0.001_depth3_fanout4_groupSize4_randomfalse.csv`
  - Recherche d'une run Pessimiste qui échoue avec un arbre peu profond
  - Le but est de comparer comment les versions évoluent des run Opti et Pess
- `run12_stratEAGER-3-PESS_maxR10_lat100_crypto100_compute100_failureRate0-4-0.0015_depth3_fanout4_groupSize4_randomfalse.csv`
  - `run12_stratEAGER-3-PESS_maxR10_lat100_crypto100_compute100_failureRate0-4-0.001_depth3_fanout4_groupSize4_randomfalse.csv` n'avait aucune pannes Pessimiste
  - Au moins une panne de optimiste et une de pessimiste
  - Cependant les pannes ne sont pas les mêmes (SimulFails et ContribDead) et ont donc des profils différents
- `run15_fullstratEAGER-3-PESS_maxR10_lat100_crypto100_compute100_failureRate0-5-0.002_depth3_fanout4_groupSize4_randomfalse.csv`
  - Le but est d'observer le détails des simulations entre opti et pessi
  - Les dernières versions du simulateur supprimait certains messages enregistrés
  - Visualisation des durées de traitement
- `run30_fullstratEAGER-3-PESS_maxR10_lat100_crypto100_compute100_failureRate0-5-0.0008_depth4_fanout4_groupSize4_randomfalse.csv`
  - Correction du bug de manque de backup
- `run13500_stratEAGER-3-PESS_maxR10_lat100_crypto100_compute100_failureRate0-5-0.002_depth3-3-5_fanout4_groupSize4-3-6_randomfalse.csv`
  - Les corrections et stats précédentes à plus grande échelle
- `concat_leader-lessrun1000_stratEAGER-2-OPTI_maxR10_failureRate0-5-0.0004_depth3_fanout4_groupSize3_randomfalse.csv`
  - In this simulation, we compare the same runs using the protocol with leader based ping collection and without leader.
  - We can see that the protocol without leaders are running slightly faster than the ones with leaders. Because leaderless allows for faster convergence and one less message latency, less failures have time to occurs and the ones that do have less impact because nodes have started aggregating earlier.
  - Even in terms of messages where we expect leaderless runs to send more messages, the leaderless protocols perform better because they converge faster to the final version and thus avoid failures. This is also because leaf aggregators will tell their members anyway about the local list and the leader sending to his members requires as many messages as contributors contacting each parent when
