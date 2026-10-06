import { expect, test } from "@playwright/test";

test("la landing BuildFlow est accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/BuildFlow AI/i);
  await expect(
    page.getByText(/Transformez vos idées en applications/i)
  ).toBeVisible();
});

test("la navigation publique expose les templates", async ({ page }) => {
  await page.goto("/templates");
  await expect(
    page.getByRole("heading", { name: /Templates prêts à démarrer/i })
  ).toBeVisible();
});

test("la landing reste utilisable sur un écran mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText(/Transformez vos idées en applications/i)).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});
