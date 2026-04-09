import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "ccm",
  serviceCode: "CCM",
  serviceName: "Cloud Certificate & Manager",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CCM.png",
  implementation: "configurable",
  billingOptions: ["One-time"],
  defaults: {
    type: "SSL Certificates",
    certificateType: "OV",
    certificateAuthority: "DigiCert",
    domainType: "Single domain",
    validityPeriodYears: 1,
    domainQuantity: 2,
    quantity: 1,
  },
  fields: [
    { id: "type", type: "select", label: "Type", required: true, options: ["SSL Certificates"] },
    { id: "certificateType", type: "select", label: "Certificate Type", required: true, optionsSource: "catalog.certificateTypeOptions" },
    { id: "certificateAuthority", type: "select", label: "Certificate Authority", required: true, optionsSource: "catalog.certificateAuthorityOptions" },
    { id: "domainType", type: "select", label: "Domain Type", required: true, optionsSource: "catalog.domainTypeOptions" },
    { id: "validityPeriodYears", type: "select", label: "Validity Period", required: true, optionsSource: "catalog.validityPeriodOptions" },
    { id: "domainQuantity", type: "number", label: "Domain Quantity", required: true, min: 2, step: 1, visibleWhen: { field: "domainType", equals: "Multiple domains" } },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{certificateType} | {certificateAuthority} | {domainType} | {validityPeriodYears} years | {quantity}",
    notes: [
      "This calculator models the SSL Certificates flow from the Huawei ccm calculator.",
      "Multiple-domain pricing uses the base primary-domain certificate plus the additional single-domain add-on price from the live catalog.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "ccm",
  serviceCode: "CCM",
  serviceName: "Cloud Certificate & Manager",
  catalogAdapter: "ccm",
  rateSources: {
    base: {
      catalogKey: "baseTiers.amount",
      description: "Normalized Cloud Certificate & Manager base certificate prices from the Huawei ccm calculator catalog.",
    },
  },
  metrics: [
    {
      id: "certificate",
      label: "Certificates",
      rateSource: "base",
      quantity: {
        source: "field",
        field: "quantity",
      },
    },
  ],
} satisfies PricingDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  catalogDefinition: {
    source: {
      displayName: "Cloud Certificate & Manager",
      urlPath: "ccm",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "baseTiers",
          path: "product.ccm_scm2.cert",
          filters: [
            {
              kind: "field-matches-regex",
              path: "DomainType",
              pattern: "^(Single|Wildcard|Multi_PriSingle)$",
            },
          ],
          fields: [
            {
              key: "certificateType",
              extractor: {
                kind: "keyword-map",
                directPath: "CertificateType",
                directMap: {
                  OV: "OV",
                  OVPro: "OV Pro",
                  EV: "EV",
                  EVPro: "EV Pro",
                  DV: "DV",
                  DVBasic: "DV(Basic)",
                },
                textPaths: ["CertificateType", "resourceSpecCode", "productSpecSysDesc"],
                mappings: [],
              },
              required: true,
            },
            {
              key: "certificateAuthority",
              extractor: {
                kind: "keyword-map",
                directPath: "CABrand",
                directMap: {
                  Digcert: "DigiCert",
                  Digicert: "DigiCert",
                  Geotrust: "GeoTrust",
                  GlobalSign: "Globalsign",
                },
                textPaths: ["CABrand", "resourceSpecCode", "productSpecSysDesc"],
                mappings: [],
              },
              required: true,
            },
            {
              key: "domainType",
              extractor: {
                kind: "keyword-map",
                directPath: "DomainType",
                directMap: {
                  Single: "Single domain",
                  Wildcard: "Wildcard",
                  Multi_PriSingle: "Multiple domains",
                },
                textPaths: ["DomainType", "resourceSpecCode", "productSpecSysDesc"],
                mappings: [],
              },
              required: true,
            },
            {
              key: "validityPeriodYears",
              extractor: {
                kind: "number-from-pattern",
                paths: ["resourceSpecCode", "productSpecSysDesc"],
                pattern: "(\\d+)(?=$|\\D*$)",
              },
              required: true,
            },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "amount", extractor: { kind: "plan-amount", billingMode: "ONETIME", billingEvent: "event.type.onetime" }, required: true },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONETIME" } },
          ],
          dedupeBy: ["certificateType", "certificateAuthority", "domainType", "validityPeriodYears"],
          sort: [
            { path: "certificateType", direction: "asc", order: ["OV", "OV Pro", "EV", "EV Pro", "DV", "DV(Basic)"] },
            { path: "certificateAuthority", direction: "asc", order: ["DigiCert", "Globalsign", "GeoTrust"] },
            { path: "domainType", direction: "asc", order: ["Single domain", "Multiple domains", "Wildcard"] },
            { path: "validityPeriodYears", direction: "asc" },
          ],
        },
        {
          targetPath: "additionalDomainTiers",
          path: "product.ccm_scm2.singledomain",
          filters: [
            {
              kind: "field-equals",
              path: "DomainType",
              value: "Multi_SingleDomain",
            },
          ],
          fields: [
            {
              key: "certificateType",
              extractor: {
                kind: "keyword-map",
                directPath: "CertificateType",
                directMap: {
                  OV: "OV",
                  OVPro: "OV Pro",
                  EV: "EV",
                  EVPro: "EV Pro",
                  DV: "DV",
                  DVBasic: "DV(Basic)",
                },
                textPaths: ["CertificateType", "resourceSpecCode", "productSpecSysDesc"],
                mappings: [],
              },
              required: true,
            },
            {
              key: "certificateAuthority",
              extractor: {
                kind: "keyword-map",
                directPath: "CABrand",
                directMap: {
                  Digcert: "DigiCert",
                  Digicert: "DigiCert",
                  Geotrust: "GeoTrust",
                  GlobalSign: "Globalsign",
                },
                textPaths: ["CABrand", "resourceSpecCode", "productSpecSysDesc"],
                mappings: [],
              },
              required: true,
            },
            {
              key: "validityPeriodYears",
              extractor: {
                kind: "number-from-pattern",
                paths: ["resourceSpecCode", "PurchaseTime", "productSpecSysDesc"],
                pattern: "(\\d+)(?=$|\\D*$)",
              },
              required: true,
            },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "amount", extractor: { kind: "plan-amount", billingMode: "ONETIME", billingEvent: "event.type.onetime" }, required: true },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONETIME" } },
          ],
          dedupeBy: ["certificateType", "certificateAuthority", "validityPeriodYears"],
          sort: [
            { path: "certificateType", direction: "asc", order: ["OV", "OV Pro", "EV", "EV Pro", "DV", "DV(Basic)"] },
            { path: "certificateAuthority", direction: "asc", order: ["DigiCert", "Globalsign", "GeoTrust"] },
            { path: "validityPeriodYears", direction: "asc" },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "Certificate",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "ccm-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "typeOptions", value: ["SSL Certificates"] },
      { key: "type", value: call("resolveOption", ref("values.type"), ref("derived.typeOptions"), ref("helpers.ccmDefaults.type")) },
      { key: "certificateTypeOptions", value: ifElse(ref("catalog"), call("listCcmCertificateTypes", ref("catalog")), []) },
      { key: "certificateType", value: call("resolveOption", ref("values.certificateType"), ref("derived.certificateTypeOptions"), ref("helpers.ccmDefaults.certificateType")) },
      { key: "certificateAuthorityOptions", value: ifElse(ref("catalog"), call("listCcmAuthorities", ref("catalog"), ref("derived.certificateType")), []) },
      { key: "certificateAuthority", value: call("resolveOption", ref("values.certificateAuthority"), ref("derived.certificateAuthorityOptions"), ref("helpers.ccmDefaults.certificateAuthority")) },
      {
        key: "domainTypeOptions",
        value: ifElse(
          ref("catalog"),
          call("listCcmDomainTypes", ref("catalog"), { certificateType: ref("derived.certificateType"), certificateAuthority: ref("derived.certificateAuthority") }),
          [],
        ),
      },
      { key: "domainType", value: call("resolveOption", ref("values.domainType"), ref("derived.domainTypeOptions"), ref("helpers.ccmDefaults.domainType")) },
      {
        key: "validityPeriodOptions",
        value: ifElse(
          ref("catalog"),
          call("listCcmValidityPeriods", ref("catalog"), {
            certificateType: ref("derived.certificateType"),
            certificateAuthority: ref("derived.certificateAuthority"),
            domainType: ref("derived.domainType"),
          }),
          [],
        ),
      },
      { key: "validityPeriodYears", value: call("resolveNumberOption", ref("values.validityPeriodYears"), ref("derived.validityPeriodOptions"), ref("helpers.ccmDefaults.validityPeriodYears")) },
      { key: "domainQuantity", value: call("clampInteger", ref("values.domainQuantity"), 2) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateCcmConfiguration", ref("catalog"), {
            certificateType: ref("derived.certificateType"),
            certificateAuthority: ref("derived.certificateAuthority"),
            domainType: ref("derived.domainType"),
            validityPeriodYears: ref("derived.validityPeriodYears"),
            domainQuantity: ref("derived.domainQuantity"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      type: ref("derived.type"),
      certificateType: ref("derived.certificateType"),
      certificateAuthority: ref("derived.certificateAuthority"),
      domainType: ref("derived.domainType"),
      validityPeriodYears: ref("derived.validityPeriodYears"),
      domainQuantity: ref("derived.domainQuantity"),
      quantity: ref("derived.quantity"),
    },
    activeBillingOptions: ["One-time"],
    fieldRuntime: {
      type: { options: call("optionList", ref("derived.typeOptions")) },
      certificateType: { options: call("optionList", ref("derived.certificateTypeOptions")) },
      certificateAuthority: { options: call("optionList", ref("derived.certificateAuthorityOptions")) },
      domainType: { options: call("optionList", ref("derived.domainTypeOptions")) },
      validityPeriodYears: { options: call("optionList", ref("derived.validityPeriodOptions")) },
      domainQuantity: { min: 2, normalize: ref("derived.domainQuantity") },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "Cloud Certificate & Manager pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {certificateType} | {certificateAuthority} | {domainType} | {years} | {quantity} | {estimate}", {
        certificateType: ref("derived.certificateType"),
        certificateAuthority: ref("derived.certificateAuthority"),
        domainType: ifElse(
          eq(ref("derived.domainType"), "Multiple domains"),
          template("{domains} domains", { domains: ref("derived.domainQuantity") }),
          ref("derived.domainType"),
        ),
        years: template("{years} year{suffix}", {
          years: ref("derived.validityPeriodYears"),
          suffix: ifElse(eq(ref("derived.validityPeriodYears"), 1), "", "s"),
        }),
        quantity: template("{quantity} certificate{suffix}", {
          quantity: ref("derived.quantity"),
          suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s"),
        }),
        estimate: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
      }),
      "Selected specifications:",
    ),
    selectionNotes: ifElse(
      ref("derived.estimate"),
      call("concatArrays", call("formatBreakdownNotes", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")), ref("derived.estimate.notes")),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud Certificate & Manager calculator API for {region}. Sources: {pricingUrl}, {productUrl}, and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.ccmPricingReference.pricingUrl"),
        productUrl: ref("helpers.ccmPricingReference.productUrl"),
        calculatorApi: ref("helpers.ccmPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "ccm",
        title: template("{service} {certificateType} {domainType}", {
          service: ref("selectedService"),
          certificateType: ref("derived.certificateType"),
          domainType: ref("derived.domainType"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: "One-time",
          type: ref("derived.type"),
          certificateType: ref("derived.certificateType"),
          certificateAuthority: ref("derived.certificateAuthority"),
          domainType: ref("derived.domainType"),
          validityPeriodYears: ref("derived.validityPeriodYears"),
          domainQuantity: ifElse(eq(ref("derived.domainType"), "Multiple domains"), ref("derived.domainQuantity"), null),
          quantity: ref("derived.quantity"),
          resourceSpecCode: ref("derived.estimate.tier.resourceSpecCode"),
          baseProductId: ref("derived.estimate.tier.productId"),
          additionalDomainProductId: coalesce(ref("derived.estimate.additionalDomainTier.productId"), null),
        },
        pricing: {
          total: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
          estimate: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
          breakdown: call("byLabelAmount", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")),
        },
      },
      null,
    ),
    hydrate: ifElse(
      and(call("isRecord", ref("product.config")), eq(ref("product.productType"), "ccm")),
      {
        handled: true,
        values: {
          type: coalesce(ref("product.config.type"), ref("helpers.ccmDefaults.type")),
          certificateType: coalesce(ref("product.config.certificateType"), ref("helpers.ccmDefaults.certificateType")),
          certificateAuthority: coalesce(ref("product.config.certificateAuthority"), ref("helpers.ccmDefaults.certificateAuthority")),
          domainType: coalesce(ref("product.config.domainType"), ref("helpers.ccmDefaults.domainType")),
          validityPeriodYears: call("integerString", ref("product.config.validityPeriodYears"), ref("helpers.ccmDefaults.validityPeriodYears"), 1, 3),
          domainQuantity: call("integerString", ref("product.config.domainQuantity"), ref("helpers.ccmDefaults.domainQuantity"), 2),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.ccmDefaults.quantity"), 1),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
        nextBillingMode: "One-time",
      },
      {
        handled: false,
        error: "This product cannot be edited from the calculator.",
      },
    ),
  },
} as const satisfies ConfigurableServiceBundleDefinition;

export const pricing = pricingDefinition;
export const service = serviceDefinition;
