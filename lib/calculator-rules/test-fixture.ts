import { compileRules } from "./compile";
import type { ScopeSnapshot, SnapshotRelease } from "../huawei-snapshot/types";
export function fixture() {
  const config = `var lang={calc_1_:'Flavor'};var viewConfig={calc_view:{components:[{id:'flavor',type:'CommonRadioGroup',optionKeys:['size'],titles:['calc_1_']}]}};var dataConfig={dataSources:[{ids:['flavor'],sources:[{param:'hws.resource.type.vm'}]}]};var funcConfig={calc:{parseSelectProduct:[]}};`;
  const scope: ScopeSnapshot = {
    service: "ecs", region: "region", modes: ["ONDEMAND", "PERIOD"], config, rules: compileRules(config), rulesChecks: 1,
    source: { page: "", config: "rules-1", products: "", framework: "framework-1", menu: "", fetchedAt: "2026-10-09" }, checks: 1, verifiedAt: "2026-10-09",
    products: { region: "region", urlPath: "ecs", product: { ec2_vm: ["Small", "Large"].map((size, i) => ({ cloudServiceType: "hws.service.type.ec2", resourceType: "hws.resource.type.vm", resourceSpecCode: `vm.${size}`, size, periodList: 0, planList: [{ productId: `product${i}`, billingMode: "ONDEMAND", usageFactor: "duration", usageMeasureId: 4, measureUnit: 4, amount: (i + 1) * 2 }, { productId: `monthly${i}`, billingMode: "MONTHLY", periodNum: 1, amount: (i + 1) * 50 }] })) }, period: { ec2_vm: [[{ periodType: "MONTH", value: 1 }, { periodType: "MONTH", value: 2 }, { periodType: "YEAR", value: 1 }]] } },
  };
  const menu = { menuInfos: [{ subCategoryLists: [{ urlPath: "ecs", categoryInfos: [{ cloudServiceType: "hws.service.type.ec2", resourceType: "hws.resource.type.vm" }] }] }], languagePack: {}, global: {}, measureID: { 4: { unit: "hour", pluralUnit: "hours" }, 41: { unit: "unit", pluralUnit: "units" } } };
  const release: SnapshotRelease = { version: 1, id: "", createdAt: "first", engine: { kind: "neo-rules", version: 1, fingerprint: "engine-test" }, menu: JSON.stringify(menu), frameworkUrl: "", assets: {}, diagnostics: [], directory: { services: [], regions: [], billingModes: {} }, scopes: {} };
  return { scope, release, menu };
}
