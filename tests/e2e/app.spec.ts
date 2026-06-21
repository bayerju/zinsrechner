import { expect, test, type Page } from "@playwright/test";

async function expectApprovedScreenshot(page: Page, name: string) {
  await page.waitForTimeout(2_000);
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dialog],
      [data-nextjs-dialog-overlay],
      .recharts-line-curve,
      .recharts-area-area,
      .recharts-area-curve,
      .recharts-dot,
      .recharts-active-dot {
        display: none !important;
      }
    `,
  });
  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    timeout: 15_000,
  });
}

test.describe("Zinsrechner", () => {
  test("updates financing figures when purchase data changes", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Ihre Bedingungen")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Raten" })).toBeVisible();

    const kaufpreis = page.getByRole("textbox", {
      name: "Kaufpreis",
      exact: true,
    });
    await expect(kaufpreis).toHaveValue(/330\.?000/);

    await kaufpreis.click();
    await expect(kaufpreis).toHaveValue("330000");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("300000");
    await kaufpreis.blur();

    await expect(kaufpreis).toHaveValue(/300\.?000/);
    await expect(page.getByRole("textbox", { name: /Kaufnebenkosten/ })).toHaveValue(/36\.?210/);
    await expect(page.getByRole("heading", { name: "Raten" })).toBeVisible();
  });

  test("navigates between calculation views", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    await page.getByRole("link", { name: "Finanzplan" }).click();
    await expect(page).toHaveURL(/\/finanzplan$/);
    await expect(page.getByRole("columnheader", { name: "Stichtag" }).first()).toBeVisible();

    await page.getByRole("link", { name: "Eingaben" }).click();
    await expect(page).toHaveURL(/\/liquiditaetsplan$/);
    await expect(page.getByRole("heading", { name: "Rahmendaten Liquiditaet" })).toBeVisible();

    await page.getByRole("link", { name: "Auswertung" }).click();
    await expect(page).toHaveURL(/\/liquiditaetsauswertung$/);
    await expect(page.getByText("Endkapital:")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Monat" })).toBeVisible();
  });

  test("adds income and expense items to the liquidity plan", async ({ page }) => {
    await page.goto("/liquiditaetsplan");

    await expect(page.getByRole("heading", { name: "Rahmendaten Liquiditaet" })).toBeVisible();

    await page.getByLabel("Name Einnahme").fill("Gehalt");
    await page.getByLabel("Betrag Einnahme").fill("3500");
    await page.getByLabel("Einnahme hinzufügen").click();

    await expect(page.getByText("Summe: 3.500 €")).toBeVisible();
    await expect(page.getByLabel("Gehalt bearbeiten")).toBeVisible();

    await page.getByLabel("Name Ausgabe").fill("Miete");
    await page.getByLabel("Betrag Ausgabe").fill("1200");
    await page.getByLabel("Ausgabe hinzufügen").click();

    await expect(page.getByText("Summe: 1.200 €")).toBeVisible();
    await expect(page.getByLabel("Miete bearbeiten")).toBeVisible();

    await page.getByRole("link", { name: "Auswertung" }).click();
    await expect(page.getByText("Endkapital:")).toBeVisible();
    await expect(page.getByRole("button", { name: "3.500,00 €" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "1.200,00 €" }).first()).toBeVisible();
  });

  test("matches approved screenshots for core screens", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Raten" })).toBeVisible();
    await expectApprovedScreenshot(page, "konditionen-desktop.png");

    await page.getByRole("link", { name: "Finanzplan" }).click();
    await expect(page.getByRole("columnheader", { name: "Stichtag" }).first()).toBeVisible();
    await expectApprovedScreenshot(page, "finanzplan-desktop.png");

    await page.getByRole("link", { name: "Eingaben" }).click();
    await expect(page.getByRole("heading", { name: "Rahmendaten Liquiditaet" })).toBeVisible();
    await page.getByLabel("Name Einnahme").fill("Gehalt");
    await page.getByLabel("Betrag Einnahme").fill("3500");
    await page.getByLabel("Einnahme hinzufügen").click();
    await page.getByLabel("Name Ausgabe").fill("Miete");
    await page.getByLabel("Betrag Ausgabe").fill("1200");
    await page.getByLabel("Ausgabe hinzufügen").click();
    await expect(page.getByText("Summe: 3.500 €")).toBeVisible();
    await expectApprovedScreenshot(page, "liquiditaetsplan-mit-positionen-desktop.png");

    await page.getByRole("link", { name: "Auswertung" }).click();
    await expect(page.getByRole("button", { name: "3.500,00 €" }).first()).toBeVisible();
    await expectApprovedScreenshot(page, "liquiditaetsauswertung-mit-positionen-desktop.png");
  });
});
