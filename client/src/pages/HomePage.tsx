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
export function HomePage({ navigate }: { navigate: (path: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const suggestions = [
    "Créer un portfolio moderne",
    "Créer une boutique en ligne",
    "Créer une application de gestion de tâches",
    "Créer un dashboard financier",
    "Créer un site pour une association",
  ];

  return (
    <div className="bf-marketing min-h-screen overflow-hidden bg-[#0B1020] text-slate-100">
      <MarketingNav navigate={navigate} />
      <main>
        <section className="relative px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
          <div className="bf-grid-pointer absolute inset-0 opacity-60" />
          <div className="absolute left-1/2 top-8 h-[460px] w-[800px] -translate-x-1/2 rounded-full bg-blue-600/12 blur-[120px]" />
          <div className="absolute right-[-14%] top-40 h-[360px] w-[360px] rounded-full bg-violet-600/12 blur-[120px]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-400/10 px-3.5 py-1.5 text-xs font-semibold text-blue-100">
              <Sparkles className="h-3.5 w-3.5 text-blue-300" />
              La nouvelle façon de construire avec l’IA
              <ArrowUpRight className="h-3.5 w-3.5 text-blue-300" />
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.055em] text-white sm:text-6xl lg:text-[4.5rem]">
              Créez votre application avec{" "}
              <span className="bf-gradient-text">
                l’intelligence artificielle
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Décrivez votre idée, laissez l’IA générer votre interface, votre
              code et votre prototype fonctionnel en quelques minutes.
            </p>

            <div className="mt-9 max-w-2xl rounded-2xl border border-white/10 bg-[#111827]/90 p-2 shadow-[0_20px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl">
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

            <div className="mt-5 flex max-w-2xl flex-wrap gap-2">
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
            <div className="relative block">
              <div className="bf-glow bf-hero-visual overflow-hidden rounded-[2rem] p-1">
                <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#0e1729]">
                  <img src="/visuals/buildflow-hero.jpg" alt="Espace de travail BuildFlow avec chat IA, code et prévisualisation" className="h-[300px] w-full object-cover object-center opacity-90 sm:h-[400px] lg:h-[470px]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08101f]/90 via-transparent to-[#08101f]/10" />
                  <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                    <div className="rounded-2xl border border-white/15 bg-[#08101f]/75 px-4 py-3 backdrop-blur-xl">
                      <p className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" /> Projet généré avec succès</p>
                      <p className="mt-1 text-xs text-slate-300">Dashboard financier · 18 fichiers · 42 s</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-blue-500/20 px-3 py-2 text-right backdrop-blur-xl">
                      <p className="text-lg font-semibold text-white">98%</p>
                      <p className="text-[10px] uppercase tracking-wider text-blue-100">prêt à publier</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-8 rounded-2xl border border-white/10 bg-[#101b31]/90 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200"><Bot className="h-4 w-4" /></div><div><p className="text-xs font-semibold text-white">BuildFlow AI</p><p className="text-[11px] text-slate-300">Analyse de votre idée…</p></div></div>
              </div>
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

        <section className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
          <div className="mx-auto grid max-w-6xl items-center gap-10 rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#111d35] to-[#0c1426] p-4 shadow-2xl sm:p-6 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
            <div className="px-2 py-4 sm:px-4">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Un vrai espace de travail</span>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-4xl">Du prompt à une interface qui donne envie de cliquer.</h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300">Chaque génération devient un projet vivant : fichiers organisés, preview instantanée, conversation avec l’IA et modifications visibles en temps réel.</p>
              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-2xl font-semibold text-white">3×</p><p className="mt-1 text-xs text-slate-300">plus rapide à prototyper</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-2xl font-semibold text-white">24/7</p><p className="mt-1 text-xs text-slate-300">assistant disponible</p></div>
              </div>
            </div>
            <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#091120] shadow-[0_20px_70px_rgba(2,6,23,0.45)]">
              <img src="/visuals/buildflow-dashboard.jpg" alt="Dashboard généré par BuildFlow AI" className="h-auto w-full object-cover transition duration-700 hover:scale-[1.03]" />
            </div>
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

export function TemplateCard({
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
