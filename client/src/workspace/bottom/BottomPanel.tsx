import { Toaster, toast } from "sonner";
import type { RuntimeLogEntry } from "../types";
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

const productionStages = [
  "Analyse du besoin",
  "Planification",
  "Design system",
  "Frontend & backend",
  "Base de données",
  "Tests & corrections",
  "Prévisualisation finale",
];

export function BottomPanel({
  tab,
  setTab,
  activeStage,
  logs,
  errors,
  isRunning,
}: {
  tab: string;
  setTab: (tab: string) => void;
  activeStage: number;
  logs: RuntimeLogEntry[];
  errors: RuntimeLogEntry[];
  isRunning: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-4 border-b border-white/[0.06] px-4">
        <div className="flex gap-4">
          {["Production", "Logs", "Terminal", "Erreurs"].map(item => (
            <button
              type="button"
              key={item}
              onClick={() => setTab(item)}
              className={cn(
                "border-b-2 py-3 text-[10px] font-medium",
                tab === item
                  ? "border-blue-400 text-white"
                  : "border-transparent text-slate-600 hover:text-slate-300"
              )}
            >
              {item}
              {item === "Erreurs" && (
                <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[9px]", errors.length ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300")}>
                  {errors.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className={cn("ml-auto flex items-center gap-1.5 text-[10px]", isRunning ? "text-emerald-400" : "text-amber-300")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", isRunning ? "bg-emerald-400" : "bg-amber-400")} />
          {isRunning ? "Vite actif" : "Runtime en préparation"}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {tab === "Production" && (
          <ProductionTimeline activeStage={activeStage} />
        )}
        {tab === "Logs" && (
          <div className="space-y-1">
            {logs.length ? logs.map(log => (
              <div key={log.id} className="flex gap-3 font-mono text-[10px]">
                <span className="shrink-0 text-slate-700">{log.time}</span>
                <span className={log.level === "error" ? "shrink-0 text-red-300" : "shrink-0 text-blue-300"}>{log.source}</span>
                <span className={log.level === "error" ? "break-all text-red-200" : "break-all text-slate-500"}>{log.message}</span>
              </div>
            )) : <p className="py-3 text-[10px] text-slate-600">En attente des sorties réelles de npm et Vite…</p>}
          </div>
        )}
        {tab === "Terminal" && (
          <pre className="whitespace-pre-wrap break-all font-mono text-[10px] leading-5 text-slate-500">
            {logs.length ? logs.map(log => `[${log.time}] ${log.source}: ${log.message}`).join("\n") : "En attente de la sortie réelle des processus WebContainer…"}
          </pre>
        )}
        {tab === "Erreurs" && (
          errors.length ? (
            <div className="space-y-2">
              {errors.map(error => <div key={error.id} className="rounded-md border border-red-400/15 bg-red-500/5 px-3 py-2 font-mono text-[10px] text-red-200"><span className="mr-2 text-red-400">[{error.time} · {error.source}]</span>{error.message}</div>)}
            </div>
          ) : <div className="flex items-center gap-2 py-2 text-[10px] text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Aucune erreur runtime capturée.</div>
        )}
      </div>
    </div>
  );
}

function ProductionTimeline({ activeStage }: { activeStage: number }) {
  return (
    <div className="flex h-full items-center gap-2 overflow-x-auto py-2">
      {productionStages.map((stage, index) => {
        const complete = index < activeStage;
        const active = index === activeStage;
        return (
          <div key={stage} className="flex min-w-[120px] items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                complete
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                  : active
                    ? "border-blue-400/50 bg-blue-500/15 text-blue-200"
                    : "border-white/10 bg-white/[0.03] text-slate-600"
              )}
            >
              {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </div>
            <div>
              <p
                className={cn(
                  "text-[10px] font-medium",
                  active
                    ? "text-blue-200"
                    : complete
                      ? "text-slate-300"
                      : "text-slate-600"
                )}
              >
                {stage}
              </p>
              <p className="mt-0.5 text-[9px] text-slate-700">
                {complete ? "Terminé" : active ? "En cours" : "En attente"}
              </p>
            </div>
            {index < productionStages.length - 1 && (
              <span
                className={cn(
                  "h-px w-5 shrink-0",
                  complete ? "bg-emerald-400/40" : "bg-white/10"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
