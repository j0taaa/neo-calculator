import { expect, test } from "@playwright/test";

test("services-status page shows Free badge for always-free services", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001/services-status", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Implementation Status")).toBeVisible();

  await expect(page.getByText("Always Free")).toBeVisible();

  const autoScalingRow = page.locator("div").filter({ hasText: "Auto Scaling" }).filter({ hasText: "AS" }).first();
  await expect(autoScalingRow).toBeVisible();
  await expect(autoScalingRow.locator("span").filter({ hasText: "Free" }).first()).toBeVisible();

  const vpcRow = page.locator("div").filter({ hasText: "Virtual Private Cloud" }).filter({ hasText: "VPC" }).first();
  await expect(vpcRow).toBeVisible();
  await expect(vpcRow.locator("span").filter({ hasText: "Free" }).first()).toBeVisible();
});

test("selecting Auto Scaling shows free service panel", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001", { waitUntil: "domcontentloaded" });

  const searchInput = page.getByPlaceholder("Search service name");
  await searchInput.click();
  await searchInput.fill("Auto Scaling");

  await page.getByRole("option", { name: "Auto Scaling" }).click();

  await expect(page.locator("span").filter({ hasText: "Free" }).first()).toBeVisible();
  await expect(page.getByText("Auto Scaling is free of charge")).toBeVisible();
  await expect(page.getByText(/no calculator needed/i)).toBeVisible();
});

test("selecting VPC shows free service panel", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001", { waitUntil: "domcontentloaded" });

  const searchInput = page.getByPlaceholder("Search service name");
  await searchInput.click();
  await searchInput.fill("Virtual Private Cloud");

  await page.getByRole("option", { name: "Virtual Private Cloud" }).click();

  await expect(page.locator("span").filter({ hasText: "Free" }).first()).toBeVisible();
  await expect(page.getByText("Virtual Private Cloud is free of charge")).toBeVisible();
});

test("selecting IAM shows free service panel", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001", { waitUntil: "domcontentloaded" });

  const searchInput = page.getByPlaceholder("Search service name");
  await searchInput.click();
  await searchInput.fill("IAM");

  await page.getByRole("option", { name: "Identity and Access Management" }).click();

  await expect(page.locator("span").filter({ hasText: "Free" }).first()).toBeVisible();
  await expect(page.getByText("Identity and Access Management is free of charge")).toBeVisible();
});

test("free service does not show billing mode or estimate bar", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001", { waitUntil: "domcontentloaded" });

  const searchInput = page.getByPlaceholder("Search service name");
  await searchInput.click();
  await searchInput.fill("Cloud Eye");

  await page.getByRole("option", { name: "Cloud Eye" }).click();

  await expect(page.getByText("Cloud Eye is free of charge")).toBeVisible();
  await expect(page.getByText("Billing Mode")).not.toBeVisible();
  await expect(page.getByText("Add to List")).not.toBeVisible();
});
