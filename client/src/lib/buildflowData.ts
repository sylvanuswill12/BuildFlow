import type { UploadedImage } from "@shared/attachments";

export type ProjectStatus = "Brouillon" | "En cours" | "Publié" | "Archivé";

export type Project = {
  id: string;
  name: string;
  type: string;
  description: string;
  status: ProjectStatus;
	  updatedAt: string;
	  files: number;
	  sourceFiles?: Record<string, string>;
  revision?: number;
  deploymentProvider?: "vercel" | "netlify" | "cloudflare";
  deploymentId?: string;
  deploymentUrl?: string;
  deploymentStatus?: "queued" | "building" | "ready" | "error";
  deploymentError?: string;
  deployedRevision?: number;
  accent: string;
  gradient: string;
  initials: string;
};

export type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  accent: string;
  icon: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  time: string;
  changes?: string[];
  attachments?: UploadedImage[];
};

export const demoProjects: Project[] = [
  {
    id: "expenses",
    name: "Gestionnaire de dépenses",
    type: "Application web",
    description: "Suivez vos dépenses, budgets et habitudes financières.",
    status: "En cours",
    updatedAt: "il y a 12 min",
    files: 24,
    accent: "#3B82F6",
    gradient: "from-blue-500/30 via-indigo-500/10 to-transparent",
    initials: "GD",
  },
  {
    id: "portfolio",
    name: "Portfolio créatif",
    type: "Portfolio",
    description: "Une vitrine éditoriale pour présenter vos projets.",
    status: "Publié",
    updatedAt: "hier",
    files: 18,
    accent: "#8B5CF6",
    gradient: "from-violet-500/30 via-fuchsia-500/10 to-transparent",
    initials: "PC",
  },
  {
    id: "commerce",
    name: "Dashboard e-commerce",
    type: "Dashboard",
    description: "Analysez vos ventes, stocks et performances marketing.",
    status: "Brouillon",
    updatedAt: "il y a 2 jours",
    files: 31,
    accent: "#22C55E",
    gradient: "from-emerald-500/30 via-teal-500/10 to-transparent",
    initials: "DE",
  },
  {
    id: "solidarity",
    name: "Site ONG Solidarité",
    type: "Site vitrine",
    description: "Mobilisez votre communauté autour de vos missions.",
    status: "Publié",
    updatedAt: "il y a 4 jours",
    files: 16,
    accent: "#F59E0B",
    gradient: "from-amber-500/30 via-orange-500/10 to-transparent",
    initials: "SO",
  },
  {
    id: "booking",
    name: "Application de réservation",
    type: "Application web",
    description: "Un parcours simple pour réserver et gérer ses créneaux.",
    status: "En cours",
    updatedAt: "il y a 6 jours",
    files: 27,
    accent: "#EC4899",
    gradient: "from-pink-500/30 via-rose-500/10 to-transparent",
    initials: "AR",
  },
];

export const templates: Template[] = [
  {
    id: "saas-dashboard",
    name: "SaaS Analytics",
    category: "Dashboard",
    description: "Un dashboard produit dense, lisible et prêt à personnaliser.",
    tags: ["React", "Charts", "Dark"],
    accent: "#3B82F6",
    icon: "chart",
  },
  {
    id: "creative-portfolio",
    name: "Studio créatif",
    category: "Portfolio",
    description: "Une landing immersive pour vos projets et votre univers.",
    tags: ["Portfolio", "Editorial", "Pro"],
    accent: "#8B5CF6",
    icon: "spark",
  },
  {
    id: "task-flow",
    name: "TaskFlow",
    category: "Productivité",
    description: "Gérez vos tâches et vos équipes avec un espace clair.",
    tags: ["Kanban", "Teams", "React"],
    accent: "#22C55E",
    icon: "check",
  },
  {
    id: "commerce-kit",
    name: "Commerce Kit",
    category: "E-commerce",
    description: "Une boutique moderne avec catalogue, panier et métriques.",
    tags: ["Store", "Checkout", "UI"],
    accent: "#F59E0B",
    icon: "box",
  },
  {
    id: "ngo-impact",
    name: "Impact ONG",
    category: "Association",
    description: "Racontez votre mission et activez les dons de votre communauté.",
    tags: ["Storytelling", "Don", "Mobile"],
    accent: "#EC4899",
    icon: "heart",
  },
  {
    id: "booking-flow",
    name: "Booking Flow",
    category: "Réservation",
    description: "Un parcours de réservation guidé et rassurant.",
    tags: ["Calendar", "Forms", "SaaS"],
    accent: "#14B8A6",
    icon: "calendar",
  },
];

