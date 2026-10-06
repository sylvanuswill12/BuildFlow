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
export function NotFoundPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1020] px-4 text-center text-slate-100">
      <div className="max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
          <CircleHelp className="h-7 w-7" />
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
          Erreur 404
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">
          Cette page a disparu dans le flux.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-500">
          Le lien que vous avez suivi n’existe pas ou n’est plus disponible.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="bf-primary-button mt-8 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Home className="h-4 w-4" />
          Retour à l’accueil
        </button>
      </div>
    </div>
  );
}
