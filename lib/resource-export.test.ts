import { expect, test } from "bun:test";
import ExcelJS from "exceljs";

import { buildProjectWorkbookBuffer } from "@/lib/resource-export-excel";

test("buildProjectWorkbookBuffer keeps summary rows aligned when earlier carts are empty", async () => {
  const buffer = await buildProjectWorkbookBuffer({
    name: "Test Project",
    ownerUserId: "user-1",
    accessLevel: "owner",
    canShare: true,
    description: null,
    lists: [
      {
        name: "Empty Cart",
        products: [],
      },
      {
        name: "Filled Cart",
        products: [
          {
            serviceCode: "ECS",
            serviceName: "Elastic Cloud Server",
            productType: "ecs",
            title: "Test ECS",
            quantity: 1,
            config: { region: "la-sao-paulo1", description: "Elastic Cloud Server", vcpu: 2, ramGiB: 8 },
            pricing: { total: "USD 19.00/mo" },
          },
        ],
      },
    ],
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer));

  const summarySheet = workbook.getWorksheet("Summary");
  expect(summarySheet).toBeDefined();

  expect(summarySheet?.getCell("C3").value).toBe(0);
  expect(summarySheet?.getCell("D3").value).toBe(0);

  const yearlyFormula = summarySheet?.getCell("C4").value;
  const monthlyFormula = summarySheet?.getCell("D4").value;

  expect(yearlyFormula).toEqual({ formula: "'Filled Cart'!G4" });
  expect(monthlyFormula).toEqual({ formula: "'Filled Cart'!F4" });
});
