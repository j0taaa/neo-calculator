import { verifyRecordedQuotes } from "../lib/huawei-snapshot/audit";
import { SnapshotStore } from "../lib/huawei-snapshot/store";
import { rateInquiry } from "../lib/huawei-snapshot/rating";
const store = new SnapshotStore(),
  release = await store.active();
let comparisons = 0;
const failures: string[] = [];
for (const key of Object.keys(release.scopes)) {
  const [service, region] = key.split("/"),
    scope = await store.scope(release, service, region);
  verifyRecordedQuotes(scope);
  comparisons += scope.customProof?.length ?? 0;
  for (const { inquiry, response } of scope.proof ?? []) {
    const local = rateInquiry(scope, inquiry);
    for (const actual of response.productRatingResult) {
      const predicted = local.productRatingResult.find(
        (item) => item.id === actual.id,
      );
      comparisons++;
      if (
        !predicted ||
        Math.abs(actual.amount - predicted.amount) > 0.0000001 ||
        Math.abs(
          Number(actual.perAmount ?? 0) - Number(predicted.perAmount ?? 0),
        ) > 0.0000001
      )
        failures.push(
          `${key}: ${inquiry.productInfos.find((product) => product.id === actual.id)?.resourceSpecCode}`,
        );
    }
  }
}
console.log(
  JSON.stringify({
    release: release.id,
    scopes: Object.keys(release.scopes).length,
    comparisons,
    failures: failures.length,
    examples: failures.slice(0, 20),
  }),
);
if (failures.length) process.exitCode = 1;
