import { expect, test, type Page } from "@playwright/test";

async function gotoApp(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Ihre Bedingungen")).toBeVisible();
}

test.describe("Zwischenfinanzierung (bridge credit)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("creates a bridge credit and shows it in the credits list", async ({
    page,
  }) => {
    await gotoApp(page);

    await page.getByRole("button", { name: "Neuer Kredit" }).click();

    await page
      .getByRole("button", { name: /Zwischenfinanzierung/ })
      .click();

    await page.getByPlaceholder("Kreditname").fill("neumünster");

    const summeInput = page.getByLabel("Summe Darlehen");
    await summeInput.click();
    await summeInput.fill("120000");
    await summeInput.blur();

    const sollzinsInput = page.getByLabel("Sollzins p.a.");
    await sollzinsInput.click();
    await sollzinsInput.fill("6");
    await sollzinsInput.blur();

    const effzinsInput = page.getByLabel("Effektivzins p.a.");
    await effzinsInput.click();
    await effzinsInput.fill("6,17");
    await effzinsInput.blur();

    const laufzeitInput = page.getByLabel("Laufzeit der Zwischenfinanzierung");
    await laufzeitInput.click();
    await laufzeitInput.fill("18");
    await laufzeitInput.blur();

    await page.getByRole("button", { name: "Speichern" }).click();

    await expect(
      page.getByText("Zwischenfinanzierung, 18 Monate"),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: /120\.?000/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "neumünster bearbeiten" }),
    ).toBeVisible();
  });
});
