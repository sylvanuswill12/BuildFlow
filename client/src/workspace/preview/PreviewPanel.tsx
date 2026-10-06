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
import type { RuntimeLogEntry, RuntimeStatus } from "../types";
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

export function PreviewPanel({
  mode,
  setMode,
  revision,
  code,
  files,
  onLog,
  onRuntimeState,
}: {
  mode: "desktop" | "tablet" | "mobile";
  setMode: (mode: "desktop" | "tablet" | "mobile") => void;
  revision: number;
  code: string;
  files: Record<string, string>;
  onLog?: (entry: Omit<RuntimeLogEntry, "id" | "time">) => void;
  onRuntimeState?: (status: RuntimeStatus) => void;
}) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [runtimeState, setRuntimeState] = useState<
    "idle" | "starting" | "running" | "error"
  >("idle");
  const [runtimeUrl, setRuntimeUrl] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState("");
  const [runtimeLogs, setRuntimeLogs] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const width =
    mode === "desktop" ? "w-full" : mode === "tablet" ? "w-[76%]" : "w-[320px]";
  const appendLog = (message: string) => {
    const lines = message
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length) {
      setRuntimeLogs(current => [...current, ...lines].slice(-80));
      for (const line of lines) {
        const isError = /\b(error|failed|exception|unable to|could not)\b/i.test(line);
        onLog?.({
          source: isError ? "stderr" : "stdout",
          level: isError ? "error" : "info",
          message: line,
        });
      }
    }
  };
  const startRuntime = async (notify = true) => {
    setRuntimeState("starting");
    setRuntimeError("");
    setRuntimeLogs([]);
    try {
      if (runtimeUrl) {
        await updateWebContainerRuntime(code, files, appendLog);
        setRuntimeState("running");
        setRefreshNonce(value => value + 1);
        if (notify) toast.success("Preview réelle actualisée");
        return;
      }
      const url = await startWebContainerRuntime(code, files, appendLog);
      setRuntimeUrl(url);
      setRuntimeState("running");
      if (notify) toast.success("Runtime réel démarré");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Le runtime n’a pas pu démarrer.";
      appendLog(message);
      setRuntimeError(message);
      setRuntimeState("error");
      toast.error(message);
    }
  };
  useEffect(() => {
    void startRuntime(false);
    // Start the actual project runtime once when the workspace opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    onRuntimeState?.(runtimeState);
  }, [runtimeState, onRuntimeState]);
  useEffect(() => {
    const receiveRuntimeMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { source?: unknown; type?: unknown; level?: unknown; message?: unknown };
      if (data?.source !== "buildflow-preview-runtime" || data.type !== "console") return;
      const message = typeof data.message === "string" ? data.message : String(data.message ?? "Erreur runtime");
      const level = data.level === "error" ? "error" : "warn";
      onLog?.({ source: "iframe", level, message });
      if (level === "error") {
        setRuntimeLogs(current => [...current, `[iframe] ${message}`].slice(-80));
        setRuntimeError(message);
      }
    };
    window.addEventListener("message", receiveRuntimeMessage);
    return () => window.removeEventListener("message", receiveRuntimeMessage);
  }, [onLog]);
  useEffect(() => {
    if (!runtimeUrl || runtimeState !== "running") return;
    const timer = window.setTimeout(() => {
      void updateWebContainerRuntime(code, files, appendLog).catch(error => {
        const message =
          error instanceof Error
            ? error.message
            : "La mise à jour du runtime a échoué.";
        appendLog(message);
        setRuntimeError(message);
        setRuntimeState("error");
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [code, files, runtimeState, runtimeUrl]);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0b1222]">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">
            Preview{" "}
            <span className="ml-1 text-[10px] font-normal text-slate-600">
              v{revision}
            </span>
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px]",
              runtimeState === "running"
                ? "bg-emerald-500/10 text-emerald-300"
                : runtimeState === "error"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-amber-500/10 text-amber-300"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                runtimeState === "running"
                  ? "bg-emerald-400"
                  : runtimeState === "error"
                    ? "bg-red-400"
                    : "bg-amber-400"
              )}
            />
            {runtimeState === "running"
              ? "Runtime réel"
              : runtimeState === "starting"
                ? "Démarrage…"
                : runtimeState === "error"
                  ? "Erreur runtime"
                  : "Runtime en attente"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void startRuntime()}
            disabled={runtimeState === "starting"}
            className="mr-1 inline-flex items-center gap-1.5 rounded-md border border-blue-400/20 bg-blue-500/10 px-2 py-1.5 text-[10px] font-medium text-blue-200 disabled:cursor-wait disabled:opacity-60"
            title="Démarrer ou actualiser le runtime"
          >
            {runtimeState === "starting" ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            {runtimeState === "running" ? "Actualiser" : "Lancer le runtime"}
          </button>
          <button
            type="button"
            onClick={() => setMode("desktop")}
            className={cn(
              "rounded-md p-1.5",
              mode === "desktop"
                ? "bg-white/10 text-white"
                : "text-slate-600 hover:text-slate-300"
            )}
            title="Desktop"
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMode("tablet")}
            className={cn(
              "rounded-md p-1.5",
              mode === "tablet"
                ? "bg-white/10 text-white"
                : "text-slate-600 hover:text-slate-300"
            )}
            title="Tablette"
          >
            <Tablet className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMode("mobile")}
            className={cn(
              "rounded-md p-1.5",
              mode === "mobile"
                ? "bg-white/10 text-white"
                : "text-slate-600 hover:text-slate-300"
            )}
            title="Mobile"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void startRuntime()}
            className="rounded-md p-1.5 text-slate-600 hover:text-slate-300"
            title="Actualiser la preview"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => runtimeUrl && window.open(runtimeUrl, "_blank", "noopener,noreferrer")}
            disabled={!runtimeUrl}
            className="rounded-md p-1.5 text-slate-600 hover:text-slate-300 disabled:opacity-30"
            title="Ouvrir la preview"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-600 hover:text-slate-300"
            title="Plein écran"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {runtimeError && (
        <div className="border-b border-red-400/20 bg-red-500/10 px-4 py-2 text-[11px] leading-5 text-red-200">
          <strong>Le runtime a rencontré une erreur.</strong> Corrigez le code
          ou relancez le runtime. {runtimeError}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-8">
        <div
          className={cn(
            "relative mx-auto min-h-full overflow-hidden rounded-xl border border-white/10 bg-[#f8fafc] shadow-2xl transition-all duration-300",
            width
          )}
        >
          {runtimeUrl ? (
            <iframe
              ref={iframeRef}
              key={`${refreshNonce}-${runtimeUrl}`}
              title="Preview de l’application générée"
              sandbox="allow-scripts allow-forms allow-modals allow-same-origin allow-popups"
              src={runtimeUrl}
              className="h-[680px] min-h-full w-full border-0"
            />
          ) : (
            <div className="flex min-h-[680px] items-center justify-center bg-[#0d1425] px-8 text-center text-slate-300">
              <div className="max-w-md">
                {runtimeState === "starting" ? <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-300" /> : <CircleAlert className="mx-auto h-6 w-6 text-amber-300" />}
                <h2 className="mt-4 text-sm font-semibold text-white">
                  {runtimeState === "starting" ? "Préparation de votre application" : runtimeState === "error" ? "Le runtime n’a pas démarré" : "Démarrage du runtime"}
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {runtimeState === "starting" ? "Installation des dépendances et compilation des fichiers réels…" : runtimeError || "La preview s’affichera dès que Vite aura compilé le projet."}
                </p>
                {runtimeLogs.length > 0 && <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/20 p-3 text-left font-mono text-[10px] text-slate-400">{runtimeLogs.slice(-12).join("\n")}</pre>}
              </div>
            </div>
          )}
        </div>
        {runtimeLogs.length > 0 && (
          <details className="mx-auto mt-4 max-w-4xl rounded-lg border border-white/[0.07] bg-black/20 p-3 text-[10px] text-slate-400">
            <summary className="cursor-pointer text-slate-300">
              Logs du runtime ({runtimeLogs.length})
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono">
              {runtimeLogs.join("\n")}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
