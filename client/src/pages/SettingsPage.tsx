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


import { Field } from "./AuthPage";
import { FEATURE_SETTING_LABELS, type FeatureSettingKey, readFeatureSettings, saveFeatureSettings } from "@/lib/featureSettings";

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");
type IconType = typeof Sparkles;

export function SettingsPage({
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
  const [featureSettings, setFeatureSettings] = useState(readFeatureSettings);
  const [saving, setSaving] = useState(false);
  const providersQuery = trpc.ai.providers.useQuery();
  const usageQuery = trpc.ai.usage.useQuery(undefined, { enabled: featureSettings.costTracking && Boolean(userEmail) });
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
      saveFeatureSettings(featureSettings);
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
          title="Fonctionnalités expérimentales"
          description="Activez ou désactivez individuellement les fonctions optionnelles de BuildFlow. Les intégrations nécessitant des identifiants restent inactives tant qu’elles ne sont pas configurées."
        >
          <div className="space-y-4">
            {(Object.entries(FEATURE_SETTING_LABELS) as [FeatureSettingKey, { label: string; description: string }][]).map(([key, item]) => (
              <ToggleRow
                key={key}
                label={item.label}
                description={item.description}
                checked={featureSettings[key]}
                onChange={value => setFeatureSettings(current => ({ ...current, [key]: value }))}
              />
            ))}
          </div>
        </SettingsSection>
        <SettingsSection
          title="Utilisation IA"
          description="Historique récent de tokens et estimation de coût calculée côté serveur; ce n’est pas une facture fournisseur."
        >
          {featureSettings.costTracking ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <UsageMetric label="Générations récentes" value={String(usageQuery.data?.length ?? 0)} />
              <UsageMetric label="Tokens suivis" value={(usageQuery.data ?? []).reduce((sum, row) => sum + row.totalTokens, 0).toLocaleString("fr-FR")} />
              <UsageMetric label="Coût estimé (USD)" value={`$${((usageQuery.data ?? []).reduce((sum, row) => sum + row.estimatedCostMicros, 0) / 1_000_000).toFixed(4)}`} />
              {usageQuery.error && <p className="text-xs text-amber-300 sm:col-span-3">Historique indisponible : {usageQuery.error.message}. Vérifiez que la migration 0014 a été appliquée.</p>}
            </div>
          ) : <p className="text-xs text-slate-500">Le suivi des coûts est désactivé dans les fonctionnalités expérimentales.</p>}
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
                "Votre session utilise votre adresse email et votre mot de passe localement chiffré."
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

function UsageMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-600">{label}</p><p className="mt-2 text-lg font-semibold text-slate-100">{value}</p></div>;
}
