import { fetchVpnPricingCatalog } from "@/lib/vpn-pricing";
import { estimateVpnConfiguration } from "@/lib/vpn-catalog";
import type { CalculatorPriceVerificationCase } from "@/tests/huawei-inquiry/types";

export const vpnInquiryCases: CalculatorPriceVerificationCase[] = [
  {
    id: "vpn-payg-v300-1h",
    serviceCode: "VPN",
    description: "AGENTS.md inquiry example for VPN pay-per-use V300, 1 hour",
    tolerance: 0.00001,
    buildInquiryRequest() {
      return {
        url: "https://portal-intl.huaweicloud.com/api/cbc/global/rest/BSS/billing/ratingservice/v2/inquiry/resource?servieName=vpn",
        body: {
          regionId: "ap-southeast-1",
          chargingMode: 1,
          periodType: 4,
          periodNum: 1,
          subscriptionNum: 1,
          siteCode: "HWC",
          productInfos: [
            {
              id: "vpn-payg-v300-1h",
              cloudServiceType: "hws.service.type.vpn",
              resourceType: "hws.resource.type.vpn.ipsecvpn",
              resourceSpecCode: "V300",
              productNum: 1,
              resourceSize: 1,
              resouceSizeMeasureId: 14,
              usageFactor: "duration",
              usageMeasureId: 4,
              usageValue: 1,
            },
          ],
        },
      };
    },
    async getLocalAmount() {
      const catalog = await fetchVpnPricingCatalog("ap-southeast-1");
      const estimate = estimateVpnConfiguration(catalog, {
        mode: "Site-to-Cloud",
        networkType: "Public network",
        specification: "Professional 2",
        billingMode: "Pay-per-use",
        accessViaNonFixedIp: "Off",
        connectionGroups: 1,
        useSharedBandwidth: true,
        eipBandwidthMbit1: 0,
        eipBandwidthMbit2: 0,
        usageHours: 1,
        durationMonths: 1,
      });

      if (!estimate) {
        throw new Error("Local VPN estimator returned null for the AGENTS.md inquiry example");
      }

      return estimate.amount;
    },
  },
];
