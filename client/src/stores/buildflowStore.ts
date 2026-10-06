import { create } from "zustand";

export type WorkspaceTab =
  | "Fichiers"
  | "Code"
  | "Composants"
  | "Données"
  | "Équipe IA"
  | "Historique"
  | "Diff";

type BuildFlowStore = {
  rightTab: WorkspaceTab;
  motionEnabled: boolean;
  setRightTab: (tab: WorkspaceTab) => void;
  setMotionEnabled: (enabled: boolean) => void;
};

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const useBuildFlowStore = create<BuildFlowStore>(set => ({
  rightTab: "Fichiers",
  motionEnabled: !prefersReducedMotion,
  setRightTab: rightTab => set({ rightTab }),
  setMotionEnabled: motionEnabled => set({ motionEnabled }),
}));
