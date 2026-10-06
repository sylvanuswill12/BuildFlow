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
type IconType = typeof Sparkles;

export function DashboardPage({
  projects,
  navigate,
  setProjects,
  credits,
  generationCount,
  onDeleteProject,
  onUpdateProject,
  onDuplicateProject,
}: {
  projects: Project[];
  navigate: (path: string) => void;
  setProjects: (projects: Project[]) => void;
  credits: number;
  generationCount: number;
  onDeleteProject: (project: Project) => void;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  onDuplicateProject: (project: Project) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = projects.filter(
    project =>
      project.name.toLowerCase().includes(query.toLowerCase()) ||
      project.type.toLowerCase().includes(query.toLowerCase())
  );
  const activeProjects = projects.filter(
    project => project.status !== "Archivé"
  ).length;
  const publishedProjects = projects.filter(
    project => project.status === "Publié"
  ).length;
  const researchHistory = trpc.research.history.useQuery({});
  const researchMemories = trpc.research.memories.useQuery({});
  const renameProject = (project: Project) => {
    const nextName = window.prompt("Nouveau nom du projet", project.name);
    if (nextName?.trim()) {
      onUpdateProject(project.id, {
        name: nextName.trim(),
        updatedAt: "à l’instant",
      });
      toast.success("Projet renommé");
    }
  };
  const duplicateProject = (project: Project) => onDuplicateProject(project);
  const deleteProject = (project: Project) => onDeleteProject(project);
  const archiveProject = (project: Project) => {
    onUpdateProject(project.id, {
      status: "Archivé",
      updatedAt: "à l’instant",
    });
    toast.success("Projet archivé");
  };

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <AnimatedReveal className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
            Vue d’ensemble
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Bonjour, Alex <span className="inline-block">👋</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Prêt à créer quelque chose d’incroyable aujourd’hui ?
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/new")}
          className="bf-primary-button flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          Créer un nouveau projet
        </button>
      </AnimatedReveal>
      <div className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Projets actifs"
          value={String(activeProjects)}
          detail={`${projects.length} au total`}
          icon={Layers3}
          tone="blue"
        />
        <StatCard
          label="Générations utilisées"
          value={String(generationCount)}
          detail="sur votre période actuelle"
          icon={Sparkles}
          tone="violet"
        />
        <StatCard
          label="Crédits restants"
          value={String(credits)}
          detail="Disponibles maintenant"
          icon={Zap}
          tone="green"
        />
        <StatCard
          label="Applications publiées"
          value={String(publishedProjects)}
          detail="Dans votre workspace"
          icon={Globe2}
          tone="amber"
        />
      </div>
      <div className="mt-6">
        <ResearchInsightsPanel
          runs={researchHistory.data ?? []}
          loading={researchHistory.isLoading}
        />
      </div>
      <div className="mt-6">
        <ResearchHistoryPanel
          runs={researchHistory.data ?? []}
          memories={researchMemories.data ?? []}
          navigate={navigate}
        />
      </div>
      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Projets récents
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Reprenez votre travail là où vous l’avez laissé.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Filtrer les projets"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-8 pr-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-blue-400/30 sm:w-48"
              />
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {filtered.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => navigate(`/workspace/${project.id}`)}
                onRename={() => renameProject(project)}
                onDuplicate={() => duplicateProject(project)}
                onArchive={() => archiveProject(project)}
                onDelete={() => deleteProject(project)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                Aucun projet ne correspond à votre recherche.
              </div>
            )}
          </div>
        </section>
        <aside className="space-y-6">
          <Panel title="Activité récente" action="Voir tout">
            <div className="space-y-4">
              {activityItems.map(item => (
                <div key={item.title} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      item.tone === "green"
                        ? "bg-emerald-400"
                        : item.tone === "violet"
                          ? "bg-violet-400"
                          : item.tone === "amber"
                            ? "bg-amber-400"
                            : "bg-blue-400"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-300">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {item.detail} · {item.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="Templates populaires"
            action="Explorer"
            onAction={() => navigate("/templates")}
          >
            <div className="space-y-3">
              {templates.slice(0, 3).map(template => (
                <button
                  type="button"
                  key={template.id}
                  onClick={() => navigate("/new")}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/[0.04]"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      color: template.accent,
                      backgroundColor: `${template.accent}18`,
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-300">
                      {template.name}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-600">
                      {template.category}
                    </span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
                </button>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function parseResearchJson<T>(
  value: string | null | undefined,
  fallback: T
): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function ResearchInsightsPanel({
  runs,
  loading,
}: {
  runs: Array<{
    query: string;
    findings: string | null;
    citations: string | null;
    createdAt: Date;
  }>;
  loading: boolean;
}) {
  const latest = runs[0];
  const findings = parseResearchJson(
    latest?.findings,
    null as {
      summary?: string;
      recommendations?: string[];
      risks?: string[];
    } | null
  );
  const citations = parseResearchJson(
    latest?.citations,
    [] as Array<{ url: string; title: string }>
  );
  return (
    <section className="bf-glass bf-glow overflow-hidden rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-cyan-200">
            <Globe2 className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">
              Research Council
            </p>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Intelligence récente pour vos prochains builds
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Les agents transforment la veille quotidienne en décisions
            concrètes, citées et vérifiables.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Veille quotidienne active
        </span>
      </div>
      {loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="bf-skeleton h-20 rounded-xl" />
          <div className="bf-skeleton h-20 rounded-xl" />
          <div className="bf-skeleton h-20 rounded-xl" />
        </div>
      ) : !latest || !findings ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
            <Search className="h-4 w-4" />
          </span>
          <p className="mt-3 text-sm font-medium text-slate-300">
            Aucun insight de veille pour le moment
          </p>
          <p className="mt-1 max-w-md text-xs leading-5 text-slate-600">
            La prochaine veille quotidienne alimentera automatiquement ce
            panneau. Vous pouvez aussi lancer une recherche depuis l’onglet
            Équipe IA.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Synthèse · {latest.query}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {findings.summary ?? "Synthèse disponible dans l’historique."}
            </p>
            <p className="mt-3 text-[10px] text-cyan-300">
              {citations.length} sources citées ·{" "}
              {latest.createdAt.toLocaleDateString("fr-FR")}
            </p>
          </div>
          <div className="rounded-xl border border-blue-400/10 bg-blue-500/[0.05] p-4">
            <div className="flex items-center gap-2 text-blue-200">
              <Sparkles className="h-3.5 w-3.5" />
              <p className="text-[10px] font-semibold uppercase tracking-wider">
                Opportunités
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {(findings.recommendations ?? []).slice(0, 3).map(item => (
                <li
                  key={item}
                  className="flex gap-2 text-[10px] leading-4 text-slate-400"
                >
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-400/10 bg-amber-500/[0.05] p-4">
            <div className="flex items-center gap-2 text-amber-200">
              <CircleAlert className="h-3.5 w-3.5" />
              <p className="text-[10px] font-semibold uppercase tracking-wider">
                À valider
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {(findings.risks ?? []).slice(0, 3).map(item => (
                <li
                  key={item}
                  className="flex gap-2 text-[10px] leading-4 text-slate-400"
                >
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function ResearchHistoryPanel({
  runs,
  memories,
  navigate,
}: {
  runs: Array<{
    id: string;
    query: string;
    findings: string | null;
    citations: string | null;
    createdAt: Date;
  }>;
  memories: Array<{
    agentRole: string;
    confidence: number;
    sourceRunId: string | null;
  }>;
  navigate: (path: string) => void;
}) {
  const [queryFilter, setQueryFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("Tous les agents");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [decisions, setDecisions] = useState<
    Record<string, "accepted" | "rejected">
  >({});
  const agents = Array.from(
    new Set(memories.map(memory => memory.agentRole))
  ).sort();
  useEffect(() => {
    try {
      const saved = localStorage.getItem("buildflow-research-decisions");
      if (saved)
        setDecisions(
          JSON.parse(saved) as Record<string, "accepted" | "rejected">
        );
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        "buildflow-research-decisions",
        JSON.stringify(decisions)
      );
    } catch {
      /* storage unavailable */
    }
  }, [decisions]);
  const visible = runs.filter(run => {
    const matchesQuery = run.query
      .toLowerCase()
      .includes(queryFilter.toLowerCase());
    const matchesAgent =
      agentFilter === "Tous les agents" ||
      memories.some(
        memory =>
          memory.sourceRunId === run.id && memory.agentRole === agentFilter
      );
    return matchesQuery && matchesAgent;
  });
  const latestFindings = visible[0]
    ? parseResearchJson(visible[0].findings, { recommendations: [], risks: [] })
    : { recommendations: [], risks: [] };
  const previousFindings = visible[1]
    ? parseResearchJson(visible[1].findings, { recommendations: [], risks: [] })
    : { recommendations: [], risks: [] };
  const decide = (key: string, decision: "accepted" | "rejected") => {
    setDecisions(current => ({ ...current, [key]: decision }));
    toast.success(
      decision === "accepted"
        ? "Recommandation ajoutée à vos décisions"
        : "Recommandation écartée"
    );
  };
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[#0e1729]/80 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
            Mémoire & décisions
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Historique de veille
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Filtrez les recherches, validez les recommandations et
            transformez-les en briefs de construction.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={queryFilter}
            onChange={event => setQueryFilter(event.target.value)}
            placeholder="Filtrer par sujet"
            className="w-44 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-white outline-none focus:border-violet-400/40"
          />
          <select
            value={agentFilter}
            onChange={event => setAgentFilter(event.target.value)}
            className="rounded-lg border border-white/10 bg-[#101a2e] px-3 py-2 text-[10px] text-slate-300 outline-none focus:border-violet-400/40"
          >
            <option>Tous les agents</option>
            {agents.map(agent => (
              <option key={agent}>{agent}</option>
            ))}
          </select>
        </div>
      </div>
      {runs.length > 1 && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-violet-400/10 bg-violet-500/[0.05] px-3 py-2">
          <span className="text-[10px] text-slate-400">
            Comparaison avec la veille précédente :{" "}
            <strong className="text-violet-200">
              {latestFindings.recommendations.length -
                previousFindings.recommendations.length >=
              0
                ? "+"
                : ""}
              {latestFindings.recommendations.length -
                previousFindings.recommendations.length}{" "}
              opportunité(s)
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setCompare(value => !value)}
            className="text-[10px] font-medium text-violet-300 hover:text-violet-200"
          >
            {compare ? "Masquer la comparaison" : "Voir la comparaison"}
          </button>
        </div>
      )}
      {compare && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-[9px] text-slate-600">Opportunités</p>
            <p className="mt-1 text-lg font-semibold text-blue-200">
              {latestFindings.recommendations.length -
                previousFindings.recommendations.length >=
              0
                ? "+"
                : ""}
              {latestFindings.recommendations.length -
                previousFindings.recommendations.length}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-[9px] text-slate-600">Risques</p>
            <p className="mt-1 text-lg font-semibold text-amber-200">
              {latestFindings.risks.length - previousFindings.risks.length >= 0
                ? "+"
                : ""}
              {latestFindings.risks.length - previousFindings.risks.length}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-[9px] text-slate-600">Mémoires agents</p>
            <p className="mt-1 text-lg font-semibold text-emerald-200">
              {memories.length}
            </p>
          </div>
        </div>
      )}
      <div className="mt-5 space-y-3">
        {visible.slice(0, 6).map(run => {
          const findings = parseResearchJson(run.findings, {
            summary: "",
            recommendations: [],
            risks: [],
          });
          const citations = parseResearchJson(
            run.citations,
            [] as Array<{ url: string }>
          );
          const isOpen = expanded === run.id;
          return (
            <div
              key={run.id}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : run.id)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-200">
                    {run.query}
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-600">
                    {run.createdAt.toLocaleDateString("fr-FR")} ·{" "}
                    {citations.length} source(s) ·{" "}
                    {findings.recommendations.length} opportunité(s)
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-slate-600 transition",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              {isOpen && (
                <div className="mt-4 border-t border-white/[0.07] pt-4">
                  <p className="text-xs leading-5 text-slate-400">
                    {findings.summary || "Aucune synthèse disponible."}
                  </p>
                  <div className="mt-4 space-y-2">
                    {findings.recommendations.map(
                      (recommendation: string, index: number) => {
                        const key = `${run.id}-${index}`;
                        const decision = decisions[key];
                        return (
                          <div
                            key={key}
                            className="flex flex-col gap-2 rounded-lg border border-blue-400/10 bg-blue-500/[0.04] p-3 sm:flex-row sm:items-center"
                          >
                            <p className="flex-1 text-[10px] leading-4 text-slate-300">
                              {recommendation}
                            </p>
                            <div className="flex shrink-0 gap-1.5">
                              <button
                                type="button"
                                onClick={() => decide(key, "accepted")}
                                className={cn(
                                  "rounded-md px-2 py-1 text-[9px]",
                                  decision === "accepted"
                                    ? "bg-emerald-500/20 text-emerald-200"
                                    : "border border-emerald-400/20 text-emerald-300"
                                )}
                              >
                                {decision === "accepted"
                                  ? "Acceptée"
                                  : "Accepter"}
                              </button>
                              <button
                                type="button"
                                onClick={() => decide(key, "rejected")}
                                className={cn(
                                  "rounded-md px-2 py-1 text-[9px]",
                                  decision === "rejected"
                                    ? "bg-red-500/20 text-red-200"
                                    : "border border-red-400/20 text-red-300"
                                )}
                              >
                                {decision === "rejected"
                                  ? "Écartée"
                                  : "Écarter"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/new?prompt=${encodeURIComponent(`Construis cette amélioration à partir de la veille BuildFlow : ${recommendation}`)}`
                                  )
                                }
                                className="rounded-md border border-violet-400/20 px-2 py-1 text-[9px] text-violet-200 hover:bg-violet-500/10"
                              >
                                Créer un brief
                              </button>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {citations.map((citation, index) => (
                      <a
                        key={`${citation.url}-${index}`}
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[9px] text-slate-500 hover:text-slate-300"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        Source {index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-xs text-slate-600">
            Aucune veille ne correspond à vos filtres.
          </div>
        )}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconType;
  tone: string;
}) {
  const toneClasses =
    tone === "violet"
      ? "bg-violet-500/10 text-violet-300"
      : tone === "green"
        ? "bg-emerald-500/10 text-emerald-300"
        : tone === "amber"
          ? "bg-amber-500/10 text-amber-300"
          : "bg-blue-500/10 text-blue-300";
  return (
    <GlassPanel className="p-5 transition duration-300 hover:-translate-y-1 hover:border-blue-400/20">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            toneClasses
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <AnimatedMetric
        value={value}
        className="mt-5 block text-2xl font-semibold tracking-[-0.04em] text-white"
      />
      <p className="mt-1 text-[11px] text-slate-600">{detail}</p>
    </GlassPanel>
  );
}

function ProjectCard({
  project,
  onOpen,
  onRename,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const statusClass =
    project.status === "Publié"
      ? "text-emerald-300 bg-emerald-500/10"
      : project.status === "En cours"
        ? "text-blue-300 bg-blue-500/10"
        : "text-amber-300 bg-amber-500/10";
  return (
    <div className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111827]/75 transition hover:-translate-y-0.5 hover:border-blue-400/20">
      <button
        type="button"
        onClick={onOpen}
        className="relative block h-32 w-full overflow-hidden text-left"
        style={{
          background: `linear-gradient(135deg, ${project.accent}20, transparent 65%), #0d1425`,
        }}
      >
        <div className="absolute right-5 top-4 h-24 w-36 rounded-xl border border-white/10 bg-white/[0.04] p-3 shadow-2xl">
          <div className="flex gap-2">
            <span
              className="h-2 w-12 rounded-full"
              style={{ backgroundColor: project.accent }}
            />
            <span className="h-2 w-6 rounded-full bg-white/10" />
          </div>
          <div className="mt-4 flex items-end gap-1.5">
            <span
              className="h-9 flex-1 rounded-t"
              style={{ backgroundColor: `${project.accent}bb` }}
            />
            <span className="h-14 flex-1 rounded-t bg-white/10" />
            <span
              className="h-11 flex-1 rounded-t"
              style={{ backgroundColor: `${project.accent}66` }}
            />
          </div>
        </div>
        <div className="absolute bottom-4 left-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-sm font-semibold text-white">
          {project.initials}
        </div>
      </button>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={onOpen} className="min-w-0 text-left">
            <h3 className="truncate text-sm font-semibold text-white transition group-hover:text-blue-200">
              {project.name}
            </h3>
            <p className="mt-1 text-xs text-slate-600">{project.type}</p>
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu(!menu)}
              aria-label="Actions du projet"
              className="rounded-md p-1 text-slate-600 transition hover:bg-white/10 hover:text-slate-200"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menu && (
              <>
                <button
                  type="button"
                  aria-label="Fermer le menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setMenu(false)}
                />
                <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-white/10 bg-[#182238] p-1 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      onOpen();
                    }}
                    className="menu-action"
                  >
                    Ouvrir <ExternalLink className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      onRename();
                    }}
                    className="menu-action"
                  >
                    Renommer <SquarePen className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      onDuplicate();
                    }}
                    className="menu-action"
                  >
                    Dupliquer <Copy className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      downloadProjectZip(project, project.sourceFiles ?? { "src/App.tsx": codeSnippets["src/App.tsx"] });
                      toast.success("Export ZIP téléchargé");
                    }}
                    className="menu-action"
                  >
                    Exporter <Download className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      onArchive();
                    }}
                    className="menu-action"
                  >
                    Archiver <Box className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      onDelete();
                    }}
                    className="menu-action text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3 w-3" />
                    Supprimer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <p className="mt-4 line-clamp-2 text-xs leading-5 text-slate-500">
          {project.description}
        </p>
        <div className="mt-5 flex items-center justify-between">
          <span
            className={cn(
              "rounded-full px-2 py-1 text-[10px] font-medium",
              statusClass
            )}
          >
            {project.status}
          </span>
          <span className="text-[10px] text-slate-600">
            {project.files} fichiers · {project.updatedAt}
          </span>
        </div>
      </div>
    </div>
  );
}
