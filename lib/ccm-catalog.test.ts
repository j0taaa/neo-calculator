import { expect, test } from "bun:test";

import {
  estimateCcmConfiguration,
  listCcmAuthorities,
  listCcmCertificateTypes,
  listCcmDomainTypes,
  listCcmValidityPeriods,
} from "@/lib/ccm-catalog";
import { parseCcmPricingCatalogResponse } from "@/lib/ccm-pricing";

const payload = {
  product: {
    "ccm_scm2.cert": [
      {
        resourceSpecCode: "digicert.ov.single.1",
        CABrand: "Digcert",
        CertificateType: "OV",
        DomainType: "Single",
        productSpecSysDesc: "CABrand:Digcert;CertificateType:OV;DomainType:Single;PurchaseTime:1 year",
        planList: [{ productId: "ov-single-1", billingMode: "ONETIME", amount: 120, billingEvent: "event.type.onetime" }],
      },
      {
        resourceSpecCode: "digicert.ov.wildcard.1",
        CABrand: "Digcert",
        CertificateType: "OV",
        DomainType: "Wildcard",
        productSpecSysDesc: "CABrand:Digcert;CertificateType:OV;DomainType:Wildcard;PurchaseTime:1 year",
        planList: [{ productId: "ov-wildcard-1", billingMode: "ONETIME", amount: 300, billingEvent: "event.type.onetime" }],
      },
      {
        resourceSpecCode: "digicert.ov.multi.primary_single.1",
        CABrand: "Digcert",
        CertificateType: "OV",
        DomainType: "Multi_PriSingle",
        productSpecSysDesc: "CABrand:Digcert;CertificateType:OV;DomainType:Multi_PriSingle;PurchaseTime:1 year",
        planList: [{ productId: "ov-multi-1", billingMode: "ONETIME", amount: 140, billingEvent: "event.type.onetime" }],
      },
      {
        resourceSpecCode: "globalsign.dv.single.2",
        CABrand: "GlobalSign",
        CertificateType: "DV",
        DomainType: "Single",
        productSpecSysDesc: "CABrand:GlobalSign;CertificateType:DV;DomainType:Single;PurchaseTime:2 years",
        planList: [{ productId: "dv-single-2", billingMode: "ONETIME", amount: 80, billingEvent: "event.type.onetime" }],
      },
    ],
    "ccm_scm2.singledomain": [
      {
        resourceSpecCode: "digicert.ov.multi.single_domain.1",
        CABrand: "Digicert",
        CertificateType: "OV",
        DomainType: "Multi_SingleDomain",
        PurchaseTime: "1 year",
        planList: [{ productId: "ov-multi-addon-1", billingMode: "ONETIME", amount: 25, billingEvent: "event.type.onetime" }],
      },
    ],
  },
};

test("CCM parser extracts normalized certificate options", () => {
  const catalog = parseCcmPricingCatalogResponse(payload, "sa-brazil-1");

  expect(listCcmCertificateTypes(catalog)).toEqual(["OV", "DV"]);
  expect(listCcmAuthorities(catalog, "OV")).toEqual(["DigiCert"]);
  expect(listCcmDomainTypes(catalog, { certificateType: "OV", certificateAuthority: "DigiCert" })).toEqual(["Single domain", "Multiple domains", "Wildcard"]);
  expect(listCcmValidityPeriods(catalog, {
    certificateType: "OV",
    certificateAuthority: "DigiCert",
    domainType: "Multiple domains",
  })).toEqual([1]);
});

test("CCM estimator prices single, wildcard, and multiple-domain flows", () => {
  const catalog = parseCcmPricingCatalogResponse(payload, "sa-brazil-1");

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
    domainQuantity: 3,
    quantity: 2,
  })?.amount).toBe(380);
});
