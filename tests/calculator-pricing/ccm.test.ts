import { expect, test } from "bun:test";

import { estimateCcmConfiguration, type CcmPricingCatalog } from "@/lib/ccm-catalog";

const catalog: CcmPricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
  baseTiers: [
    {
      certificateType: "OV",
      certificateAuthority: "DigiCert",
      domainType: "Single domain",
      validityPeriodYears: 1,
      resourceSpecCode: "digicert.ov.single.1",
      amount: 120,
      productId: "ov-single-1",
    },
    {
      certificateType: "OV",
      certificateAuthority: "DigiCert",
      domainType: "Multiple domains",
      validityPeriodYears: 1,
      resourceSpecCode: "digicert.ov.multi.primary_single.1",
      amount: 140,
      productId: "ov-multi-1",
    },
    {
      certificateType: "OV",
      certificateAuthority: "DigiCert",
      domainType: "Wildcard",
      validityPeriodYears: 1,
      resourceSpecCode: "digicert.ov.wildcard.1",
      amount: 300,
      productId: "ov-wildcard-1",
    },
  ],
  additionalDomainTiers: [
    {
      certificateType: "OV",
      certificateAuthority: "DigiCert",
      validityPeriodYears: 1,
      resourceSpecCode: "digicert.ov.multi.single_domain.1",
      amount: 25,
      productId: "ov-multi-addon-1",
    },
  ],
};

test("CCM LATAM estimates stay aligned", () => {
  expect(estimateCcmConfiguration(catalog, {
    certificateType: "OV",
    certificateAuthority: "DigiCert",
    domainType: "Single domain",
    validityPeriodYears: 1,
    domainQuantity: 2,
    quantity: 1,
  })?.amount).toBe(120);

  expect(estimateCcmConfiguration(catalog, {
    certificateType: "OV",
    certificateAuthority: "DigiCert",
    domainType: "Multiple domains",
    validityPeriodYears: 1,
    domainQuantity: 4,
    quantity: 1,
  })?.amount).toBe(215);
});

test("CCM rejects impossible multi-domain quantities", () => {
  expect(estimateCcmConfiguration(catalog, {
    certificateType: "OV",
    certificateAuthority: "DigiCert",
    domainType: "Multiple domains",
    validityPeriodYears: 1,
    domainQuantity: 1,
    quantity: 1,
  })).toBeNull();
});
