export const STARTER_TEMPLATE_IDS = ["react-vite-tailwind", "react-zustand", "dashboard", "landing-page"] as const;
export type StarterTemplateId = (typeof STARTER_TEMPLATE_IDS)[number];

const commonFiles = (name: string, dependencies: Record<string, string> = {}) => ({
  "package.json": JSON.stringify({
    name: "buildflow-starter",
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: { dev: "vite --host 0.0.0.0", build: "vite build" },
    dependencies: { react: "^19.2.1", "react-dom": "^19.2.1", ...dependencies },
    devDependencies: { vite: "^7.1.9", "@vitejs/plugin-react": "^5.0.4", typescript: "^5.9.3", tailwindcss: "^4.1.14", "@tailwindcss/vite": "^4.1.14" },
  }, null, 2),
  "index.html": `<!doctype html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0f172a"><title>${name}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
  "src/styles/globals.css": `@import "tailwindcss";\n\n:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-synthesis: none; text-rendering: optimizeLegibility; }\nbody { margin: 0; min-width: 320px; min-height: 100vh; }\n* { box-sizing: border-box; }\n`,
});

const templates: Record<StarterTemplateId, Record<string, string>> = {
  "react-vite-tailwind": {
    ...commonFiles("React + Vite + Tailwind"),
    "src/App.tsx": `import { useState } from "react";\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl"><p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">React · Vite · Tailwind</p><h1 className="mt-4 text-3xl font-bold">Votre projet est prêt</h1><p className="mt-3 text-sm text-slate-400">Modifiez les fichiers ou décrivez la prochaine fonctionnalité à l’agent.</p><button className="mt-6 rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950" onClick={() => setCount(value => value + 1)}>Compteur : {count}</button></section></main>;\n}\n`,
  },
  "react-zustand": {
    ...commonFiles("React + Zustand", { zustand: "^5.0.8" }),
    "src/App.tsx": `import { create } from "zustand";\n\ntype Store = { count: number; increment: () => void; reset: () => void };\nconst useCounter = create<Store>(set => ({ count: 0, increment: () => set(state => ({ count: state.count + 1 })), reset: () => set({ count: 0 }) }));\n\nexport default function App() {\n  const { count, increment, reset } = useCounter();\n  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8"><p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">Starter Zustand</p><h1 className="mt-4 text-3xl font-bold">État partagé</h1><output className="mt-5 block text-5xl font-bold">{count}</output><div className="mt-6 flex gap-3"><button className="rounded-xl bg-violet-400 px-4 py-2 font-semibold text-slate-950" onClick={increment}>Incrémenter</button><button className="rounded-xl border border-white/15 px-4 py-2" onClick={reset}>Réinitialiser</button></div></section></main>;\n}\n`,
  },
  dashboard: {
    ...commonFiles("Dashboard"),
    "src/App.tsx": `const metrics = [{ label: "Revenu", value: "24 580 €", change: "+12,8 %" }, { label: "Commandes", value: "1 284", change: "+8,2 %" }, { label: "Conversion", value: "4,82 %", change: "+0,6 %" }];\n\nexport default function App() {\n  return <main className="min-h-screen bg-slate-950 p-6 text-white md:p-10"><header className="mx-auto flex max-w-6xl items-end justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-cyan-300">Vue d’ensemble</p><h1 className="mt-2 text-3xl font-bold">Dashboard</h1></div><button className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Exporter</button></header><section className="mx-auto mt-8 grid max-w-6xl gap-4 md:grid-cols-3">{metrics.map(item => <article key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-6"><p className="text-sm text-slate-400">{item.label}</p><p className="mt-3 text-3xl font-bold">{item.value}</p><p className="mt-3 text-xs text-emerald-300">{item.change} ce mois</p></article>)}</section><section className="mx-auto mt-5 max-w-6xl rounded-2xl border border-white/10 bg-white/5 p-6"><h2 className="font-semibold">Activité récente</h2><div className="mt-5 grid h-48 grid-cols-12 items-end gap-2">{[36, 58, 44, 76, 53, 88, 62, 72, 95, 64, 82, 100].map((height, i) => <div key={i} style={{ height: height + "%" }} className="rounded-t-md bg-gradient-to-t from-blue-600 to-cyan-300" />)}</div></section></main>;\n}\n`,
  },
  "landing-page": {
    ...commonFiles("Landing page"),
    "src/App.tsx": `export default function App() {\n  return <main className="min-h-screen overflow-hidden bg-[#f8f7f4] text-slate-900"><nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6"><span className="font-bold tracking-tight">STUDIO / 01</span><a href="#contact" className="rounded-full border border-slate-300 px-4 py-2 text-sm">Nous contacter</a></nav><section className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-20 md:grid-cols-[1.1fr_.9fr] md:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-orange-700">Design qui fait avancer</p><h1 className="mt-5 text-5xl font-semibold leading-[1.04] tracking-[-.05em] md:text-7xl">Donnez forme à votre prochaine idée.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Une page de lancement élégante, rapide et prête à adapter à votre marque.</p><a id="contact" href="mailto:bonjour@example.com" className="mt-8 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white">Découvrir le projet</a></div><div className="aspect-[4/5] rounded-[2rem] bg-gradient-to-br from-orange-200 via-rose-200 to-violet-300 shadow-2xl"><div className="m-5 flex h-[calc(100%-2.5rem)] items-end rounded-[1.5rem] bg-white/20 p-6 backdrop-blur-sm"><p className="max-w-xs text-2xl font-medium text-slate-900">Une direction artistique prête à personnaliser.</p></div></div></section></main>;\n}\n`,
  },
};

export function getStarterTemplateFiles(template: StarterTemplateId): Record<string, string> {
  return { ...templates[template] };
}
