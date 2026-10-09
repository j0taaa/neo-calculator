import { expect, test } from "bun:test";
import { nativeBillingDirectory, isNativeBillingMode } from "./native-billing";
import { parseNativeSelection, selectionBillingMode } from "./native-selection";

test("billing availability follows each official service and region, excluding AZ-only or unknown modes", () => {
  expect(nativeBillingDirectory({menuInfos:[{subCategoryLists:[{urlPath:"ecs",regionOnline:{hk:{common:["PERIOD","ONDEMAND","RI","NEW"]},paris:{common:["ONDEMAND","RI"]},az:{homeZoneAZCodes:["PERIOD"]}}},{urlPath:"ccm",regionOnline:{hk:{common:["ONETIME"]}}}]}]}))
    .toEqual({ecs:{hk:["PERIOD","ONDEMAND","RI"],paris:["ONDEMAND","RI"]},ccm:{hk:["ONETIME"]}});
  for (const value of ["", "toString", 0, "RESERVED"]) expect(isNativeBillingMode(value)).toBe(false);
});
test("saved configurations preserve all billing modes and legacy selections remain pay-per-use", () => {
  const selection = {version:1,service:"ecs",region:"hk",initial:[],steps:[],fields:[]};
  expect(selectionBillingMode(parseNativeSelection(selection))).toBe("ONDEMAND");
  for (const billingMode of ["ONDEMAND","PERIOD","RI","ONETIME"] as const) expect(selectionBillingMode(parseNativeSelection({...selection,version:2,billingMode}))).toBe(billingMode);
  for (const change of [{version:2},{version:2,billingMode:"unknown"},{version:1,billingMode:"RI"},{version:3}]) expect(() => parseNativeSelection({...selection,...change})).toThrow();
});
test("synchronization refuses unknown advertised modes without rejecting hidden or ineligible offers", () => {
  const service = { urlPath: "ecs", regionOnline: {
    eligible: { common: ["ONDEMAND"], homeZoneAZCodes: ["zone"], zone: ["NEW"] },
    excluded: { common: ["NEW"] },
  } };
  const menu = { menuInfos: [{ subCategoryLists: [
    service, { urlPath: "hidden", regionOnline: { eligible: { common: ["NEW"] } } },
  ] }] };
  const validation = { services: new Set(["ecs"]), regions: new Set(["eligible"]) };
  expect(() => nativeBillingDirectory(menu, validation)).toThrow("ecs/eligible");
  service.regionOnline.eligible.zone = ["PERIOD"];
  expect(nativeBillingDirectory(menu, validation)).toEqual({ ecs: { eligible: ["ONDEMAND", "PERIOD"] }, hidden: {} });
});
