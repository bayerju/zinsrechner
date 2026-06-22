import { expect, test } from "@playwright/test";

test.describe("Copilot chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("is closed by default on small devices", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Raten" })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Type a message..." }),
    ).not.toBeVisible();

    await page.getByRole("button", { name: "Open chat" }).click();
    await expect(
      page.getByRole("textbox", { name: "Type a message..." }),
    ).toBeVisible();
  });

  test("gets a real model response", async ({ page }) => {
    const failedCopilotResponses: string[] = [];
    const copilotConsoleErrors: string[] = [];

    page.on("response", (response) => {
      if (
        response.url().includes("/api/copilotkit") &&
        response.status() >= 400
      ) {
        failedCopilotResponses.push(
          `${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });
    page.on("console", (message) => {
      if (
        (message.type() === "error" || message.type() === "warning") &&
        message.text().includes("CopilotKit")
      ) {
        copilotConsoleErrors.push(message.text());
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Raten" })).toBeVisible();

    const messageBox = page.getByRole("textbox", {
      name: "Type a message...",
    });

    await expect(messageBox).toBeVisible();
    await messageBox.fill("Antworte nur mit: Copilot funktioniert");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Copilot funktioniert")).toBeVisible({
      timeout: 90_000,
    });
    expect(failedCopilotResponses).toEqual([]);
    expect(copilotConsoleErrors).toEqual([]);
  });
});
