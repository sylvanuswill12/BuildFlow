import { Sparkles } from "lucide-react";

type BuildFlowLogoProps = {
  compact?: boolean;
  onClick?: () => void;
  light?: boolean;
};

export function BuildFlowLogo({ compact = false, onClick, light = false }: BuildFlowLogoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-2.5 text-left ${onClick ? "cursor-pointer" : "cursor-default"}`}
      aria-label="BuildFlow AI"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-400/25 bg-blue-500/15 shadow-[0_0_26px_rgba(59,130,246,0.2)]">
        <span className="absolute -left-1 top-1 h-5 w-3 rotate-45 rounded-full bg-blue-400" />
        <span className="absolute bottom-1 right-0 h-5 w-3 -rotate-45 rounded-full bg-violet-400" />
        <Sparkles className="relative z-10 h-3.5 w-3.5 text-white" strokeWidth={2.6} />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className={`block text-[15px] font-semibold tracking-[-0.02em] ${light ? "text-white" : "text-slate-100"}`}>
            BuildFlow <span className="text-blue-400">AI</span>
          </span>
          <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.24em] text-slate-500">Build faster</span>
        </span>
      )}
    </button>
  );
}
