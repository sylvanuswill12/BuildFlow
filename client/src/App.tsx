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
import { startLogin } from "@/const";
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
import {
  startWebContainerRuntime,
  updateWebContainerRuntime,
} from "@/lib/webcontainerRuntime";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

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
  previewRevision: number;
  credits: number;
};

type InitialProjectOptions = {
  provider?: AiProviderId;
  model?: string;
};

type AiProviderId =
  | "manus"
  | "openai"
  | "google"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "mistral"
  | "ollama"
  | "openai-compatible";

type GenerationRequest = {
  prompt: string;
  currentCode: string;
  currentFiles: Record<string, string>;
  revision: number;
  provider: AiProviderId;
  model?: string;
  onChunk?: (chunk: string) => void;
};

async function streamGenerationChange(
  input: GenerationRequest
): Promise<LlmGenerationResult> {
  const { onChunk, ...body } = input;
  const response = await fetch("/api/generation/change-stream", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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
  const [demoAuthed, setDemoAuthed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const path = location.split("?")[0];
  const authed = demoAuthed || auth.isAuthenticated;
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
  const handleAuthenticated = () => {
    setDemoAuthed(true);
    toast.success("Bienvenue dans BuildFlow AI");
    navigate("/dashboard");
  };
  const handleOAuthLogin = () => {
    try {
      startLogin();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "La connexion Manus n’est pas disponible."
      );
    }
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
    if (!auth.isAuthenticated && !consumeCredit()) return;
    if (auth.isAuthenticated && !isAdmin && credits <= 0) {
      toast.error("Vous n’avez plus de crédits IA disponibles.");
      return;
    }
    const nextProject = createProjectDraft(prompt, type);
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
          provider: options.provider ?? "manus",
          ...(options.model ? { model: options.model } : {}),
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
  if (path === "/") return <HomePage navigate={navigate} />;
  if (isAuthRoute)
    return (
      <AuthPage
        mode={path.slice(1) as "login" | "signup" | "forgot-password"}
        onAuthenticated={handleAuthenticated}
        onOAuthLogin={handleOAuthLogin}
        navigate={navigate}
      />
    );
  if (path === "/404") return <NotFoundPage navigate={navigate} />;
  if (isAppRoute) {
    if (!authed && auth.loading && path !== "/docs" && path !== "/templates")
      return <AuthLoadingScreen />;
    if (!authed && path !== "/docs" && path !== "/templates")
      return (
        <AuthPage
          mode="login"
          onAuthenticated={handleAuthenticated}
          onOAuthLogin={handleOAuthLogin}
          navigate={navigate}
        />
      );
    const workspaceId = path.startsWith("/workspace/")
      ? path.split("/")[2]
      : undefined;
    const workspaceProject = workspaceId
      ? projects.find(project => project.id === workspaceId)
      : undefined;
    if (path === "/admin" && !isAdmin)
      return <NotFoundPage navigate={navigate} />;
    return (
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
          setDemoAuthed(false);
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
    );
  }
  return <NotFoundPage navigate={navigate} />;
}
function isAuthPath(path: string) {
  return path === "/login" || path === "/signup" || path === "/forgot-password";
}
function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1020] text-sm text-slate-400">
      <RefreshCw className="mr-2 h-4 w-4 animate-spin text-blue-300" />
      Vérification de votre session…
    </div>
  );
}
function HomePage({ navigate }: { navigate: (path: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const suggestions = [
    "Créer un portfolio moderne",
    "Créer une boutique en ligne",
    "Créer une application de gestion de tâches",
    "Créer un dashboard financier",
    "Créer un site pour une association",
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-[#0B1020] text-slate-100">
      <MarketingNav navigate={navigate} />
      <main>
        <section className="relative px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-28 lg:pt-28">
          <div className="bf-grid-pointer absolute inset-0 opacity-60" />
          <div className="absolute left-1/2 top-8 h-[460px] w-[800px] -translate-x-1/2 rounded-full bg-blue-600/12 blur-[120px]" />
          <div className="absolute right-[-14%] top-40 h-[360px] w-[360px] rounded-full bg-violet-600/12 blur-[120px]" />
          <div className="relative mx-auto max-w-6xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3.5 py-1.5 text-xs font-medium text-blue-200">
              <Sparkles className="h-3.5 w-3.5 text-blue-300" />
              La nouvelle façon de construire avec l’IA
              <ArrowUpRight className="h-3.5 w-3.5 text-blue-300" />
            </div>
            <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
              Créez votre application avec{" "}
              <span className="bf-gradient-text">
                l’intelligence artificielle
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Décrivez votre idée, laissez l’IA générer votre interface, votre
              code et votre prototype fonctionnel en quelques minutes.
            </p>

            <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-white/10 bg-[#111827]/90 p-2 shadow-[0_20px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl">
              <div className="rounded-xl border border-white/[0.06] bg-[#0d1425] p-4 text-left sm:p-5">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
                    <WandSparkles className="h-4 w-4" />
                  </div>
                  <textarea
                    value={prompt}
                    onChange={event => setPrompt(event.target.value)}
                    rows={2}
                    className="min-h-[66px] flex-1 resize-none bg-transparent text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600"
                    placeholder="Exemple : Crée une application de gestion de dépenses avec dashboard, catégories, graphiques et authentification utilisateur."
                  />
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                    Ajoutez du contexte à votre prompt
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/new${prompt ? `?prompt=${encodeURIComponent(prompt)}` : ""}`
                      )
                    }
                    className="bf-primary-button flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Générer mon application
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-2">
              {suggestions.map(suggestion => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => setPrompt(suggestion)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-blue-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-[#0d1425]/70 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 text-xs text-slate-500 sm:justify-between">
            <span className="uppercase tracking-[0.2em]">
              Déjà utilisé par des builders ambitieux
            </span>
            <div className="flex items-center gap-7 text-sm font-semibold text-slate-400">
              <span>northstar</span>
              <span>ACME</span>
              <span className="flex items-center gap-1">
                <Box className="h-4 w-4" /> orbit
              </span>
              <span>◼ venture</span>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
        >
          <SectionHeading
            eyebrow="Comment ça marche"
            title="De l’idée au prototype en quelques minutes."
            description="Un espace unique pour transformer une intuition en produit concret, sans perdre le fil."
          />
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              [
                "01",
                "Décrivez votre idée",
                "Partagez votre vision en langage naturel. BuildFlow comprend le contexte, les écrans et les règles métier.",
                MessageSquare,
              ],
              [
                "02",
                "L’IA génère votre application",
                "Une base fonctionnelle apparaît avec des composants réutilisables, des données réalistes et une direction visuelle.",
                Sparkles,
              ],
              [
                "03",
                "Modifiez, prévisualisez et publiez",
                "Discutez avec l’assistant, inspectez chaque fichier et validez vos changements dans la preview.",
                Rocket,
              ],
            ].map(([number, title, description, Icon]) => (
              <div
                key={number as string}
                className="bf-surface relative overflow-hidden rounded-2xl p-6"
              >
                <span className="text-xs font-semibold tracking-[0.2em] text-blue-400">
                  {number as string}
                </span>
                <div className="mt-8 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {title as string}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {description as string}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#0d1425]/75 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Tout ce qu’il vous faut"
              title="Un atelier complet, pensé pour aller vite."
              description="Du premier prompt au dernier détail de l’interface, BuildFlow garde votre projet clair et évolutif."
            />
            <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "Génération de code par IA",
                  "Des composants propres et prêts à personnaliser.",
                  Code2,
                ],
                [
                  "Prévisualisation instantanée",
                  "Voyez chaque changement en temps réel.",
                  Eye,
                ],
                [
                  "Éditeur de code intégré",
                  "Gardez le contrôle sur chaque fichier.",
                  FileCode2,
                ],
                [
                  "Templates prêts à l’emploi",
                  "Démarrez avec une base qui vous ressemble.",
                  Layers3,
                ],
                [
                  "Export GitHub",
                  "Emportez votre code quand vous le souhaitez.",
                  Github,
                ],
                [
                  "Publication rapide",
                  "Passez de preview à produit en un clic.",
                  Globe2,
                ],
                [
                  "Historique des versions",
                  "Comparez, restaurez et avancez sereinement.",
                  Copy,
                ],
                [
                  "Collaboration en équipe",
                  "Construisez à plusieurs, au même endroit.",
                  Users2,
                ],
              ].map(([title, description, Icon]) => (
                <div
                  key={title as string}
                  className="rounded-2xl border border-white/[0.07] bg-[#111827]/65 p-5 transition hover:-translate-y-1 hover:border-blue-400/20 hover:bg-[#151f33]"
                >
                  <Icon className="h-5 w-5 text-blue-300" />
                  <h3 className="mt-5 text-sm font-semibold text-slate-100">
                    {title as string}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {description as string}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="templates"
          className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow="Inspirez-vous"
              title="Des projets qui partent déjà du bon pied."
              description="Explorez les bases générées par la communauté BuildFlow."
            />
            <button
              type="button"
              onClick={() => navigate("/templates")}
              className="bf-secondary-button inline-flex items-center gap-2 self-start rounded-lg px-4 py-2.5 text-sm font-medium text-slate-200 sm:self-auto"
            >
              Voir tous les templates <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.slice(0, 6).map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={() => navigate("/new")}
              />
            ))}
          </div>
        </section>

        <section
          id="pricing"
          className="bg-[#0d1425]/75 px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
        >
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Tarifs simples"
              title="Commencez gratuitement. Accélérez quand vous êtes prêt."
              description="Pas de carte bancaire pour tester vos premières idées."
              align="center"
            />
            <div className="mt-14 grid gap-4 lg:grid-cols-3">
              <PriceCard
                name="Gratuit"
                price="0 €"
                description="Pour explorer et créer vos premières idées."
                items={[
                  "3 projets",
                  "20 générations IA par mois",
                  "Prévisualisation",
                  "Export ZIP",
                ]}
                action="Commencer gratuitement"
                onClick={() => navigate("/signup")}
              />
              <PriceCard
                featured
                name="Pro"
                price="19 €"
                description="Pour construire sérieusement, plus vite."
                items={[
                  "Projets illimités",
                  "500 générations IA par mois",
                  "Export GitHub",
                  "Publication personnalisée",
                  "Support prioritaire",
                ]}
                action="Essayer Pro"
                onClick={() => navigate("/signup")}
              />
              <PriceCard
                name="Équipe"
                price="49 €"
                description="Pour les équipes qui avancent ensemble."
                items={[
                  "Tout le plan Pro",
                  "2 000 générations IA par mois",
                  "Collaboration",
                  "Membres d’équipe",
                  "Gestion de rôles",
                  "Facturation centralisée",
                ]}
                action="Parler à l’équipe"
                onClick={() => navigate("/signup")}
              />
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/[0.06] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <BuildFlowLogo onClick={() => navigate("/")} />
            <p className="mt-3 text-xs text-slate-600">
              Transformez vos idées en applications avec l’IA.
            </p>
          </div>
          <div className="flex flex-wrap gap-5 text-xs text-slate-500">
            <button onClick={() => navigate("/docs")} type="button">
              Documentation
            </button>
            <button onClick={() => navigate("/billing")} type="button">
              Tarifs
            </button>
            <button type="button">Confidentialité</button>
            <button type="button">Contact</button>
          </div>
          <p className="text-xs text-slate-600">© 2026 BuildFlow AI</p>
        </div>
      </footer>
    </div>
  );
}

function MarketingNav({ navigate }: { navigate: (path: string) => void }) {
  return (
    <header className="relative z-20 border-b border-white/[0.06] bg-[#0B1020]/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
        <BuildFlowLogo onClick={() => navigate("/")} />
        <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
          <a href="#features" className="transition hover:text-white">
            Fonctionnalités
          </a>
          <button
            type="button"
            onClick={() => navigate("/templates")}
            className="transition hover:text-white"
          >
            Templates
          </button>
          <a href="#pricing" className="transition hover:text-white">
            Tarifs
          </a>
          <button
            type="button"
            onClick={() => navigate("/docs")}
            className="transition hover:text-white"
          >
            Documentation
          </button>
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="hidden rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white sm:inline-flex"
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="bf-primary-button rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
          >
            Commencer gratuitement
          </button>
        </div>
      </div>
    </header>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn(align === "center" && "mx-auto max-w-2xl text-center")}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
}: {
  template: (typeof templates)[number];
  onUse: () => void;
}) {
  const Icon =
    template.icon === "chart"
      ? BarChart3
      : template.icon === "box"
        ? Box
        : template.icon === "check"
          ? CheckCircle2
          : template.icon === "heart"
            ? Heart
            : template.icon === "calendar"
              ? Globe2
              : Sparkles;
  return (
    <div className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111827]/80">
      <div className="relative h-36 overflow-hidden bg-[#0d1425] p-4">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(circle at 75% 15%, ${template.accent}, transparent 50%)`,
          }}
        />
        <div className="relative flex h-full items-end">
          <div className="grid w-full grid-cols-3 gap-2">
            <div className="col-span-1 rounded-md border border-white/10 bg-white/5 p-2">
              <span
                className="mb-2 block h-1.5 w-10 rounded-full"
                style={{ backgroundColor: template.accent }}
              />
              <span className="block h-1 w-14 rounded-full bg-white/10" />
              <span className="mt-1 block h-1 w-8 rounded-full bg-white/10" />
            </div>
            <div className="col-span-2 rounded-md border border-white/10 bg-white/[0.04] p-2">
              <div className="flex items-end gap-1">
                <span className="h-5 flex-1 rounded-t bg-white/10" />
                <span
                  className="h-9 flex-1 rounded-t"
                  style={{ backgroundColor: `${template.accent}99` }}
                />
                <span className="h-7 flex-1 rounded-t bg-white/10" />
                <span
                  className="h-12 flex-1 rounded-t"
                  style={{ backgroundColor: `${template.accent}66` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{template.name}</p>
            <p className="mt-1 text-xs text-slate-500">{template.category}</p>
          </div>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              color: template.accent,
              backgroundColor: `${template.accent}18`,
            }}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-400">
          {template.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {template.tags.map(tag => (
            <span
              key={tag}
              className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-500"
            >
              {tag}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onUse}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] py-2 text-xs font-semibold text-slate-300 transition hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-blue-200"
        >
          Utiliser ce template <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function PriceCard({
  name,
  price,
  description,
  items,
  action,
  featured = false,
  onClick,
}: {
  name: string;
  price: string;
  description: string;
  items: string[];
  action: string;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border p-6",
        featured
          ? "border-blue-400/45 bg-blue-500/[0.09] shadow-[0_0_50px_rgba(59,130,246,0.14)]"
          : "border-white/[0.08] bg-[#111827]/80"
      )}
    >
      {featured && (
        <span className="absolute right-5 top-5 rounded-full bg-blue-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
          Populaire
        </span>
      )}
      <p className="text-sm font-semibold text-white">{name}</p>
      <div className="mt-5 flex items-end gap-1">
        <span className="text-4xl font-semibold tracking-[-0.05em] text-white">
          {price}
        </span>
        <span className="pb-1 text-xs text-slate-500">/ mois</span>
      </div>
      <p className="mt-3 min-h-10 text-xs leading-5 text-slate-400">
        {description}
      </p>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "mt-7 w-full rounded-lg py-2.5 text-sm font-semibold",
          featured
            ? "bf-primary-button text-white"
            : "border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]"
        )}
      >
        {action}
      </button>
      <div className="mt-7 space-y-3">
        {items.map(item => (
          <div
            key={item}
            className="flex items-center gap-2.5 text-xs text-slate-300"
          >
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthPage({
  mode,
  onAuthenticated,
  onOAuthLogin,
  navigate,
}: {
  mode: "login" | "signup" | "forgot-password";
  onAuthenticated: () => void;
  onOAuthLogin: () => void;
  navigate: (path: string) => void;
}) {
  const [email, setEmail] = useState(
    mode === "login" ? "demo@buildflow.ai" : ""
  );
  const [password, setPassword] = useState(
    mode === "login" ? "demo123456" : ""
  );
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const title =
    mode === "login"
      ? "Bon retour parmi les builders."
      : mode === "signup"
        ? "Commencez à construire."
        : "Retrouvez l’accès à votre espace.";
  const subtitle =
    mode === "login"
      ? "Connectez-vous pour reprendre là où vous vous êtes arrêté."
      : mode === "signup"
        ? "Créez votre compte et donnez vie à votre prochaine idée."
        : "Saisissez votre email, nous vous enverrons un lien sécurisé.";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!email.includes("@"))
      return setError("Veuillez saisir une adresse email valide.");
    if (mode === "forgot-password") {
      setSuccess(
        "Si un compte existe pour cet email, un lien vient d’être envoyé."
      );
      return;
    }
    if (mode === "signup" && name.trim().length < 2)
      return setError("Ajoutez votre nom pour continuer.");
    if (
      mode === "login" &&
      email === "demo@buildflow.ai" &&
      password === "demo123456"
    ) {
      onAuthenticated();
      return;
    }
    if (mode === "login") {
      setSuccess("Redirection vers la connexion sécurisée Manus…");
      onOAuthLogin();
      return;
    }
    setSuccess("Redirection vers la création de compte sécurisée Manus…");
    onOAuthLogin();
  };

  return (
    <div className="flex min-h-screen bg-[#0B1020] text-slate-100">
      <div className="relative hidden w-[45%] overflow-hidden border-r border-white/[0.06] bg-[#0d1425] lg:block">
        <div className="absolute left-[-30%] top-[-10%] h-[560px] w-[560px] rounded-full bg-blue-500/15 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-15%] h-[480px] w-[480px] rounded-full bg-violet-500/15 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <BuildFlowLogo onClick={() => navigate("/")} />
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
              BuildFlow AI
            </p>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white">
              Une idée mérite un espace pour devenir réelle.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-400">
              Décrivez, générez, inspectez et itérez dans le même workspace. Vos
              prototypes avancent à la vitesse de votre imagination.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-2xl font-semibold text-white">10×</p>
                <p className="mt-1 text-xs text-slate-500">
                  plus rapide pour prototyper
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-2xl font-semibold text-white">24/7</p>
                <p className="mt-1 text-xs text-slate-500">
                  assistant disponible
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            © 2026 BuildFlow AI · Construire mieux, ensemble.
          </p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <BuildFlowLogo onClick={() => navigate("/")} />
          </div>
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">{subtitle}</p>
          </div>
          {mode !== "forgot-password" && (
            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onOAuthLogin}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.07]"
              >
                <span className="font-bold text-red-400">G</span> Google{" "}
                <span className="text-[10px] text-slate-600">via Manus</span>
              </button>
              <button
                type="button"
                onClick={onOAuthLogin}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.07]"
              >
                <Github className="h-4 w-4" /> GitHub{" "}
                <span className="text-[10px] text-slate-600">via Manus</span>
              </button>
            </div>
          )}{" "}
          {mode !== "forgot-password" && (
            <div className="mb-5 flex items-center gap-3 text-xs text-slate-600">
              <span className="h-px flex-1 bg-white/10" />
              <span>ou continuer avec Manus</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <Field
                label="Nom complet"
                value={name}
                onChange={setName}
                placeholder="Alex Martin"
              />
            )}
            {
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="vous@exemple.com"
                type="email"
              />
            }
            {mode !== "forgot-password" && (
              <Field
                label="Mot de passe"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                type="password"
              />
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-xs leading-5 text-red-200">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {success}
              </div>
            )}{" "}
            {mode === "login" && (
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-500">
                  <input
                    checked={remember}
                    onChange={event => setRemember(event.target.checked)}
                    type="checkbox"
                    className="accent-blue-500"
                  />
                  Se souvenir de moi
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-blue-300 hover:text-blue-200"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}
            <button
              type="submit"
              className="bf-primary-button flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white"
            >
              {mode === "login"
                ? "Se connecter"
                : mode === "signup"
                  ? "Créer mon compte"
                  : "Envoyer le lien"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          {mode === "login" && (
            <button
              type="button"
              onClick={() => {
                setEmail("demo@buildflow.ai");
                setPassword("demo123456");
                setSuccess("Compte démo chargé. Vous pouvez vous connecter.");
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-400/30 bg-blue-500/[0.06] py-2.5 text-xs text-blue-200 transition hover:bg-blue-500/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Utiliser le compte démo local
            </button>
          )}
          <p className="mt-7 text-center text-xs text-slate-500">
            {mode === "login"
              ? "Pas encore de compte ?"
              : "Vous avez déjà un compte ?"}{" "}
            <button
              type="button"
              onClick={() => navigate(mode === "login" ? "/signup" : "/login")}
              className="font-medium text-blue-300 hover:text-blue-200"
            >
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-slate-300">
        {label}
      </span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/50 focus:bg-blue-500/[0.05] focus:ring-2 focus:ring-blue-500/10"
      />
    </label>
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

function DashboardPage({
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
                      downloadProjectZip(project, codeSnippets["page.tsx"]);
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

function NewProjectPage({
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
        `${prompt}\nStyle : ${style}. Stack : ${framework}. Niveau : ${level}.`,
        type
      );
    } finally {
      progressStreamRef.current?.close();
      progressStreamRef.current = null;
      setGenerating(false);
      setGenerationStep(0);
    }
  };
  useEffect(() => () => progressStreamRef.current?.close(), []);
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
        </section>
        <aside className="space-y-5">
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

type AgentStatus =
  | "En attente"
  | "Analyse"
  | "Planification"
  | "Design"
  | "Développement"
  | "Test"
  | "Terminé"
  | "Attention requise";
type ProjectAgent = {
  name: string;
  role: string;
  mission: string;
  icon: IconType;
  status: AgentStatus;
  progress: number;
  lastAction: string;
  report: string;
};

const defaultProjectAgents: ProjectAgent[] = [
  {
    name: "BuildFlow Orchestrator",
    role: "Orchestrateur principal",
    mission: "Coordonne le cycle de production et vérifie la cohérence finale.",
    icon: Bot,
    status: "En attente",
    progress: 0,
    lastAction: "En attente d’une demande",
    report: "Le projet sera découpé en tâches spécialisées avant génération.",
  },
  {
    name: "Product Strategist",
    role: "Product manager IA",
    mission:
      "Transforme l’idée en fonctionnalités, personas et critères d’acceptation.",
    icon: WandSparkles,
    status: "En attente",
    progress: 0,
    lastAction: "Aucun brief produit",
    report:
      "Le brief produit détaillera le problème, les utilisateurs et les priorités MVP.",
  },
  {
    name: "System Architect",
    role: "Architecte logiciel",
    mission: "Définit les modules, API, rôles et choix technologiques.",
    icon: Layers3,
    status: "En attente",
    progress: 0,
    lastAction: "Architecture non définie",
    report:
      "L’architecture séparera interface, logique métier, données et intégrations.",
  },
  {
    name: "Experience Designer",
    role: "UX designer",
    mission: "Conçoit les parcours, les états et la navigation.",
    icon: PanelRight,
    status: "En attente",
    progress: 0,
    lastAction: "Parcours non analysé",
    report:
      "Les états de chargement, erreur, succès et données vides seront vérifiés.",
  },
  {
    name: "Art Director",
    role: "Directeur artistique",
    mission: "Crée une identité visuelle cohérente avec le secteur.",
    icon: Sparkles,
    status: "En attente",
    progress: 0,
    lastAction: "Direction visuelle non définie",
    report:
      "La direction artistique produira palette, typographies, tokens et règles d’animation.",
  },
  {
    name: "Frontend Builder",
    role: "Ingénieur frontend",
    mission: "Construit les écrans responsive et accessibles.",
    icon: Code2,
    status: "En attente",
    progress: 0,
    lastAction: "Aucun composant généré",
    report:
      "Les composants seront modulaires, typés et testables dans le runtime réel.",
  },
  {
    name: "Backend Builder",
    role: "Ingénieur backend",
    mission: "Génère les APIs, validations et règles métier.",
    icon: Database,
    status: "En attente",
    progress: 0,
    lastAction: "API non définie",
    report:
      "Les endpoints et validations seront dérivés des fonctionnalités du produit.",
  },
  {
    name: "Quality Guardian",
    role: "QA & debugging",
    mission: "Teste le produit et corrige les régressions.",
    icon: CheckCircle2,
    status: "En attente",
    progress: 0,
    lastAction: "Tests non lancés",
    report:
      "La qualité couvrira build, navigation, responsive, accessibilité et erreurs runtime.",
  },
  {
    name: "Performance Sentinel",
    role: "Performance & sécurité",
    mission: "Surveille la performance, les permissions et les secrets.",
    icon: ShieldCheck,
    status: "En attente",
    progress: 0,
    lastAction: "Audit non lancé",
    report:
      "L’audit détectera les secrets exposés, les routes sensibles et les optimisations possibles.",
  },
];

const productionStages = [
  "Analyse du besoin",
  "Planification",
  "Design system",
  "Frontend & backend",
  "Base de données",
  "Tests & corrections",
  "Prévisualisation finale",
];

function WorkspacePage({
  project,
  navigate,
  updateProject,
  consumeCredit,
  generateChange,
  onCreditsUpdated,
}: {
  project: Project;
  navigate: (path: string) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  consumeCredit: () => boolean;
  generateChange?: (input: {
    prompt: string;
    currentCode: string;
    currentFiles: Record<string, string>;
    revision: number;
    provider: AiProviderId;
    model?: string;
    onChunk?: (chunk: string) => void;
  }) => Promise<LlmGenerationResult>;
  onCreditsUpdated: (credits: number) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [prompt, setPrompt] = useState("");
  const initialFiles =
    project.sourceFiles && Object.keys(project.sourceFiles).length > 0
      ? { ...codeSnippets, ...project.sourceFiles }
      : { ...codeSnippets };
  const [activeFile, setActiveFile] = useState("page.tsx");
  const [code, setCode] = useState(
    initialFiles["page.tsx"] ?? codeSnippets["page.tsx"]
  );
  const [projectFiles, setProjectFiles] =
    useState<Record<string, string>>(initialFiles);
  const [previewMode, setPreviewMode] = useState<
    "desktop" | "tablet" | "mobile"
  >("desktop");
  const rightTab = useBuildFlowStore(state => state.rightTab);
  const setRightTab = useBuildFlowStore(state => state.setRightTab);
  const motionEnabled = useBuildFlowStore(state => state.motionEnabled);
  const [bottomTab, setBottomTab] = useState("Production");
  const [productionStage, setProductionStage] = useState(0);
  const [agents, setAgents] = useState<ProjectAgent[]>(defaultProjectAgents);
  const [generating, setGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [saved, setSaved] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"chat" | "preview" | "files">(
    "preview"
  );
  const [previewRevision, setPreviewRevision] = useState(project.revision ?? 1);
  const [versions, setVersions] = useState<
    Array<{ label: string; code: string }>
  >([{ label: "v1 · Création du projet", code: codeSnippets["page.tsx"] }]);
  const [projectName, setProjectName] = useState(project.name);
  const aiProvidersQuery = trpc.ai.providers.useQuery();
  const [selectedProvider, setSelectedProvider] =
    useState<AiProviderId>("manus");
  const [selectedModel, setSelectedModel] = useState("platform-default");
  const [deploymentTarget, setDeploymentTarget] = useState<
    "vercel" | "netlify" | "cloudflare"
  >("vercel");
  const publishMutation = trpc.deploy.publish.useMutation();
  const selectedProviderInfo = aiProvidersQuery.data?.find(
    provider => provider.id === selectedProvider
  );

  useEffect(() => {
    if (
      selectedProviderInfo?.defaultModel &&
      !selectedProviderInfo.models.includes(selectedModel)
    ) {
      setSelectedModel(selectedProviderInfo.defaultModel);
    }
  }, [selectedProviderInfo, selectedModel]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      updateProject(project.id, {
        files: Object.keys(projectFiles).length,
        sourceFiles: projectFiles,
        revision: previewRevision,
        updatedAt: "à l’instant",
      });
      setSaved(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [project.id, projectFiles, previewRevision]);

  const chooseFile = (label: string) => {
    const nextCode =
      projectFiles[label] ??
      codeSnippets[label] ??
      `// ${label}\n\nexport default function Component() {\n  return <div>Generated component</div>;\n}`;
    setActiveFile(label);
    setCode(nextCode);
    setProjectFiles(current => ({ ...current, [label]: nextCode }));
  };
  const sendPrompt = async (value = prompt) => {
    if (!value.trim() || generating) return;
    if (!generateChange && !consumeCredit()) return;
    const content = value.trim();
    setPrompt("");
    setGenerating(true);
    setStreamingText("");
    setProductionStage(1);
    setAgents(current =>
      current.map((agent, index) => ({
        ...agent,
        status:
          index === 0
            ? "Analyse"
            : index === 1
              ? "Planification"
              : "En attente",
        progress: index === 0 ? 18 : index === 1 ? 12 : 0,
        lastAction:
          index === 0
            ? "Analyse de la demande en cours"
            : index === 1
              ? "Préparation du brief produit"
              : agent.lastAction,
      }))
    );
    setSaved(false);
    const userMessageId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content,
      time: "à l’instant",
    };
    setMessages(current => [...current, userMessage]);
    try {
      const nextRevision = previewRevision + 1;
      const generated = generateChange
        ? await generateChange({
            prompt: content,
            currentCode: code,
            currentFiles: projectFiles,
            revision: previewRevision,
            provider: selectedProvider,
            model: selectedModel,
            onChunk: chunk => setStreamingText(current => current + chunk),
          })
        : await new Promise<ReturnType<typeof generateMockChange>>(resolve =>
            setTimeout(
              () => resolve(generateMockChange(code, content, nextRevision)),
              1250
            )
          );
      const generatedFiles =
        "files" in generated && Array.isArray(generated.files)
          ? generated.files
          : [{ path: "page.tsx", content: generated.code }];
      const changedFiles = Object.fromEntries(
        (generatedFiles as Array<{ path: string; content: string }>).map(
          file => [file.path, file.content]
        )
      );
      const nextFiles = { ...projectFiles, ...changedFiles };
      const nextCode = changedFiles["page.tsx"] ?? generated.code;
      setCode(nextCode);
      setActiveFile("page.tsx");
      setProjectFiles(nextFiles);
      setPreviewRevision(generated.previewRevision);
      setStreamingText("");
      updateProject(project.id, {
        files: Object.keys(nextFiles).length,
        sourceFiles: nextFiles,
        revision: generated.previewRevision,
        updatedAt: "à l’instant",
      });
      setVersions(current => [
        ...current,
        {
          label: `v${current.length + 1} · ${content.slice(0, 28)}`,
          code: nextCode,
        },
      ]);
      const assistantText =
        "assistantMessage" in generated &&
        typeof generated.assistantMessage === "string"
          ? generated.assistantMessage
          : `C’est fait. J’ai appliqué votre demande « ${content} » au code et à la preview. Les changements sont prêts à être inspectés dans les fichiers concernés.`;
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantText,
        time: "à l’instant",
        changes: generated.changes,
      };
      setMessages(current => [...current, assistantMessage]);
      setProductionStage(6);
      setAgents(current =>
        current.map(agent => ({
          ...agent,
          status: agent.name === "Quality Guardian" ? "Test" : "Terminé",
          progress: agent.name === "Quality Guardian" ? 72 : 100,
          lastAction:
            agent.name === "Quality Guardian"
              ? "Validation du build et des changements"
              : "Patch validé dans le workspace",
        }))
      );
      if ("credits" in generated && typeof generated.credits === "number")
        onCreditsUpdated(generated.credits);
      setGenerating(false);
      setSaved(true);
      toast.success("Modification générée — 1 crédit IA utilisé");
    } catch (error) {
      setMessages(current =>
        current.filter(message => message.id !== userMessageId)
      );
      setGenerating(false);
      setStreamingText("");
      setSaved(true);
      toast.error(
        error instanceof Error
          ? error.message
          : "La génération IA a échoué. Votre crédit n’a pas été débité."
      );
    }
  };
  const handleNameBlur = () => {
    if (projectName.trim() && projectName !== project.name) {
      updateProject(project.id, {
        name: projectName.trim(),
        updatedAt: "à l’instant",
      });
      toast.success("Nom du projet mis à jour");
    }
  };

  return (
    <main className="flex h-[calc(100vh-4rem)] min-h-[680px] flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0d1425] px-4">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-5 w-px bg-white/10" />
        <div className="min-w-0 flex-1">
          <input
            value={projectName}
            onChange={event => setProjectName(event.target.value)}
            onBlur={handleNameBlur}
            className="max-w-[210px] bg-transparent text-sm font-semibold text-white outline-none"
          />
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-600">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                saved ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
              )}
            />
            {saved ? "Sauvegardé automatiquement" : "Enregistrement..."}
          </div>
        </div>
        <div className="hidden items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] p-1 md:flex">
          <button
            type="button"
            onClick={() => setMobilePanel("chat")}
            className={cn(
              "px-2.5 py-1.5 text-[10px] font-medium",
              mobilePanel === "chat"
                ? "rounded-md bg-white/10 text-white"
                : "text-slate-600"
            )}
          >
            Assistant
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("preview")}
            className={cn(
              "px-2.5 py-1.5 text-[10px] font-medium",
              mobilePanel === "preview"
                ? "rounded-md bg-white/10 text-white"
                : "text-slate-600"
            )}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("files")}
            className={cn(
              "px-2.5 py-1.5 text-[10px] font-medium",
              mobilePanel === "files"
                ? "rounded-md bg-white/10 text-white"
                : "text-slate-600"
            )}
          >
            Fichiers
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1 rounded-lg border border-violet-400/15 bg-violet-500/[0.06] px-2 py-1.5 sm:flex">
            <Sparkles className="h-3 w-3 text-violet-300" />
            <select
              aria-label="Provider IA"
              value={selectedProvider}
              onChange={event =>
                setSelectedProvider(event.target.value as AiProviderId)
              }
              className="max-w-[112px] bg-transparent text-[10px] font-medium text-violet-100 outline-none"
            >
              {(aiProvidersQuery.data ?? []).map(provider => (
                <option
                  key={provider.id}
                  value={provider.id}
                  className="bg-[#101a31] text-white"
                >
                  {provider.label}
                  {provider.configured ? " · actif" : " · non configuré"}
                </option>
              ))}
            </select>
            <select
              aria-label="Modèle IA"
              value={selectedModel}
              onChange={event => setSelectedModel(event.target.value)}
              className="hidden max-w-[118px] bg-transparent text-[10px] text-violet-200 outline-none lg:block"
            >
              {(selectedProviderInfo?.models ?? [selectedModel]).map(model => (
                <option
                  key={model}
                  value={model}
                  className="bg-[#101a31] text-white"
                >
                  {model}
                </option>
              ))}
            </select>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                selectedProviderInfo?.configured
                  ? "bg-emerald-400"
                  : "bg-amber-400"
              )}
              title={
                selectedProviderInfo?.configured
                  ? "Provider configuré"
                  : "Provider à configurer côté serveur"
              }
            />
          </div>
          <button
            type="button"
            onClick={() =>
              toast.success("Preview actualisée depuis le code actif")
            }
            className="hidden rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-white sm:block"
            title="Prévisualiser"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
              toast.success("Lien du workspace copié dans le presse-papiers");
            }}
            className="hidden rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-white sm:block"
            title="Partager"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              downloadProjectZip(project, code);
              toast.success("Export ZIP téléchargé");
            }}
            className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.07] md:flex"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter
          </button>
          <select
            aria-label="Cible de déploiement"
            value={deploymentTarget}
            onChange={event =>
              setDeploymentTarget(
                event.target.value as "vercel" | "netlify" | "cloudflare"
              )
            }
            className="hidden max-w-[108px] rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-[10px] text-slate-300 outline-none sm:block"
          >
            <option value="vercel" className="bg-[#101a31]">Vercel</option>
            <option value="netlify" className="bg-[#101a31]">Netlify</option>
            <option value="cloudflare" className="bg-[#101a31]">Cloudflare</option>
          </select>
          <button
            type="button"
            disabled={publishMutation.isPending}
            onClick={() => {
              void publishMutation
                .mutateAsync({ projectId: project.id, target: deploymentTarget })
                .then(result => {
                  updateProject(project.id, {
                    status: "Publié",
                    deploymentProvider: deploymentTarget,
                    deploymentId: result.result.deploymentId,
                    deploymentUrl: result.result.url,
                    deploymentStatus: result.result.status,
                    deployedRevision: project.revision,
                  });
                  toast.success(
                    result.result.url
                      ? `Déploiement prêt : ${result.result.url}`
                      : "Déploiement confirmé par le fournisseur"
                  );
                })
                .catch(error => {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Le déploiement a échoué."
                  );
                });
            }}
            className="bf-primary-button flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          >
            <Rocket className="h-3.5 w-3.5" />
            {publishMutation.isPending ? "Publication..." : "Publier"}
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 transition hover:bg-white/5 hover:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          className={cn(
            "min-h-0 w-full border-b border-white/[0.06] lg:block lg:w-[300px] lg:border-b-0 lg:border-r",
            mobilePanel === "chat" ? "flex flex-1" : "hidden lg:flex",
            "flex-col"
          )}
        >
          <ChatPanel
            messages={messages}
            prompt={prompt}
            setPrompt={setPrompt}
            onSend={() => sendPrompt()}
            onQuickPrompt={sendPrompt}
            generating={generating}
            streamingText={streamingText}
          />
        </div>
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col",
            mobilePanel === "preview" ? "flex" : "hidden lg:flex"
          )}
        >
          <PreviewPanel
            mode={previewMode}
            setMode={setPreviewMode}
            revision={previewRevision}
            code={code}
            files={projectFiles}
          />
        </div>
        <div
          className={cn(
            "min-h-0 w-full border-t border-white/[0.06] lg:block lg:w-[315px] lg:border-l lg:border-t-0",
            mobilePanel === "files" ? "flex flex-1" : "hidden lg:flex",
            "flex-col"
          )}
        >
          <FilesPanel
            projectId={project.id}
            activeFile={activeFile}
            chooseFile={chooseFile}
            rightTab={rightTab}
            setRightTab={setRightTab}
            agents={agents}
            motionEnabled={motionEnabled}
            code={code}
            setCode={next => {
              setCode(next);
              setProjectFiles(current => ({ ...current, [activeFile]: next }));
              setSaved(false);
            }}
            versions={versions}
            onRestore={version => {
              setCode(version.code);
              setProjectFiles(current => ({
                ...current,
                "page.tsx": version.code,
              }));
              setActiveFile("page.tsx");
              setSaved(true);
              toast.success(`${version.label} restaurée`);
            }}
          />
        </div>
      </div>
      <div className="hidden h-36 shrink-0 border-t border-white/[0.06] bg-[#0a1120] lg:block">
        <BottomPanel
          tab={bottomTab}
          setTab={setBottomTab}
          activeStage={productionStage}
        />
      </div>
      <div className="flex h-12 shrink-0 items-center justify-between border-t border-white/[0.06] bg-[#0a1120] px-4 lg:hidden">
        <div className="flex items-center gap-4 text-[10px] text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Runtime isolé actif
          </span>
          <span>24 fichiers</span>
        </div>
        <button
          type="button"
          onClick={() => toast("Le terminal est disponible sur desktop")}
          className="text-slate-500"
        >
          <Terminal className="h-4 w-4" />
        </button>
      </div>
    </main>
  );
}

