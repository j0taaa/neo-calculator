import { test, expect } from "@playwright/test";

for (const direction of ["studio", "console", "atelier"]) {
  for (const width of [280, 375, 768, 1440, 1920]) {
    test(`${direction} renders without overflow at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1050 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/designs/${direction}`);
      await expect(
        page.getByRole("heading", {
          name: "Elastic Cloud Server",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByTestId("proposal-price")).toHaveText("$52.56");
      await expect(page.getByTestId("proposal-total")).toHaveText("$57.36");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(await page.locator("iframe").count()).toBe(0);
      await expect(
        page.getByText("Sample prices", { exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() =>
          Array.from(document.fonts).some(
            (font) =>
              font.family.includes("Neo DM Sans") && font.status === "loaded",
          ),
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/neo-design-${direction}-${width}.png`,
        fullPage: true,
      });
    });
  }

  for (const interactionWidth of [375, 1440]) {
    test(`${direction} controls and carts work without pricing requests or persistence at ${interactionWidth}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: interactionWidth, height: 1100 });
      await page.goto(`/designs/${direction}`);
      await expect(page.getByTestId("proposal-price")).toHaveText("$52.56");
      const storageBefore = await page.evaluate(() =>
        JSON.stringify({ ...localStorage }),
      );
      const requests: string[] = [];
      // Once loaded, every interaction must be local, including cart creation.
      await page.route("**/*", async (route) => {
        requests.push(route.request().url());
        await route.abort();
      });
      await page.getByLabel("Duration", { exact: true }).fill("1460");
      await expect(page.getByTestId("proposal-price")).toHaveText("$105.12");
      await page.getByRole("button", { name: "Increase quantity" }).click();
      await expect(page.getByTestId("proposal-price")).toHaveText("$210.24");
      await page.getByRole("button", { name: "Decrease quantity" }).click();
      await page.getByRole("button", { name: "Monthly", exact: true }).click();
      await expect(page.getByLabel("Duration", { exact: true })).toHaveValue(
        "1",
      );
      await expect(page.getByTestId("proposal-price")).toHaveText("$52.56");
      await page
        .getByRole("button", { name: "4 vCPUs · 16 GiB", exact: true })
        .click();
      await expect(page.getByTestId("proposal-price")).toHaveText("$105.12");
      await page.getByLabel("Resource name").fill("Preview machine");
      await page
        .getByRole("combobox", { name: "Region", exact: true })
        .selectOption("Frankfurt");
      await page.getByRole("button", { name: "Add to estimate" }).click();
      await expect(page.getByTestId("proposal-total")).toHaveText("$162.48");
      await expect(page.getByRole("status")).toContainText(
        "Preview machine added",
      );
      await page
        .getByRole("button", { name: "Remove Preview machine" })
        .click();
      await expect(page.getByTestId("proposal-total")).toHaveText("$57.36");
      await page.getByLabel("Search services").fill("nonexistent");
      await expect(page.getByText("No services found.")).toBeVisible();
      await page.getByLabel("Search services").fill("database");
      await page.getByRole("button", { name: /RDS Database/ }).click();
      await expect(
        page.getByRole("heading", { name: "Relational Database Service" }),
      ).toBeVisible();
      await expect(page.getByTestId("proposal-price")).toHaveText("$116.80");
      await page.getByLabel("Search services").fill("");
      for (const [service, spec] of [
        ["ELB Networking", "Small"],
        ["EVS Storage", "100 GiB · General purpose"],
        ["ECS Compute", "2 vCPUs · 8 GiB"],
      ]) {
        await page.getByRole("button", { name: service }).click();
        await expect(
          page.getByRole("button", { name: spec, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
      }
      await page.getByLabel("Duration", { exact: true }).fill("");
      await expect(
        page.getByRole("button", { name: "Add to estimate" }),
      ).toBeDisabled();
      await page.getByLabel("Duration", { exact: true }).fill("1");
      await page.getByRole("button", { name: "New Cart", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByLabel("Cart name")
        .fill("Cancelled draft");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(
        page.getByRole("button", { name: "New Cart", exact: true }),
      ).toBeFocused();
      await expect(page.getByTestId("proposal-total")).toHaveText("$57.36");
      await page.getByRole("button", { name: "New Cart", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Cart name").fill("Design exploration");
      await dialog
        .getByRole("button", { name: "Create cart", exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Design exploration" }),
      ).toBeVisible();
      await expect(page.getByTestId("proposal-total")).toHaveText("$0.00");
      await page.getByRole("button", { name: "Add to estimate" }).click();
      await expect(page.getByTestId("proposal-total")).toHaveText("$52.56");
      expect(
        await page.evaluate(() => JSON.stringify({ ...localStorage })),
      ).toBe(storageBefore);
      expect(
        requests.filter((value) => {
          const url = new URL(value);
          const isNavigationPrefetch =
            url.searchParams.has("_rsc") &&
            (url.pathname === "/" ||
              url.pathname === "/designs" ||
              /^\/designs\/(studio|console|atelier)$/.test(url.pathname));
          return !isNavigationPrefetch && !url.pathname.startsWith("/_next/");
        }),
      ).toEqual([]);
      await page.unroute("**/*");
      await page.reload();
      await expect(page.getByTestId("proposal-total")).toHaveText("$57.36");
    });
  }
}

test("gallery links all proposals, navigation and invalid routes behave correctly", async ({
  page,
}) => {
  await page.goto("/designs");
  for (const direction of ["studio", "console", "atelier"]) {
    await expect(page.locator(`a[href='/designs/${direction}']`)).toHaveCount(
      1,
    );
  }
  await page.getByRole("link", { name: "Studio", exact: true }).click();
  await expect(page).toHaveURL(/\/designs\/studio$/);
  await page
    .getByRole("navigation", { name: "Design direction" })
    .getByRole("link", { name: /Console/ })
    .click();
  await expect(page).toHaveURL(/\/designs\/console$/);
  await page.getByRole("link", { name: "All designs" }).click();
  await expect(page).toHaveURL(/\/designs$/);
  await page.getByRole("link", { name: "Back to calculator" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await expect(page.locator(".neo-designs")).toHaveCount(0);
  const invalid = await page.goto("/designs/not-a-design");
  expect(invalid?.status()).toBe(404);
});

for (const width of [280, 375, 1440]) {
  test(`gallery fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/designs");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/neo-design-gallery-${width}.png`,
      fullPage: true,
    });
  });
}
