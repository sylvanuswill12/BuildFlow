export const BILLING_PLANS = {
  free: { name: "Gratuit", priceCents: 0, credits: 20, description: "Pour explorer et créer vos premières idées." },
  pro: { name: "Pro", priceCents: 1900, credits: 500, description: "Pour construire sérieusement, plus vite." },
  team: { name: "Équipe", priceCents: 4900, credits: 2_000, description: "Pour les équipes qui avancent ensemble." },
} as const;

export type PaidPlan = "pro" | "team";
export type BillingPlan = keyof typeof BILLING_PLANS;

export function isPaidPlan(plan: string): plan is PaidPlan {
  return plan === "pro" || plan === "team";
}
