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
  Fragment,
  lazy,
  Suspense,
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

import type { ProjectAgent } from "../WorkspacePage";
import { buildProjectFileTree, type ProjectTreeNode } from "@/lib/projectFileTree";
import { diffFileContents, diffProjectFileMaps, type ProjectFileChange } from "@/lib/fileDiff";
const MonacoEditor = lazy(() => import("@monaco-editor/react"));

function editorLanguage(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  return ({ tsx: "typescript", ts: "typescript", jsx: "javascript", js: "javascript", json: "json", css: "css", html: "html", md: "markdown" } as Record<string, string>)[extension ?? ""] ?? "plaintext";
}

export function FilesPanel({
  projectId,
  activeFile,
  chooseFile,
  rightTab,
  setRightTab,
  agents,
  motionEnabled,
  code,
  setCode,
  files,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  versions,
  onRestore,
  onViewSnapshot,
  selectedSnapshotId,
  snapshotFiles,
  pendingChanges,
  onAcceptChange,
  onRejectChange,
}: {
  projectId: string;
  activeFile: string;
  chooseFile: (file: string) => void;
  rightTab: WorkspaceTab;
  setRightTab: (tab: WorkspaceTab) => void;
  agents: ProjectAgent[];
  motionEnabled: boolean;
  code: string;
  setCode: (code: string) => void;
  files: Record<string, string>;
  onCreateFile: (path: string, content?: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onDeleteFile: (path: string) => void;
  versions: Array<{ id: string; label: string; createdAt: Date | string }>;
  onRestore: (snapshotId: string) => void;
  onViewSnapshot: (snapshotId: string) => void;
  selectedSnapshotId?: string;
  snapshotFiles?: Record<string, string>;
  pendingChanges: ProjectFileChange[];
  onAcceptChange: (path: string) => void;
  onRejectChange: (path: string) => void;
}) {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const tree = useMemo(() => buildProjectFileTree(files), [files]);
  const renderTree = (nodes: ProjectTreeNode[], depth = 0): ReactNode => nodes.map(node => {
    const isActive = node.kind === "file" && node.path === activeFile;
    const isCollapsed = collapsedFolders.has(node.path);
    const Icon = node.kind === "folder"
      ? isCollapsed ? Folder : FolderOpen
      : node.name.endsWith(".json") ? FileJson : node.name.endsWith(".md") ? FileText : FileCode2;
    return (
      <Fragment key={node.path}>
        <button
          type="button"
          onClick={() => node.kind === "folder"
            ? setCollapsedFolders(current => {
                const next = new Set(current);
                if (next.has(node.path)) next.delete(node.path); else next.add(node.path);
                return next;
              })
            : chooseFile(node.path)}
          className={cn("flex w-full items-center gap-1.5 rounded-md py-1.5 text-left text-[11px] transition", isActive ? "bg-blue-500/12 text-blue-200" : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300")}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          aria-expanded={node.kind === "folder" ? !isCollapsed : undefined}
        >
          {node.kind === "folder" ? <ChevronRight className={cn("h-3 w-3 transition", !isCollapsed && "rotate-90")} /> : <span className="w-3" />}
          <Icon className={cn("h-3.5 w-3.5 shrink-0", node.kind === "folder" ? "text-amber-300/70" : "text-slate-600")} />
          <span className="truncate">{node.name}</span>
          {isActive && <span className="ml-auto mr-2 h-1.5 w-1.5 rounded-full bg-blue-400" />}
        </button>
        {node.kind === "folder" && !isCollapsed && renderTree(node.children, depth + 1)}
      </Fragment>
    );
  });
  const tabs: WorkspaceTab[] = [
    "Fichiers",
    "Code",
    "Composants",
    "Données",
    "Équipe IA",
    "Historique",
    "Diff",
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.06] px-2">
        {tabs.map(tab => (
          <button
            type="button"
            key={tab}
            onClick={() => setRightTab(tab)}
            className={cn(
              "shrink-0 rounded-md px-2 py-1.5 text-[10px] font-medium",
              rightTab === tab
                ? "bg-white/10 text-white"
                : "text-slate-600 hover:text-slate-300"
            )}
          >
            {tab}
          </button>
        ))}
      </div>
      {rightTab === "Fichiers" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{Object.keys(files).length} fichiers</span>
            <div className="flex items-center gap-1">
              <button type="button" title="Créer un fichier" onClick={() => {
                const path = window.prompt("Chemin du nouveau fichier", "src/components/NewComponent.tsx");
                if (path) onCreateFile(path);
              }} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-white"><Plus className="h-3.5 w-3.5" /></button>
              <button type="button" title="Créer un dossier" onClick={() => {
                const path = window.prompt("Chemin du nouveau dossier", "src/components/new-folder");
                if (path) onCreateFile(`${path.replace(/\/$/, "")}/.gitkeep`, "");
              }} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-white"><Folder className="h-3.5 w-3.5" /></button>
              <button type="button" title="Renommer le fichier actif" disabled={!files[activeFile]} onClick={() => {
                const path = window.prompt("Nouveau chemin", activeFile);
                if (path && path !== activeFile) onRenameFile(activeFile, path);
              }} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-white disabled:opacity-30"><SquarePen className="h-3.5 w-3.5" /></button>
              <button type="button" title="Supprimer le fichier actif" disabled={!files[activeFile] || activeFile === "src/App.tsx"} onClick={() => {
                if (window.confirm(`Supprimer ${activeFile} ?`)) onDeleteFile(activeFile);
              }} className="rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          {tree.length ? renderTree(tree) : <p className="p-3 text-xs text-slate-600">Aucun fichier dans ce projet.</p>}
        </div>
      )}
      {rightTab === "Code" && (
        <div className="min-h-0 flex-1 p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] text-slate-600">
            <span>{activeFile}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(code);
                toast.success("Code copié");
              }}
              className="hover:text-slate-300"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
          <div className="h-[calc(100%-2rem)] min-h-[350px] overflow-hidden rounded-lg border border-white/[0.07] bg-[#080e1b]">
            <Suspense fallback={<div className="p-4 text-xs text-slate-500">Chargement de Monaco…</div>}>
              <MonacoEditor
                height="100%"
                language={editorLanguage(activeFile)}
                theme="vs-dark"
                value={code}
                onChange={value => setCode(value ?? "")}
                options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: "on", wordWrap: "on", scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2 }}
              />
            </Suspense>
          </div>
        </div>
      )}
      {rightTab === "Composants" && <ComponentList />}
      {rightTab === "Données" && <DataList />}
      {rightTab === "Équipe IA" && (
        <AgentTeamPanel
          projectId={projectId}
          agents={agents}
          motionEnabled={motionEnabled}
        />
      )}
      {rightTab === "Historique" && (
        <HistoryList
          versions={versions}
          currentFiles={files}
          onRestore={onRestore}
          onViewSnapshot={onViewSnapshot}
          selectedSnapshotId={selectedSnapshotId}
          snapshotFiles={snapshotFiles}
        />
      )}
      {rightTab === "Diff" && <DiffReviewPanel changes={pendingChanges} onAccept={onAcceptChange} onReject={onRejectChange} />}
    </div>
  );
}