export const fileTree = [
  { label: "src", kind: "folder", depth: 0 },
  { label: "app", kind: "folder", depth: 1 },
  { label: "page.tsx", kind: "file", depth: 2, language: "tsx" },
  { label: "layout.tsx", kind: "file", depth: 2, language: "tsx" },
  { label: "dashboard", kind: "folder", depth: 2 },
  { label: "page.tsx", kind: "file", depth: 3, language: "tsx" },
  { label: "transactions", kind: "folder", depth: 2 },
  { label: "page.tsx", kind: "file", depth: 3, language: "tsx" },
  { label: "components", kind: "folder", depth: 1 },
  { label: "Sidebar.tsx", kind: "file", depth: 2, language: "tsx" },
  { label: "DashboardCard.tsx", kind: "file", depth: 2, language: "tsx" },
  { label: "ExpenseChart.tsx", kind: "file", depth: 2, language: "tsx" },
  { label: "ExpenseForm.tsx", kind: "file", depth: 2, language: "tsx" },
  { label: "TransactionList.tsx", kind: "file", depth: 2, language: "tsx" },
  { label: "lib", kind: "folder", depth: 1 },
  { label: "utils.ts", kind: "file", depth: 2, language: "ts" },
  { label: "styles", kind: "folder", depth: 1 },
  { label: "globals.css", kind: "file", depth: 2, language: "css" },
  { label: "public", kind: "folder", depth: 0 },
  { label: "package.json", kind: "file", depth: 0, language: "json" },
  { label: "tailwind.config.ts", kind: "file", depth: 0, language: "ts" },
  { label: "README.md", kind: "file", depth: 0, language: "md" },
] as const;

export const codeSnippets: Record<string, string> = {
  "src/App.tsx": `import { useState } from "react";

export default function App() {
  const [tasks, setTasks] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const addTask = () => {
    const task = draft.trim();
    if (!task) return;
    setTasks(current => [...current, task]);
    setDraft("");
  };
  return (
    <main style={{ maxWidth: 640, margin: "60px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <p style={{ color: "#64748b" }}>BuildFlow starter</p>
      <h1>Votre application commence ici</h1>
      <form onSubmit={event => { event.preventDefault(); addTask(); }} style={{ display: "flex", gap: 8 }}>
        <input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ajouter un élément" style={{ flex: 1, padding: 12 }} />
        <button type="submit">Ajouter</button>
      </form>
      <ul>{tasks.map((task, index) => <li key={index}>{task}</li>)}</ul>
    </main>
  );
}`,
  "src/styles/globals.css": `@import "tailwindcss";

:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #0f172a; background: #f8fafc; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
* { box-sizing: border-box; }`,
  "package.json": JSON.stringify({ name: "buildflow-project", private: true, version: "0.0.0", type: "module", scripts: { dev: "vite" }, dependencies: { react: "^19.2.1", "react-dom": "^19.2.1" }, devDependencies: { vite: "^7.1.9", "@vitejs/plugin-react": "^5.0.4", typescript: "^5.9.3", tailwindcss: "^4.1.14", "@tailwindcss/vite": "^4.1.14" } }, null, 2),
  "index.html": `<!doctype html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mon application</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
};

export const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "Crée une application de gestion de dépenses personnelles avec un tableau de bord, des graphiques et un formulaire pour ajouter des dépenses.",
    time: "10:42",
  },
  {
    id: "m2",
    role: "assistant",
    content: "J’ai créé la structure de votre application de gestion de dépenses. J’ai ajouté un dashboard, une page d’ajout de dépense, une liste de transactions, des statistiques et un graphique de répartition par catégorie.",
    time: "10:43",
    changes: [
      "Création de la page Dashboard",
      "Création de la page Transactions",
      "Création du composant ExpenseForm",
      "Création du composant ExpenseChart",
      "Ajout de données de démonstration",
      "Mise en place du design responsive",
    ],
  },
];

export const activityItems = [
  { title: "ExpenseChart.tsx mis à jour", detail: "Gestionnaire de dépenses", time: "il y a 12 min", tone: "blue" },
  { title: "Projet publié", detail: "Portfolio créatif", time: "hier à 16:24", tone: "green" },
  { title: "Nouvelle version créée", detail: "Dashboard e-commerce", time: "il y a 2 jours", tone: "violet" },
  { title: "Template utilisé", detail: "SaaS Analytics", time: "il y a 3 jours", tone: "amber" },
];

export const generationLogs = [
  { time: "10:43:18", label: "Génération terminée", detail: "24 fichiers créés", tone: "success" },
  { time: "10:43:12", label: "Composants analysés", detail: "5 composants React", tone: "info" },
  { time: "10:43:08", label: "Données de démonstration", detail: "12 transactions injectées", tone: "info" },
  { time: "10:42:54", label: "Prompt interprété", detail: "Type : application web", tone: "info" },
];
