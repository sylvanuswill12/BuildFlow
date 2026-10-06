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
type BillingPayment = {
  id: string;
  plan: "pro" | "team";
  amount: number;
  currency: string;
  status: string;
  createdAt: Date | string;
};

export function BillingPage({
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
      toast("Connectez-vous pour ouvrir le Checkout Stripe.");
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
