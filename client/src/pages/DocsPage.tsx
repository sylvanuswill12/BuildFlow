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


const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");
export function DocsPage({ navigate }: { navigate: (path: string) => void }) {
  const [section, setSection] = useState("Introduction");
  const docs: Record<
    string,
    { title: string; body: string; points: string[] }
  > = {
    Introduction: {
      title: "Construire avec BuildFlow AI",
      body: "BuildFlow transforme votre idée en une base d’application claire, modifiable et prête à évoluer. Commencez par décrire ce que vous voulez construire, puis utilisez la conversation pour affiner chaque écran.",
      points: [
        "Un prompt précis donne une meilleure première structure.",
        "Chaque génération reste inspectable dans l’arbre de fichiers.",
        "La preview vous permet de valider l’expérience avant de publier.",
      ],
    },
    "Prompts efficaces": {
      title: "Écrire de meilleurs prompts",
      body: "Décrivez le rôle de vos utilisateurs, les actions principales, les données à afficher et le ton visuel recherché. Vous pouvez toujours ajouter des contraintes dans un second message.",
      points: [
        "Commencez par le résultat attendu.",
        "Nommez les pages et les composants clés.",
        "Ajoutez les cas d’erreur et les états vides.",
      ],
    },
    Workspace: {
      title: "Comprendre le workspace",
      body: "Le workspace est organisé comme un atelier : conversation à gauche, preview au centre, fichiers à droite et logs en bas. Chaque zone peut évoluer indépendamment.",
      points: [
        "Cliquez sur un fichier pour inspecter son code.",
        "Utilisez les modes desktop, tablette et mobile.",
        "Les versions vous permettent de revenir à un état précédent.",
      ],
    },
    Publication: {
      title: "Prévisualiser et publier",
      body: "Quand votre application est prête, utilisez la preview pour vérifier les détails puis publiez une version. Dans cette démonstration, la publication est simulée.",
      points: [
        "Corrigez d’abord les erreurs affichées dans les logs.",
        "Partagez une preview avec votre équipe.",
        "Gardez un nom de version explicite.",
      ],
    },
  };
  const current = docs[section];
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
            Ressources
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Documentation
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Les bases pour transformer une idée en produit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/new")}
          className="bf-primary-button flex items-center gap-2 self-start rounded-lg px-4 py-2.5 text-xs font-semibold text-white"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Commencer à construire
        </button>
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="space-y-1">
          {Object.keys(docs).map(item => (
            <button
              type="button"
              key={item}
              onClick={() => setSection(item)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs",
                section === item
                  ? "bg-blue-500/12 text-blue-200"
                  : "text-slate-600 hover:bg-white/5 hover:text-slate-300"
              )}
            >
              {(() => {
                const Icon =
                  item === "Introduction"
                    ? BookOpen
                    : item === "Prompts efficaces"
                      ? WandSparkles
                      : item === "Workspace"
                        ? PanelRight
                        : Rocket;
                return (
                  <>
                    <Icon className="h-3.5 w-3.5" />
                    {item}
                  </>
                );
              })()}
            </button>
          ))}
        </nav>
        <article className="bf-surface rounded-2xl p-6 sm:p-9">
          <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
            Guide BuildFlow
          </span>
          <h2 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">
            {current.title}
          </h2>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">
            {current.body}
          </p>
          <div className="mt-8 space-y-3">
            {current.points.map(point => (
              <div
                key={point}
                className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 text-sm text-slate-300"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {point}
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-xl border border-blue-400/15 bg-blue-500/[0.06] p-5">
            <div className="flex gap-3">
              <CircleHelp className="h-5 w-5 shrink-0 text-blue-300" />
              <div>
                <p className="text-xs font-semibold text-blue-100">
                  Besoin d’aide ?
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Notre équipe est là pour vous aider à débloquer votre
                  prochaine idée.
                </p>
              </div>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
