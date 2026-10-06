export type RuntimeLogEntry = {
  id: string;
  time: string;
  source: "stdout" | "stderr" | "iframe";
  level: "info" | "warn" | "error";
  message: string;
};

export type RuntimeStatus = "idle" | "starting" | "running" | "error";
