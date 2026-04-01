import { fetchHuaweiBillingInquiry } from "@/lib/huawei-billing-inquiry";
import type { CalculatorPriceVerificationCase } from "@/tests/huawei-inquiry/types";
import { vpnInquiryCases } from "@/tests/huawei-inquiry/vpn";

const verificationCases: CalculatorPriceVerificationCase[] = [
  ...vpnInquiryCases,
];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

async function main() {
  const selectedCaseIds = new Set(process.argv.slice(2));
  const selectedCases = selectedCaseIds.size > 0
    ? verificationCases.filter((entry) => selectedCaseIds.has(entry.id))
    : verificationCases;

  if (selectedCases.length === 0) {
    throw new Error(`No calculator price verification cases matched: ${[...selectedCaseIds].join(", ")}`);
  }

  const failures: string[] = [];

  for (const testCase of selectedCases) {
    const [localAmount, inquiry] = await Promise.all([
      testCase.getLocalAmount(),
      fetchHuaweiBillingInquiry(testCase.buildInquiryRequest()),
    ]);
    const remoteAmount = inquiry.amount;
    const delta = roundAmount(Math.abs(localAmount - remoteAmount));

    console.log(
      [
        `${testCase.id}`,
        testCase.serviceCode,
        testCase.description,
        `local=${localAmount.toFixed(5)}`,
        `remote=${remoteAmount.toFixed(5)}`,
        `delta=${delta.toFixed(5)}`,
      ].join(" | "),
    );

    if (delta > testCase.tolerance) {
      failures.push(
        `${testCase.id}: local ${localAmount.toFixed(5)} vs Huawei inquiry ${remoteAmount.toFixed(5)} exceeded tolerance ${testCase.tolerance.toFixed(5)}`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`Calculator price verification failed:\n${failures.join("\n")}`);
  }

  console.log(`Verified ${selectedCases.length} calculator pricing case${selectedCases.length === 1 ? "" : "s"} against Huawei inquiry API.`);
}

await main();