function AgentTeamPanel({
  projectId,
  agents,
  motionEnabled,
}: {
  projectId: string;
  agents: ProjectAgent[];
  motionEnabled: boolean;
}) {
  const [selected, setSelected] = useState<ProjectAgent | null>(null);
  const [researchQuery, setResearchQuery] = useState(
    "Quelles pratiques modernes amélioreront ce produit ?"
  );
  const [researchSources, setResearchSources] = useState(
    "https://nextjs.org/docs\nhttps://web.dev/learn"
  );
  const researchRun = trpc.research.run.useMutation();
  const startResearch = () => {
    const sources = researchSources
      .split("\n")
      .map(url => url.trim())
      .filter(Boolean)
      .map(url => ({ url, trustScore: 70 }));
    researchRun.mutate({ projectId, query: researchQuery, sources });
  };
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="mb-3 rounded-xl border border-violet-400/15 bg-violet-500/[0.07] p-3">
        <div className="flex items-center gap-2 text-violet-200">
          <Users2 className="h-4 w-4" />
          <span className="text-[11px] font-semibold">Équipe IA</span>
        </div>
        <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
          Des agents spécialisés coordonnés pour transformer votre idée en
          produit.
        </p>
      </div>
      <div className="mb-3 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.05] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-cyan-200">
            <Globe2 className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold">Research Council</span>
          </div>
          <span className="text-[9px] text-slate-600">
            Sources citées · mémoire projet
          </span>
        </div>
        <input
          value={researchQuery}
          onChange={event => setResearchQuery(event.target.value)}
          className="mt-2 w-full rounded-md border border-white/10 bg-[#081120] px-2.5 py-2 text-[10px] text-slate-300 outline-none focus:border-cyan-400/40"
          placeholder="Question de recherche"
        />
        <textarea
          value={researchSources}
          onChange={event => setResearchSources(event.target.value)}
          className="mt-1.5 h-12 w-full resize-none rounded-md border border-white/10 bg-[#081120] px-2.5 py-2 text-[9px] leading-4 text-slate-500 outline-none focus:border-cyan-400/40"
          placeholder="Une URL publique par ligne"
        />
        <button
          type="button"
          onClick={startResearch}
          disabled={researchRun.isPending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-2 text-[10px] font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-60"
        >
          {researchRun.isPending ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <Search className="h-3 w-3" />
          )}
          {researchRun.isPending
            ? "Analyse des sources…"
            : "Lancer une recherche avancée"}
        </button>
        {researchRun.data && (
          <div className="mt-2 rounded-md border border-emerald-400/15 bg-emerald-500/[0.06] p-2">
            <p className="text-[9px] leading-4 text-slate-300">
              {researchRun.data.summary}
            </p>
            <p className="mt-1 text-[9px] text-emerald-300">
              {researchRun.data.citations.length} sources citées · mémoire
              enregistrée
            </p>
          </div>
        )}
        {researchRun.error && (
          <p className="mt-2 text-[9px] leading-4 text-red-300">
            {researchRun.error.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        {agents.map(agent => {
          const AgentIcon = agent.icon;
          const active =
            agent.status !== "En attente" && agent.status !== "Terminé";
          return (
            <motion.button
              type="button"
              key={agent.name}
              onClick={() => setSelected(agent)}
              layout
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5 text-left transition hover:border-blue-400/20 hover:bg-white/[0.05]"
              initial={motionEnabled ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              whileHover={motionEnabled ? { y: -2 } : undefined}
              whileTap={motionEnabled ? { scale: 0.985 } : undefined}
              transition={{
                duration: 0.2,
                delay: motionEnabled ? agents.indexOf(agent) * 0.025 : 0,
              }}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    active
                      ? "bg-blue-500/15 text-blue-300"
                      : agent.status === "Terminé"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-white/[0.05] text-slate-500"
                  )}
                >
                  <AgentIcon
                    className={cn("h-3.5 w-3.5", active && "animate-pulse")}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-semibold text-slate-300">
                    {agent.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] text-slate-600">
                    {agent.role}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[9px]",
                    active
                      ? "text-blue-300"
                      : agent.status === "Terminé"
                        ? "text-emerald-300"
                        : "text-slate-600"
                  )}
                >
                  {agent.status}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    agent.status === "Terminé"
                      ? "bg-emerald-400"
                      : "bg-blue-400"
                  )}
                  style={{ width: `${agent.progress}%` }}
                />
              </div>
              <p className="mt-1.5 truncate text-[9px] text-slate-600">
                {agent.lastAction}
              </p>
            </motion.button>
          );
        })}
      </div>
      {selected && (
        <div className="mt-3 rounded-lg border border-blue-400/15 bg-blue-500/[0.06] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-blue-100">
              Rapport · {selected.name}
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-slate-600 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-400">
            {selected.report}
          </p>
          <p className="mt-2 text-[9px] text-slate-600">
            Mission : {selected.mission}
          </p>
        </div>
      )}
    </div>
  );
}

