import { listStoredEcsFlavors, syncEcsFlavorCatalog } from "@/lib/ecs-flavor-catalog";

const regionId = process.env.ECS_SYNC_TEST_REGION?.trim() || "sa-brazil-1";

async function main() {
  await syncEcsFlavorCatalog({
    regionIds: [regionId],
    includeOnDemandBackfill: false,
  });

  const flavors = listStoredEcsFlavors(regionId);
  if (!flavors.length) {
    throw new Error(`No ECS flavors were stored for ${regionId}`);
  }

  const billingCounts = {
    ONDEMAND: 0,
    MONTHLY: 0,
    YEARLY: 0,
    RI: 0,
  };

  for (const flavor of flavors) {
    for (const billingMode of Object.keys(billingCounts) as Array<keyof typeof billingCounts>) {
      if (typeof flavor.prices[billingMode] === "number") {
        billingCounts[billingMode] += 1;
      }
    }
  }

  for (const [billingMode, count] of Object.entries(billingCounts)) {
    if (count === 0) {
      throw new Error(`No ${billingMode} prices were stored for ${regionId}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        regionId,
        storedFlavorCount: flavors.length,
        billingCounts,
        sampleFlavor: flavors[0],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

