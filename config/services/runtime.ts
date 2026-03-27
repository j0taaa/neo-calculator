import type { DeclarativeRuntimeDefinition } from "@/lib/declarative-service-runtime-types";

export const configurableRuntimeDefinitions: Partial<Record<string, DeclarativeRuntimeDefinition>> = {
  CCE: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "cce-pricing" },
    catalogViewExpression: `(() => {
      const activeCatalog = catalog ?? helpers.getFallbackCcePricingCatalog();
      const clusterScaleOptions = helpers.listCceClusterScales(activeCatalog);
      const clusterScale = clusterScaleOptions.includes(values.clusterScale) ? values.clusterScale : (clusterScaleOptions[0] ?? helpers.cceDefaults.scale);
      const masterNodeOptions = helpers.listCceMasterNodes(clusterScale, activeCatalog);
      const masterNodes = masterNodeOptions.includes(values.masterNodes) ? values.masterNodes : (masterNodeOptions[0] ?? helpers.cceDefaults.masterNodes);
      const estimate = helpers.estimateCceConfiguration(activeCatalog, {
        scale: clusterScale,
        masterNodes,
        billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly',
        usageHours: billingMode === 'Pay-per-use' ? usageHoursValue : null,
      });
      return { activeCatalog, clusterScaleOptions, clusterScale, masterNodeOptions, masterNodes, estimate };
    })()`,
    syncValuesExpression: `({ clusterScale: catalogView.clusterScale, masterNodes: catalogView.masterNodes })`,
    fieldRuntime: {
      clusterScale: { optionsExpression: "helpers.optionList(catalogView.clusterScaleOptions)" },
      masterNodes: { optionsExpression: "helpers.optionList(catalogView.masterNodeOptions)" },
    },
    estimateExpression: "catalogView.estimate",
    selectionSummaryExpression: "catalogView.estimate ? `Selected specifications: ${catalogView.clusterScale} | ${catalogView.masterNodes} | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : 'Selected specifications:'",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud CCE calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Source: ${helpers.ccePricingReference.pricingUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'cce',
      title: \`\${selectedService} \${catalogView.clusterScale} \${catalogView.masterNodes}\`,
      quantity: instanceCountValue,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode,
        clusterScale: catalogView.clusterScale,
        masterNodes: catalogView.masterNodes,
        usageHours: billingMode === 'Pay-per-use' ? usageHoursValue : null,
        resourceSpecCode: catalogView.estimate.tier.resourceSpecCode ?? null,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount * instanceCountValue, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'cce' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          clusterScale: typeof product.config.clusterScale === 'string' ? product.config.clusterScale : helpers.cceDefaults.scale,
          masterNodes: product.config.masterNodes === 'Single' ? 'Single' : '3 Masters',
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
        nextUsageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })()`,
  },
  CCI: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    showSharedUsageHoursExpression: "true",
    fieldRuntime: {
      cpu: {
        minExpression: "1",
        normalizeExpression: "helpers.clampInteger(values.cpu || 1, 1)",
      },
      memoryGiB: {
        minExpression: "1",
        normalizeExpression: "helpers.clampInteger(values.memoryGiB || 1, 1)",
      },
    },
    selectionSummaryExpression: "`Selected specifications: ${helpers.clampInteger(values.cpu || 1, 1)} vCPU | ${helpers.clampInteger(values.memoryGiB || 1, 1)} GiB`",
    buildRequestBodiesExpression: `({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'cci',
      title: \`\${selectedService} \${helpers.clampInteger(values.cpu || 1, 1)} vCPU \${helpers.clampInteger(values.memoryGiB || 1, 1)} GiB\`,
      quantity: instanceCountValue,
      config: {
        region: regionValue,
        billingMode,
        cpu: helpers.clampInteger(values.cpu || 1, 1),
        memoryGiB: helpers.clampInteger(values.memoryGiB || 1, 1),
        usageHours: billingMode === 'Pay-per-use' ? usageHoursValue : null,
      },
      pricing: { total: 'USD 0.00' },
    })`,
    hydrateExpression: `(() => {
      if (product.productType !== 'cci' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          cpu: typeof product.config.cpu === 'number' ? String(Math.max(1, Math.floor(product.config.cpu))) : '1',
          memoryGiB: typeof product.config.memoryGiB === 'number' ? String(Math.max(1, Math.floor(product.config.memoryGiB))) : '1',
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
        nextUsageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })()`,
  },
  DCS: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "dcs-pricing" },
    showSharedUsageHoursExpression: "false",
    catalogViewExpression: `(() => {
      const versionOptions = catalog ? helpers.listDcsVersions(catalog) : ['7.0', '6.0', '5.0', '4.0'];
      const version = versionOptions.includes(values.version) ? values.version : (versionOptions[0] ?? helpers.dcsDefaults.version);
      const instanceTypeOptions = catalog ? helpers.listDcsInstanceTypes(catalog, version) : ['Single-node', 'Master/Standby', 'Redis Cluster'];
      const instanceType = instanceTypeOptions.includes(values.instanceType) ? values.instanceType : (instanceTypeOptions[0] ?? helpers.dcsDefaults.instanceType);
      const architectureOptions = catalog ? helpers.listDcsArchitectures(catalog, { version, instanceType }) : ['x86 | DRAM', 'ARM | DRAM'];
      const architecture = architectureOptions.includes(values.architecture) ? values.architecture : (architectureOptions[0] ?? helpers.dcsDefaults.architecture);
      const showReplicas = instanceType !== 'Single-node';
      const replicaOptions = catalog ? helpers.listDcsReplicas(catalog, { version, instanceType, architecture }) : (instanceType === 'Master/Standby' ? [2, 3, 4, 5] : instanceType === 'Redis Cluster' ? [1, 2, 3, 4, 6] : []);
      const replicas = showReplicas ? (replicaOptions.includes(Number(values.replicas)) ? Number(values.replicas) : (replicaOptions[0] ?? helpers.dcsDefaults.replicas)) : null;
      const specificationOptions = catalog ? helpers.listDcsSpecifications(catalog, { version, instanceType, architecture, replicas }) : (instanceType === 'Redis Cluster' ? ['4 GB', '8 GB', '16 GB', '32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1024 GB'] : ['0.125 GB', '0.25 GB', '0.5 GB', '1 GB', '2 GB', '4 GB', '8 GB', '16 GB', '32 GB', '64 GB']);
      const specification = specificationOptions.includes(String(values.specification)) ? String(values.specification) : (specificationOptions[0] ?? helpers.dcsDefaults.specification);
      const quantity = helpers.clampInteger(values.quantity || 1, 1);
      const elasticBandwidth = values.elasticBandwidth === 'Buy later' ? 'Buy later' : 'Buy now';
      const bandwidthMbit = helpers.clampInteger(values.bandwidthMbit || 1, 1);
      const dcsUsageHoursValue = helpers.clampInteger(values.usageHours || 744, 1, 87600);
      const estimate = catalog ? helpers.estimateDcsConfiguration(catalog, { edition: 'Basic', version, instanceType, architecture, replicas, specification, quantity, elasticBandwidth, bandwidthMbit, usageHours: dcsUsageHoursValue }) : null;
      return { versionOptions, version, instanceTypeOptions, instanceType, architectureOptions, architecture, showReplicas, replicaOptions, replicas, specificationOptions, specification, quantity, elasticBandwidth, bandwidthMbit, dcsUsageHoursValue, estimate };
    })()`,
    syncValuesExpression: `({
      edition: 'Basic',
      version: catalogView.version,
      instanceType: catalogView.instanceType,
      architecture: catalogView.architecture,
      replicas: String(catalogView.replicas ?? helpers.dcsDefaults.replicas),
      specification: catalogView.specification,
      quantity: String(catalogView.quantity),
      elasticBandwidth: catalogView.elasticBandwidth,
      bandwidthMbit: String(catalogView.bandwidthMbit),
      usageHours: String(catalogView.dcsUsageHoursValue),
    })`,
    visibilityContextExpression: `({ showReplicas: catalogView.showReplicas, elasticBandwidth: catalogView.elasticBandwidth })`,
    fieldRuntime: {
      edition: { disabledExpression: "true" },
      version: { optionsExpression: "helpers.optionList(catalogView.versionOptions)" },
      instanceType: { optionsExpression: "helpers.optionList(catalogView.instanceTypeOptions)" },
      architecture: { optionsExpression: "helpers.optionList(catalogView.architectureOptions)" },
      replicas: { optionsExpression: "helpers.optionList(catalogView.replicaOptions)" },
      specification: { optionsExpression: "helpers.optionList(catalogView.specificationOptions)" },
      quantity: { minExpression: "1", normalizeExpression: "helpers.clampInteger(values.quantity || 1, 1)" },
      bandwidthMbit: { minExpression: "1", normalizeExpression: "helpers.clampInteger(values.bandwidthMbit || 1, 1)" },
      usageHours: { minExpression: "1", maxExpression: "87600", normalizeExpression: "helpers.clampInteger(values.usageHours || 744, 1, 87600)" },
    },
    estimateExpression: "catalogView.estimate",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'DCS pricing is unavailable for the current selection.')",
    selectionSummaryExpression: "`Selected specifications: Basic | ${catalogView.version} | ${catalogView.instanceType} | ${catalogView.architecture}${catalogView.showReplicas && catalogView.replicas != null ? ` | ${catalogView.replicas} replicas` : ''} | ${catalogView.specification} | ${catalogView.quantity} instance${catalogView.quantity === 1 ? '' : 's'} | ${catalogView.elasticBandwidth}${catalogView.elasticBandwidth === 'Buy now' ? ` ${catalogView.bandwidthMbit} Mbit/s` : ''} | ${catalogView.dcsUsageHoursValue}h${catalogView.estimate ? ` | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : ''}`",
    selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), `Monthly average: ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo')}.`, ...helpers.asArray(catalogView.estimate.notes)] : []",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud DCS calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.dcsPricingReference.pricingUrl} and ${helpers.dcsPricingReference.productUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'dcs',
      title: \`\${selectedService} \${catalogView.version} \${catalogView.instanceType} \${catalogView.specification}\`,
      quantity: 1,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: 'Pay-per-use',
        edition: 'Basic',
        version: catalogView.version,
        instanceType: catalogView.instanceType,
        architecture: catalogView.architecture,
        replicas: catalogView.showReplicas ? catalogView.replicas : null,
        specification: catalogView.specification,
        quantity: catalogView.quantity,
        elasticBandwidth: catalogView.elasticBandwidth,
        bandwidthMbit: catalogView.elasticBandwidth === 'Buy now' ? catalogView.bandwidthMbit : null,
        usageHours: catalogView.dcsUsageHoursValue,
        resourceSpecCode: catalogView.estimate.tier.resourceSpecCode,
        productId: catalogView.estimate.tier.productIds.ONDEMAND ?? null,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
        breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'dcs' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          edition: 'Basic',
          version: typeof product.config.version === 'string' ? product.config.version : helpers.dcsDefaults.version,
          instanceType: typeof product.config.instanceType === 'string' ? product.config.instanceType : helpers.dcsDefaults.instanceType,
          architecture: typeof product.config.architecture === 'string' ? product.config.architecture : helpers.dcsDefaults.architecture,
          replicas: typeof product.config.replicas === 'number' ? String(product.config.replicas) : String(helpers.dcsDefaults.replicas),
          specification: typeof product.config.specification === 'string' ? product.config.specification : helpers.dcsDefaults.specification,
          quantity: typeof product.config.quantity === 'number' ? String(Math.max(1, Math.floor(product.config.quantity))) : String(helpers.dcsDefaults.quantity),
          elasticBandwidth: product.config.elasticBandwidth === 'Buy later' ? 'Buy later' : 'Buy now',
          bandwidthMbit: typeof product.config.bandwidthMbit === 'number' ? String(Math.max(1, Math.floor(product.config.bandwidthMbit))) : String(helpers.dcsDefaults.bandwidthMbit),
          usageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : String(helpers.dcsDefaults.usageHours),
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
      };
    })()`,
  },
  ModelArts: {
    quantityLabel: "Configuration",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "modelarts-pricing" },
    showSharedUsageHoursExpression: "false",
    catalogViewExpression: `(() => {
      const resourceTypeOptions = catalog ? helpers.listModelArtsResourceTypes(catalog, billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use') : (billingMode === 'Yearly/Monthly' ? ['Dedicated Resource Pool'] : ['Public Resource Pool', 'Dedicated Resource Pool', 'EVS Storage']);
      const resourceType = resourceTypeOptions.includes(values.resourceType) ? values.resourceType : (resourceTypeOptions[0] ?? helpers.modelArtsDefaults.resourceType);
      const specificationOptions = catalog ? helpers.listModelArtsSpecifications(catalog, { billingMode: billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use', resourceType }) : [helpers.modelArtsDefaults.specification];
      const specification = specificationOptions.includes(values.specification) ? values.specification : (specificationOptions[0] ?? helpers.modelArtsDefaults.specification);
      const quantity = helpers.clampInteger(values.quantity || 1, 1);
      const storageQuotaGb = helpers.clampNumber(values.storageQuotaGb || 1, 1);
      const durationMonths = [1,2,3,4,5,6,7,8,9,12].includes(Number(values.durationMonths)) ? Number(values.durationMonths) : helpers.modelArtsDefaults.durationMonths;
      const estimate = catalog ? helpers.estimateModelArtsConfiguration(catalog, { billingMode: billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use', serviceType: 'AI Development Lifecycle', resourceType, specification, quantity, storageQuotaGb, usageHours: usageHoursValue, durationMonths }) : null;
      return { resourceTypeOptions, resourceType, specificationOptions, specification, quantity, storageQuotaGb, durationMonths, estimate };
    })()`,
    syncValuesExpression: "({ serviceType: 'AI Development Lifecycle', resourceType: catalogView.resourceType, specification: catalogView.specification, quantity: String(catalogView.quantity), storageQuotaGb: String(catalogView.storageQuotaGb), durationMonths: String(catalogView.durationMonths), usageHours: String(usageHoursValue) })",
    fieldRuntime: {
      serviceType: { disabledExpression: "true" },
      resourceType: { optionsExpression: "helpers.optionList(catalogView.resourceTypeOptions)" },
      specification: { optionsExpression: "helpers.optionList(catalogView.specificationOptions)" },
      quantity: { minExpression: "1", normalizeExpression: "helpers.clampInteger(values.quantity || 1, 1)" },
      storageQuotaGb: { minExpression: "1", normalizeExpression: "helpers.clampNumber(values.storageQuotaGb || 1, 1)" },
      usageHours: { minExpression: "1", maxExpression: "87600", normalizeExpression: "helpers.clampInteger(values.usageHours || 744, 1, 87600)" },
    },
    estimateExpression: "catalogView.estimate",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'ModelArts pricing is unavailable for the current selection.')",
    selectionSummaryExpression: "`Selected specifications: AI Development Lifecycle | ${catalogView.resourceType} | ${catalogView.specification}${catalogView.resourceType === 'EVS Storage' ? ` | ${catalogView.storageQuotaGb} GB` : ` | ${catalogView.quantity} instance${catalogView.quantity === 1 ? '' : 's'}`}${billingMode === 'Yearly/Monthly' ? ` | ${catalogView.durationMonths === 12 ? '1yr' : `${catalogView.durationMonths}mo`}` : ` | ${usageHoursValue}h`}${catalogView.estimate ? ` | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : ''}`",
    selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), `Monthly average: ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo')}.`, ...helpers.asArray(catalogView.estimate.notes)] : []",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud ModelArts calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.modelArtsPricingReference.pricingUrl} and ${helpers.modelArtsPricingReference.productUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'modelarts',
      title: \`\${selectedService} \${catalogView.resourceType} \${catalogView.specification}\`,
      quantity: 1,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
        serviceType: 'AI Development Lifecycle',
        resourceType: catalogView.resourceType,
        specification: catalogView.specification,
        quantity: catalogView.resourceType === 'EVS Storage' ? null : catalogView.quantity,
        storageQuotaGb: catalogView.resourceType === 'EVS Storage' ? catalogView.storageQuotaGb : null,
        usageHours: billingMode === 'Pay-per-use' ? usageHoursValue : null,
        durationMonths: billingMode === 'Yearly/Monthly' ? catalogView.durationMonths : null,
        resourceSpecCode: catalogView.estimate.tier.resourceSpecCode,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
        breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'modelarts' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          serviceType: 'AI Development Lifecycle',
          resourceType: typeof product.config.resourceType === 'string' ? product.config.resourceType : helpers.modelArtsDefaults.resourceType,
          specification: typeof product.config.specification === 'string' ? product.config.specification : helpers.modelArtsDefaults.specification,
          quantity: typeof product.config.quantity === 'number' ? String(Math.max(1, Math.floor(product.config.quantity))) : String(helpers.modelArtsDefaults.quantity),
          storageQuotaGb: typeof product.config.storageQuotaGb === 'number' ? String(Math.max(1, product.config.storageQuotaGb)) : String(helpers.modelArtsDefaults.storageQuotaGb),
          durationMonths: typeof product.config.durationMonths === 'number' ? String(product.config.durationMonths) : String(helpers.modelArtsDefaults.durationMonths),
          usageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : usageHours,
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
        nextUsageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : usageHours,
        nextInstanceCount: '1',
      };
    })()`,
  },
  NAT: {
    quantityLabel: "Gateway",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "nat-pricing" },
    catalogViewExpression: `(() => {
      const activeCatalog = catalog ?? helpers.getFallbackNatPricingCatalog();
      const natTypeOptions = helpers.listNatGatewayTypes(activeCatalog);
      const natType = natTypeOptions.includes(values.natType) ? values.natType : helpers.natDefaults.type;
      const natSizeOptions = helpers.listNatGatewaySizes(natType, activeCatalog);
      const natSize = natSizeOptions.includes(values.natSize) ? values.natSize : (natSizeOptions[0] ?? helpers.natDefaults.size);
      const estimate = helpers.estimateNatConfiguration(activeCatalog, { type: natType, size: natSize, billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly', usageHours: usageHoursValue });
      return { activeCatalog, natTypeOptions, natType, natSizeOptions, natSize, estimate };
    })()`,
    syncValuesExpression: "({ natType: catalogView.natType, natSize: catalogView.natSize })",
    activeBillingOptionsExpression: "catalogView.natType === 'Public NAT Gateway' ? ['Pay-per-use', 'Yearly/Monthly'] : ['Pay-per-use']",
    fieldRuntime: {
      natType: { optionsExpression: "helpers.optionList(catalogView.natTypeOptions)" },
      natSize: { optionsExpression: "helpers.optionList(catalogView.natSizeOptions)" },
    },
    estimateExpression: "catalogView.estimate",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'NAT pricing is unavailable for the current selection.')",
    selectionSummaryExpression: "catalogView.estimate ? `Selected specifications: ${catalogView.natType} | ${catalogView.natSize} | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : 'Selected specifications:'",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud NAT calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.natPricingReference.pricingUrl} and ${helpers.natPricingReference.specsUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'nat',
      title: \`\${selectedService} \${catalogView.natType} \${catalogView.natSize}\`,
      quantity: instanceCountValue,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly',
        type: catalogView.natType,
        size: catalogView.natSize,
        resourceSpecCode: catalogView.estimate.tier.resourceSpecCode,
        usageHours: billingMode === 'Pay-per-use' ? usageHoursValue : null,
        billableDays: catalogView.estimate.billableDays,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount * instanceCountValue, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'nat' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          natType: product.config.type === 'Private NAT Gateway' ? 'Private NAT Gateway' : 'Public NAT Gateway',
          natSize: ['Small', 'Medium', 'Large', 'Extra-large'].includes(product.config.size) ? product.config.size : 'Small',
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
        nextUsageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })()`,
  },
  EIP: {
    quantityLabel: "EIP",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "eip-pricing" },
    catalogViewExpression: `(() => {
      const type = values.type === 'Shared EIP' ? 'Shared EIP' : 'Dedicated EIP';
      const chargeModeOptions = type === 'Shared EIP' ? ['By bandwidth', 'Enhanced 95'] : ['By bandwidth', 'By traffic'];
      const chargeMode = chargeModeOptions.includes(values.chargeMode) ? values.chargeMode : 'By bandwidth';
      const showBandwidth = chargeMode === 'By bandwidth' || chargeMode === 'Enhanced 95';
      const showTraffic = type === 'Dedicated EIP' && chargeMode === 'By traffic';
      const showEnhanced95DurationMonths = type === 'Shared EIP' && chargeMode === 'Enhanced 95';
      const showSharedBandwidthQuantity = type === 'Shared EIP' && chargeMode === 'By bandwidth';
      const bandwidthMinimumMbit = type === 'Shared EIP' ? (chargeMode === 'Enhanced 95' ? helpers.eipSharedEnhanced95MinimumMbit : helpers.eipSharedBandwidthMinimumMbit) : 1;
      const bandwidthMbit = showBandwidth ? Math.max(bandwidthMinimumMbit, helpers.normalizeObsPositiveNumber(values.bandwidthMbit, bandwidthMinimumMbit, 0)) : 0;
      const enhanced95DurationMonths = Math.max(1, Math.floor(helpers.normalizeObsPositiveNumber(values.enhanced95DurationMonths, 1, 1)));
      const sharedBandwidthQuantity = Math.max(1, Math.floor(helpers.normalizeObsPositiveNumber(values.sharedBandwidthQuantity, 1, 1)));
      const trafficAmount = helpers.normalizeObsPositiveNumber(values.trafficAmount, 0, 0);
      const trafficUnit = values.trafficUnit === 'TB' ? 'TB' : 'GB';
      const estimate = catalog ? helpers.estimateEipConfiguration(catalog, { type, chargeMode, billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly', durationHours: usageHoursValue, durationMonths: showEnhanced95DurationMonths ? enhanced95DurationMonths : 1, bandwidthMbit, sharedBandwidthQuantity: showSharedBandwidthQuantity ? sharedBandwidthQuantity : 1, trafficAmount: showTraffic ? trafficAmount : 0, trafficUnit }) : null;
      return { type, chargeModeOptions, chargeMode, showBandwidth, showTraffic, showEnhanced95DurationMonths, showSharedBandwidthQuantity, bandwidthMinimumMbit, bandwidthMbit, enhanced95DurationMonths, sharedBandwidthQuantity, trafficAmount, trafficUnit, estimate };
    })()`,
    syncValuesExpression: `({
      type: catalogView.type,
      chargeMode: catalogView.chargeMode,
      bandwidthMbit: String(catalogView.bandwidthMbit),
      enhanced95DurationMonths: String(catalogView.enhanced95DurationMonths),
      sharedBandwidthQuantity: String(catalogView.sharedBandwidthQuantity),
      trafficAmount: String(catalogView.trafficAmount),
      trafficUnit: catalogView.trafficUnit,
    })`,
    visibilityContextExpression: `({
      showBandwidth: catalogView.showBandwidth,
      showTraffic: catalogView.showTraffic,
    })`,
    activeBillingOptionsExpression: "catalogView.type === 'Dedicated EIP' && catalogView.chargeMode === 'By bandwidth' ? ['Pay-per-use', 'Yearly/Monthly'] : ['Pay-per-use']",
    showSharedUsageHoursExpression: "!catalogView.showEnhanced95DurationMonths",
    fieldRuntime: {
      chargeMode: { optionsExpression: "helpers.optionList(catalogView.chargeModeOptions)" },
      bandwidthMbit: { minExpression: "catalogView.bandwidthMinimumMbit", normalizeExpression: "String(catalogView.bandwidthMbit)" },
      enhanced95DurationMonths: { minExpression: "1", normalizeExpression: "String(catalogView.enhanced95DurationMonths)" },
      sharedBandwidthQuantity: { minExpression: "1", normalizeExpression: "String(catalogView.sharedBandwidthQuantity)" },
      trafficAmount: { minExpression: "0", normalizeExpression: "String(catalogView.trafficAmount)" },
    },
    estimateExpression: "catalogView.estimate",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'EIP pricing is unavailable for the current selection.')",
    selectionSummaryExpression: "catalogView.estimate ? `Selected specifications: ${catalogView.type} | Dynamic BGP | ${catalogView.chargeMode}${catalogView.showBandwidth ? ` | ${catalogView.bandwidthMbit} Mbit/s` : ''}${catalogView.showEnhanced95DurationMonths ? ` | ${catalogView.enhanced95DurationMonths}mo` : ''}${catalogView.showSharedBandwidthQuantity ? ` | ${catalogView.sharedBandwidthQuantity} shared bandwidth${catalogView.sharedBandwidthQuantity === 1 ? '' : 's'}` : ''}${catalogView.showTraffic ? ` | ${catalogView.trafficAmount} ${catalogView.trafficUnit}` : ''} | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : 'Selected specifications:'",
    selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), `Monthly average: ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo')}.`, ...helpers.asArray(catalogView.estimate.notes)] : []",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud EIP calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Source: ${helpers.eipPricingReference.pricingUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'eip',
      title: \`\${selectedService} \${catalogView.type} Dynamic BGP \${catalogView.chargeMode}\`,
      quantity: instanceCountValue,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly',
        type: catalogView.type,
        eipType: 'Dynamic BGP',
        chargeMode: catalogView.chargeMode,
        bandwidthMbit: catalogView.showBandwidth ? catalogView.bandwidthMbit : null,
        durationMonths: catalogView.showEnhanced95DurationMonths ? catalogView.enhanced95DurationMonths : null,
        sharedBandwidthQuantity: catalogView.showSharedBandwidthQuantity ? catalogView.sharedBandwidthQuantity : null,
        trafficAmount: catalogView.showTraffic ? catalogView.trafficAmount : null,
        trafficUnit: catalogView.showTraffic ? catalogView.trafficUnit : null,
        usageHours: billingMode === 'Pay-per-use' && !catalogView.showEnhanced95DurationMonths ? usageHoursValue : null,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount * instanceCountValue, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
        breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'eip' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          type: product.config.type === 'Shared EIP' ? 'Shared EIP' : 'Dedicated EIP',
          chargeMode: product.config.chargeMode === 'By traffic' || product.config.chargeMode === 'Enhanced 95' ? product.config.chargeMode : 'By bandwidth',
          bandwidthMbit: typeof product.config.bandwidthMbit === 'number' ? String(product.config.bandwidthMbit) : String(helpers.eipDefaults.bandwidthMbit),
          enhanced95DurationMonths: typeof product.config.durationMonths === 'number' ? String(product.config.durationMonths) : '1',
          sharedBandwidthQuantity: typeof product.config.sharedBandwidthQuantity === 'number' ? String(product.config.sharedBandwidthQuantity) : '1',
          trafficAmount: typeof product.config.trafficAmount === 'number' ? String(product.config.trafficAmount) : '0',
          trafficUnit: product.config.trafficUnit === 'TB' ? 'TB' : 'GB',
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
        nextUsageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })()`,
  },
  EVS: {
    quantityLabel: "Volume",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: false,
    catalog: { route: "evs-pricing", loadingMessage: "Loading EVS pricing..." },
    showSharedUsageHoursExpression: "false",
    catalogViewExpression: `(() => {
      const diskType = helpers.systemDiskOptions.includes(values.diskType) ? values.diskType : 'General Purpose SSD';
      const evsBillingMode = values.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use';
      const diskSizeGiB = Number.isFinite(Number(values.diskSizeGiB)) ? Math.max(helpers.evsDiskSizeBounds.min, Number(values.diskSizeGiB)) : helpers.evsDiskSizeBounds.min;
      const isGpSsd2Selected = diskType === 'General Purpose SSD V2';
      const gpSsd2IopsValue = isGpSsd2Selected ? helpers.normalizeGpSsd2Iops(values.iops, diskSizeGiB) : null;
      const gpSsd2IopsRange = isGpSsd2Selected ? helpers.getGpSsd2IopsBounds(diskSizeGiB) : null;
      const gpSsd2ThroughputValue = isGpSsd2Selected && gpSsd2IopsValue != null ? helpers.normalizeGpSsd2Throughput(values.throughput, gpSsd2IopsValue) : null;
      const gpSsd2ThroughputRange = isGpSsd2Selected && gpSsd2IopsValue != null ? helpers.getGpSsd2ThroughputBounds(gpSsd2IopsValue) : null;
      const durationMonths = Math.max(1, Math.floor(helpers.normalizeObsPositiveNumber(values.durationMonths, 1, 1)));
      const selectedDiskPrice = catalog ? helpers.getDiskPriceForBillingOption(catalog, diskType, diskSizeGiB, evsBillingMode, usageHoursValue, durationMonths) : null;
      return { diskType, evsBillingMode, diskSizeGiB, isGpSsd2Selected, gpSsd2IopsValue, gpSsd2IopsRange, gpSsd2ThroughputValue, gpSsd2ThroughputRange, durationMonths, selectedDiskPrice, splitNotice: helpers.buildEvsSplitNotice(diskSizeGiB) };
    })()`,
    syncValuesExpression: "({ billingMode: catalogView.evsBillingMode, diskType: catalogView.diskType, diskSizeGiB: String(catalogView.diskSizeGiB), usageHours: String(usageHoursValue), durationMonths: String(catalogView.durationMonths), iops: String(catalogView.gpSsd2IopsValue ?? 3000), throughput: String(catalogView.gpSsd2ThroughputValue ?? 125) })",
    fieldRuntime: {
      billingMode: { optionsExpression: "helpers.optionList(['Pay-per-use', 'Yearly/Monthly'])" },
      diskType: { optionsExpression: "helpers.optionList(helpers.systemDiskOptions)" },
      diskSizeGiB: { minExpression: "helpers.evsDiskSizeBounds.min", maxExpression: "helpers.evsDiskSizeBounds.max", normalizeExpression: "String(catalogView.diskSizeGiB)" },
      usageHours: { minExpression: "1", maxExpression: "87600", normalizeExpression: "String(Math.max(1, usageHoursValue))" },
      durationMonths: { minExpression: "1", normalizeExpression: "String(catalogView.durationMonths)" },
      iops: { minExpression: "catalogView.gpSsd2IopsRange?.min", maxExpression: "catalogView.gpSsd2IopsRange?.max", normalizeExpression: "catalogView.gpSsd2IopsValue == null ? values.iops : String(catalogView.gpSsd2IopsValue)" },
      throughput: { minExpression: "catalogView.gpSsd2ThroughputRange?.min", maxExpression: "catalogView.gpSsd2ThroughputRange?.max", normalizeExpression: "catalogView.gpSsd2ThroughputValue == null ? values.throughput : String(catalogView.gpSsd2ThroughputValue)" },
    },
    panelNotesExpression: "[(catalogView.isGpSsd2Selected ? 'Current estimate reflects capacity pricing only. Additional GPSSD2 IOPS and throughput charges are not modeled yet.' : null), `A single EVS disk can be up to 32768 GiB. Entering a larger total will save multiple disks: 32768 GiB chunks plus one final remainder disk.`, catalogView.splitNotice].filter(Boolean)",
    estimateExpression: "catalogView.selectedDiskPrice ? { currency: catalogView.selectedDiskPrice.currency, amount: catalogView.selectedDiskPrice.amount * instanceCountValue, suffix: catalogView.selectedDiskPrice.suffix, unitAmount: catalogView.selectedDiskPrice.amount } : null",
    addToListErrorExpression: "catalogView.selectedDiskPrice ? null : 'Select a volume type first.'",
    selectionSummaryExpression: "catalogView.selectedDiskPrice ? `Selected specifications: ${catalogView.diskType} | ${catalogView.diskSizeGiB} GiB | ${catalogView.evsBillingMode === 'Pay-per-use' ? `${usageHoursValue}h` : `${catalogView.durationMonths}mo`}${catalogView.isGpSsd2Selected && catalogView.gpSsd2IopsValue != null && catalogView.gpSsd2ThroughputValue != null ? ` | ${catalogView.gpSsd2IopsValue} IOPS | ${catalogView.gpSsd2ThroughputValue} MB/s` : ''} | Disk ${helpers.formatFlavorAmount(catalogView.selectedDiskPrice.currency, catalogView.selectedDiskPrice.amount, catalogView.selectedDiskPrice.suffix)}` : 'Selected specifications:'",
    selectionNotesExpression: "catalogView.splitNotice ? [catalogView.splitNotice] : []",
    addSuccessMessageExpression: "requestBodiesCount > 1 ? `Added ${requestBodiesCount} EVS disks to the list because totals above 32768 GiB are split into 32768 GiB chunks plus a final remainder disk.` : 'Product added to list.'",
    updateSuccessMessageExpression: "extraRequestBodiesCount > 0 ? `Product updated and split into ${requestBodiesCount} EVS disks because totals above 32768 GiB are saved in chunks.` : 'Product updated.'",
    batchSuccessMessageExpression: "expandedCount > 0 ? `Added ${createdCount} products to the list. ${expandedCount} extra EVS split disk${expandedCount === 1 ? '' : 's'} were created for sizes above 32768 GiB.` : (createdCount === 1 ? 'Added 1 product to the list.' : `Added ${createdCount} products to the list.`)",
    buildRequestBodiesExpression: `catalogView.selectedDiskPrice ? helpers.buildEvsProductMutationBodies({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      serviceTitle: selectedService,
      region: regionValue,
      billingMode,
      usageHours: usageHoursValue,
      durationMonths: catalogView.durationMonths,
      quantity: Math.max(1, instanceCountValue),
      description: selectedService,
      diskType: catalogView.diskType,
      diskSizeGiB: catalogView.diskSizeGiB,
      requestedIops: catalogView.isGpSsd2Selected ? catalogView.gpSsd2IopsValue : null,
      requestedThroughput: catalogView.isGpSsd2Selected ? catalogView.gpSsd2ThroughputValue : null,
      diskPricing: catalog,
    }) : null`,
    batchPanel: {
      placeholderExpression: "`[\\n  {\\n    \\\"size\\\": 40\\n  },\\n  {\\n    \\\"type\\\": \\\"Ultra-high I/O\\\",\\n    \\\"size\\\": 50000,\\n    \\\"durationMonths\\\": 6,\\n    \\\"quantity\\\": 2,\\n    \\\"description\\\": \\\"Database disks\\\"\\n  },\\n  {\\n    \\\"type\\\": \\\"General Purpose SSD V2\\\",\\n    \\\"size\\\": 800,\\n    \\\"iops\\\": 6000,\\n    \\\"throughput\\\": 250\\n  }\\n]`",
      descriptionExpression: "`Paste a JSON array of EVS volumes. Optional fields: type, size, durationMonths, quantity, description, iops, and throughput.`",
      defaultsExpression: "`If omitted, type defaults to ${catalogView.diskType} and size defaults to ${catalogView.diskSizeGiB} GiB. When using yearly/monthly EVS, durationMonths falls back to the active calculator value. Sizes above 32768 are split into multiple disks when saved. For General Purpose SSD V2, omitted iops and throughput use the minimum valid values.`",
      validationExpression: "`Each JSON item should resolve to a valid EVS disk type. When size is above 32768 GiB, it is saved as multiple disks: 32768 GiB chunks plus one final remainder disk. General Purpose SSD V2 accepts configurable iops and throughput values.`",
    },
    buildBatchRequestBodiesExpression: `(() => {
      const quantity = helpers.parseBatchQuantity(helpers.isRecord(item) ? item.quantity : undefined);
      const description = helpers.getBatchDescription(item, selectedService);
      const diskType = helpers.getBatchDiskType(item, catalogView.diskType);
      const diskSizeGiB = helpers.getBatchDiskSize(item, catalogView.diskSizeGiB, helpers.evsDiskSizeBounds);
      const rawDurationMonths = helpers.getNestedRecord(item, 'evs')?.durationMonths ?? helpers.getNestedRecord(item, 'evs')?.months ?? (helpers.isRecord(item) ? item.durationMonths : undefined) ?? (helpers.isRecord(item) ? item.months : undefined);
      const durationMonths = billingMode === 'Yearly/Monthly' ? Math.max(1, Math.floor(helpers.normalizeObsPositiveNumber(rawDurationMonths, catalogView.durationMonths, 1))) : catalogView.durationMonths;
      const requestedIops = diskType === 'General Purpose SSD V2' ? helpers.getGpSsd2RequestedIops(item, diskSizeGiB) : null;
      const requestedThroughput = diskType === 'General Purpose SSD V2' && requestedIops != null ? helpers.getGpSsd2RequestedThroughput(item, requestedIops) : null;
      return helpers.buildEvsProductMutationBodies({
        serviceCode: selectedServiceCode,
        serviceName: selectedService,
        serviceTitle: selectedService,
        region: regionValue,
        billingMode,
        usageHours: usageHoursValue,
        durationMonths,
        quantity,
        description,
        diskType,
        diskSizeGiB,
        requestedIops,
        requestedThroughput,
        diskPricing: catalog,
      });
    })()`,
    hydrateExpression: `(() => {
      if (product.productType !== 'evs' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      const systemDisk = helpers.isRecord(product.config.systemDisk) ? product.config.systemDisk : null;
      const diskSize = typeof product.config.diskSizeGiB === 'number' ? product.config.diskSizeGiB : (typeof systemDisk?.sizeGiB === 'number' ? systemDisk.sizeGiB : helpers.evsDiskSizeBounds.min);
      return {
        handled: true,
        values: {
          billingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
          diskType: helpers.systemDiskOptions.includes(product.config.diskType) ? product.config.diskType : (helpers.systemDiskOptions.includes(systemDisk?.type) ? systemDisk.type : 'High I/O'),
          diskSizeGiB: String(Math.max(helpers.evsDiskSizeBounds.min, Math.floor(diskSize))),
          usageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : '744',
          durationMonths: typeof product.config.durationMonths === 'number' ? String(Math.max(1, Math.floor(product.config.durationMonths))) : '1',
          iops: String(helpers.getGpSsd2RequestedIops(product.config, diskSize)),
          throughput: String(helpers.getGpSsd2RequestedThroughput(product.config, helpers.getGpSsd2RequestedIops(product.config, diskSize))),
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
        nextUsageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })()`,
  },
  ELB: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "elb-pricing" },
    showSharedUsageHoursExpression: "false",
    catalogViewExpression: `(() => {
      const type = values.type === 'Dedicated load balancer' ? 'Dedicated load balancer' : 'Shared load balancer';
      const specificationType = values.specificationType === 'Elastic' ? 'Elastic' : 'Fixed';
      const networkType = values.networkType === 'Private network' ? 'Private network' : 'Public network';
      const sharedChargeMode = values.sharedChargeMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic';
      const sharedBandwidthMbit = helpers.normalizeObsPositiveNumber(values.sharedBandwidthMbit, 0, 0);
      const sharedTrafficAmount = helpers.normalizeObsPositiveNumber(values.sharedTrafficAmount, 0, 0);
      const sharedTrafficUnit = values.sharedTrafficUnit === 'TB' ? 'TB' : 'GB';
      const fixedAvailabilityAzCountOptions = (() => {
        const rateSet = catalog?.dedicatedRates?.fixed?.[helpers.elbDefaults.subAz];
        if (!rateSet) return [String(helpers.elbDefaults.fixedAvailabilityAzCount)];
        const options = Object.keys(rateSet).map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((left, right) => left - right).map(String);
        return options.length > 0 ? options : [String(helpers.elbDefaults.fixedAvailabilityAzCount)];
      })();
      const fixedAvailabilityAzCount = Number.isFinite(Number(values.fixedAvailabilityAzCount)) ? Math.max(1, Math.floor(Number(values.fixedAvailabilityAzCount))) : Number(fixedAvailabilityAzCountOptions[0] ?? helpers.elbDefaults.fixedAvailabilityAzCount);
      const fixedNetworkEnabled = values.fixedNetworkEnabled === 'true';
      const fixedApplicationEnabled = values.fixedApplicationEnabled === 'true';
      const fixedNetworkSpec = helpers.elbFixedSpecOptions.includes(values.fixedNetworkSpec) ? values.fixedNetworkSpec : helpers.elbDefaults.fixedTypeSpecs['Network load balancing (TCP/UDP/TLS)'];
      const fixedApplicationSpec = helpers.elbFixedSpecOptions.includes(values.fixedApplicationSpec) ? values.fixedApplicationSpec : helpers.elbDefaults.fixedTypeSpecs['Application load balancing (HTTP/HTTPS)'];
      const showSharedChargeMode = helpers.shouldShowElbSharedChargeMode(type, networkType);
      const showSharedBandwidth = helpers.shouldShowElbSharedBandwidth(type, networkType, sharedChargeMode);
      const showSharedTraffic = helpers.shouldShowElbSharedTraffic(type, networkType, sharedChargeMode);
      const protocols = [
        { protocol: 'Network load balancing (TCP)', prefix: 'tcp' },
        { protocol: 'Network load balancing (UDP)', prefix: 'udp' },
        { protocol: 'Network load balancing (TLS)', prefix: 'tls' },
        { protocol: 'Application load balancing (HTTP/HTTPS)', prefix: 'http' },
      ].map(({ protocol, prefix }) => {
        const enabled = values[prefix + 'Enabled'] === 'true';
        const metricMode = values[prefix + 'MetricMode'] === 'By bandwidth' ? 'By bandwidth' : 'By traffic';
        return {
          protocol,
          prefix,
          enabled,
          input: {
            newConnections: helpers.normalizeObsPositiveNumber(values[prefix + 'NewConnections'], 0, 0),
            maxConcurrentConnections: helpers.normalizeObsPositiveNumber(values[prefix + 'MaxConcurrentConnections'], 0, 0),
            metricMode,
            processedTrafficGbPerHour: helpers.normalizeObsPositiveNumber(values[prefix + 'ProcessedTrafficGbPerHour'], 0, 0),
            averageBandwidthMbit: helpers.normalizeObsPositiveNumber(values[prefix + 'AverageBandwidthMbit'], 0, 0),
            queriesPerSecond: prefix === 'http' ? helpers.normalizeObsPositiveNumber(values.httpQueriesPerSecond, 0, 0) : 0,
            forwardingRules: prefix === 'http' ? helpers.normalizeObsPositiveNumber(values.httpForwardingRules, 0, 0) : 0,
          },
        };
      });
      const enabledProtocolPrefixes = protocols.filter((entry) => entry.enabled).map((entry) => entry.prefix);
      const normalizedFixedNetworkEnabled = type === 'Dedicated load balancer' && specificationType === 'Fixed' && !fixedNetworkEnabled && !fixedApplicationEnabled ? true : fixedNetworkEnabled;
      const normalizedFixedApplicationEnabled = type === 'Dedicated load balancer' && specificationType === 'Fixed' && !fixedNetworkEnabled && !fixedApplicationEnabled ? false : fixedApplicationEnabled;
      const normalizedProtocols = protocols.map((entry) => entry.prefix === 'tcp' && type === 'Dedicated load balancer' && specificationType === 'Elastic' && enabledProtocolPrefixes.length === 0 ? { ...entry, enabled: true } : entry);
      const selectedProtocols = normalizedProtocols.filter((entry) => entry.enabled).map((entry) => entry.protocol);
      const protocolInputs = Object.fromEntries(normalizedProtocols.map((entry) => [entry.protocol, entry.input]));
      const estimateInput = {
        type,
        specificationType,
        subAz: helpers.elbDefaults.subAz,
        fixedAvailabilityAzCount,
        fixedSelectedTypes: type === 'Dedicated load balancer' && specificationType === 'Fixed'
          ? [
              ...(normalizedFixedNetworkEnabled ? ['Network load balancing (TCP/UDP/TLS)'] : []),
              ...(normalizedFixedApplicationEnabled ? ['Application load balancing (HTTP/HTTPS)'] : []),
            ]
          : [],
        fixedTypeSpecs: {
          'Network load balancing (TCP/UDP/TLS)': fixedNetworkSpec,
          'Application load balancing (HTTP/HTTPS)': fixedApplicationSpec,
        },
        selectedProtocols: type === 'Dedicated load balancer' && specificationType === 'Elastic' ? selectedProtocols : [],
        protocolInputs: type === 'Dedicated load balancer' && specificationType === 'Elastic' ? protocolInputs : {},
        networkType,
        billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly',
        sharedDurationHours: usageHoursValue,
        sharedChargeMode,
        sharedTrafficAmount: showSharedTraffic ? sharedTrafficAmount : 0,
        sharedTrafficUnit,
        sharedBandwidthMbit: showSharedBandwidth ? sharedBandwidthMbit : 0,
      };
      const estimate = catalog ? helpers.estimateElbConfiguration(catalog, estimateInput) : null;
      return { type, specificationType, networkType, sharedChargeMode, sharedBandwidthMbit, sharedTrafficAmount, sharedTrafficUnit, fixedAvailabilityAzCountOptions, fixedAvailabilityAzCount, fixedNetworkEnabled: normalizedFixedNetworkEnabled, fixedApplicationEnabled: normalizedFixedApplicationEnabled, fixedNetworkSpec, fixedApplicationSpec, showSharedChargeMode, showSharedBandwidth, showSharedTraffic, protocols: normalizedProtocols, selectedProtocols, protocolInputs, estimate };
    })()`,
    syncValuesExpression: `(() => {
      const next = {
        type: catalogView.type,
        networkType: catalogView.networkType,
        sharedChargeMode: catalogView.sharedChargeMode,
        specificationType: catalogView.specificationType,
        fixedAvailabilityAzCount: String(catalogView.fixedAvailabilityAzCount),
        fixedNetworkEnabled: catalogView.fixedNetworkEnabled ? 'true' : 'false',
        fixedApplicationEnabled: catalogView.fixedApplicationEnabled ? 'true' : 'false',
        fixedNetworkSpec: catalogView.fixedNetworkSpec,
        fixedApplicationSpec: catalogView.fixedApplicationSpec,
      };
      for (const entry of catalogView.protocols) {
        next[entry.prefix + 'Enabled'] = entry.enabled ? 'true' : 'false';
      }
      return next;
    })()`,
    visibilityContextExpression: `({
      showUsageHours: true,
      showSharedBandwidth: catalogView.showSharedBandwidth,
      showSharedTraffic: catalogView.showSharedTraffic,
      type: catalogView.type,
      specificationType: catalogView.specificationType,
      networkType: catalogView.networkType,
      fixedNetworkEnabled: catalogView.fixedNetworkEnabled,
      fixedApplicationEnabled: catalogView.fixedApplicationEnabled,
      tcpEnabled: catalogView.protocols.find((entry) => entry.prefix === 'tcp')?.enabled ?? false,
      tcpMetricMode: values.tcpMetricMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic',
      udpEnabled: catalogView.protocols.find((entry) => entry.prefix === 'udp')?.enabled ?? false,
      udpMetricMode: values.udpMetricMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic',
      tlsEnabled: catalogView.protocols.find((entry) => entry.prefix === 'tls')?.enabled ?? false,
      tlsMetricMode: values.tlsMetricMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic',
      httpEnabled: catalogView.protocols.find((entry) => entry.prefix === 'http')?.enabled ?? false,
      httpMetricMode: values.httpMetricMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic',
    })`,
    activeBillingOptionsExpression: "helpers.getElbBillingOptions(catalogView.type)",
    fieldRuntime: {
      fixedAvailabilityAzCount: { optionsExpression: "helpers.optionList(catalogView.fixedAvailabilityAzCountOptions)" },
      sharedBandwidthMbit: { minExpression: "0" },
      sharedTrafficAmount: { minExpression: "0" },
      tcpNewConnections: { minExpression: "0" },
      tcpMaxConcurrentConnections: { minExpression: "0" },
      tcpProcessedTrafficGbPerHour: { minExpression: "0" },
      tcpAverageBandwidthMbit: { minExpression: "0" },
      udpNewConnections: { minExpression: "0" },
      udpMaxConcurrentConnections: { minExpression: "0" },
      udpProcessedTrafficGbPerHour: { minExpression: "0" },
      udpAverageBandwidthMbit: { minExpression: "0" },
      tlsNewConnections: { minExpression: "0" },
      tlsMaxConcurrentConnections: { minExpression: "0" },
      tlsProcessedTrafficGbPerHour: { minExpression: "0" },
      tlsAverageBandwidthMbit: { minExpression: "0" },
      httpNewConnections: { minExpression: "0" },
      httpMaxConcurrentConnections: { minExpression: "0" },
      httpProcessedTrafficGbPerHour: { minExpression: "0" },
      httpAverageBandwidthMbit: { minExpression: "0" },
      httpQueriesPerSecond: { minExpression: "0" },
      httpForwardingRules: { minExpression: "0" },
    },
    estimateExpression: "catalogView.estimate",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'ELB pricing is unavailable for the current selection.')",
    selectionSummaryExpression: "catalogView.estimate ? `Selected specifications: ${catalogView.type}${catalogView.type === 'Dedicated load balancer' ? ` | ${catalogView.specificationType}` : ''}${catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Fixed' ? ` | ${catalogView.fixedAvailabilityAzCount} AZs` : ''} | ${catalogView.networkType}${catalogView.showSharedChargeMode ? ` | ${catalogView.sharedChargeMode}${catalogView.showSharedBandwidth ? ` | ${catalogView.sharedBandwidthMbit} Mbit/s` : ''}${catalogView.showSharedTraffic ? ` | ${catalogView.sharedTrafficAmount} ${catalogView.sharedTrafficUnit}` : ''}` : ''}${catalogView.type === 'Dedicated load balancer' ? ` | ${catalogView.estimate.estimatedLcus.total} estimated LCU` : ''} | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : 'Selected specifications:'",
    selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), ...helpers.asArray(catalogView.estimate.notes)] : []",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud ELB calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.elbPricingReference.pricingUrl}, ${helpers.elbPricingReference.fixedDrawerNetworkUrl}, and ${helpers.elbPricingReference.fixedDrawerAppUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'elb',
      title: \`\${selectedService} \${catalogView.type}\`,
      quantity: instanceCountValue,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly',
        type: catalogView.type,
        specificationType: catalogView.specificationType,
        subAz: helpers.elbDefaults.subAz,
        fixedAvailabilityAzCount: catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Fixed' ? catalogView.fixedAvailabilityAzCount : null,
        fixedSelectedTypes: catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Fixed'
          ? [
              ...(catalogView.fixedNetworkEnabled ? ['Network load balancing (TCP/UDP/TLS)'] : []),
              ...(catalogView.fixedApplicationEnabled ? ['Application load balancing (HTTP/HTTPS)'] : []),
            ]
          : [],
        fixedTypeSpecs: catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Fixed'
          ? {
              'Network load balancing (TCP/UDP/TLS)': catalogView.fixedNetworkSpec,
              'Application load balancing (HTTP/HTTPS)': catalogView.fixedApplicationSpec,
            }
          : {},
        networkType: catalogView.networkType,
        sharedChargeMode: catalogView.showSharedChargeMode ? catalogView.sharedChargeMode : null,
        sharedBandwidthMbit: catalogView.showSharedBandwidth ? catalogView.sharedBandwidthMbit : null,
        sharedTrafficAmount: catalogView.showSharedTraffic ? catalogView.sharedTrafficAmount : null,
        sharedTrafficUnit: catalogView.showSharedTraffic ? catalogView.sharedTrafficUnit : null,
        selectedProtocols: catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Elastic' ? catalogView.selectedProtocols : [],
        protocolInputs: catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Elastic' ? catalogView.protocolInputs : {},
        estimatedNetworkLcus: catalogView.estimate.estimatedLcus.network,
        estimatedApplicationLcus: catalogView.estimate.estimatedLcus.application,
        estimatedTotalLcus: catalogView.estimate.estimatedLcus.total,
        selectedNetworkSpecLcus: catalogView.estimate.selectedSpecLcus.network,
        selectedApplicationSpecLcus: catalogView.estimate.selectedSpecLcus.application,
        usageHours: usageHoursValue,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount * instanceCountValue, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
        breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'elb' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      const fixedSelectedTypes = Array.isArray(product.config.fixedSelectedTypes) ? product.config.fixedSelectedTypes.filter((entry) => typeof entry === 'string') : [];
      const fixedTypeSpecs = helpers.isRecord(product.config.fixedTypeSpecs) ? product.config.fixedTypeSpecs : {};
      const selectedProtocols = Array.isArray(product.config.selectedProtocols) ? product.config.selectedProtocols.filter((entry) => typeof entry === 'string') : [];
      const protocolInputs = helpers.isRecord(product.config.protocolInputs) ? product.config.protocolInputs : {};
      return {
        handled: true,
        values: {
          type: product.config.type === 'Dedicated load balancer' ? 'Dedicated load balancer' : 'Shared load balancer',
          specificationType: product.config.specificationType === 'Elastic' ? 'Elastic' : 'Fixed',
          networkType: product.config.networkType === 'Private network' ? 'Private network' : 'Public network',
          sharedChargeMode: product.config.sharedChargeMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic',
          usageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : '744',
          sharedBandwidthMbit: typeof product.config.sharedBandwidthMbit === 'number' ? String(Math.max(0, product.config.sharedBandwidthMbit)) : String(helpers.elbDefaults.sharedBandwidthMbit),
          sharedTrafficAmount: typeof product.config.sharedTrafficAmount === 'number' ? String(Math.max(0, product.config.sharedTrafficAmount)) : String(helpers.elbDefaults.sharedTrafficGb),
          sharedTrafficUnit: product.config.sharedTrafficUnit === 'TB' ? 'TB' : 'GB',
          fixedAvailabilityAzCount: typeof product.config.fixedAvailabilityAzCount === 'number' ? String(Math.max(1, Math.floor(product.config.fixedAvailabilityAzCount))) : String(helpers.elbDefaults.fixedAvailabilityAzCount),
          fixedNetworkEnabled: fixedSelectedTypes.includes('Network load balancing (TCP/UDP/TLS)') ? 'true' : 'false',
          fixedNetworkSpec: typeof fixedTypeSpecs['Network load balancing (TCP/UDP/TLS)'] === 'string' ? String(fixedTypeSpecs['Network load balancing (TCP/UDP/TLS)']) : helpers.elbDefaults.fixedTypeSpecs['Network load balancing (TCP/UDP/TLS)'],
          fixedApplicationEnabled: fixedSelectedTypes.includes('Application load balancing (HTTP/HTTPS)') ? 'true' : 'false',
          fixedApplicationSpec: typeof fixedTypeSpecs['Application load balancing (HTTP/HTTPS)'] === 'string' ? String(fixedTypeSpecs['Application load balancing (HTTP/HTTPS)']) : helpers.elbDefaults.fixedTypeSpecs['Application load balancing (HTTP/HTTPS)'],
          tcpEnabled: selectedProtocols.includes('Network load balancing (TCP)') ? 'true' : 'false',
          udpEnabled: selectedProtocols.includes('Network load balancing (UDP)') ? 'true' : 'false',
          tlsEnabled: selectedProtocols.includes('Network load balancing (TLS)') ? 'true' : 'false',
          httpEnabled: selectedProtocols.includes('Application load balancing (HTTP/HTTPS)') ? 'true' : 'false',
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
        nextUsageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })()`,
  },
  OBS: {
    quantityLabel: "Bucket",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "obs-pricing" },
    showSharedUsageHoursExpression: "false",
    catalogViewExpression: `(() => {
      const productTypeOptions = catalog ? helpers.listObsProductTypes(catalog) : ['Object storage', 'Parallel file system'];
      const productType = productTypeOptions.includes(values.productType) ? values.productType : 'Object storage';
      const storageClassOptions = catalog ? helpers.listObsStorageClasses(catalog, productType) : helpers.getObsStorageClassOptions(productType);
      const storageClass = storageClassOptions.includes(values.storageClass) ? values.storageClass : (storageClassOptions[0] ?? 'Standard');
      const redundancyOptions = catalog ? helpers.listObsRedundancies(catalog, productType, storageClass) : helpers.getObsRedundancyOptions(productType, storageClass);
      const redundancy = redundancyOptions.includes(values.redundancy) ? values.redundancy : (redundancyOptions[0] ?? 'Single-AZ storage');
      const restorationTypeOptions = helpers.listObsRestorationTypes(storageClass);
      const restorationType = restorationTypeOptions.includes(values.restorationType) ? values.restorationType : (restorationTypeOptions[0] ?? null);
      const showReplicationTraffic = productType === 'Object storage' && (storageClass === 'Standard' || storageClass === 'Infrequent Access');
      const showPullTraffic = helpers.shouldShowObsPullTraffic(productType);
      const storageAmount = helpers.normalizeObsPositiveNumber(values.storageAmount, helpers.obsStorageSizeBounds.min, helpers.obsStorageSizeBounds.min);
      const storageUnit = ['GB', 'TB', 'PB'].includes(values.storageUnit) ? values.storageUnit : 'GB';
      const durationMonths = Math.max(1, Math.floor(helpers.normalizeObsPositiveNumber(values.durationMonths, 1, 1)));
      const outboundTrafficAmount = helpers.normalizeObsPositiveNumber(values.outboundTrafficAmount, 0, 0);
      const outboundTrafficUnit = ['GB', 'TB', 'PB'].includes(values.outboundTrafficUnit) ? values.outboundTrafficUnit : 'GB';
      const readRequests = helpers.normalizeObsPositiveNumber(values.readRequests, 0, 0);
      const writeRequests = helpers.normalizeObsPositiveNumber(values.writeRequests, 0, 0);
      const deleteRequests = helpers.normalizeObsPositiveNumber(values.deleteRequests, 0, 0);
      const pullTrafficAmount = helpers.normalizeObsPositiveNumber(values.pullTrafficAmount, 0, 0);
      const pullTrafficUnit = ['GB', 'TB', 'PB'].includes(values.pullTrafficUnit) ? values.pullTrafficUnit : 'GB';
      const readTrafficAmount = helpers.normalizeObsPositiveNumber(values.readTrafficAmount, 0, 0);
      const readTrafficUnit = ['GB', 'TB', 'PB'].includes(values.readTrafficUnit) ? values.readTrafficUnit : 'GB';
      const replicationTrafficAmount = helpers.normalizeObsPositiveNumber(values.replicationTrafficAmount, 0, 0);
      const replicationTrafficUnit = ['GB', 'TB', 'PB'].includes(values.replicationTrafficUnit) ? values.replicationTrafficUnit : 'GB';
      const lifecycleTransitionRequests = helpers.normalizeObsPositiveNumber(values.lifecycleTransitionRequests, 0, 0);
      const estimate = catalog ? helpers.estimateObsConfiguration(catalog, {
        productType, storageClass, redundancy, storageAmount, storageUnit, durationMonths,
        outboundTrafficAmount, outboundTrafficUnit,
        readRequests: helpers.convertObsRequestInputToCount(readRequests),
        writeRequests: helpers.convertObsRequestInputToCount(writeRequests),
        deleteRequests: helpers.convertObsRequestInputToCount(deleteRequests),
        pullTrafficAmount: showPullTraffic ? pullTrafficAmount : 0,
        pullTrafficUnit,
        restorationType,
        readTrafficAmount,
        readTrafficUnit,
        replicationTrafficAmount: showReplicationTraffic ? replicationTrafficAmount : 0,
        replicationTrafficUnit,
        lifecycleTransitionRequests: helpers.convertObsRequestInputToCount(lifecycleTransitionRequests),
      }) : null;
      return { productTypeOptions, productType, storageClassOptions, storageClass, redundancyOptions, redundancy, restorationTypeOptions, restorationType, showReplicationTraffic, showPullTraffic, storageAmount, storageUnit, durationMonths, outboundTrafficAmount, outboundTrafficUnit, readRequests, writeRequests, deleteRequests, pullTrafficAmount, pullTrafficUnit, readTrafficAmount, readTrafficUnit, replicationTrafficAmount, replicationTrafficUnit, lifecycleTransitionRequests, estimate };
    })()`,
    syncValuesExpression: "({ productType: catalogView.productType, storageClass: catalogView.storageClass, redundancy: catalogView.redundancy, storageAmount: String(catalogView.storageAmount), storageUnit: catalogView.storageUnit, durationMonths: String(catalogView.durationMonths), outboundTrafficAmount: String(catalogView.outboundTrafficAmount), outboundTrafficUnit: catalogView.outboundTrafficUnit, readRequests: String(catalogView.readRequests), writeRequests: String(catalogView.writeRequests), deleteRequests: String(catalogView.deleteRequests), pullTrafficAmount: String(catalogView.pullTrafficAmount), pullTrafficUnit: catalogView.pullTrafficUnit, restorationType: catalogView.restorationType ?? '', readTrafficAmount: String(catalogView.readTrafficAmount), readTrafficUnit: catalogView.readTrafficUnit, replicationTrafficAmount: String(catalogView.replicationTrafficAmount), replicationTrafficUnit: catalogView.replicationTrafficUnit, lifecycleTransitionRequests: String(catalogView.lifecycleTransitionRequests) })",
    visibilityContextExpression: "({ showRestorationFields: catalogView.restorationTypeOptions.length > 0, showReplicationTraffic: catalogView.showReplicationTraffic })",
    fieldRuntime: {
      productType: { optionsExpression: "helpers.optionList(catalogView.productTypeOptions)" },
      storageClass: { optionsExpression: "helpers.optionList(catalogView.storageClassOptions)" },
      redundancy: { optionsExpression: "helpers.optionList(catalogView.redundancyOptions)" },
      storageAmount: { minExpression: "helpers.obsStorageSizeBounds.min", maxExpression: "helpers.obsStorageSizeBounds.max", normalizeExpression: "String(catalogView.storageAmount)" },
      restorationType: { optionsExpression: "helpers.optionList(catalogView.restorationTypeOptions)" },
    },
    estimateExpression: "catalogView.estimate ? { currency: catalogView.estimate.currency, amount: catalogView.estimate.amount * instanceCountValue, suffix: catalogView.estimate.suffix, unitAmount: catalogView.estimate.amount, monthlyAverageAmount: catalogView.estimate.monthlyAverageAmount, breakdown: catalogView.estimate.breakdown, notes: catalogView.estimate.notes, variant: catalogView.estimate.variant } : null",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'Select an OBS storage class first.')",
    selectionSummaryExpression: "catalogView.estimate ? `Selected specifications: ${catalogView.productType} | ${catalogView.storageClass} | ${catalogView.redundancy}${catalogView.restorationType ? ` | ${catalogView.restorationType}` : ''} | ${catalogView.storageAmount} ${catalogView.storageUnit}${catalogView.readTrafficAmount > 0 ? ` | Read ${catalogView.readTrafficAmount} ${catalogView.readTrafficUnit}` : ''} | ${catalogView.durationMonths}mo | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : 'Selected specifications:'",
    selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), ...helpers.asArray(catalogView.estimate.notes)] : []",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud OBS calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.obsPricingReference.productUrl}, ${helpers.obsPricingReference.billingUrl}, and ${helpers.obsPricingReference.packageOverviewUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'obs',
      title: \`\${selectedService} \${catalogView.productType} \${catalogView.storageClass} \${catalogView.storageAmount} \${catalogView.storageUnit}\`,
      quantity: Math.max(1, instanceCountValue),
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: 'Pay-per-use',
        description: selectedService,
        productType: catalogView.productType,
        storageClass: catalogView.storageClass,
        redundancy: catalogView.redundancy,
        storageAmount: catalogView.storageAmount,
        storageUnit: catalogView.storageUnit,
        storageGiB: helpers.convertObsCapacityToGb(catalogView.storageAmount, catalogView.storageUnit),
        durationMonths: catalogView.durationMonths,
        outboundTrafficAmount: catalogView.outboundTrafficAmount,
        outboundTrafficUnit: catalogView.outboundTrafficUnit,
        readRequests: helpers.convertObsRequestInputToCount(catalogView.readRequests),
        writeRequests: helpers.convertObsRequestInputToCount(catalogView.writeRequests),
        deleteRequests: helpers.convertObsRequestInputToCount(catalogView.deleteRequests),
        pullTrafficAmount: catalogView.showPullTraffic ? catalogView.pullTrafficAmount : 0,
        pullTrafficUnit: catalogView.pullTrafficUnit,
        restorationType: catalogView.restorationType,
        readTrafficAmount: catalogView.readTrafficAmount,
        readTrafficUnit: catalogView.readTrafficUnit,
        replicationTrafficAmount: catalogView.showReplicationTraffic ? catalogView.replicationTrafficAmount : 0,
        replicationTrafficUnit: catalogView.replicationTrafficUnit,
        lifecycleTransitionRequests: helpers.convertObsRequestInputToCount(catalogView.lifecycleTransitionRequests),
        minimumStorageDays: catalogView.estimate.variant.minimumStorageDays,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount * Math.max(1, instanceCountValue), catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
        breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
      },
    }) : null`,
    batchPanel: {
      placeholderExpression: "`[\\n  {\\n    \\\"size\\\": 500\\n  },\\n  {\\n    \\\"productType\\\": \\\"Object storage\\\",\\n    \\\"storageClass\\\": \\\"Archive\\\",\\n    \\\"redundancy\\\": \\\"Single-AZ storage\\\",\\n    \\\"size\\\": 2,\\n    \\\"sizeUnit\\\": \\\"TB\\\",\\n    \\\"durationMonths\\\": 3,\\n    \\\"outboundTraffic\\\": 120,\\n    \\\"readRequests\\\": 50,\\n    \\\"writeRequests\\\": 8,\\n    \\\"deleteRequests\\\": 1,\\n    \\\"pullTraffic\\\": 50,\\n    \\\"replicationTraffic\\\": 20,\\n    \\\"quantity\\\": 2,\\n    \\\"description\\\": \\\"Media archive\\\"\\n  }\\n]`",
      descriptionExpression: "`Paste a JSON array of OBS items. Required field: size. Optional fields: productType, storageClass, redundancy, sizeUnit, durationMonths, outboundTraffic, readRequests, writeRequests, deleteRequests, pullTraffic, replicationTraffic, quantity, and description. Request fields use units of 10,000, so 2 means 20,000 requests.`",
      defaultsExpression: "`If omitted, productType defaults to ${catalogView.productType}, storageClass defaults to ${catalogView.storageClass}, redundancy defaults to ${catalogView.redundancy}, size defaults to ${catalogView.storageAmount}, sizeUnit defaults to ${catalogView.storageUnit}, and durationMonths defaults to ${catalogView.durationMonths}.`",
      validationExpression: "`Each JSON item should include a positive storage size. When present, productType, storageClass, redundancy, and all unit fields should match the available OBS options for the selected region. Unsupported combinations fail item-by-item.`",
    },
    buildBatchRequestBodiesExpression: `(() => {
      if (!catalog) {
        return null;
      }
      const productType = helpers.getBatchObsProductType(item, catalogView.productType);
      const storageClass = helpers.getBatchObsStorageClass(item, catalogView.storageClass);
      const redundancy = helpers.getBatchObsRedundancy(item, catalogView.redundancy);
      const storageAmount = helpers.getBatchObsStorageSize(item, catalogView.storageAmount);
      const storageUnit = helpers.getBatchObsUnit(item, catalogView.storageUnit, ['sizeUnit', 'storageUnit']);
      const durationMonths = Math.max(1, Math.floor(helpers.getBatchObsAmount(item, catalogView.durationMonths, ['durationMonths', 'months'])));
      const outboundTrafficAmount = helpers.getBatchObsAmount(item, catalogView.outboundTrafficAmount, ['outboundTraffic', 'outboundTrafficAmount']);
      const outboundTrafficUnit = helpers.getBatchObsUnit(item, catalogView.outboundTrafficUnit, ['outboundTrafficUnit']);
      const readRequests = helpers.getBatchObsAmount(item, catalogView.readRequests, ['readRequests']);
      const writeRequests = helpers.getBatchObsAmount(item, catalogView.writeRequests, ['writeRequests']);
      const deleteRequests = helpers.getBatchObsAmount(item, catalogView.deleteRequests, ['deleteRequests']);
      const pullTrafficAmount = helpers.getBatchObsAmount(item, catalogView.pullTrafficAmount, ['pullTraffic', 'pullTrafficAmount']);
      const pullTrafficUnit = helpers.getBatchObsUnit(item, catalogView.pullTrafficUnit, ['pullTrafficUnit']);
      const replicationTrafficAmount = helpers.getBatchObsAmount(item, catalogView.replicationTrafficAmount, ['replicationTraffic', 'replicationTrafficAmount']);
      const replicationTrafficUnit = helpers.getBatchObsUnit(item, catalogView.replicationTrafficUnit, ['replicationTrafficUnit']);
      const quantity = helpers.parseBatchQuantity(helpers.isRecord(item) ? item.quantity : undefined);
      const description = helpers.getBatchDescription(item, selectedService);
      const estimate = helpers.estimateObsConfiguration(catalog, {
        productType, storageClass, redundancy, storageAmount, storageUnit, durationMonths,
        outboundTrafficAmount, outboundTrafficUnit,
        readRequests: helpers.convertObsRequestInputToCount(readRequests),
        writeRequests: helpers.convertObsRequestInputToCount(writeRequests),
        deleteRequests: helpers.convertObsRequestInputToCount(deleteRequests),
        pullTrafficAmount: productType === 'Object storage' ? pullTrafficAmount : 0,
        pullTrafficUnit,
        restorationType: null,
        readTrafficAmount: 0,
        readTrafficUnit: 'GB',
        replicationTrafficAmount: (productType === 'Object storage' && (storageClass === 'Standard' || storageClass === 'Infrequent Access')) ? replicationTrafficAmount : 0,
        replicationTrafficUnit,
        lifecycleTransitionRequests: 0,
      });
      if (!estimate) {
        return null;
      }
      return [{
        serviceCode: selectedServiceCode,
        serviceName: selectedService,
        productType: 'obs',
        title: \`\${selectedService} \${productType} \${storageClass} \${storageAmount} \${storageUnit}\`,
        quantity,
        config: {
          region: regionValue,
          catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
          billingMode: 'Pay-per-use',
          description,
          productType,
          storageClass,
          redundancy,
          storageAmount,
          storageUnit,
          storageGiB: helpers.convertObsCapacityToGb(storageAmount, storageUnit),
          durationMonths,
          outboundTrafficAmount,
          outboundTrafficUnit,
          readRequests: helpers.convertObsRequestInputToCount(readRequests),
          writeRequests: helpers.convertObsRequestInputToCount(writeRequests),
          deleteRequests: helpers.convertObsRequestInputToCount(deleteRequests),
          pullTrafficAmount: productType === 'Object storage' ? pullTrafficAmount : 0,
          pullTrafficUnit,
          restorationType: null,
          readTrafficAmount: 0,
          readTrafficUnit: 'GB',
          replicationTrafficAmount: (productType === 'Object storage' && (storageClass === 'Standard' || storageClass === 'Infrequent Access')) ? replicationTrafficAmount : 0,
          replicationTrafficUnit,
          lifecycleTransitionRequests: 0,
          minimumStorageDays: estimate.variant.minimumStorageDays,
        },
        pricing: {
          total: helpers.formatFlavorAmount(estimate.currency, estimate.amount * quantity, estimate.suffix),
          estimate: helpers.formatFlavorAmount(estimate.currency, estimate.amount, estimate.suffix),
          monthlyAverage: helpers.formatFlavorAmount(estimate.currency, estimate.monthlyAverageAmount, '/mo'),
          breakdown: helpers.byLabelAmount(estimate.currency, estimate.suffix, estimate.breakdown),
        },
      }];
    })()`,
    hydrateExpression: `(() => {
      if (product.productType !== 'obs' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          productType: typeof product.config.productType === 'string' ? product.config.productType : 'Object storage',
          storageClass: typeof product.config.storageClass === 'string' ? product.config.storageClass : 'Standard',
          redundancy: typeof product.config.redundancy === 'string' ? product.config.redundancy : 'Single-AZ storage',
          storageAmount: typeof product.config.storageAmount === 'number' ? String(Math.max(helpers.obsStorageSizeBounds.min, product.config.storageAmount)) : (typeof product.config.storageGiB === 'number' ? String(Math.max(helpers.obsStorageSizeBounds.min, product.config.storageGiB)) : String(helpers.obsStorageSizeBounds.min)),
          storageUnit: ['GB', 'TB', 'PB'].includes(product.config.storageUnit) ? product.config.storageUnit : 'GB',
          durationMonths: typeof product.config.durationMonths === 'number' ? String(Math.max(1, Math.floor(product.config.durationMonths))) : '1',
          outboundTrafficAmount: typeof product.config.outboundTrafficAmount === 'number' ? String(Math.max(0, product.config.outboundTrafficAmount)) : '0',
          outboundTrafficUnit: ['GB', 'TB', 'PB'].includes(product.config.outboundTrafficUnit) ? product.config.outboundTrafficUnit : 'GB',
          readRequests: typeof product.config.readRequests === 'number' ? helpers.formatObsRequestInputValue(product.config.readRequests) : '0',
          writeRequests: typeof product.config.writeRequests === 'number' ? helpers.formatObsRequestInputValue(product.config.writeRequests) : '0',
          deleteRequests: typeof product.config.deleteRequests === 'number' ? helpers.formatObsRequestInputValue(product.config.deleteRequests) : '0',
          pullTrafficAmount: typeof product.config.pullTrafficAmount === 'number' ? String(Math.max(0, product.config.pullTrafficAmount)) : '0',
          pullTrafficUnit: ['GB', 'TB', 'PB'].includes(product.config.pullTrafficUnit) ? product.config.pullTrafficUnit : 'GB',
          restorationType: typeof product.config.restorationType === 'string' ? product.config.restorationType : '',
          readTrafficAmount: typeof product.config.readTrafficAmount === 'number' ? String(Math.max(0, product.config.readTrafficAmount)) : '0',
          readTrafficUnit: ['GB', 'TB', 'PB'].includes(product.config.readTrafficUnit) ? product.config.readTrafficUnit : 'GB',
          replicationTrafficAmount: typeof product.config.replicationTrafficAmount === 'number' ? String(Math.max(0, product.config.replicationTrafficAmount)) : '0',
          replicationTrafficUnit: ['GB', 'TB', 'PB'].includes(product.config.replicationTrafficUnit) ? product.config.replicationTrafficUnit : 'GB',
          lifecycleTransitionRequests: typeof product.config.lifecycleTransitionRequests === 'number' ? helpers.formatObsRequestInputValue(product.config.lifecycleTransitionRequests) : '0',
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: 'Pay-per-use',
        nextUsageHours: usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })()`,
  },
  Workspace: {
    quantityLabel: "Desktop",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "workspace-pricing" },
    showSharedUsageHoursExpression: "false",
    catalogViewExpression: `(() => {
      const cpuOptions = catalog ? helpers.listWorkspaceCpuOptions(catalog) : ['2 vCPUs', '4 vCPUs', '8 vCPUs'];
      const cpu = cpuOptions.includes(values.cpu) ? values.cpu : helpers.workspaceDefaults.cpu;
      const memoryOptions = catalog ? helpers.listWorkspaceMemoryOptions(catalog, cpu) : (cpu === '2 vCPUs' ? ['4 GB', '8 GB'] : cpu === '4 vCPUs' ? ['8 GB', '16 GB'] : ['16 GB', '32 GB']);
      const memory = memoryOptions.includes(values.memory) ? values.memory : (memoryOptions[0] ?? helpers.workspaceDefaults.memory);
      const diskTypeOptions = catalog ? helpers.listWorkspaceDiskTypes(catalog) : ['High I/O', 'Ultra-high I/O', 'General purpose SSD'];
      const diskType = diskTypeOptions.includes(values.diskType) ? values.diskType : helpers.workspaceDefaults.diskType;
      const cpuUsageHours = helpers.clampInteger(values.cpuUsageHours || 744, 1, 87600);
      const diskSizeGb = helpers.clampInteger(values.diskSizeGb || 80, 80, 32760);
      const diskUsageHours = helpers.clampInteger(values.diskUsageHours || 744, 1, 87600);
      const quantity = helpers.clampInteger(values.quantity || 1, 1);
      const estimate = catalog ? helpers.estimateWorkspaceConfiguration(catalog, { architecture: 'x86 desktop', specification: 'Ultimate', cpu, memory, cpuUsageHours, diskType, diskSizeGb, diskUsageHours, quantity }) : null;
      return { cpuOptions, cpu, memoryOptions, memory, diskTypeOptions, diskType, cpuUsageHours, diskSizeGb, diskUsageHours, quantity, estimate };
    })()`,
    syncValuesExpression: "({ architecture: 'x86 desktop', specification: 'Ultimate', cpu: catalogView.cpu, memory: catalogView.memory, cpuUsageHours: String(catalogView.cpuUsageHours), diskType: catalogView.diskType, diskSizeGb: String(catalogView.diskSizeGb), diskUsageHours: String(catalogView.diskUsageHours), quantity: String(catalogView.quantity) })",
    fieldRuntime: {
      architecture: { disabledExpression: "true" },
      specification: { disabledExpression: "true" },
      cpu: { optionsExpression: "helpers.optionList(catalogView.cpuOptions)" },
      memory: { optionsExpression: "helpers.optionList(catalogView.memoryOptions)" },
      diskType: { optionsExpression: "helpers.optionList(catalogView.diskTypeOptions)" },
      cpuUsageHours: { minExpression: "1", maxExpression: "87600", normalizeExpression: "helpers.clampInteger(values.cpuUsageHours || 744, 1, 87600)" },
      diskSizeGb: { minExpression: "80", maxExpression: "32760", normalizeExpression: "helpers.clampInteger(values.diskSizeGb || 80, 80, 32760)" },
      diskUsageHours: { minExpression: "1", maxExpression: "87600", normalizeExpression: "helpers.clampInteger(values.diskUsageHours || 744, 1, 87600)" },
      quantity: { minExpression: "1", normalizeExpression: "helpers.clampInteger(values.quantity || 1, 1)" },
    },
    estimateExpression: "catalogView.estimate",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'Workspace pricing is unavailable for the current selection.')",
    selectionSummaryExpression: "`Selected specifications: x86 desktop | Ultimate | ${catalogView.cpu} | ${catalogView.memory} | ${catalogView.diskType} ${catalogView.diskSizeGb} GB | CPU ${catalogView.cpuUsageHours}h | Disk ${catalogView.diskUsageHours}h | ${catalogView.quantity} desktop${catalogView.quantity === 1 ? '' : 's'}${catalogView.estimate ? ` | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : ''}`",
    selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), `Monthly average: ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo')}.`, ...helpers.asArray(catalogView.estimate.notes)] : []",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud Workspace calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.workspacePricingReference.pricingUrl} and ${helpers.workspacePricingReference.productUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'workspace',
      title: \`\${selectedService} \${catalogView.cpu} \${catalogView.memory}\`,
      quantity: 1,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: 'Pay-per-use',
        architecture: 'x86 desktop',
        specification: 'Ultimate',
        cpu: catalogView.cpu,
        memory: catalogView.memory,
        cpuUsageHours: catalogView.cpuUsageHours,
        diskType: catalogView.diskType,
        diskSizeGb: catalogView.diskSizeGb,
        diskUsageHours: catalogView.diskUsageHours,
        quantity: catalogView.quantity,
        desktopResourceSpecCode: catalogView.estimate.desktopTier.resourceSpecCode,
        desktopProductId: catalogView.estimate.desktopTier.productIds.ONDEMAND ?? null,
        diskResourceSpecCode: catalogView.estimate.diskTier.resourceSpecCode,
        diskProductId: catalogView.estimate.diskTier.productIds.ONDEMAND ?? null,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
        breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'workspace' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          architecture: 'x86 desktop',
          specification: 'Ultimate',
          cpu: typeof product.config.cpu === 'string' ? product.config.cpu : helpers.workspaceDefaults.cpu,
          memory: typeof product.config.memory === 'string' ? product.config.memory : helpers.workspaceDefaults.memory,
          cpuUsageHours: typeof product.config.cpuUsageHours === 'number' ? String(Math.max(1, Math.floor(product.config.cpuUsageHours))) : String(helpers.workspaceDefaults.cpuUsageHours),
          diskType: typeof product.config.diskType === 'string' ? product.config.diskType : helpers.workspaceDefaults.diskType,
          diskSizeGb: typeof product.config.diskSizeGb === 'number' ? String(Math.max(80, Math.floor(product.config.diskSizeGb))) : String(helpers.workspaceDefaults.diskSizeGb),
          diskUsageHours: typeof product.config.diskUsageHours === 'number' ? String(Math.max(1, Math.floor(product.config.diskUsageHours))) : String(helpers.workspaceDefaults.diskUsageHours),
          quantity: typeof product.config.quantity === 'number' ? String(Math.max(1, Math.floor(product.config.quantity))) : String(helpers.workspaceDefaults.quantity),
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
      };
    })()`,
  },
  VPN: {
    quantityLabel: "Gateway",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "vpn-pricing" },
    catalogViewExpression: `(() => {
      const activeCatalog = catalog ?? helpers.getFallbackVpnPricingCatalog();
      const edition = billingMode === 'Yearly/Monthly' ? 'Enterprise' : (values.edition === 'Enterprise' ? 'Enterprise' : 'Classic');
      const modeOptions = helpers.listVpnModes(activeCatalog, { billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly', edition });
      const mode = edition === 'Classic' ? 'Site-to-Cloud' : (modeOptions.includes(values.mode) ? values.mode : (modeOptions[0] ?? helpers.vpnDefaults.mode));
      const networkType = edition === 'Classic' ? 'Public network' : (values.networkType === 'Private network' ? 'Private network' : 'Public network');
      const specificationOptions = helpers.listVpnSpecifications(mode, activeCatalog);
      const specification = edition === 'Classic' ? 'Basic' : (specificationOptions[0] ?? (mode === 'Point-to-Cloud' ? 'Professional 1' : 'Professional 2'));
      const useSharedBandwidth = edition === 'Classic' ? false : values.useSharedBandwidth === 'Yes';
      const eipBandwidthMbit1 = Math.max(0, Number(values.eipBandwidthMbit1) || helpers.vpnDefaults.eipBandwidthMbit1);
      const eipBandwidthMbit2 = Math.max(0, Number(values.eipBandwidthMbit2) || helpers.vpnDefaults.eipBandwidthMbit2);
      const durationMonths = [1,2,3,4,5,6,7,8,9,12,24,36].includes(Number(values.durationMonths)) ? Number(values.durationMonths) : helpers.vpnDefaults.durationMonths;
      const showPublicBandwidth = helpers.shouldShowVpnPublicBandwidth(edition, networkType);
      const availableBillingOptions = helpers.getVpnBillingOptions(activeCatalog, { mode, networkType, specification, accessViaNonFixedIp: 'Off' });
      const estimate = helpers.estimateVpnConfiguration(activeCatalog, { mode, networkType, specification, billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly', accessViaNonFixedIp: 'Off', connectionGroups: 10, useSharedBandwidth, eipBandwidthMbit1, eipBandwidthMbit2, usageHours: usageHoursValue, durationMonths });
      return { activeCatalog, edition, modeOptions, mode, networkType, specificationOptions, specification, useSharedBandwidth, eipBandwidthMbit1, eipBandwidthMbit2, durationMonths, showPublicBandwidth, availableBillingOptions, estimate };
    })()`,
    syncValuesExpression: "({ edition: catalogView.edition, mode: catalogView.mode, networkType: catalogView.networkType, useSharedBandwidth: catalogView.useSharedBandwidth ? 'Yes' : 'No', specification: catalogView.specification, eipBandwidthMbit1: String(catalogView.eipBandwidthMbit1), eipBandwidthMbit2: String(catalogView.eipBandwidthMbit2), durationMonths: String(catalogView.durationMonths) })",
    activeBillingOptionsExpression: "catalogView.availableBillingOptions.length > 0 ? catalogView.availableBillingOptions : ['Yearly/Monthly']",
    fieldRuntime: {
      edition: { optionsExpression: "helpers.optionList(billingMode === 'Yearly/Monthly' ? ['Enterprise'] : ['Classic', 'Enterprise'])" },
      mode: { optionsExpression: "helpers.optionList(catalogView.modeOptions)" },
      specification: { optionsExpression: "helpers.optionList(catalogView.specificationOptions)", disabledExpression: "true" },
      eipBandwidthMbit1: { minExpression: "0", normalizeExpression: "String(catalogView.eipBandwidthMbit1)" },
      eipBandwidthMbit2: { minExpression: "0", normalizeExpression: "String(catalogView.eipBandwidthMbit2)" },
    },
    estimateExpression: "catalogView.estimate",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'VPN pricing is unavailable for the current selection.')",
    selectionSummaryExpression: "catalogView.estimate ? `Selected specifications: ${catalogView.edition}${catalogView.edition === 'Enterprise' ? ` | ${catalogView.mode} | ${catalogView.networkType} | ${catalogView.specification}${catalogView.showPublicBandwidth ? ` | ${catalogView.useSharedBandwidth ? 'Shared' : 'Dedicated'} bandwidth | EIP1 ${catalogView.eipBandwidthMbit1} Mbit/s | EIP2 ${catalogView.eipBandwidthMbit2} Mbit/s` : ''}` : ''}${billingMode === 'Yearly/Monthly' ? ` | ${catalogView.durationMonths}mo` : ''} | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : 'Selected specifications:'",
    selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), `Monthly average: ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo')}.`, ...helpers.asArray(catalogView.estimate.notes)] : []",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud VPN calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.vpnPricingReference.pricingUrl}, ${helpers.vpnPricingReference.productUrl}, and ${helpers.vpnPricingReference.specsUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'vpn',
      title: \`\${selectedService} \${catalogView.edition} \${catalogView.mode} \${catalogView.specification}\`,
      quantity: instanceCountValue,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly',
        edition: catalogView.edition,
        mode: catalogView.mode,
        networkType: catalogView.networkType,
        specification: catalogView.specification,
        accessViaNonFixedIp: 'Off',
        connectionGroups: 10,
        useSharedBandwidth: catalogView.showPublicBandwidth ? catalogView.useSharedBandwidth : null,
        eipBandwidthMbit1: catalogView.showPublicBandwidth ? catalogView.eipBandwidthMbit1 : null,
        eipBandwidthMbit2: catalogView.showPublicBandwidth ? catalogView.eipBandwidthMbit2 : null,
        durationMonths: billingMode === 'Yearly/Monthly' ? catalogView.durationMonths : null,
        usageHours: billingMode === 'Pay-per-use' ? usageHoursValue : null,
        gatewayResourceSpecCode: catalogView.estimate.gatewayTier.resourceSpecCode,
        bandwidthResourceSpecCode: catalogView.estimate.bandwidthTier?.resourceSpecCode ?? null,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount * instanceCountValue, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
        breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'vpn' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          edition: product.config.edition === 'Enterprise' ? 'Enterprise' : 'Classic',
          mode: product.config.mode === 'Point-to-Cloud' ? 'Point-to-Cloud' : 'Site-to-Cloud',
          networkType: product.config.networkType === 'Private network' ? 'Private network' : 'Public network',
          useSharedBandwidth: product.config.useSharedBandwidth === true ? 'Yes' : 'No',
          eipBandwidthMbit1: typeof product.config.eipBandwidthMbit1 === 'number' ? String(product.config.eipBandwidthMbit1) : String(helpers.vpnDefaults.eipBandwidthMbit1),
          eipBandwidthMbit2: typeof product.config.eipBandwidthMbit2 === 'number' ? String(product.config.eipBandwidthMbit2) : String(helpers.vpnDefaults.eipBandwidthMbit2),
          durationMonths: typeof product.config.durationMonths === 'number' ? String(product.config.durationMonths) : String(helpers.vpnDefaults.durationMonths),
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
        nextUsageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })()`,
  },
};
