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
import { Panel } from "../components/Panel";
export function AdminPage() {
  const adminStats = [
    ["Générations aujourd’hui", "1 284", "+18,2%", Sparkles],
    ["Utilisateurs actifs", "342", "+7,4%", Users2],
    ["Projets publiés", "89", "+12,1%", Globe2],
    ["Taux de réussite", "98,6%", "+0,8%", CheckCircle2],
  ] as const;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
          Console
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
          Administration
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Une vue rapide sur la santé de BuildFlow AI.
        </p>
      </div>
      <div className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {adminStats.map(([label, value, detail, Icon]) => (
          <div key={label} className="bf-surface rounded-2xl p-5">
            <Icon className="h-4 w-4 text-blue-300" />
            <p className="mt-5 text-2xl font-semibold text-white">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{label}</p>
            <p className="mt-3 text-[10px] text-emerald-400">
              {detail} cette semaine
            </p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Panel title="Santé des services">
          <div className="space-y-3">
            {[
              ["Génération IA", "Opérationnel", "blue"],
              ["Prévisualisation", "Opérationnel", "green"],
              ["Base de données", "Opérationnel", "green"],
              ["Export projet", "Surveillé", "amber"],
            ].map(([name, status, tone]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.025] px-4 py-3"
              >
                <span className="text-xs text-slate-300">{name}</span>
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-[10px]",
                    tone === "amber" ? "text-amber-300" : "text-emerald-300"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      tone === "amber" ? "bg-amber-400" : "bg-emerald-400"
                    )}
                  />
                  {status}
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Dernières générations">
          <div className="space-y-4">
            {[
              "Gestionnaire de dépenses",
              "SaaS Analytics",
              "Impact ONG",
              "Booking Flow",
            ].map((name, index) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-[10px] text-slate-700">0{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-300">{name}</p>
                  <div className="mt-2 h-1 rounded-full bg-white/10">
                    <div
                      className="h-1 rounded-full bg-blue-500"
                      style={{ width: `${92 - index * 8}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-slate-600">
                  {92 - index * 8}%
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  );
}
