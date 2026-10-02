import Stripe from "stripe";
import * as db from "./db";
import { BILLING_PLANS, isPaidPlan, type PaidPlan } from "./billing";

const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe secret key is not configured");
  return new Stripe(secretKey);
};

const getWebhookSecret = () => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("Stripe webhook secret is not configured");
  return webhookSecret;
};

function idOf(value: string | { id: string } | null | undefined): string | undefined {
  return typeof value === "string" ? value : value?.id;
}

function planFromMetadata(metadata: Stripe.Metadata | null | undefined): PaidPlan | undefined {
  const plan = metadata?.plan;
  return plan && isPaidPlan(plan) ? plan : undefined;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = Number(session.metadata?.user_id ?? session.client_reference_id);
  const plan = planFromMetadata(session.metadata);
  if (!Number.isInteger(userId) || !plan) throw new Error("Stripe checkout is missing BuildFlow identity metadata");

  const user = await db.getUserById(userId);
  if (!user) throw new Error("BuildFlow user for Stripe checkout was not found");

  const paymentIntentId = idOf(session.payment_intent);
  const paid = session.payment_status === "paid";
  await db.createPayment({
    id: session.id,
    ownerId: userId,
    plan,
    amount: session.amount_total ?? BILLING_PLANS[plan].priceCents,
    currency: session.currency ?? "eur",
    status: paid ? "paid" : "pending",
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId ?? null,
  });

  // A Checkout session can be completed before payment confirmation. Never grant
  // premium access until Stripe explicitly reports the payment as paid.
  if (!paid) return;

  const subscriptionId = idOf(session.subscription);
  const customerId = idOf(session.customer);
  await db.updateUserBilling(userId, {
    plan,
    credits: BILLING_PLANS[plan].credits,
    generationCount: 0,
    creditsResetAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
    stripeCustomerId: customerId ?? null,
    stripeSubscriptionId: subscriptionId ?? null,
    stripeSubscriptionStatus: "active",
  });
}

async function handlePaymentIntent(paymentIntent: Stripe.PaymentIntent, status: "paid" | "failed") {
  const payment = await db.updatePaymentStatusByPaymentIntent(paymentIntent.id, status);
  if (!payment || status !== "paid") return;

  const plan = payment.plan;
  await db.updateUserBilling(payment.ownerId, {
    plan,
    credits: BILLING_PLANS[plan].credits,
    generationCount: 0,
    creditsResetAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
    stripeSubscriptionStatus: "active",
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const user = await db.getUserByStripeSubscriptionId(subscription.id);
  if (!user) return;
  const plan = planFromMetadata(subscription.metadata) ?? (isPaidPlan(user.plan) ? user.plan : undefined);
  const active = ["active", "trialing"].includes(subscription.status);
  const periodEndTimestamp = subscription.items.data[0]?.current_period_end;
  const periodEnd = periodEndTimestamp ? new Date(periodEndTimestamp * 1000) : null;
  const shouldResetCredits = Boolean(
    active &&
    plan &&
    (!user.stripeCurrentPeriodEnd || (periodEnd && periodEnd.getTime() > user.stripeCurrentPeriodEnd.getTime()))
  );
  await db.updateUserBilling(user.id, {
    plan: active && plan ? plan : "free",
    ...(shouldResetCredits && plan ? { credits: BILLING_PLANS[plan].credits, generationCount: 0 } : {}),
    ...(!active ? { credits: BILLING_PLANS.free.credits, generationCount: 0 } : {}),
    stripeCustomerId: idOf(subscription.customer) ?? user.stripeCustomerId,
    stripePriceId: subscription.items.data[0]?.price.id ?? user.stripePriceId,
    stripeSubscriptionStatus: subscription.status,
    stripeCurrentPeriodEnd: periodEnd,
    creditsResetAt: active ? (periodEnd ?? user.creditsResetAt) : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const user = await db.getUserByStripeSubscriptionId(subscription.id);
  if (!user) return;
  await db.updateUserBilling(user.id, {
    plan: "free",
    credits: BILLING_PLANS.free.credits,
    generationCount: 0,
    creditsResetAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
    stripeSubscriptionId: null,
    stripePriceId: null,
    stripeSubscriptionStatus: "canceled",
    stripeCurrentPeriodEnd: null,
  });
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  if (!signature) throw new Error("Missing Stripe signature");
  const event = getStripe().webhooks.constructEvent(rawBody, signature, getWebhookSecret());

  // Reserve the event before applying side effects. The unique DB key makes this
  // safe when Stripe delivers the same event concurrently; failed handlers remove
  // the reservation so Stripe can retry it.
  if (!(await db.recordStripeEvent({ id: event.id, type: event.type }))) return;
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent, "paid");
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent, "failed");
        break;
      default:
        break;
    }
  } catch (error) {
    await db.deleteStripeEvent(event.id);
    throw error;
  }
}