function ChatPanel({
  messages,
  prompt,
  setPrompt,
  onSend,
  onQuickPrompt,
  generating,
  streamingText,
}: {
  messages: ChatMessage[];
  prompt: string;
  setPrompt: (value: string) => void;
  onSend: () => void;
  onQuickPrompt: (value: string) => void;
  generating: boolean;
  streamingText: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          <Bot className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-white">
            BuildFlow Assistant
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-400">
            En ligne · prêt à aider
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {messages.map(message => (
          <div
            key={message.id}
            className={cn(message.role === "user" ? "ml-5" : "mr-1")}
          >
            <div
              className={cn(
                "rounded-xl p-3 text-xs leading-5",
                message.role === "user"
                  ? "border border-blue-400/20 bg-blue-500/10 text-blue-50"
                  : "border border-white/[0.07] bg-white/[0.035] text-slate-300"
              )}
            >
              <p>{message.content}</p>
              {message.changes && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Modifications
                  </p>
                  <div className="space-y-1.5">
                    {message.changes.map(change => (
                      <p
                        key={change}
                        className="flex items-center gap-1.5 text-[11px] text-slate-400"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        {change}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-1.5 px-1 text-[10px] text-slate-700">
              {message.time}
            </p>
          </div>
        ))}
        {generating && streamingText && (
          <div className="mr-1 rounded-xl border border-violet-400/20 bg-violet-500/5 p-3 text-xs text-slate-400">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
              Réponse IA en direct
            </p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-slate-500">
              {streamingText}
            </pre>
          </div>
        )}
        {generating && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" />
            </span>
            BuildFlow génère vos changements...
          </div>
        )}
      </div>
      <div className="border-t border-white/[0.06] p-3">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {[
            "Rends le design plus premium",
            "Ajoute des animations haut de gamme",
            "Améliore l’expérience mobile",
            "Crée un dashboard plus interactif",
            "Ajoute une direction artistique plus forte",
            "Améliore les micro-interactions",
            "Optimise les performances",
            "Vérifie les erreurs",
            "Ajoute une page administrateur",
            "Ajoute un système de rôles",
          ].map(quick => (
            <button
              type="button"
              key={quick}
              onClick={() => onQuickPrompt(quick)}
              className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-500 transition hover:border-blue-400/30 hover:text-blue-200"
            >
              {quick}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2">
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            rows={2}
            placeholder="Demandez une modification..."
            className="w-full resize-none bg-transparent px-1 text-xs leading-5 text-slate-200 outline-none placeholder:text-slate-600"
          />
          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md p-1.5 text-slate-600 hover:bg-white/10 hover:text-slate-300"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded-md p-1.5 text-slate-600 hover:bg-white/10 hover:text-slate-300"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded-md p-1.5 text-slate-600 hover:bg-white/10 hover:text-slate-300"
              >
                <Mic className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onSend}
              disabled={generating || !prompt.trim()}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500 text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({
  mode,
  setMode,
  revision,
  code,
  files,
}: {
  mode: "desktop" | "tablet" | "mobile";
  setMode: (mode: "desktop" | "tablet" | "mobile") => void;
  revision: number;
  code: string;
  files: Record<string, string>;
}) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [runtimeState, setRuntimeState] = useState<
    "idle" | "starting" | "running" | "error"
  >("idle");
  const [runtimeUrl, setRuntimeUrl] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState("");
  const [runtimeLogs, setRuntimeLogs] = useState<string[]>([]);
  const width =
    mode === "desktop" ? "w-full" : mode === "tablet" ? "w-[76%]" : "w-[320px]";
  const previewDocument = buildPreviewDocument(code, revision, refreshNonce);
  const appendLog = (message: string) => {
    const lines = message
      .split("\\n")
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length)
      setRuntimeLogs(current => [...current, ...lines].slice(-80));
  };
  const startRuntime = async () => {
    setRuntimeState("starting");
    setRuntimeError("");
    setRuntimeLogs([]);
    try {
      if (runtimeUrl) {
        await updateWebContainerRuntime(code, files);
        setRuntimeState("running");
        setRefreshNonce(value => value + 1);
        toast.success("Preview réelle actualisée");
        return;
      }
      const url = await startWebContainerRuntime(code, files, appendLog);
      setRuntimeUrl(url);
      setRuntimeState("running");
      toast.success("Runtime réel démarré");
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
    if (!runtimeUrl || runtimeState !== "running") return;
    const timer = window.setTimeout(() => {
      void updateWebContainerRuntime(code, files).catch(error => {
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
                  : "Preview simulée"}
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
            onClick={() => setRefreshNonce(value => value + 1)}
            className="rounded-md p-1.5 text-slate-600 hover:text-slate-300"
            title="Actualiser la preview"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const url =
                runtimeUrl ??
                URL.createObjectURL(
                  new Blob([previewDocument], { type: "text/html" })
                );
              const popup = window.open(url, "_blank", "noopener,noreferrer");
              if (!runtimeUrl) {
                if (popup)
                  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
                else URL.revokeObjectURL(url);
              }
            }}
            className="rounded-md p-1.5 text-slate-600 hover:text-slate-300"
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
          <iframe
            key={`${revision}-${refreshNonce}-${runtimeUrl ?? "fallback"}`}
            title="Preview de l’application générée"
            sandbox="allow-scripts allow-forms allow-modals"
            src={runtimeUrl ?? undefined}
            srcDoc={runtimeUrl ? undefined : previewDocument}
            className="h-[680px] min-h-full w-full border-0"
          />
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
function escapePreviewHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    character =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character
  );
}

function buildPreviewDocument(
  code: string,
  revision: number,
  refreshNonce: number
) {
  const title = code.match(/Bonjour,\s*([^<\n]+)/i)?.[1]?.trim() || "Alex";
  const cards = [
    ...code.matchAll(
      /<DashboardCard\s+label=["']([^"']+)["']\s+value=["']([^"']+)["']/g
    ),
  ].slice(0, 3);
  const metrics = cards.length
    ? cards
        .map(
          match =>
            `<article class="metric"><span>${escapePreviewHtml(match[1])}</span><strong>${escapePreviewHtml(match[2])}</strong><small>Mis à jour à l’instant</small></article>`
        )
        .join("")
    : `<article class="metric"><span>Projets actifs</span><strong>12</strong><small>+3 ce mois</small></article><article class="metric"><span>Générations</span><strong>72</strong><small>Cette période</small></article><article class="metric"><span>Performance</span><strong>98,6%</strong><small>Excellent</small></article>`;
  const chart = code.toLowerCase().includes("chart");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}body{margin:0;background:#f7f9fc;color:#0f172a;font:14px Inter,ui-sans-serif,system-ui,sans-serif}button{font:inherit}.shell{display:flex;min-height:680px}.side{width:190px;flex:none;border-right:1px solid #e2e8f0;background:#fff;padding:22px 16px}.brand{font-weight:800;display:flex;gap:8px;align-items:center}.brand i{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:#2563eb;color:#fff;font-style:normal}.nav{margin-top:38px;display:grid;gap:5px}.nav button{border:0;background:transparent;border-radius:8px;text-align:left;padding:9px;color:#64748b;cursor:pointer}.nav button.active,.nav button:hover{background:#eff6ff;color:#2563eb;font-weight:700}.main{min-width:0;flex:1;padding:28px}.eyebrow{font-size:11px;color:#94a3b8}.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.heading h1{margin:6px 0 4px;font-size:27px;letter-spacing:-.04em}.heading p{margin:0;color:#64748b;font-size:12px}.avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#60a5fa,#8b5cf6)}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:26px}.metric,.panel{border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:16px;box-shadow:0 6px 18px rgba(15,23,42,.04)}.metric span,.metric small{display:block;color:#94a3b8;font-size:11px}.metric strong{display:block;margin:9px 0 5px;font-size:22px;letter-spacing:-.04em}.metric small{color:#10b981}.grid{display:grid;grid-template-columns:1.25fr .75fr;gap:14px;margin-top:14px}.panel h2{font-size:13px;margin:0}.bars{height:160px;display:flex;align-items:flex-end;gap:7px;margin-top:25px}.bars i{display:block;flex:1;border-radius:6px 6px 2px 2px;background:linear-gradient(#60a5fa,#2563eb);min-height:18px}.transactions{display:grid;gap:11px;margin-top:18px}.transaction{display:flex;justify-content:space-between;gap:10px;align-items:center}.transaction span{font-size:11px}.transaction small{display:block;color:#94a3b8;font-size:10px;margin-top:3px}.add{border:0;border-radius:8px;padding:8px 11px;background:#2563eb;color:#fff;font-size:11px;cursor:pointer}.toast{position:fixed;right:18px;bottom:18px;padding:10px 12px;background:#0f172a;color:#fff;border-radius:9px;font-size:11px;opacity:0;transform:translateY(8px);transition:.2s}.toast.show{opacity:1;transform:none}@media(max-width:720px){.side{display:none}.main{padding:20px 16px}.metrics{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.heading h1{font-size:23px}}
  </style></head><body><div class="shell"><aside class="side"><div class="brand"><i>BF</i> BuildFlow</div><nav class="nav"><button class="active">Vue d’ensemble</button><button>Projets</button><button>Activité</button><button>Paramètres</button></nav></aside><main class="main"><div class="heading"><div><span class="eyebrow">Runtime isolé · révision ${revision}.${refreshNonce}</span><h1>Bonjour, ${escapePreviewHtml(title)} 👋</h1><p>Cette interface est générée depuis les fichiers actifs du workspace.</p></div><span class="avatar"></span></div><section class="metrics">${metrics}</section><div class="grid">${chart ? `<section class="panel"><h2>Évolution des données</h2><div class="bars">${[45, 62, 52, 78, 58, 90, 72, 84, 67, 96].map(height => `<i style="height:${height}%"></i>`).join("")}</div></section>` : `<section class="panel"><h2>Votre application est prête</h2><p style="color:#64748b;font-size:12px;line-height:1.7">Modifiez le code ou demandez une nouvelle génération dans le chat pour actualiser cette preview.</p></section>`}<section class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2>Activité récente</h2><button class="add" id="add">+ Ajouter</button></div><div class="transactions" id="transactions"><div class="transaction"><div><span>Nouvelle fonctionnalité</span><small>à l’instant</small></div><b style="color:#2563eb">Prêt</b></div><div class="transaction"><div><span>Preview compilée</span><small>révision ${revision}</small></div><b style="color:#10b981">OK</b></div></div></section></div></main></div><div class="toast" id="toast">Action enregistrée</div><script>const toast=document.getElementById('toast'),list=document.getElementById('transactions');document.querySelectorAll('.nav button').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.nav button').forEach(item=>item.classList.remove('active'));button.classList.add('active');toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1200)}));document.getElementById('add').addEventListener('click',()=>{const row=document.createElement('div');row.className='transaction';row.innerHTML='<div><span>Élément ajouté</span><small>maintenant</small></div><b style="color:#8b5cf6">Nouveau</b>';list.prepend(row);toast.textContent='Élément ajouté';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1200)});</script></body></html>`;
}

function ExpensePreview() {
  const transactions = [
    ["Notion", "Abonnement", "-14,00 €", "#8B5CF6"],
    ["Carrefour Market", "Alimentation", "-82,40 €", "#F59E0B"],
    ["Uber", "Transport", "-18,20 €", "#3B82F6"],
    ["Figma", "Outils", "-15,00 €", "#EC4899"],
  ];
  return (
    <div className="min-h-[600px] bg-[#f7f9fc] text-slate-900">
      <div className="flex min-h-[600px]">
        <aside className="hidden w-40 shrink-0 border-r border-slate-200 bg-white p-3 sm:block">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-800">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-600 text-white">
              <Sparkles className="h-3 w-3" />
            </span>
            ExpenseFlow
          </div>
          <div className="mt-8 space-y-1">
            {["Vue d’ensemble", "Transactions", "Budgets", "Rapports"].map(
              (item, index) => (
                <div
                  key={item}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-[9px]",
                    index === 0
                      ? "bg-blue-50 font-semibold text-blue-600"
                      : "text-slate-400"
                  )}
                >
                  {item}
                </div>
              )
            )}
          </div>
          <div className="mt-12 rounded-lg bg-slate-50 p-2">
            <p className="text-[8px] text-slate-400">Budget mensuel</p>
            <p className="mt-1 text-[12px] font-bold">62% utilisé</p>
            <div className="mt-2 h-1 rounded-full bg-slate-200">
              <div className="h-1 w-[62%] rounded-full bg-blue-500" />
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] text-slate-400">
                Mardi 24 septembre 2026
              </p>
              <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                Bonjour, Alex <span className="text-base">👋</span>
              </h3>
              <p className="mt-1 text-[10px] text-slate-400">
                Voici le résumé de vos finances.
              </p>
            </div>
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-500" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MiniMetric
              label="Dépenses"
              value="2 480 €"
              detail="-8,4%"
              positive
            />
            <MiniMetric
              label="Budget restant"
              value="1 240 €"
              detail="sur 4 000 €"
            />
            <MiniMetric
              label="Épargne"
              value="680 €"
              detail="+12,5%"
              positive
            />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold">Évolution des dépenses</p>
                <span className="rounded-md bg-slate-50 px-2 py-1 text-[8px] text-slate-400">
                  6 mois⌄
                </span>
              </div>
              <div className="relative mt-4 h-24">
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100" />
                <div className="absolute inset-x-0 bottom-1/4 border-t border-dashed border-slate-100" />
                <svg
                  viewBox="0 0 300 100"
                  className="h-full w-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#3B82F6" stopOpacity=".25" />
                      <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 72 C20 60, 30 80, 48 58 S72 70, 88 44 S112 65, 128 50 S148 35, 166 42 S184 58, 202 28 S224 55, 242 38 S264 42, 300 16 V100 H0Z"
                    fill="url(#area)"
                  />
                  <path
                    d="M0 72 C20 60, 30 80, 48 58 S72 70, 88 44 S112 65, 128 50 S148 35, 166 42 S184 58, 202 28 S224 55, 242 38 S264 42, 300 16"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="mt-1 flex justify-between text-[8px] text-slate-300">
                <span>Avr</span>
                <span>Mai</span>
                <span>Juin</span>
                <span>Juil</span>
                <span>Août</span>
                <span>Sep</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold">Par catégorie</p>
              <div className="mt-4 flex items-center gap-3">
                <div
                  className="relative h-16 w-16 shrink-0 rounded-full"
                  style={{
                    background:
                      "conic-gradient(#3B82F6 0 38%, #8B5CF6 38% 62%, #F59E0B 62% 82%, #22C55E 82% 100%)",
                  }}
                >
                  <div className="absolute inset-2 rounded-full bg-white" />
                </div>
                <div className="space-y-1 text-[8px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <i className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Logement 38%
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                    Alimentation 24%
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Transport 20%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold">Transactions récentes</p>
              <button
                type="button"
                className="rounded-md bg-blue-600 px-2 py-1 text-[8px] font-semibold text-white"
              >
                + Ajouter
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {transactions.map(([name, category, amount, color]) => (
                <div key={name} className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[8px] font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {name.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[9px] font-semibold">
                        {name}
                      </p>
                      <p className="text-[8px] text-slate-400">{category}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-semibold text-slate-700">
                    {amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  detail,
  positive = false,
}: {
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <p className="text-[8px] text-slate-400">{label}</p>
      <p className="mt-1 text-[13px] font-bold tracking-tight text-slate-800">
        {value}
      </p>
      <p
        className={cn(
          "mt-1 text-[8px]",
          positive ? "text-emerald-500" : "text-slate-400"
        )}
      >
        {detail}
      </p>
    </div>
  );
}

function FilesPanel({
  projectId,
  activeFile,
  chooseFile,
  rightTab,
  setRightTab,
  agents,
  motionEnabled,
  code,
  setCode,
  versions,
  onRestore,
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
  versions: Array<{ label: string; code: string }>;
  onRestore: (version: { label: string; code: string }) => void;
}) {
  const tabs: WorkspaceTab[] = [
    "Fichiers",
    "Code",
    "Composants",
    "Données",
    "Équipe IA",
    "Historique",
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
          {fileTree.map((item, index) => {
            const isActive = item.kind === "file" && item.label === activeFile;
            const FileIcon =
              item.kind === "folder"
                ? index === 0 || item.label === "app"
                  ? FolderOpen
                  : Folder
                : item.language === "json"
                  ? FileJson
                  : item.language === "md"
                    ? FileText
                    : FileCode2;
            return (
              <button
                type="button"
                key={`${item.label}-${index}`}
                onClick={() => item.kind === "file" && chooseFile(item.label)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md py-1.5 text-left text-[11px] transition",
                  isActive
                    ? "bg-blue-500/12 text-blue-200"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                )}
                style={{ paddingLeft: `${10 + item.depth * 15}px` }}
              >
                <FileIcon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    item.kind === "folder"
                      ? "text-amber-300/70"
                      : "text-slate-600"
                  )}
                />
                {item.label}
                {isActive && (
                  <span className="ml-auto mr-2 h-1.5 w-1.5 rounded-full bg-blue-400" />
                )}
              </button>
            );
          })}
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
          <textarea
            value={code}
            onChange={event => setCode(event.target.value)}
            spellCheck={false}
            className="h-full min-h-[350px] w-full resize-none rounded-lg border border-white/[0.07] bg-[#080e1b] p-3 font-mono text-[10px] leading-5 text-blue-100/80 outline-none focus:border-blue-400/30"
          />
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
        <HistoryList versions={versions} onRestore={onRestore} />
      )}
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
function HistoryList({
  versions,
  onRestore,
}: {
  versions: Array<{ label: string; code: string }>;
  onRestore: (version: { label: string; code: string }) => void;
}) {
  return (
    <div className="space-y-3 overflow-y-auto p-3">
      {versions
        .slice()
        .reverse()
        .map((version, index) => (
          <div
            key={version.label}
            className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] text-slate-300">
                {version.label}
              </p>
              <p className="mt-1 text-[10px] text-slate-600">
                {index === 0 ? "à l’instant" : "version sauvegardée"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRestore(version)}
              className="shrink-0 text-[10px] text-blue-300 hover:text-blue-200"
            >
              Restaurer
            </button>
          </div>
        ))}
    </div>
  );
}

function BottomPanel({
  tab,
  setTab,
  activeStage,
}: {
  tab: string;
  setTab: (tab: string) => void;
  activeStage: number;
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
                <span className="ml-1.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300">
                  0
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Processus actif
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {tab === "Production" && (
          <ProductionTimeline activeStage={activeStage} />
        )}
        {tab === "Logs" && (
          <div className="space-y-1">
            {generationLogs.map(log => (
              <div key={log.time} className="flex gap-4 font-mono text-[10px]">
                <span className="text-slate-700">{log.time}</span>
                <span
                  className={
                    log.tone === "success"
                      ? "text-emerald-400"
                      : "text-blue-300"
                  }
                >
                  {log.label}
                </span>
                <span className="text-slate-600">{log.detail}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "Terminal" && (
          <div className="font-mono text-[10px] leading-5 text-slate-500">
            <p>
              <span className="text-emerald-400">➜</span> expense-flow{" "}
              <span className="text-slate-300">pnpm dev</span>
            </p>
            <p className="text-slate-600">VITE v7.1.7 ready in 426 ms</p>
            <p className="text-blue-300">➜ Local: http://localhost:5173/</p>
          </div>
        )}
        {tab === "Erreurs" && (
          <div className="flex items-center gap-2 py-2 text-[10px] text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aucune erreur détectée dans votre projet.
          </div>
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

function TemplatesPage({
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

type BillingPayment = {
  id: string;
  plan: "pro" | "team";
  amount: number;
  currency: string;
  status: string;
  createdAt: Date | string;
};
function BillingPage({
  credits,
  currentPlan,
  payments,
  isAdmin,
  onCheckout,
}: {
  credits: number;
  currentPlan: "free" | "pro" | "team";
  payments: BillingPayment[];
  isAdmin: boolean;
  onCheckout?: (plan: "Pro" | "Équipe") => Promise<void>;
}) {
  const initialPlan =
    currentPlan === "pro"
      ? "Pro"
      : currentPlan === "team"
        ? "Équipe"
        : "Gratuit";
  const [plan, setPlan] = useState<"Gratuit" | "Pro" | "Équipe">(initialPlan);
  useEffect(() => setPlan(initialPlan), [initialPlan]);
  const [loadingPlan, setLoadingPlan] = useState<"Pro" | "Équipe" | null>(null);
  const planLimit = isAdmin
    ? 2_000
    : plan === "Pro"
      ? 500
      : plan === "Équipe"
        ? 2_000
        : 20;
  const used = Math.max(0, planLimit - credits);
  const progress = Math.min(100, Math.round((used / planLimit) * 100));
  const choosePlan = async (selectedPlan: "Pro" | "Équipe") => {
    setPlan(selectedPlan);
    if (!onCheckout) {
      toast("Connectez-vous avec Manus pour ouvrir le Checkout Stripe.");
      return;
    }
    setLoadingPlan(selectedPlan);
    try {
      await onCheckout(selectedPlan);
      toast.success("Checkout Stripe ouvert dans un nouvel onglet");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d’ouvrir le Checkout Stripe."
      );
    } finally {
      setLoadingPlan(null);
    }
  };
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
        Compte
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
        Facturation & crédits
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Le plan gratuit inclut 20 générations IA par mois, sans quota quotidien
        massif.{" "}
        {isAdmin
          ? "Votre compte administrateur dispose d’un accès premium illimité."
          : ""}
      </p>
      <div className="mt-9 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="bf-surface rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Plan {plan}</p>
              <p className="mt-1 text-xs text-slate-500">
                Les crédits se renouvellent à chaque période d’abonnement.
              </p>
            </div>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-300">
              Actif
            </span>
          </div>
          <div className="mt-7">
            <div className="flex items-end justify-between">
              <span className="text-xs text-slate-500">
                Générations IA utilisées
              </span>
              <span className="text-xs font-semibold text-white">
                {used}{" "}
                <span className="font-normal text-slate-600">
                  / {planLimit}
                </span>
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-600">
              {credits} crédits disponibles
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {(plan === "Gratuit"
              ? [
                  "3 projets",
                  "Prévisualisation",
                  "Export ZIP",
                  "20 générations par mois",
                ]
              : plan === "Pro"
                ? [
                    "Projets illimités",
                    "Export GitHub",
                    "Publication personnalisée",
                    "Support prioritaire",
                  ]
                : [
                    "Tout le plan Pro",
                    "2 000 générations par mois",
                    "Collaboration",
                    "Gestion des rôles",
                  ]
            ).map(item => (
              <div
                key={item}
                className="flex items-center gap-2 text-xs text-slate-300"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                {item}
              </div>
            ))}
          </div>
          <p className="mt-8 text-[11px] leading-5 text-slate-600">
            Les paiements utilisent Stripe Checkout en mode test. Aucun débit
            n’est lancé depuis cette page sans action explicite sur le Checkout.
          </p>
        </div>
        <div className="rounded-2xl border border-blue-400/25 bg-blue-500/[0.08] p-6">
          <Sparkles className="h-5 w-5 text-blue-300" />
          <h2 className="mt-5 text-lg font-semibold text-white">
            Passez à l’échelle.
          </h2>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            Choisissez un abonnement mensuel et récupérez votre quota à chaque
            période.
          </p>
          <div className="mt-6 grid gap-3">
            {!isAdmin && (
              <>
                <button
                  type="button"
                  disabled={loadingPlan !== null}
                  onClick={() => choosePlan("Pro")}
                  className="bf-primary-button flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold text-white"
                >
                  {loadingPlan === "Pro" ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Pro · 19 € / mois
                </button>
                <button
                  type="button"
                  disabled={loadingPlan !== null}
                  onClick={() => choosePlan("Équipe")}
                  className="rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.07]"
                >
                  Équipe · 49 € / mois
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white">
          Historique de facturation
        </h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111827]/65">
          <div className="grid grid-cols-4 border-b border-white/[0.06] px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            <span>Date</span>
            <span>Plan</span>
            <span>Statut</span>
            <span className="text-right">Montant</span>
          </div>
          {payments.length === 0 ? (
            <div className="px-5 py-6 text-xs text-slate-600">
              Aucun paiement enregistré pour le moment.
            </div>
          ) : (
            payments.map(payment => (
              <div
                key={payment.id}
                className="grid grid-cols-4 px-5 py-4 text-xs text-slate-400"
              >
                <span>
                  {new Date(payment.createdAt).toLocaleDateString("fr-FR")}
                </span>
                <span>{payment.plan === "team" ? "Équipe" : "Pro"}</span>
                <span
                  className={
                    payment.status === "paid"
                      ? "text-emerald-300"
                      : "text-amber-300"
                  }
                >
                  {payment.status === "paid" ? "Payé" : payment.status}
                </span>
                <span className="text-right text-slate-200">
                  {(payment.amount / 100).toLocaleString("fr-FR", {
                    style: "currency",
                    currency: payment.currency.toUpperCase(),
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
function SettingsPage({
  userName,
  userEmail,
  onSaveProfile,
}: {
  userName: string;
  userEmail: string;
  onSaveProfile?: (profile: { name: string; email: string }) => Promise<void>;
}) {
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(userEmail);
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [developerMode, setDeveloperMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const providersQuery = trpc.ai.providers.useQuery();
  const testProviderMutation = trpc.ai.testConnection.useMutation();
  const vercelPreflight = trpc.deploy.preflight.useQuery({ target: "vercel" });
  const netlifyPreflight = trpc.deploy.preflight.useQuery({ target: "netlify" });
  const cloudflarePreflight = trpc.deploy.preflight.useQuery({ target: "cloudflare" });
  const [providerResults, setProviderResults] = useState<
    Record<string, { ok: boolean; latencyMs?: number; message?: string }>
  >({});
  const [supabaseStatus, setSupabaseStatus] = useState<
    { ok: boolean; latencyMs?: number; message: string } | undefined
  >();
  const [testingSupabase, setTestingSupabase] = useState(false);
  useEffect(() => {
    setName(userName);
    setEmail(userEmail);
  }, [userName, userEmail]);
  const save = async () => {
    if (name.trim().length < 2 || !email.includes("@")) {
      toast.error("Vérifiez votre nom et votre adresse email.");
      return;
    }
    setSaving(true);
    try {
      if (onSaveProfile)
        await onSaveProfile({ name: name.trim(), email: email.trim() });
      localStorage.setItem(
        "buildflow-preferences",
        JSON.stringify({ notifications, autoSave, developerMode })
      );
      toast.success("Préférences enregistrées");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer vos préférences."
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
        Compte
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
        Paramètres
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Personnalisez votre espace de travail.
      </p>
      <div className="mt-9 space-y-5">
        <SettingsSection
          title="Profil"
          description="Les informations visibles par votre équipe."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nom complet"
              value={name}
              onChange={setName}
              placeholder="Alex Martin"
            />
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="vous@exemple.com"
              type="email"
            />
          </div>
        </SettingsSection>
        <SettingsSection
          title="Préférences"
          description="Configurez la façon dont BuildFlow vous accompagne."
        >
          <div className="space-y-4">
            <ToggleRow
              label="Notifications de génération"
              description="Recevoir un résumé quand une génération est terminée."
              checked={notifications}
              onChange={setNotifications}
            />
            <ToggleRow
              label="Sauvegarde automatique"
              description="Enregistrer les modifications après chaque action."
              checked={autoSave}
              onChange={setAutoSave}
            />
            <ToggleRow
              label="Mode développeur"
              description="Afficher les logs détaillés dans le workspace."
              checked={developerMode}
              onChange={setDeveloperMode}
            />
          </div>
        </SettingsSection>
        <SettingsSection
          title="Providers IA"
          description="Vérifiez la configuration serveur, la disponibilité et la latence de chaque provider."
        >
          <div className="space-y-3">
            {(providersQuery.data ?? []).map(provider => {
              const result = providerResults[provider.id];
              const testing =
                testProviderMutation.isPending &&
                testProviderMutation.variables?.provider === provider.id;
              return (
                <div
                  key={provider.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-200">{provider.label}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px]", provider.configured ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300")}>
                        {provider.configured ? "Configuré" : "À configurer"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">{provider.description}</p>
                    {result && (
                      <p className={cn("mt-2 flex items-center gap-1.5 text-[11px]", result.ok ? "text-emerald-300" : "text-red-300")}>
                        {result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
                        {result.ok ? `Connexion OK · ${result.latencyMs ?? 0} ms` : result.message}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={testing || !provider.configured}
                    onClick={() => testProviderMutation.mutate(
                      { provider: provider.id },
                      {
                        onSuccess: value => setProviderResults(current => ({ ...current, [provider.id]: value })),
                        onError: error => setProviderResults(current => ({ ...current, [provider.id]: { ok: false, message: error.message } })),
                      }
                    )}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", testing && "animate-spin")} />
                    {testing ? "Test en cours…" : "Tester la connexion"}
                  </button>
                </div>
              );
            })}
            {providersQuery.isLoading && <p className="text-xs text-slate-600">Chargement des providers…</p>}
            {providersQuery.error && <p className="text-xs text-red-300">Impossible de charger les providers : {providersQuery.error.message}</p>}
          </div>
        </SettingsSection>
        <SettingsSection
          title="Supabase"
          description="Vérifiez que le projet Supabase configuré répond avant d’activer ses fonctionnalités métier."
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {isSupabaseConfigured ? "Projet Supabase détecté" : "Supabase non configuré"}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                {supabaseStatus?.message ??
                  "La connexion utilise VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY côté client."}
              </p>
            </div>
            <button
              type="button"
              disabled={!supabase || testingSupabase}
              onClick={async () => {
                if (!supabase) return;
                setTestingSupabase(true);
                const startedAt = Date.now();
                try {
                  const { error } = await supabase.auth.getSession();
                  if (error) throw error;
                  setSupabaseStatus({
                    ok: true,
                    latencyMs: Date.now() - startedAt,
                    message: "Connexion Supabase opérationnelle.",
                  });
                } catch (error) {
                  setSupabaseStatus({
                    ok: false,
                    message: error instanceof Error ? error.message : "Connexion Supabase indisponible.",
                  });
                } finally {
                  setTestingSupabase(false);
                }
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", testingSupabase && "animate-spin")} />
              {testingSupabase ? "Test en cours…" : "Tester Supabase"}
            </button>
          </div>
          {supabaseStatus && (
            <p className={cn("mt-3 text-[11px]", supabaseStatus.ok ? "text-emerald-300" : "text-red-300")}>
              {supabaseStatus.ok ? `OK · ${supabaseStatus.latencyMs} ms` : "Échec"}
            </p>
          )}
        </SettingsSection>
        <SettingsSection
          title="Déploiement"
          description="Le pré-contrôle vérifie les variables nécessaires avant toute intégration de déploiement distant."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Vercel", vercelPreflight.data],
              ["Netlify", netlifyPreflight.data],
              ["Cloudflare Pages", cloudflarePreflight.data],
            ].map(entry => {
              const label = String(entry[0]);
              const preflight = entry[1] as typeof vercelPreflight.data;
              return (
                <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", preflight?.ready ? "bg-emerald-400" : "bg-amber-400")} />
                    <p className="text-xs font-semibold text-slate-200">{label}</p>
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-slate-600">
                    {preflight?.message ?? "Vérification en cours…"}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] text-slate-600">
            Aucun statut « publié » n’est modifié par ce contrôle : il bloque seulement les faux positifs de configuration.
          </p>
        </SettingsSection>
        <SettingsSection
          title="Sécurité"
          description="Protégez l’accès à votre espace."
        >
          <button
            type="button"
            onClick={() =>
              toast(
                "La connexion et la récupération de compte sont gérées par Manus OAuth."
              )
            }
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.07]"
          >
            <ShieldCheck className="h-4 w-4 text-blue-300" />
            Gérer la connexion
          </button>
        </SettingsSection>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="bf-primary-button rounded-lg px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </div>
      </div>
    </main>
  );
}
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="bf-surface rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs text-slate-600">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span>
        <span className="block text-xs font-medium text-slate-300">
          {label}
        </span>
        <span className="mt-1 block text-[11px] text-slate-600">
          {description}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition",
          checked ? "bg-blue-500" : "bg-white/10"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-white transition",
            checked ? "left-5" : "left-1"
          )}
        />
      </button>
    </label>
  );
}

function DocsPage({ navigate }: { navigate: (path: string) => void }) {
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

function AdminPage() {
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

function Panel({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bf-surface rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="text-[10px] text-blue-300 hover:text-blue-200"
          >
            {action}
          </button>
        )}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function NotFoundPage({ navigate }: { navigate: (path: string) => void }) {
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
