import {
  getConfigSpecsSummary,
  getMonthlyPrice,
  getDescriptionFromConfig,
  getRegionFromConfig,
  type ExportProjectLike,
} from "@/lib/resource-export";

function sanitizeSheetName(name: string) {
  return name
    .replace(/[\\/?*\[\]:]/g, "")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, 31) || "Sheet";
}

function getUniqueSheetName(name: string, usedNames: Set<string>) {
  const baseName = sanitizeSheetName(name) || "Cart";
  let candidate = baseName;
  let suffix = 2;

  while (usedNames.has(candidate)) {
    const suffixText = ` (${suffix})`;
    candidate = `${baseName.slice(0, Math.max(1, 31 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

export async function buildProjectWorkbookBuffer(project: ExportProjectLike, shareUrl?: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();

  if (!project.lists.length) {
    const worksheet = workbook.addWorksheet(getUniqueSheetName("Project", usedNames));
    worksheet.addRow(["Project", project.name]);
    worksheet.addRow(["Note", "This project has no carts to export."]);
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ArrayBuffer;
  }

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.views = [{ showGridLines: false }];

  summarySheet.columns = [
    { width: 8 },
    { width: 32 },
    { width: 25.85 },
    { width: 25.85 },
  ];

  const summaryTitleRow = summarySheet.addRow([`${project.name} - Huawei Cloud`]);
  summaryTitleRow.height = 34.80;
  summarySheet.mergeCells("A1:D1");
  summaryTitleRow.getCell(1).font = { name: "Arial", size: 20, bold: true };
  summaryTitleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  summaryTitleRow.getCell(1).border = {
    top: { style: "thin", color: { argb: "000000" } },
    bottom: { style: "thin", color: { argb: "000000" } },
    left: { style: "thin", color: { argb: "000000" } },
    right: { style: "thin", color: { argb: "000000" } },
  };

  const summaryHeaders = ["No", "Name", "Yearly Price (US$)", "Monthly Price (US$)"];
  const summaryHeaderRow = summarySheet.addRow(summaryHeaders);
  summaryHeaderRow.height = 34.80;
  summaryHeaderRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "003366" } };
    cell.border = {
      top: { style: "thin", color: { argb: "000000" } },
      bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } },
      right: { style: "thin", color: { argb: "000000" } },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const summaryDataRowCount = project.lists.length;
  project.lists.forEach((list, index) => {
    const row = summarySheet.addRow([
      index + 1,
      list.name,
      0,
      0,
    ]);
    row.height = 34.80;

    row.eachCell((cell, colNum) => {
      cell.font = { name: "Arial", size: 14 };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };

      if (colNum === 1) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colNum === 2) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colNum === 3 || colNum === 4) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = '"$"* #,##0.00';
      }
    });
  });

  const linkRowNum = summaryDataRowCount + 3;
  const linkRow = summarySheet.addRow(["Open project in calculator"]);
  linkRow.height = 34.80;
  summarySheet.mergeCells(`A${linkRowNum}:D${linkRowNum}`);
  const linkCell = linkRow.getCell(1);
  linkCell.font = { name: "Arial", size: 14, color: { argb: "0563C1" }, underline: "single" };
  linkCell.alignment = { horizontal: "center", vertical: "middle" };
  linkCell.border = {
    top: { style: "thin", color: { argb: "000000" } },
    bottom: { style: "thin", color: { argb: "000000" } },
    left: { style: "thin", color: { argb: "000000" } },
    right: { style: "thin", color: { argb: "000000" } },
  };

  const listSheetInfo: Array<{ name: string; totalRowNum: number | null }> = [];

  project.lists.forEach((list) => {
    const sheetName = getUniqueSheetName(list.name, usedNames);
    const worksheet = workbook.addWorksheet(sheetName);
    listSheetInfo.push({ name: sheetName, totalRowNum: null });

    worksheet.views = [{ showGridLines: false }];

    if (!list.products.length) {
      const emptyHeaderRow = worksheet.addRow(["No", "Service", "Region", "Specifications", "Quantity", "Monthly Price", "Yearly Price", "Comments"]);
      emptyHeaderRow.height = 34.80;
      const emptyRow1 = worksheet.addRow(["", "", "", "", "", "", "", ""]);
      emptyRow1.height = 34.80;
      const emptyRow2 = worksheet.addRow(["", "This cart has no saved resources.", "", "", "", "", "", ""]);
      emptyRow2.height = 34.80;
      return;
    }

    const dataRowCount = list.products.length;
    const totalRowNum = 3 + dataRowCount;

    listSheetInfo[listSheetInfo.length - 1] = { name: sheetName, totalRowNum };

    worksheet.columns = [
      { width: 6 },
      { width: 32 },
      { width: 14 },
      { width: 45 },
      { width: 11.31 },
      { width: 20.31 },
      { width: 20.31 },
      { width: 20 },
    ];

    const titleRow = worksheet.addRow([list.name]);
    titleRow.height = 34.80;
    worksheet.mergeCells("A1:H1");
    titleRow.getCell(1).font = { name: "Arial", size: 20, bold: true };
    titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    titleRow.getCell(1).border = {
      top: { style: "thin", color: { argb: "000000" } },
      bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } },
      right: { style: "thin", color: { argb: "000000" } },
    };

    const headers = ["No", "Service", "Region", "Specifications", "Quantity", "Monthly Price", "Yearly Price", "Comments"];
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 34.80;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "003366" } };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    list.products.forEach((product, index) => {
      const monthlyPrice = getMonthlyPrice(product.pricing);
      const specs = getConfigSpecsSummary(product.config);
      const title = product.title || "";
      const specifications = title + (specs ? ` | ${specs}` : "");
      const quantity = product.quantity || 1;
      const excelRowNum = index + 3;

      const row = worksheet.addRow([
        index + 1,
        getDescriptionFromConfig(product.config, product.serviceName),
        getRegionFromConfig(product.config),
        specifications,
        quantity,
        monthlyPrice ?? 0,
        { formula: `F${excelRowNum}*12` },
        "",
      ]);
      row.height = 34.80;

      row.eachCell((cell, colNum) => {
        cell.font = { name: "Arial", size: 14 };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        if (colNum === 1 || colNum === 5) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (colNum === 3) {
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        } else if (colNum === 4) {
          cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        } else if (colNum === 6 || colNum === 7) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = '"$"* #,##0.00';
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });
    });

    const totalRow = worksheet.addRow([
      "Total",
      "",
      "",
      "",
      "",
      { formula: `SUM(F3:F${totalRowNum - 1})` },
      { formula: `SUM(G3:G${totalRowNum - 1})` },
      "",
    ]);
    totalRow.height = 34.80;

    worksheet.mergeCells(`A${totalRowNum}:E${totalRowNum}`);

    totalRow.eachCell((cell, colNum) => {
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };

      if (colNum === 1) {
        cell.font = { name: "Arial", size: 14, bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colNum === 6 || colNum === 7) {
        cell.font = { name: "Arial", size: 14, bold: true };
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = '"$"* #,##0.00';
      }
    });
  });

  const summaryDataStartRow = 3;
  project.lists.forEach((list, index) => {
    const sheetInfo = listSheetInfo[index];
    if (sheetInfo?.totalRowNum != null) {
      const summaryRowNum = summaryDataStartRow + index;
      const yearlyPriceCell = summarySheet.getCell(summaryRowNum, 3);
      yearlyPriceCell.value = { formula: `'${sheetInfo.name}'!G${sheetInfo.totalRowNum}` };
      yearlyPriceCell.numFmt = '"$"* #,##0.00';

      const monthlyPriceCell = summarySheet.getCell(summaryRowNum, 4);
      monthlyPriceCell.value = { formula: `'${sheetInfo.name}'!F${sheetInfo.totalRowNum}` };
      monthlyPriceCell.numFmt = '"$"* #,##0.00';
    } else {
      const summaryRowNum = summaryDataStartRow + index;
      summarySheet.getCell(summaryRowNum, 3).value = 0;
      summarySheet.getCell(summaryRowNum, 4).value = 0;
    }
  });

  const finalLinkRowNum = project.lists.length + 3;
  const finalLinkCell = summarySheet.getCell(finalLinkRowNum, 1);
  if (shareUrl) {
    finalLinkCell.value = { text: "Open project in calculator", hyperlink: shareUrl };
  } else {
    finalLinkCell.value = "Open project in calculator";
    finalLinkCell.font = { name: "Arial", size: 14, color: { argb: "666666" } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