function ComponentList() {
  return (
    <div className="space-y-2 overflow-y-auto p-3">
      {[
        "Sidebar",
        "DashboardCard",
        "ExpenseChart",
        "ExpenseForm",
        "TransactionList",
      ].map((item, index) => (
        <div
          key={item}
          className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/10 text-violet-300">
            <Code2 className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[11px] font-medium text-slate-300">{item}.tsx</p>
            <p className="mt-1 text-[10px] text-slate-600">
              {index + 2} props · utilisé {index + 1}×
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DataList() {
  return (
    <div className="space-y-2 p-3">
      {[
        ["transactions", "12 entrées", Database],
        ["categories", "6 entrées", Layers3],
        ["monthlyStats", "6 entrées", BarChart3],
      ].map(([name, detail, Icon]) => (
        <div
          key={name as string}
          className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"
        >
          <Icon className="h-4 w-4 text-blue-300" />
          <div>
            <p className="text-[11px] font-medium text-slate-300">
              {name as string}.json
            </p>
            <p className="mt-1 text-[10px] text-slate-600">
              {detail as string}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DiffReviewPanel({
  changes,
  onAccept,
  onReject,
}: {
  changes: ProjectFileChange[];
  onAccept: (path: string) => void;
  onReject: (path: string) => void;
}) {
  if (!changes.length) return <div className="p-5 text-xs text-slate-600">Aucun changement en attente. Une génération récente affichera ici les fichiers modifiés.</div>;
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {changes.map(change => (
        <section key={change.path} className="overflow-hidden rounded-lg border border-white/[0.08]">
          <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.025] px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-200">{change.path}</span>
            <span className="text-[9px] uppercase text-violet-300">{change.kind}</span>
            <button type="button" onClick={() => onAccept(change.path)} className="rounded px-2 py-1 text-[9px] text-emerald-300 hover:bg-emerald-500/10">Accepter</button>
            <button type="button" onClick={() => onReject(change.path)} className="rounded px-2 py-1 text-[9px] text-red-300 hover:bg-red-500/10">Refuser</button>
          </div>
          <pre className="max-h-64 overflow-auto bg-[#080e1b] p-2 font-mono text-[9px] leading-4">
            {diffFileContents(change.before ?? "", change.after ?? "").map((line, index) => (
              <span key={`${index}-${line.type}`} className={line.type === "added" ? "block bg-emerald-500/10 text-emerald-300" : line.type === "removed" ? "block bg-red-500/10 text-red-300" : "block text-slate-500"}>
                {line.type === "added" ? "+ " : line.type === "removed" ? "- " : "  "}{line.text || " "}
              </span>
            ))}
          </pre>
        </section>
      ))}
    </div>
  );
}

function HistoryList({
  versions,
  currentFiles,
  onRestore,
  onViewSnapshot,
  selectedSnapshotId,
  snapshotFiles,
}: {
  versions: Array<{ id: string; label: string; createdAt: Date | string }>;
  currentFiles: Record<string, string>;
  onRestore: (snapshotId: string) => void;
  onViewSnapshot: (snapshotId: string) => void;
  selectedSnapshotId?: string;
  snapshotFiles?: Record<string, string>;
}) {
  const changes = selectedSnapshotId && snapshotFiles
    ? diffProjectFileMaps(currentFiles, snapshotFiles)
    : [];
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {versions.length === 0 && <p className="text-xs text-slate-600">Aucun snapshot enregistré pour ce projet.</p>}
      {versions.map((version, index) => (
        <div key={version.id} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] text-slate-300">{version.label}</p>
              <p className="mt-1 text-[9px] text-slate-600">{new Date(version.createdAt).toLocaleString("fr-FR")} · snapshot complet</p>
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => onViewSnapshot(version.id)} className="text-[9px] text-blue-300 hover:text-blue-200">{selectedSnapshotId === version.id ? "Actualiser le diff" : "Comparer"}</button>
            <button type="button" onClick={() => { if (window.confirm(`Restaurer tous les fichiers de « ${version.label} » ?`)) onRestore(version.id); }} className="text-[9px] text-amber-300 hover:text-amber-200">Restaurer tous les fichiers</button>
          </div>
          {selectedSnapshotId === version.id && (
            <div className="mt-3 border-t border-white/[0.06] pt-2">
              {!snapshotFiles ? <p className="text-[9px] text-slate-600">Chargement du snapshot…</p> : changes.length === 0 ? <p className="text-[9px] text-slate-600">Aucune différence avec le projet actuel.</p> : changes.map(change => (
                <div key={change.path} className="mt-2 rounded border border-white/[0.05] p-2">
                  <p className="mb-1 text-[9px] text-slate-300">{change.kind}: {change.path}</p>
                  <pre className="max-h-24 overflow-auto font-mono text-[8px] leading-3">
                    {diffFileContents(change.before ?? "", change.after ?? "", 120).map((line, lineIndex) => <span key={`${lineIndex}-${line.type}`} className={line.type === "added" ? "block text-emerald-300" : line.type === "removed" ? "block text-red-300" : "block text-slate-600"}>{line.type === "added" ? "+ " : line.type === "removed" ? "- " : "  "}{line.text}</span>)}
                  </pre>
                </div>
              ))}
            </div>
          )}
          {index === 0 && <span className="sr-only">Version la plus récente</span>}
        </div>
      ))}
    </div>
  );
}
