import { Toaster, toast } from "sonner";
import { Panel } from "@/components/Panel";
import type { AgentAction, AgentMode } from "@shared/agentActions";
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
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { AnimatePresence, motion } from "motion/react";
import { useBuildFlowStore, type WorkspaceTab } from "@/stores/buildflowStore";
import {
  AmbientBackground,
  AnimatedMetric,
  AnimatedReveal,
  GlassPanel,
} from "@/components/buildflow/motion";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { readFeatureSettings } from "@/lib/featureSettings";
import { getStarterTemplateFiles, type StarterTemplateId } from "@shared/starterTemplates";

const HomePage = lazy(() => import("@/pages/HomePage").then(module => ({ default: module.HomePage })));
const AuthPage = lazy(() => import("@/pages/AuthPage").then(module => ({ default: module.AuthPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then(module => ({ default: module.DashboardPage })));
const NewProjectPage = lazy(() => import("@/pages/NewProjectPage").then(module => ({ default: module.NewProjectPage })));
const TemplatesPage = lazy(() => import("@/pages/TemplatesPage").then(module => ({ default: module.TemplatesPage })));
const BillingPage = lazy(() => import("@/pages/BillingPage").then(module => ({ default: module.BillingPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then(module => ({ default: module.SettingsPage })));
const DocsPage = lazy(() => import("@/pages/DocsPage").then(module => ({ default: module.DocsPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then(module => ({ default: module.AdminPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then(module => ({ default: module.NotFoundPage })));
const WorkspacePage = lazy(() => import("./workspace/WorkspacePage").then(module => ({ default: module.WorkspacePage })));

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type IconType = typeof Sparkles;

type NavItem = {
  label: string;
  path: string;
  icon: IconType;
};

const navItems: NavItem[] = [
  { label: "Mes projets", path: "/dashboard", icon: LayoutDashboard },
  { label: "Templates", path: "/templates", icon: Layers3 },
  { label: "Favoris", path: "/dashboard?filter=favorites", icon: Heart },
  { label: "Activité", path: "/dashboard?view=activity", icon: Zap },
  { label: "Facturation", path: "/billing", icon: CreditCard },
  { label: "Paramètres", path: "/settings", icon: Settings },
];

type ApiProject = Omit<
  Project,
  | "updatedAt"
  | "sourceFiles"
  | "deploymentProvider"
  | "deploymentId"
  | "deploymentUrl"
  | "deploymentStatus"
  | "deploymentError"
  | "deployedRevision"
> & {
  updatedAt: Date | string;
  sourceFiles?: string | null;
  deploymentProvider?: Project["deploymentProvider"] | null;
  deploymentId?: string | null;
  deploymentUrl?: string | null;
  deploymentStatus?: Project["deploymentStatus"] | null;
  deploymentError?: string | null;
  deployedRevision?: number | null;
};
const normalizeProject = (project: ApiProject): Project => {
  const {
    sourceFiles: rawSourceFiles,
    deploymentProvider,
    deploymentId,
    deploymentUrl,
    deploymentStatus,
    deploymentError,
    deployedRevision,
    ...projectWithoutSourceFiles
  } = project;
  let sourceFiles: Record<string, string> | undefined;
  if (rawSourceFiles) {
    try {
      const parsed = JSON.parse(rawSourceFiles) as unknown;
      if (parsed && typeof parsed === "object")
        sourceFiles = parsed as Record<string, string>;
    } catch {
      sourceFiles = undefined;
    }
  }
  return {
    ...projectWithoutSourceFiles,
    ...(deploymentProvider ? { deploymentProvider } : {}),
    ...(deploymentId ? { deploymentId } : {}),
    ...(deploymentUrl ? { deploymentUrl } : {}),
    ...(deploymentStatus ? { deploymentStatus } : {}),
    ...(deploymentError ? { deploymentError } : {}),
    ...(deployedRevision ? { deployedRevision } : {}),
    ...(sourceFiles ? { sourceFiles } : {}),
    updatedAt:
      project.updatedAt instanceof Date
        ? project.updatedAt.toLocaleDateString("fr-FR")
        : project.updatedAt,
  };
};

type LlmGenerationResult = {
  code: string;
  changes: string[];
  assistantMessage: string;
  files?: Array<{ path: string; content: string }>;
  deletedFiles?: string[];
  agentActions?: AgentAction[];
  repairSessionId?: string;
  previewRevision: number;
  credits: number;
};

type InitialProjectOptions = {
  provider?: AiProviderId;
  model?: string;
  templateId?: StarterTemplateId;
  templateOnly?: boolean;
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

type GenerationRequest = {
  projectId: string;
  repairSessionId?: string;
  activeFile?: string;
  mode?: AgentMode;
  prompt: string;
  currentCode: string;
  currentFiles: Record<string, string>;
  attachments?: string[];
  revision: number;
  provider: AiProviderId;
  model?: string;
  onChunk?: (chunk: string) => void;
  onAction?: (action: AgentAction) => void | Promise<void>;
  smartModelRouting?: boolean;
  providerFallback?: boolean;
  importGraphIndex?: boolean;
  trackUsage?: boolean;
};

async function streamGenerationChange(
  input: GenerationRequest
): Promise<LlmGenerationResult> {
  const { onChunk, onAction, ...body } = input;
  const preferences = readFeatureSettings();
  const response = await fetch("/api/generation/change-stream", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...body,
      smartModelRouting: preferences.smartModelRouting,
      providerFallback: preferences.providerFallback,
      importGraphIndex: preferences.importGraphIndex,
      trackUsage: preferences.costTracking,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `La génération a répondu ${response.status}.`);
  }
  if (!response.body) throw new Error("Le flux de génération est indisponible.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: LlmGenerationResult | undefined;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const event of events) {
        const eventName = event.match(/^event:\s*(.+)$/m)?.[1] ?? "message";
        const data = event.match(/^data:\s*(.+)$/m)?.[1];
        if (!data) continue;
        const payload = JSON.parse(data) as { text?: string; message?: string } & Partial<LlmGenerationResult>;
        if (eventName === "chunk" && typeof payload.text === "string") onChunk?.(payload.text);
        if (eventName === "action") await onAction?.(payload as unknown as AgentAction);
        if (eventName === "error") throw new Error(payload.message ?? "La génération a échoué.");
        if (eventName === "complete") result = payload as LlmGenerationResult;
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  if (!result) throw new Error("Le provider n’a pas renvoyé de résultat final.");
  return result;
}

function App() {
  const [location, setLocation] = useLocation();
  const auth = useAuth();
  const [projects, setProjects] = useState<Project[]>(demoProjects);
  const [credits, setCredits] = useState(20);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const path = location.split("?")[0];
  const authed = auth.isAuthenticated;
  const isAdmin = auth.user?.role === "admin";
  const projectsQuery = trpc.projects.list.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    retry: false,
  });
  const createProjectMutation = trpc.projects.create.useMutation();
  const createAndGenerateMutation =
    trpc.projects.createAndGenerate.useMutation();
  const updateProjectMutation = trpc.projects.update.useMutation();
  const removeProjectMutation = trpc.projects.remove.useMutation();
  const consumeCreditMutation = trpc.projects.consumeCredit.useMutation();
  const billingCheckoutMutation = trpc.billing.createCheckout.useMutation();
  const paymentsQuery = trpc.billing.payments.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    retry: false,
  });
  const updateProfileMutation = trpc.auth.updateProfile.useMutation();
  const navigate = (next: string) => {
    setMobileNavOpen(false);
    setLocation(next);
  };
  useEffect(() => {
    if (auth.user) setCredits(auth.user.credits);
  }, [auth.user]);
  useEffect(() => {
    if (auth.isAuthenticated && projectsQuery.data)
      setProjects(projectsQuery.data.map(normalizeProject));
  }, [auth.isAuthenticated, projectsQuery.data]);
  useEffect(() => {
    if (auth.isAuthenticated && isAuthPath(path)) navigate("/dashboard");
  }, [auth.isAuthenticated, path]);
  const handleAuthenticated = async () => {
    await auth.refresh();
    toast.success("Bienvenue dans BuildFlow AI");
    navigate("/dashboard");
  };
  const consumeCredit = () => {
    if (isAdmin) return true;
    if (credits <= 0) {
      toast.error("Vous n’avez plus de crédits IA disponibles.");
      return false;
    }
    const previous = credits;
    setCredits(current => current - 1);
    if (auth.isAuthenticated) {
      consumeCreditMutation.mutate(undefined, {
        onSuccess: result => {
          if (result.success) setCredits(result.credits);
          else {
            setCredits(previous);
            toast.error("Vous n’avez plus de crédits IA disponibles.");
          }
        },
        onError: () => {
          setCredits(previous);
          toast.error("Impossible de valider la consommation du crédit.");
        },
      });
    }
    return true;
  };
  const handleCreateProject = async (
    prompt: string,
    type = "Application web",
    options: InitialProjectOptions = {}
  ) => {
    if (!options.templateOnly && !auth.isAuthenticated && !consumeCredit()) return;
    if (!options.templateOnly && auth.isAuthenticated && !isAdmin && credits <= 0) {
      toast.error("Vous n’avez plus de crédits IA disponibles.");
      return;
    }
    const nextProject = createProjectDraft(prompt, type);
    if (options.templateId) {
      const starterFiles = getStarterTemplateFiles(options.templateId);
      nextProject.sourceFiles = starterFiles;
      nextProject.files = Object.keys(starterFiles).length;
    }
    if (options.templateOnly) {
      nextProject.status = "Brouillon";
      const previousProjects = projects;
      setProjects(current => [nextProject, ...current]);
      if (auth.isAuthenticated) {
        try {
          const result = await createProjectMutation.mutateAsync({
            id: nextProject.id,
            name: nextProject.name,
            type: nextProject.type,
            description: nextProject.description,
            status: "Brouillon",
            files: nextProject.files,
            sourceFiles: JSON.stringify(nextProject.sourceFiles ?? {}),
            revision: 1,
            accent: nextProject.accent,
            gradient: nextProject.gradient,
            initials: nextProject.initials,
          });
          setProjects(current => current.map(project => project.id === nextProject.id ? normalizeProject(result) : project));
        } catch (error) {
          setProjects(previousProjects);
          toast.error(error instanceof Error ? error.message : "Impossible de créer le projet depuis ce template.");
          return;
        }
      }
      navigate(`/workspace/${nextProject.id}`);
      toast.success("Template chargé — le workspace est prêt sans génération IA.");
      return;
    }
    const previousCredits = credits;
    setProjects(current => [nextProject, ...current]);
    if (auth.isAuthenticated) {
      try {
        const result = await createAndGenerateMutation.mutateAsync({
          id: nextProject.id,
          name: nextProject.name,
          type: nextProject.type,
          description: nextProject.description,
          prompt,
          ...(options.provider ? { provider: options.provider } : {}),
          ...(options.model ? { model: options.model } : {}),
          ...(options.templateId ? { templateId: options.templateId } : {}),
          smartModelRouting: readFeatureSettings().smartModelRouting,
          providerFallback: readFeatureSettings().providerFallback,
          importGraphIndex: readFeatureSettings().importGraphIndex,
          trackUsage: readFeatureSettings().costTracking,
          accent: nextProject.accent,
          gradient: nextProject.gradient,
          initials: nextProject.initials,
        });
        setCredits(result.credits);
        setProjects(current =>
          current.map(project =>
            project.id === nextProject.id
              ? normalizeProject(result.project)
              : project
          )
        );
        navigate(`/workspace/${nextProject.id}`);
        toast.success("Projet généré et sauvegardé — workspace prêt");
        return;
      } catch (error) {
        setProjects(current =>
          current.map(project =>
            project.id === nextProject.id
              ? { ...project, status: "Brouillon" as const }
              : project
          )
        );
        setCredits(previousCredits);
        navigate(`/workspace/${nextProject.id}`);
        toast.error(
          error instanceof Error
            ? `${error.message} Le brouillon a été conservé pour une nouvelle tentative.`
            : "La génération initiale a échoué. Le brouillon a été conservé pour une nouvelle tentative."
        );
        return;
      }
    }
    navigate(`/workspace/${nextProject.id}`);
    toast.success(
      isAdmin
        ? "Projet créé — accès administrateur illimité"
        : auth.isAuthenticated
          ? "Projet créé et sauvegardé — 1 crédit IA utilisé"
          : "Projet créé — 1 crédit IA utilisé"
    );
  };
  const updateProject = (id: string, patch: Partial<Project>) => {
    setProjects(current =>
      current.map(project =>
        project.id === id ? { ...project, ...patch } : project
      )
    );
    if (auth.isAuthenticated) {
      const { updatedAt: _updatedAt, sourceFiles, ...serverPatch } = patch;
      updateProjectMutation.mutate(
        {
          id,
          ...serverPatch,
          ...(sourceFiles ? { sourceFiles: JSON.stringify(sourceFiles) } : {}),
        },
        {
          onSuccess: saved => {
            if (saved)
              setProjects(current =>
                current.map(project =>
                  project.id === id ? normalizeProject(saved) : project
                )
              );
          },
          onError: () => {
            toast.error("La modification n’a pas pu être sauvegardée.");
            void projectsQuery.refetch();
          },
        }
      );
    }
  };
  const deleteProject = (project: Project) => {
    const previous = projects;
    setProjects(current => current.filter(item => item.id !== project.id));
    if (auth.isAuthenticated) {
      removeProjectMutation.mutate(
        { id: project.id },
        {
          onError: () => {
            setProjects(previous);
            toast.error("Le projet n’a pas pu être supprimé.");
          },
        }
      );
    }
    toast.success("Projet supprimé");
  };
  const duplicateProject = (project: Project) => {
    const copy = {
      ...project,
      id: `${project.id}-copy-${Date.now()}`,
      name: `${project.name} — copie`,
      status: "Brouillon" as const,
      updatedAt: "à l’instant",
    };
    const previous = projects;
    setProjects(current => [copy, ...current]);
    if (auth.isAuthenticated) {
      createProjectMutation.mutate(
        {
          id: copy.id,
          name: copy.name,
          type: copy.type,
          description: copy.description,
          status: copy.status,
          files: copy.files,
          ...(copy.sourceFiles
            ? { sourceFiles: JSON.stringify(copy.sourceFiles) }
            : {}),
          accent: copy.accent,
          gradient: copy.gradient,
          initials: copy.initials,
        },
        {
          onError: () => {
            setProjects(previous);
            toast.error("La copie n’a pas pu être sauvegardée.");
          },
        }
      );
    }
    toast.success("Projet dupliqué");
  };
  const dashboardRoutes = [
    "/dashboard",
    "/templates",
    "/billing",
    "/settings",
    "/docs",
    "/admin",
    "/new",
  ];
  const isAppRoute =
    dashboardRoutes.includes(path) || path.startsWith("/workspace/");
  const isAuthRoute = isAuthPath(path);
  if (path === "/")
    return (
      <Suspense fallback={<AuthLoadingScreen />}>
        <HomePage navigate={navigate} />
      </Suspense>
    );
  if (isAuthRoute)
    return (
      <Suspense fallback={<AuthLoadingScreen />}>
        <AuthPage
          mode={path.slice(1) as "login" | "signup" | "forgot-password"}
          onAuthenticated={handleAuthenticated}
          navigate={navigate}
        />
      </Suspense>
    );
  if (path === "/404")
    return (
      <Suspense fallback={<AuthLoadingScreen />}>
        <NotFoundPage navigate={navigate} />
      </Suspense>
    );
  if (isAppRoute) {
    if (!authed && auth.loading && path !== "/docs" && path !== "/templates")
      return <AuthLoadingScreen />;
    if (!authed && path !== "/docs" && path !== "/templates")
      return (
        <Suspense fallback={<AuthLoadingScreen />}>
          <AuthPage
            mode="login"
            onAuthenticated={handleAuthenticated}
            navigate={navigate}
          />
        </Suspense>
      );
    const workspaceId = path.startsWith("/workspace/")
      ? path.split("/")[2]
      : undefined;
    const workspaceProject = workspaceId
      ? projects.find(project => project.id === workspaceId)
      : undefined;
    if (path === "/admin" && !isAdmin)
      return (
        <Suspense fallback={<AuthLoadingScreen />}>
          <NotFoundPage navigate={navigate} />
        </Suspense>
      );
    return (
      <Suspense fallback={<AuthLoadingScreen />}>
        <AppShell
          location={location}
          navigate={navigate}
          mobileNavOpen={mobileNavOpen}
          setMobileNavOpen={setMobileNavOpen}
          credits={credits}
          isAdmin={isAdmin}
          userName={auth.user?.name ?? "Alex Martin"}
          onLogout={async () => {
            if (auth.isAuthenticated) await auth.logout();
            navigate("/");
            toast("Vous êtes déconnecté");
          }}
        >
        {workspaceId ? (
          workspaceProject ? (
            <WorkspacePage
              project={workspaceProject}
              navigate={navigate}
              updateProject={updateProject}
              consumeCredit={consumeCredit}
              generateChange={auth.isAuthenticated ? streamGenerationChange : undefined}
              onCreditsUpdated={setCredits}
            />
          ) : (
            <NotFoundPage navigate={navigate} />
          )
        ) : path === "/dashboard" ? (
          <DashboardPage
            projects={projects}
            navigate={navigate}
            setProjects={setProjects}
            credits={credits}
            generationCount={auth.user?.generationCount ?? 0}
            onDeleteProject={deleteProject}
            onUpdateProject={updateProject}
            onDuplicateProject={duplicateProject}
          />
        ) : path === "/new" ? (
          <NewProjectPage onCreate={handleCreateProject} navigate={navigate} />
        ) : path === "/templates" ? (
          <TemplatesPage
            navigate={navigate}
            onUse={template =>
              handleCreateProject(`Projet ${template.name}`, template.category)
            }
          />
        ) : path === "/billing" ? (
          <BillingPage
            currentPlan={auth.user?.plan ?? "free"}
            payments={paymentsQuery.data ?? []}
            credits={credits}
            isAdmin={isAdmin}
            onCheckout={
              auth.isAuthenticated
                ? async selectedPlan => {
                    const result = await billingCheckoutMutation.mutateAsync({
                      plan: selectedPlan === "Pro" ? "pro" : "team",
                      origin: window.location.origin,
                    });
                    window.open(result.url, "_blank", "noopener,noreferrer");
                  }
                : undefined
            }
          />
        ) : path === "/settings" ? (
          <SettingsPage
            userName={auth.user?.name ?? "Alex Martin"}
            userEmail={auth.user?.email ?? ""}
            onSaveProfile={
              auth.isAuthenticated
                ? async profile => {
                    const savedUser =
                      await updateProfileMutation.mutateAsync(profile);
                    if (savedUser) {
                      await auth.refresh();
                    }
                  }
                : undefined
            }
          />
        ) : path === "/docs" ? (
          <DocsPage navigate={navigate} />
        ) : path === "/admin" ? (
          <AdminPage />
        ) : (
          <NotFoundPage navigate={navigate} />
        )}
        </AppShell>
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<AuthLoadingScreen />}>
      <NotFoundPage navigate={navigate} />
    </Suspense>
  );
}
function isAuthPath(path: string) {
  return path === "/login" || path === "/signup" || path === "/forgot-password";
}
function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1020] text-sm text-slate-400">
      <RefreshCw className="mr-2 h-4 w-4 animate-spin text-blue-300" />
      Chargement de BuildFlow…
    </div>
  );
}













function AppShell({
  children,
  location,
  navigate,
  mobileNavOpen,
  setMobileNavOpen,
  credits,
  isAdmin,
  userName,
  onLogout,
}: {
  children: ReactNode;
  location: string;
  navigate: (path: string) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  credits: number;
  isAdmin: boolean;
  userName: string;
  onLogout: () => void | Promise<void>;
}) {
  const { theme, preference, setPreference } = useTheme();
  const ThemeIcon =
    preference === "auto" ? Clock3 : theme === "light" ? Sun : Moon;
  const themeLabel =
    preference === "auto"
      ? "Automatique"
      : preference === "light"
        ? "Clair"
        : "Sombre";
  const cycleTheme = () =>
    setPreference(
      preference === "auto" ? "dark" : preference === "dark" ? "light" : "auto"
    );
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B1020] text-slate-100">
      <AmbientBackground />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-white/[0.06] bg-[#0d1425] px-3 py-4 transition-transform lg:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="px-3 pb-7">
            <BuildFlowLogo onClick={() => navigate("/dashboard")} />
          </div>
          <button
            type="button"
            onClick={() => navigate("/new")}
            className="bf-primary-button mx-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Nouveau projet
          </button>
          <p className="mb-2 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            Workspace
          </p>
          <nav className="space-y-1">
            {navItems.map(({ label, path, icon: Icon }) => {
              const active = location.split("?")[0] === path.split("?")[0];
              return (
                <button
                  type="button"
                  key={label}
                  onClick={() => navigate(path)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition",
                    active
                      ? "bg-blue-500/12 text-blue-200"
                      : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active ? "text-blue-300" : "text-slate-600"
                    )}
                  />
                  {label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
                  )}
                </button>
              );
            })}
          </nav>
          <p className="mb-2 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            Ressources
          </p>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => navigate("/docs")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200"
            >
              <BookOpen className="h-4 w-4 text-slate-600" />
              Documentation
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200"
              >
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                Admin
              </button>
            )}
          </nav>
          <div className="mt-auto border-t border-white/[0.06] pt-4">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-violet-500 text-xs font-bold text-white">
                AM
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200">
                  {userName}
                </p>
                <p className="truncate text-[10px] text-slate-600">
                  {isAdmin ? "Administrateur · Premium illimité" : "Plan Pro"}
                </p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Déconnexion"
                className="text-slate-600 transition hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        >
          <span className="sr-only">Fermer</span>
        </button>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-[#0B1020]/85 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative hidden max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              placeholder="Rechercher un projet..."
              className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-400/30"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs sm:flex">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              <span className="text-slate-400">Crédits IA</span>
              <span className="font-semibold text-white">
                {isAdmin ? "Illimité" : credits}
              </span>
              {!isAdmin && <span className="text-slate-600">/ 500</span>}
            </div>
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`Thème ${themeLabel}. Cliquer pour changer`}
              title={`Thème : ${themeLabel}`}
              className="hidden items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 text-[10px] text-slate-500 transition hover:border-blue-400/30 hover:text-blue-200 sm:flex"
            >
              <ThemeIcon className="h-3.5 w-3.5" />
              {themeLabel}
            </button>
            <button
              type="button"
              className="relative rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-white"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-400" />
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-white/5"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-violet-500 text-[10px] font-bold text-white">
                AM
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-slate-600 sm:block" />
            </button>
          </div>
        </header>
        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
      </div>
    </div>
  );
}

































































export default function RootApp() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" defaultPreference="auto" switchable>
        <Toaster theme="system" position="bottom-right" />
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
