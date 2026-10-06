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
import { TemplateCard } from "./HomePage";
export function TemplatesPage({
  navigate,
  onUse,
}: {
  navigate: (path: string) => void;
  onUse: (template: (typeof templates)[number]) => void;
}) {
  const [category, setCategory] = useState("Tous");
  const [query, setQuery] = useState("");
  const categories = [
    "Tous",
    "Dashboard",
    "Portfolio",
    "Productivité",
    "E-commerce",
    "Association",
    "Réservation",
  ];
  const visible = templates.filter(
    template =>
      (category === "Tous" || template.category === category) &&
      template.name.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
            Bibliothèque
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Templates prêts à démarrer.
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Une base solide pour chaque idée.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/new")}
          className="bf-primary-button flex items-center gap-2 self-start rounded-lg px-4 py-2.5 text-sm font-semibold text-white sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Partir de zéro
        </button>
      </div>
      <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map(item => (
            <button
              type="button"
              key={item}
              onClick={() => setCategory(item)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs",
                category === item
                  ? "bg-blue-500/15 text-blue-200"
                  : "text-slate-600 hover:bg-white/5 hover:text-slate-300"
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Rechercher"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-8 pr-3 text-xs text-white outline-none sm:w-52"
          />
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            onUse={() => onUse(template)}
          />
        ))}
      </div>
    </main>
  );
}
