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
export function AuthPage({
  mode,
  onAuthenticated,
  navigate,
}: {
  mode: "login" | "signup" | "forgot-password";
  onAuthenticated: () => void | Promise<void>;
  navigate: (path: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const submitting = loginMutation.isPending || registerMutation.isPending;
  const title = mode === "login" ? "Bon retour parmi les builders." : mode === "signup" ? "Commencez à construire." : "Retrouvez l’accès à votre espace.";
  const subtitle = mode === "login"
    ? "Connectez-vous avec votre adresse email pour reprendre là où vous vous êtes arrêté."
    : mode === "signup"
      ? "Créez un compte BuildFlow indépendant avec votre adresse email."
      : "La réinitialisation par email n’est pas configurée sur cette installation.";
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!email.includes("@")) return setError("Veuillez saisir une adresse email valide.");
    if (mode === "forgot-password") {
      setSuccess("Contactez l’administrateur de cette installation pour réinitialiser votre mot de passe.");
      return;
    }
    if (mode === "signup" && name.trim().length < 2) return setError("Ajoutez votre nom pour continuer.");
    if (password.length < 10) return setError("Le mot de passe doit contenir au moins 10 caractères.");
    try {
      if (mode === "login") {
        await loginMutation.mutateAsync({ email, password, remember });
      } else {
        await registerMutation.mutateAsync({ name, email, password });
      }
      await onAuthenticated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de finaliser la connexion.");
    }
  };
  return (
    <div className="flex min-h-screen bg-[#0B1020] text-slate-100">
      <div className="relative hidden w-[45%] overflow-hidden border-r border-white/[0.06] bg-[#0d1425] lg:block">
        <div className="absolute left-[-30%] top-[-10%] h-[560px] w-[560px] rounded-full bg-blue-500/15 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-15%] h-[480px] w-[480px] rounded-full bg-violet-500/15 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <BuildFlowLogo onClick={() => navigate("/")} />
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">BuildFlow AI</p>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white">Une idée mérite un espace pour devenir réelle.</h2>
            <p className="mt-5 text-sm leading-7 text-slate-400">Décrivez, générez, inspectez et itérez dans le même workspace. Vos prototypes avancent à la vitesse de votre imagination.</p>
          </div>
          <p className="text-xs text-slate-600">© 2026 BuildFlow AI · Installation indépendante.</p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><BuildFlowLogo onClick={() => navigate("/")} /></div>
          <div className="mb-8"><h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-400">{subtitle}</p></div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && <Field label="Nom complet" value={name} onChange={setName} placeholder="Alex Martin" />}
            <Field label="Email" value={email} onChange={setEmail} placeholder="vous@exemple.com" type="email" />
            {mode !== "forgot-password" && <Field label="Mot de passe" value={password} onChange={setPassword} placeholder="10 caractères minimum" type="password" />}
            {error && <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-xs leading-5 text-red-200"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
            {success && <div className="flex items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</div>}
            {mode === "login" && <div className="flex items-center justify-between text-xs"><label className="flex items-center gap-2 text-slate-500"><input checked={remember} onChange={event => setRemember(event.target.checked)} type="checkbox" className="accent-blue-500" />Se souvenir de moi</label><button type="button" onClick={() => navigate("/forgot-password")} className="text-blue-300 hover:text-blue-200">Mot de passe oublié ?</button></div>}
            <button type="submit" disabled={submitting} className="bf-primary-button flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-60">
              {submitting ? "Traitement…" : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Afficher les instructions"}<ArrowRight className="h-4 w-4" />
            </button>
          </form>
          {mode !== "forgot-password" && <p className="mt-7 text-center text-xs text-slate-500">{mode === "login" ? "Pas encore de compte ?" : "Vous avez déjà un compte ?"} <button type="button" onClick={() => navigate(mode === "login" ? "/signup" : "/login")} className="font-medium text-blue-300 hover:text-blue-200">{mode === "login" ? "Créer un compte" : "Se connecter"}</button></p>}
          {mode === "forgot-password" && <p className="mt-7 text-center text-xs text-slate-500"><button type="button" onClick={() => navigate("/login")} className="font-medium text-blue-300 hover:text-blue-200">Retour à la connexion</button></p>}
        </div>
      </div>
    </div>
  );
}

export function Field({
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
