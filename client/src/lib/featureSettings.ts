export const FEATURE_SETTINGS_KEY = "buildflow-feature-settings";

export const DEFAULT_FEATURE_SETTINGS = {
  starterTemplates: true,
  prewarmRuntime: true,
  dependencySnapshotCache: true,
  smartModelRouting: false,
  providerFallback: true,
  costTracking: true,
  importGraphIndex: true,
  visualQualityCheck: false,
  runtimeQualityChecks: true,
  generatedTests: false,
  visualEditor: false,
  supabaseMigrations: false,
  projectEnvironment: false,
  githubSync: false,
  customDomains: false,
  collaboration: false,
  reviewerAgent: false,
} as const;

export type FeatureSettingKey = keyof typeof DEFAULT_FEATURE_SETTINGS;
export type FeatureSettings = Record<FeatureSettingKey, boolean>;

export const FEATURE_SETTING_LABELS: Record<FeatureSettingKey, { label: string; description: string }> = {
  starterTemplates: { label: "Templates de démarrage", description: "Afficher les starters React, Zustand, dashboard et landing page, y compris le démarrage sans génération IA." },
  prewarmRuntime: { label: "Préchauffer le runtime", description: "Démarrer WebContainer dès l’ouverture de Nouveau projet." },
  dependencySnapshotCache: { label: "Cache de dépendances", description: "Réutiliser localement les installations npm compatibles." },
  smartModelRouting: { label: "Routage intelligent des modèles", description: "Choisir automatiquement un modèle selon la taille de la tâche." },
  providerFallback: { label: "Bascule automatique de provider", description: "Réessayer sur un autre provider configuré après une panne temporaire." },
  costTracking: { label: "Suivi des coûts IA", description: "Enregistrer tokens, provider, latence et coût estimé pour chaque génération." },
  importGraphIndex: { label: "Index des imports", description: "Inclure dans le contexte les modules atteignables par imports locaux." },
  visualQualityCheck: { label: "Vérification visuelle IA", description: "Autoriser une passe de contrôle visuel après génération." },
  runtimeQualityChecks: { label: "Contrôles automatiques", description: "Lancer les vérifications de type et de qualité dans le runtime." },
  generatedTests: { label: "Tests générés par l’IA", description: "Autoriser la génération et l’exécution de tests Vitest." },
  visualEditor: { label: "Édition visuelle", description: "Activer la sélection directe d’éléments dans la preview." },
  supabaseMigrations: { label: "Migrations Supabase", description: "Proposer des migrations SQL; toute exécution reste soumise à validation." },
  projectEnvironment: { label: "Variables d’environnement projet", description: "Gérer des variables chiffrées côté serveur pour les projets." },
  githubSync: { label: "Synchronisation GitHub", description: "Activer l’import/export GitHub après configuration OAuth." },
  customDomains: { label: "Domaines personnalisés", description: "Afficher les outils de rattachement de domaine quand le provider le permet." },
  collaboration: { label: "Collaboration", description: "Activer le partage lecture seule et les outils de collaboration." },
  reviewerAgent: { label: "Agent Relecteur", description: "Ajouter une passe IA de revue à une génération." },
};

export function normalizeFeatureSettings(value: unknown): FeatureSettings {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_FEATURE_SETTINGS).map(([key, fallback]) => [key, typeof input[key] === "boolean" ? input[key] : fallback])
  ) as FeatureSettings;
}

export function readFeatureSettings(): FeatureSettings {
  if (typeof window === "undefined") return { ...DEFAULT_FEATURE_SETTINGS };
  try {
    return normalizeFeatureSettings(JSON.parse(window.localStorage.getItem(FEATURE_SETTINGS_KEY) ?? "{}"));
  } catch {
    return { ...DEFAULT_FEATURE_SETTINGS };
  }
}

export function saveFeatureSettings(settings: FeatureSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FEATURE_SETTINGS_KEY, JSON.stringify(normalizeFeatureSettings(settings)));
  window.dispatchEvent(new CustomEvent("buildflow-feature-settings", { detail: normalizeFeatureSettings(settings) }));
}

export function isFeatureEnabled(key: FeatureSettingKey): boolean {
  return readFeatureSettings()[key];
}
