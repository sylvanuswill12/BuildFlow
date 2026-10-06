import { Toaster, toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Clock3,
  Code2,
  Copy,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Github,
  Globe2,
  Heart,
  Home,
  ImagePlus,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Maximize2,
  Menu,
  MessageSquare,
  Mic,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  SquarePen,
  Sun,
  Tablet,
  Terminal,
  Trash2,
  Upload,
  UserPlus,
  Users2,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BuildFlowLogo } from "@/components/BuildFlowLogo";
import {
  activityItems,
  codeSnippets,
  demoProjects,
  fileTree,
  generationLogs,
  initialMessages,
  templates,
  type ChatMessage,
  type Project,
  type ProjectStatus,
} from "@/lib/buildflowData";
import {
  createProjectDraft,
  downloadProjectZip,
  generateMockChange,
} from "@/lib/buildflowServices";
import { AnimatePresence, motion } from "motion/react";
import { useBuildFlowStore, type WorkspaceTab } from "@/stores/buildflowStore";
import {
  AmbientBackground,
  AnimatedMetric,
  AnimatedReveal,
  GlassPanel,
} from "@/components/buildflow/motion";
import {
  startWebContainerRuntime,
  updateWebContainerRuntime,
} from "@/lib/webcontainerRuntime";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { StarterTemplateId } from "@shared/starterTemplates";


const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");
import { prewarmWebContainerRuntime } from "@/lib/webcontainerRuntime";
import { isFeatureEnabled } from "@/lib/featureSettings";
type InitialProjectOptions = {
  provider?: AiProviderId;
  model?: string;
  templateId?: StarterTemplateId;
  templateOnly?: boolean;
};

const starterTemplateIds: Record<string, StarterTemplateId> = {
  "React + Vite + Tailwind": "react-vite-tailwind",
  "React + Zustand": "react-zustand",
  Dashboard: "dashboard",
  "Landing page": "landing-page",
};

type AiProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "omniroute"
  | "groq"
  | "deepseek"
  | "mistral"
  | "ollama"
  | "openai-compatible";

type LlmGenerationResult = {
  code: string;
  changes: string[];
  assistantMessage: string;
  files?: Array<{ path: string; content: string }>;
  previewRevision: number;
  credits: number;
};

