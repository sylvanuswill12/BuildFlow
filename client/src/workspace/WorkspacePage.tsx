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
  exportWebContainerBuildFiles,
} from "@/lib/webcontainerRuntime";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { MAX_IMAGE_ATTACHMENT_BYTES } from "../../../shared/attachments";


import { ChatPanel } from "./chat/ChatPanel";
import { PreviewPanel } from "./preview/PreviewPanel";
import { FilesPanel } from "./files/FilesPanel";
import { BottomPanel } from "./bottom/BottomPanel";
import type { RuntimeLogEntry, RuntimeStatus } from "./types";
import { applyFileAgentAction, type AgentAction, type AgentMode } from "@shared/agentActions";
import type { UploadedImage } from "@shared/attachments";
import { parseImageAttachments, serializeImageAttachment } from "@shared/attachments";
import { runWebContainerCommand } from "@/lib/webcontainerRuntime";
import { diffProjectFileMaps, type ProjectFileChange } from "@/lib/fileDiff";

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

type AgentStatus =
  | "En attente"
  | "Analyse"
  | "Planification"
  | "Design"
  | "Développement"
  | "Test"
  | "Terminé"
  | "Attention requise";

export type ProjectAgent = {
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

type IconType = typeof Sparkles;

type AiProviderId = "openai" | "anthropic" | "google" | "openrouter" | "omniroute" | "groq" | "deepseek" | "mistral" | "ollama" | "openai-compatible";

type LlmGenerationResult = { code: string; changes: string[]; assistantMessage: string; files?: Array<{ path: string; content: string }>; deletedFiles?: string[]; agentActions?: AgentAction[]; repairSessionId?: string; previewRevision: number; credits: number };

export function WorkspacePage({
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
  }) => Promise<LlmGenerationResult>;
  onCreditsUpdated: (credits: number) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const initialFiles =
    project.sourceFiles && Object.keys(project.sourceFiles).length > 0
      ? { ...codeSnippets, ...project.sourceFiles }
      : { ...codeSnippets };
  const [activeFile, setActiveFile] = useState("src/App.tsx");
  const [code, setCode] = useState(
    initialFiles["src/App.tsx"] ?? codeSnippets["src/App.tsx"]
  );
  const [projectFiles, setProjectFiles] =
    useState<Record<string, string>>(initialFiles);
  const projectFilesRef = useRef(projectFiles);
  const shellResultsRef = useRef<string[]>([]);
  const messagesQuery = trpc.messages.list.useQuery(
    { projectId: project.id },
    { retry: false }
  );
  const appendMessageMutation = trpc.messages.append.useMutation();
  const uploadAttachmentMutation = trpc.attachments.upload.useMutation();
  const snapshotsQuery = trpc.snapshots.list.useQuery({ projectId: project.id }, { retry: false });
  const createSnapshotMutation = trpc.snapshots.create.useMutation();
  const restoreSnapshotMutation = trpc.snapshots.restore.useMutation();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>();
  const snapshotDetailsQuery = trpc.snapshots.get.useQuery(
    { snapshotId: selectedSnapshotId ?? "" },
    { enabled: Boolean(selectedSnapshotId), retry: false }
  );
  const initialSnapshotStarted = useRef(false);
  const [previewMode, setPreviewMode] = useState<
    "desktop" | "tablet" | "mobile"
  >("desktop");
  const rightTab = useBuildFlowStore(state => state.rightTab);
  const setRightTab = useBuildFlowStore(state => state.setRightTab);
  const motionEnabled = useBuildFlowStore(state => state.motionEnabled);
  const [bottomTab, setBottomTab] = useState("Production");
  const [runtimeLogs, setRuntimeLogs] = useState<RuntimeLogEntry[]>([]);
  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeLogEntry[]>([]);
  const runtimeErrorsRef = useRef<RuntimeLogEntry[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("idle");
  const [repairSessionId, setRepairSessionId] = useState<string | null>(null);
  const [productionStage, setProductionStage] = useState(0);
  const [agents, setAgents] = useState<ProjectAgent[]>(defaultProjectAgents);
  const [generating, setGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [saved, setSaved] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"chat" | "preview" | "files">(
    "preview"
  );
  const [previewRevision, setPreviewRevision] = useState(project.revision ?? 1);
  const [pendingFileDiffs, setPendingFileDiffs] = useState<ProjectFileChange[]>([]);
  const [projectName, setProjectName] = useState(project.name);
  const aiProvidersQuery = trpc.ai.providers.useQuery();
  const enhancePromptMutation = trpc.ai.enhancePrompt.useMutation();
  const [selectedProvider, setSelectedProvider] =
    useState<AiProviderId>("omniroute");
  const [selectedModel, setSelectedModel] = useState("auto");
  const [agentMode, setAgentMode] = useState<AgentMode>("build");
  const [deploymentTarget, setDeploymentTarget] = useState<
    "vercel" | "netlify" | "cloudflare"
  >("vercel");
  const [buildingForPublish, setBuildingForPublish] = useState(false);
  const publishMutation = trpc.deploy.publish.useMutation();
  const selectedProviderInfo = aiProvidersQuery.data?.find(
    provider => provider.id === selectedProvider
  );

  useEffect(() => {
    if (!messagesQuery.data) return;
    setMessages(messagesQuery.data.map(message => {
      const attachments = parseImageAttachments(message.actions);
      const changes = message.actions?.filter(action => !action.startsWith("buildflow-image:"));
      return {
        id: message.id,
        role: message.role as ChatMessage["role"],
        content: message.content,
        time: new Date(message.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        ...(changes?.length ? { changes } : {}),
        ...(attachments.length ? { attachments } : {}),
      };
    }));
  }, [messagesQuery.data]);

  useEffect(() => {
    projectFilesRef.current = projectFiles;
  }, [projectFiles]);

  useEffect(() => {
    if (!snapshotsQuery.isSuccess || (snapshotsQuery.data?.length ?? 0) > 0 || initialSnapshotStarted.current) return;
    initialSnapshotStarted.current = true;
    void createSnapshotMutation.mutateAsync({ projectId: project.id, label: "État initial", files: projectFiles })
      .then(() => snapshotsQuery.refetch())
      .catch(error => console.warn("[Snapshots] Initial snapshot could not be saved:", error));
  }, [snapshotsQuery.isSuccess, snapshotsQuery.data, project.id, projectFiles]);

  const recordRuntimeLog = (entry: Omit<RuntimeLogEntry, "id" | "time">) => {
    const log: RuntimeLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
    setRuntimeLogs(current => [...current, log].slice(-500));
    if (log.level === "error") {
      runtimeErrorsRef.current = [...runtimeErrorsRef.current, log].slice(-200);
      setRuntimeErrors(runtimeErrorsRef.current);
    }
  };

  const uploadImageToServer = async (file: File): Promise<UploadedImage> => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
    if (!allowed.includes(file.type as typeof allowed[number])) throw new Error("Format image non accepté. Utilisez PNG, JPEG, WebP ou GIF.");
    if (file.size > MAX_IMAGE_ATTACHMENT_BYTES) throw new Error("Une image doit peser au maximum 4 Mio.");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Lecture de l’image impossible."));
      reader.onerror = () => reject(new Error("Lecture de l’image impossible."));
      reader.readAsDataURL(file);
    });
    const dataBase64 = dataUrl.split(",", 2)[1];
    if (!dataBase64) throw new Error("Image invalide.");
    return uploadAttachmentMutation.mutateAsync({ projectId: project.id, fileName: file.name, mimeType: file.type as typeof allowed[number], dataBase64 });
  };

  const publishProjectBuild = async () => {
    setBuildingForPublish(true);
    try {
      const build = await runWebContainerCommand("npm run build", message => {
        for (const line of message.split(/\r?\n/).filter(Boolean)) {
          const isError = /\b(error|failed|exception|not found)\b/i.test(line);
          recordRuntimeLog({ source: isError ? "stderr" : "stdout", level: isError ? "error" : "info", message: line });
        }
      });
      if (build.exitCode !== 0) throw new Error(`Le build a échoué (code ${build.exitCode}).\n${build.output.slice(-1_200)}`);
      const builtFiles = await exportWebContainerBuildFiles("dist");
      const result = await publishMutation.mutateAsync({ projectId: project.id, target: deploymentTarget, builtFiles });
      updateProject(project.id, {
        status: "Publié",
        deploymentProvider: deploymentTarget,
        deploymentId: result.result.deploymentId,
        deploymentUrl: result.result.url,
        deploymentStatus: result.result.status,
        deployedRevision: project.revision,
      });
      toast.success(result.result.url ? `Déploiement prêt : ${result.result.url}` : "Déploiement confirmé par le fournisseur");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Le build ou le déploiement a échoué.";
      recordRuntimeLog({ source: "stderr", level: "error", message });
      toast.error(message);
    } finally {
      setBuildingForPublish(false);
    }
  };

  useEffect(() => {
    if (!aiProvidersQuery.isSuccess || selectedProviderInfo?.configured) return;
    const firstConfigured = aiProvidersQuery.data.find(provider => provider.configured);
    if (firstConfigured) {
      setSelectedProvider(firstConfigured.id as AiProviderId);
      setSelectedModel(firstConfigured.defaultModel);
    }
  }, [aiProvidersQuery.data, aiProvidersQuery.isSuccess, selectedProviderInfo?.configured]);

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
  const improvePrompt = async () => {
    if (!prompt.trim() || enhancePromptMutation.isPending) return;
    try {
      const result = await enhancePromptMutation.mutateAsync({
        prompt,
        provider: selectedProvider,
        model: selectedModel,
      });
      setPrompt(result.prompt);
      onCreditsUpdated(result.credits);
      toast.success("Prompt amélioré · 1 crédit IA utilisé");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’améliorer le prompt.");
    }
  };
  const sendPrompt = async (value = prompt, attachedImages: UploadedImage[] = []) => {
    if (!value.trim() || generating) return;
    if (!generateChange && !consumeCredit()) return;
    const content = value.trim();
    const beforeGenerationFiles = { ...projectFilesRef.current };
    setPrompt("");
    setGenerating(true);
    setStreamingText("");
    runtimeErrorsRef.current = [];
    setRuntimeErrors([]);
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
      ...(attachedImages.length ? { attachments: attachedImages } : {}),
    };
    try {
      const savedUserMessage = await appendMessageMutation.mutateAsync({
        projectId: project.id,
        role: "user",
        content,
        ...(attachedImages.length ? { actions: attachedImages.map(serializeImageAttachment) } : {}),
      });
      userMessage.id = savedUserMessage.id;
    } catch (error) {
      console.warn("[Conversation] User message could not be saved:", error);
    }
    setMessages(current => current.some(message => message.id === userMessage.id)
      ? current
      : [...current, userMessage]);
    shellResultsRef.current = [];
    const runtimeErrorStart = runtimeErrorsRef.current.length;
    const handleAgentAction = async (action: AgentAction) => {
              if (action.type === "message") {
                setStreamingText(current => `${current}${action.content}`);
                return;
              }
              if (action.type === "shell") {
                setBottomTab("Terminal");
                try {
                  const result = await runWebContainerCommand(action.command, message => {
                    for (const line of message.split(/\r?\n/).filter(Boolean)) {
                      const isError = /\b(error|failed|exception|not found)\b/i.test(line);
                      recordRuntimeLog({ source: isError ? "stderr" : "stdout", level: isError ? "error" : "info", message: line });
                    }
                  });
                  shellResultsRef.current.push(`$ ${action.command}\nexitCode=${result.exitCode}\n${result.output}`);
                  if (result.exitCode !== 0) recordRuntimeLog({ source: "stderr", level: "error", message: `Commande terminée avec le code ${result.exitCode}: ${action.command}` });
                } catch (error) {
                  const message = error instanceof Error ? error.message : String(error);
                  shellResultsRef.current.push(`$ ${action.command}\nerror=${message}`);
                  recordRuntimeLog({ source: "stderr", level: "error", message });
                }
                return;
              }
              const applied = applyFileAgentAction(projectFilesRef.current, action);
              projectFilesRef.current = applied.files;
              setProjectFiles(applied.files);
              if (applied.changedPath && applied.files[applied.changedPath]) {
                setCode(applied.files[applied.changedPath]!);
                setActiveFile(applied.changedPath);
              } else if (action.type === "delete" && action.path === activeFile) {
                setActiveFile("src/App.tsx");
                setCode(applied.files["src/App.tsx"] ?? code);
              }
              try {
                await startWebContainerRuntime(
                  applied.files["src/App.tsx"] ?? code,
                  applied.files,
                  message => {
                    for (const line of message.split(/\r?\n/).filter(Boolean)) {
                      const isError = /\b(error|failed|exception|not found)\b/i.test(line);
                      recordRuntimeLog({ source: isError ? "stderr" : "stdout", level: isError ? "error" : "info", message: line });
                    }
                  }
                );
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                shellResultsRef.current.push(`runtime error=${message}`);
                recordRuntimeLog({ source: "stderr", level: "error", message });
              }
              updateProject(project.id, {
                files: Object.keys(applied.files).length,
                sourceFiles: applied.files,
                revision: previewRevision + 1,
              });
    };
    const applyGenerationResult = async (
      result: LlmGenerationResult | ReturnType<typeof generateMockChange>
    ) => {
      const generatedFiles = "files" in result && Array.isArray(result.files)
        ? result.files
        : [{ path: "src/App.tsx", content: result.code }];
      const changedFiles = Object.fromEntries(
        generatedFiles.map(file => [
          file.path === "page.tsx" || file.path === "App.tsx" ? "src/App.tsx" : file.path,
          file.content,
        ])
      );
      const nextFiles = { ...projectFilesRef.current, ...changedFiles };
      const deletedFiles = "deletedFiles" in result && Array.isArray(result.deletedFiles)
        ? result.deletedFiles as string[]
        : [];
      for (const deletedPath of deletedFiles) delete nextFiles[deletedPath];
      projectFilesRef.current = nextFiles;
      const nextCode = nextFiles["src/App.tsx"] ?? result.code;
      setCode(nextCode);
      setActiveFile("src/App.tsx");
      setProjectFiles(nextFiles);
      setPreviewRevision(result.previewRevision);
      updateProject(project.id, {
        files: Object.keys(nextFiles).length,
        sourceFiles: nextFiles,
        revision: result.previewRevision,
        updatedAt: "à l’instant",
      });
      try {
        await startWebContainerRuntime(nextCode, nextFiles, message => {
          for (const line of message.split(/\r?\n/).filter(Boolean)) {
            const isError = /\b(error|failed|exception|not found)\b/i.test(line);
            recordRuntimeLog({ source: isError ? "stderr" : "stdout", level: isError ? "error" : "info", message: line });
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        shellResultsRef.current.push(`runtime error=${message}`);
        recordRuntimeLog({ source: "stderr", level: "error", message });
      }
      return nextCode;
    };
    try {
      const nextRevision = previewRevision + 1;
      let generated: LlmGenerationResult | ReturnType<typeof generateMockChange> = generateChange
        ? await generateChange({
            projectId: project.id,
            prompt: content,
            currentCode: projectFilesRef.current["src/App.tsx"] ?? code,
            currentFiles: projectFilesRef.current,
            attachments: attachedImages.map(image => image.id),
            activeFile,
            mode: agentMode,
            revision: previewRevision,
            provider: selectedProvider,
            model: selectedModel,
            onChunk: chunk => setStreamingText(current => current + chunk),
            onAction: handleAgentAction,
          })
        : await new Promise<ReturnType<typeof generateMockChange>>(resolve =>
            setTimeout(
              () => resolve(generateMockChange(code, content, nextRevision)),
              1250
            )
          );
      await applyGenerationResult(generated);
      let currentRepairSessionId = "repairSessionId" in generated && typeof generated.repairSessionId === "string"
        ? generated.repairSessionId
        : undefined;
      setRepairSessionId(currentRepairSessionId ?? null);
      const validateBuild = async () => {
        try {
          const result = await runWebContainerCommand("npm run build", message => {
            for (const line of message.split(/\r?\n/).filter(Boolean)) {
              const isError = /\b(error|failed|exception|not found)\b/i.test(line);
              recordRuntimeLog({ source: isError ? "stderr" : "stdout", level: isError ? "error" : "info", message: line });
            }
          });
          const recentRuntimeErrors = runtimeErrorsRef.current.slice(runtimeErrorStart);
          const failedCommands = shellResultsRef.current.filter(entry => /exitCode=[1-9]|runtime error=|error=/.test(entry));
          const diagnostics = [
            result.exitCode === 0 ? "" : `npm run build exited with code ${result.exitCode}.\n${result.output}`,
            ...failedCommands,
            ...recentRuntimeErrors.map(entry => `${entry.source}: ${entry.message}`),
          ].filter(Boolean).join("\n\n");
          return { diagnostics, repairable: true };
        } catch (error) {
          return {
            diagnostics: error instanceof Error ? error.message : String(error),
            repairable: false,
          };
        }
      };
      let validation = generateChange && agentMode === "build"
        ? await validateBuild()
        : { diagnostics: "", repairable: false };
      for (let attempt = 1; generateChange && agentMode === "build" && currentRepairSessionId && validation.diagnostics && validation.repairable && attempt <= 3; attempt += 1) {
        const statusMessage: ChatMessage = {
          id: `repair-${Date.now()}-${attempt}`,
          role: "assistant",
          content: `Auto-réparation ${attempt}/3 — correction des erreurs du build/runtime…`,
          time: "à l’instant",
        };
        setMessages(current => [...current, statusMessage]);
        setStreamingText(`Auto-réparation ${attempt}/3…`);
        generated = await generateChange({
          projectId: project.id,
          repairSessionId: currentRepairSessionId,
          activeFile,
          mode: agentMode,
          prompt: `Auto-réparation ${attempt}/3 : le build ou le runtime vient de signaler ces erreurs. Corrige-les dans le projet en conservant le reste des fonctionnalités. Relance les vérifications utiles.\n\n${validation.diagnostics.slice(-1_500)}`,
          currentCode: projectFilesRef.current["src/App.tsx"] ?? code,
          currentFiles: projectFilesRef.current,
          attachments: attachedImages.map(image => image.id),
          revision: previewRevision + attempt,
          provider: selectedProvider,
          model: selectedModel,
          onChunk: chunk => setStreamingText(current => current + chunk),
          onAction: handleAgentAction,
        });
        await applyGenerationResult(generated);
        if ("repairSessionId" in generated && typeof generated.repairSessionId === "string") {
          currentRepairSessionId = generated.repairSessionId;
          setRepairSessionId(currentRepairSessionId);
        }
        validation = await validateBuild();
      }
      const validationWarning = validation.diagnostics
        ? `\n\nVérification automatique : ${validation.repairable ? "les erreurs persistent après 3 tentatives" : "le runtime ne permet pas de lancer la vérification"}.\n${validation.diagnostics.slice(-700)}`
        : "";
      setStreamingText("");
      const finalFiles = { ...projectFilesRef.current };
      const changedFiles = diffProjectFileMaps(beforeGenerationFiles, finalFiles);
      setPendingFileDiffs(changedFiles);
      if (changedFiles.length) setRightTab("Diff");
      try {
        await createSnapshotMutation.mutateAsync({
          projectId: project.id,
          label: `v${previewRevision + 1} · ${content.slice(0, 260)}`,
          files: finalFiles,
        });
        await snapshotsQuery.refetch();
      } catch (error) {
        console.warn("[Snapshots] Generated snapshot could not be saved:", error);
        toast.error("Le code est généré, mais son snapshot n’a pas pu être enregistré.");
      }
      const nextCode = projectFilesRef.current["src/App.tsx"] ?? generated.code;
      const assistantText =
        "assistantMessage" in generated &&
        typeof generated.assistantMessage === "string"
          ? generated.assistantMessage
          : `C’est fait. J’ai appliqué votre demande « ${content} » au code et à la preview. Les changements sont prêts à être inspectés dans les fichiers concernés.`;
      const finalAssistantText = `${assistantText}${validationWarning}`;
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: finalAssistantText,
        time: "à l’instant",
        changes: generated.changes,
      };
      setMessages(current => current.some(message => message.id === assistantMessage.id)
        ? current
        : [...current, assistantMessage]);
      try {
        const savedAssistantMessage = await appendMessageMutation.mutateAsync({
          projectId: project.id,
          role: "assistant",
          content: finalAssistantText,
          actions: generated.changes,
        });
        setMessages(current => current.map(message => message.id === assistantMessage.id
          ? { ...message, id: savedAssistantMessage.id }
          : message));
        await messagesQuery.refetch();
      } catch (error) {
        console.warn("[Conversation] Assistant message could not be saved:", error);
        toast.error("La réponse est affichée, mais l’historique n’a pas pu être enregistré.");
      }
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
      setGenerating(false);
      setStreamingText("");
      setSaved(true);
      const errorText = error instanceof Error
        ? error.message
        : "La génération IA a échoué. Votre crédit n’a pas été débité.";
      const errorMessage: ChatMessage = {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        content: errorText,
        time: "à l’instant",
      };
      setMessages(current => [...current, errorMessage]);
      try {
        const savedErrorMessage = await appendMessageMutation.mutateAsync({ projectId: project.id, role: "assistant", content: errorText });
        setMessages(current => current.map(message => message.id === errorMessage.id ? { ...message, id: savedErrorMessage.id } : message));
        await messagesQuery.refetch();
      } catch { /* Keep the error visible if history storage is unavailable. */ }
      toast.error(errorText);
    }
  };
  const normalizeUiFilePath = (rawPath: string) => {
    const path = rawPath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (!path || path.startsWith("/") || path.split("/").some(part => !part || part === "." || part === "..")) {
      throw new Error("Chemin de fichier invalide.");
    }
    return path;
  };
  const saveFileMap = (next: Record<string, string>) => {
    projectFilesRef.current = next;
    setProjectFiles(next);
    setSaved(false);
  };
  const createProjectFile = (rawPath: string, content?: string) => {
    try {
      const path = normalizeUiFilePath(rawPath);
      if (Object.hasOwn(projectFilesRef.current, path)) throw new Error("Ce fichier existe déjà.");
      const starter = path.endsWith(".tsx") ? "export default function Component() {\n  return <div />;\n}\n" : "";
      saveFileMap({ ...projectFilesRef.current, [path]: content ?? starter });
      setActiveFile(path);
      setCode(content ?? starter);
      toast.success(`Fichier créé : ${path}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible.");
    }
  };
  const renameProjectFile = (oldPath: string, rawNewPath: string) => {
    try {
      const newPath = normalizeUiFilePath(rawNewPath);
      if (oldPath === "src/App.tsx") throw new Error("Le point d’entrée du projet ne peut pas être renommé.");
      if (!Object.hasOwn(projectFilesRef.current, oldPath)) throw new Error("Fichier introuvable.");
      if (Object.hasOwn(projectFilesRef.current, newPath)) throw new Error("La destination existe déjà.");
      const next = { ...projectFilesRef.current, [newPath]: projectFilesRef.current[oldPath]! };
      delete next[oldPath];
      saveFileMap(next);
      if (activeFile === oldPath) { setActiveFile(newPath); setCode(next[newPath]!); }
      toast.success(`Fichier renommé : ${newPath}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Renommage impossible.");
    }
  };
  const deleteProjectFile = (path: string) => {
    if (path === "src/App.tsx") { toast.error("Le point d’entrée du projet ne peut pas être supprimé."); return; }
    const next = { ...projectFilesRef.current };
    delete next[path];
    saveFileMap(next);
    if (activeFile === path) { setActiveFile("src/App.tsx"); setCode(next["src/App.tsx"] ?? ""); }
    toast.success(`Fichier supprimé : ${path}`);
  };
  const updateActiveCode = (content: string) => {
    setCode(content);
    saveFileMap({ ...projectFilesRef.current, [activeFile]: content });
  };
  const acceptPendingFileChange = (path: string) => {
    setPendingFileDiffs(current => current.filter(change => change.path !== path));
  };
  const rejectPendingFileChange = (path: string) => {
    const change = pendingFileDiffs.find(item => item.path === path);
    if (!change) return;
    const next = { ...projectFilesRef.current };
    if (change.before === undefined) delete next[path];
    else next[path] = change.before;
    saveFileMap(next);
    if (activeFile === path) setCode(next[path] ?? next["src/App.tsx"] ?? "");
    setPendingFileDiffs(current => current.filter(item => item.path !== path));
  };
  const restoreProjectSnapshot = async (snapshotId: string) => {
    try {
      const restored = await restoreSnapshotMutation.mutateAsync({ snapshotId });
      projectFilesRef.current = restored.files;
      setProjectFiles(restored.files);
      setPreviewRevision(restored.revision);
      if (restored.files[activeFile]) setCode(restored.files[activeFile]!);
      else { setActiveFile("src/App.tsx"); setCode(restored.files["src/App.tsx"] ?? ""); }
      setPendingFileDiffs([]);
      setSelectedSnapshotId(undefined);
      updateProject(project.id, { sourceFiles: restored.files, files: Object.keys(restored.files).length, revision: restored.revision });
      await snapshotsQuery.refetch();
      toast.success("Tous les fichiers du snapshot ont été restaurés.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "La restauration a échoué.");
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
              downloadProjectZip(project, projectFiles);
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
            disabled={buildingForPublish || publishMutation.isPending}
            onClick={() => void publishProjectBuild()}
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
              onSend={images => sendPrompt(prompt, images)}
              onUploadImage={uploadImageToServer}
              canAttachImages={selectedProviderInfo?.supportsVision ?? false}
              onQuickPrompt={sendPrompt}
              mode={agentMode}
              setMode={setAgentMode}
              onImprovePrompt={() => void improvePrompt()}
              improvingPrompt={enhancePromptMutation.isPending}
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
            onRuntimeState={setRuntimeStatus}
            onLog={entry => {
              const log: RuntimeLogEntry = {
                ...entry,
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              };
              setRuntimeLogs(current => [...current, log].slice(-500));
              if (log.level === "error") setRuntimeErrors(current => [...current, log].slice(-200));
            }}
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
            files={projectFiles}
            setCode={updateActiveCode}
            onCreateFile={createProjectFile}
            onRenameFile={renameProjectFile}
            onDeleteFile={deleteProjectFile}
            versions={snapshotsQuery.data ?? []}
            onRestore={snapshotId => void restoreProjectSnapshot(snapshotId)}
            onViewSnapshot={snapshotId => setSelectedSnapshotId(current => current === snapshotId ? undefined : snapshotId)}
            selectedSnapshotId={selectedSnapshotId}
            snapshotFiles={snapshotDetailsQuery.data?.files}
            pendingChanges={pendingFileDiffs}
            onAcceptChange={acceptPendingFileChange}
            onRejectChange={rejectPendingFileChange}
          />
        </div>
      </div>
      <div className="hidden h-36 shrink-0 border-t border-white/[0.06] bg-[#0a1120] lg:block">
        <BottomPanel
          tab={bottomTab}
          setTab={setBottomTab}
          activeStage={productionStage}
          logs={runtimeLogs}
          errors={runtimeErrors}
          isRunning={runtimeStatus === "running"}
        />
      </div>
      <div className="flex h-12 shrink-0 items-center justify-between border-t border-white/[0.06] bg-[#0a1120] px-4 lg:hidden">
        <div className="flex items-center gap-4 text-[10px] text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", runtimeStatus === "running" ? "bg-emerald-400" : runtimeStatus === "error" ? "bg-red-400" : "bg-amber-400")} />
            {runtimeStatus === "running" ? "Runtime Vite actif" : runtimeStatus === "error" ? "Erreur runtime" : "Runtime en préparation"}
          </span>
          <span>{Object.keys(projectFiles).length} fichiers</span>
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
