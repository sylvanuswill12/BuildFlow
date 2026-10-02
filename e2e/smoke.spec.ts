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