export function NewProjectPage({
  onCreate,
  navigate,
}: {
  onCreate: (
    prompt: string,
    type?: string,
    options?: InitialProjectOptions
  ) => Promise<void> | void;
  navigate: (path: string) => void;
}) {
  const params = new URLSearchParams(window.location.search);
  const [prompt, setPrompt] = useState(params.get("prompt") ?? "");
  const [type, setType] = useState("Application web");
  const [framework, setFramework] = useState("Choix automatique par IA");
  const [style, setStyle] = useState("Moderne");
  const [level, setLevel] = useState("Application standard");
  const [starterTemplate, setStarterTemplate] = useState("React + Vite + Tailwind");
  const [starterTemplatesEnabled] = useState(() => isFeatureEnabled("starterTemplates"));
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const progressStreamRef = useRef<EventSource | null>(null);
  const generationSteps = [
    "Analyse de votre idée…",
    "Préparation de l’architecture…",
    "Génération des fichiers…",
    "Sauvegarde du workspace…",
    "Ouverture de la preview…",
  ];
  const ideas = [
    "Crée une application de gestion de stock.",
    "Crée une plateforme de réservation d’hôtel.",
    "Crée un portfolio de développeur.",
    "Crée une application de livraison de repas.",
    "Crée une application de gestion d’école.",
    "Crée un site internet pour une ONG.",
    "Crée une boutique en ligne de vêtements.",
    "Crée une application de gestion financière.",
  ];
  const submit = async () => {
    if (prompt.trim().length < 12) {
      toast.error(
        "Décrivez votre idée en quelques mots pour lancer la génération."
      );
      return;
    }
    setGenerating(true);
    setGenerationStep(0);
    const progressStream = new EventSource("/api/generation/stream");
    progressStreamRef.current = progressStream;
    progressStream.onmessage = event => {
      try {
        const payload = JSON.parse(event.data) as { index?: number };
        if (typeof payload.index === "number") setGenerationStep(payload.index);
      } catch {
        // La réponse de génération reste la source de vérité.
      }
    };
    try {
      await onCreate(
        `${prompt}${starterTemplatesEnabled ? `\nTemplate de départ : ${starterTemplate}.` : ""} Style : ${style}. Stack : ${framework}. Niveau : ${level}.`,
        type,
        { ...(starterTemplatesEnabled ? { templateId: starterTemplateIds[starterTemplate] } : {}) }
      );
    } finally {
      progressStreamRef.current?.close();
      progressStreamRef.current = null;
      setGenerating(false);
      setGenerationStep(0);
    }
  };
  const startFromTemplate = async () => {
    setGenerating(true);
    try {
      await onCreate(
        prompt.trim() || `Projet basé sur le template ${starterTemplate}`,
        type,
        { templateId: starterTemplateIds[starterTemplate], templateOnly: true }
      );
    } finally {
      setGenerating(false);
    }
  };
  useEffect(() => {
    if (isFeatureEnabled("prewarmRuntime")) void prewarmWebContainerRuntime();
    return () => progressStreamRef.current?.close();
  }, []);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        className="mb-10 inline-flex items-center gap-2 text-xs text-slate-500 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour aux projets
      </button>
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
          Nouveau projet
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
          Que souhaitez-vous construire aujourd’hui ?
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Décrivez votre idée, choisissez un template ou laissez l’IA vous
          guider.
        </p>
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <section className="bf-surface rounded-2xl p-5 sm:p-7">
          <label className="text-sm font-semibold text-white">Votre idée</label>
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={7}
            placeholder="Décrivez votre application en détail..."
            className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-[#0d1425] p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/10"
          />
          <p className="mt-2 text-[11px] text-slate-600">
            Plus votre description est précise, plus la première génération sera
            pertinente.
          </p>
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-300">
              Besoin d’inspiration ?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ideas.map(idea => (
                <button
                  type="button"
                  key={idea}
                  onClick={() => setPrompt(idea)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-[11px] text-slate-500 transition hover:border-blue-400/30 hover:text-blue-200"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={generating}
            onClick={submit}
            className="bf-primary-button mt-8 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {generationSteps[generationStep]}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Générer avec l’IA
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
          {starterTemplatesEnabled && <button
            type="button"
            disabled={generating}
            onClick={startFromTemplate}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] py-3 text-sm font-semibold text-slate-200 transition hover:border-blue-400/30 hover:bg-white/[0.06] disabled:opacity-60"
          >
            <Code2 className="h-4 w-4" />
            Ouvrir le template sans génération IA
          </button>}
        </section>
        <aside className="space-y-5">
          {starterTemplatesEnabled && <OptionCard
            label="Template de départ"
            value={starterTemplate}
            options={[
              "React + Vite + Tailwind",
              "React + Zustand",
              "Dashboard",
              "Landing page",
            ]}
            onChange={setStarterTemplate}
          />}
          <OptionCard
            label="Type de projet"
            value={type}
            options={[
              "Site vitrine",
              "Application web",
              "Dashboard",
              "Landing page",
              "E-commerce",
              "Portfolio",
              "Blog",
              "Application mobile simulée",
            ]}
            onChange={setType}
          />
          <OptionCard
            label="Framework"
            value={framework}
            options={[
              "React",
              "Next.js",
              "Vue.js",
              "HTML / CSS / JavaScript",
              "Choix automatique par IA",
            ]}
            onChange={setFramework}
          />
          <OptionCard
            label="Style visuel"
            value={style}
            options={[
              "Moderne",
              "Minimaliste",
              "Professionnel",
              "Créatif",
              "Sombre",
              "Coloré",
            ]}
            onChange={setStyle}
          />
          <OptionCard
            label="Niveau"
            value={level}
            options={[
              "Prototype rapide",
              "Application standard",
              "Application complète",
            ]}
            onChange={setLevel}
          />
        </aside>
      </div>
    </main>
  );
}

function OptionCard({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-xl border border-white/[0.07] bg-[#111827]/65 p-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
        {label}
      </span>
      <div className="relative mt-3">
        <select
          value={value}
          onChange={event => onChange(event.target.value)}
          className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 pr-8 text-xs text-slate-200 outline-none focus:border-blue-400/40"
        >
          {options.map(option => (
            <option key={option} value={option} className="bg-[#111827]">
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
      </div>
    </label>
  );
}
