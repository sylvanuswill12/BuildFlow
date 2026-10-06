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
  type ChangeEvent,
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
import type { AgentMode } from "@shared/agentActions";
import type { UploadedImage } from "@shared/attachments";
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

export function ChatPanel({
  messages,
  prompt,
  setPrompt,
  onSend,
  onUploadImage,
  onQuickPrompt,
  generating,
  streamingText,
  mode,
  setMode,
  onImprovePrompt,
  improvingPrompt,
  canAttachImages,
}: {
  messages: ChatMessage[];
  prompt: string;
  setPrompt: (value: string) => void;
  onSend: (images: UploadedImage[]) => Promise<void> | void;
  onUploadImage: (file: File) => Promise<UploadedImage>;
  onQuickPrompt: (value: string) => void;
  generating: boolean;
  streamingText: string;
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
  onImprovePrompt: () => void;
  improvingPrompt: boolean;
  canAttachImages: boolean;
}) {
  const [attachments, setAttachments] = useState<UploadedImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const handleSend = async () => {
    if (!prompt.trim() || generating) return;
    if (attachments.length && !canAttachImages) {
      toast.error("Choisissez OpenAI, Anthropic, Gemini ou OpenRouter pour analyser des images.");
      return;
    }
    await onSend(attachments);
    setAttachments([]);
  };
  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (attachments.length + selected.length > 4) {
      toast.error("Vous pouvez joindre au maximum 4 images par message.");
      return;
    }
    setUploadingImage(true);
    try {
      for (const file of selected) {
        const uploaded = await onUploadImage(file);
        setAttachments(current => [...current, uploaded]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L’envoi de l’image a échoué.");
    } finally {
      setUploadingImage(false);
    }
  };
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
              {message.attachments?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.attachments.map(image => (
                    <a key={image.id} href={image.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border border-white/10 bg-black/10 p-1.5">
                      <img src={image.url} alt={image.name} className="h-10 w-10 rounded object-cover" />
                      <span className="max-w-28 truncate text-[9px] text-slate-400">{image.name}</span>
                    </a>
                  ))}
                </div>
              ) : null}
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
        <div className="mb-2 flex items-center gap-1">
          {([
            ["plan", "Plan"],
            ["discussion", "Discussion"],
            ["build", "Build"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn("rounded-md px-2.5 py-1 text-[10px] transition", mode === value ? "bg-blue-500/15 text-blue-200" : "text-slate-600 hover:text-slate-300")}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            title="Améliorer le prompt (1 crédit IA)"
            disabled={generating || improvingPrompt || !prompt.trim()}
            onClick={onImprovePrompt}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-violet-300 transition hover:bg-violet-500/10 disabled:opacity-40"
          >
            <WandSparkles className="h-3 w-3" />
            {improvingPrompt ? "Amélioration…" : "Améliorer"}
          </button>
        </div>
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
          <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={handleImageSelect} />
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map(image => (
                <span key={image.id} className="flex max-w-full items-center gap-1.5 rounded-md border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-[9px] text-blue-100">
                  <img src={image.url} alt="" className="h-5 w-5 rounded object-cover" />
                  <span className="max-w-32 truncate">{image.name}</span>
                  <button type="button" aria-label={`Retirer ${image.name}`} onClick={() => setAttachments(current => current.filter(item => item.id !== image.id))} className="text-slate-400 hover:text-white"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
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
                title={canAttachImages ? "Joindre une image (PNG, JPEG, WebP ou GIF, 4 Mio max)" : "Choisissez OpenAI, Anthropic, Gemini ou OpenRouter pour joindre une image"}
                disabled={generating || uploadingImage || !canAttachImages}
                onClick={() => imageInputRef.current?.click()}
                className="rounded-md p-1.5 text-slate-600 hover:bg-white/10 hover:text-slate-300"
              >
                {uploadingImage ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
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
              onClick={() => void handleSend()}
              disabled={generating || uploadingImage || !prompt.trim() || (attachments.length > 0 && !canAttachImages)}
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
