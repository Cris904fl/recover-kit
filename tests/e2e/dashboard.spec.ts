import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Set a mock JWT so auth middleware passes
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("rk_token", "test-token");
    });
  });

  test("renders metric cards", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Revenue recovered")).toBeVisible();
    await expect(page.getByText("Recovery rate")).toBeVisible();
    await expect(page.getByText("Carts abandoned")).toBeVisible();
  });

  test("navigates to Carts page", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Carts" }).click();
    await expect(page).toHaveURL("/carts");
  });

  test("navigates to Analytics page", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL("/analytics");
  });
});
