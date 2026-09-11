import path from "node:path";
import { expect, test } from "@playwright/test";

// Requires a real dev server with ANTHROPIC_API_KEY, DATABASE_URL,
// BLOB_READ_WRITE_TOKEN, APP_PASSWORD, and SESSION_SECRET configured (see
// .env.example) — skipped when those aren't present so this suite doesn't
// hard-fail in environments without secrets (e.g. a fresh local checkout).
const hasRequiredEnv =
  process.env.ANTHROPIC_API_KEY && process.env.DATABASE_URL && process.env.APP_PASSWORD;

test.describe("upload → analyze → approve/dismiss → persisted state", () => {
  test.skip(!hasRequiredEnv, "Requires ANTHROPIC_API_KEY, DATABASE_URL, APP_PASSWORD to be set");

  test("full flow persists approve/dismiss decisions across a reload", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Password").fill(process.env.APP_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/upload/);

    const fixture = path.join(
      process.cwd(),
      "golden-dataset/sow/contract-01-clean.md",
    );
    await page.setInputFiles('input[type="file"]', fixture);
    await page.getByRole("button", { name: "Analyze" }).click();

    await expect(page).toHaveURL(/\/reviews\/[0-9a-f-]+/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Issues/ })).toBeVisible();

    const issueCards = page.locator("article");
    await expect(issueCards.first()).toBeVisible();

    const firstCard = issueCards.nth(0);
    const secondCard = issueCards.nth(1);
    await firstCard.getByRole("button", { name: "Approve" }).click();
    await secondCard.getByRole("button", { name: "Dismiss" }).click();

    await expect(firstCard.getByRole("button", { name: "Approve" })).toBeDisabled();
    await expect(secondCard.getByRole("button", { name: "Dismiss" })).toBeDisabled();

    await page.reload();

    const reloadedFirstCard = page.locator("article").nth(0);
    const reloadedSecondCard = page.locator("article").nth(1);
    await expect(reloadedFirstCard.getByRole("button", { name: "Approve" })).toBeDisabled();
    await expect(reloadedSecondCard.getByRole("button", { name: "Dismiss" })).toBeDisabled();
  });

  test("rejects an unsupported file type before analysis", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Password").fill(process.env.APP_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    const fixture = path.join(process.cwd(), "package.json");
    await page.setInputFiles('input[type="file"]', fixture);
    await page.getByRole("button", { name: "Analyze" }).click();

    await expect(page.getByText(/Unsupported file type/)).toBeVisible();
  });
});
