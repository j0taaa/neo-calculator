import type { NativeState } from "../huawei-native/native-types";
import { nativeComponentId } from "../huawei-native/native-quote";
import type { ScopeSnapshot } from "../huawei-snapshot/types";
import { rateInquiry } from "../huawei-snapshot/rating";

/** Format Neo's verified prices as Huawei saved-cart data, including payment schedules. */
export function cartPriceFields(
  state: NativeState,
  scope: ScopeSnapshot,
  timeTag: number,
) {
  if (!state.local?.pricing.result || !state.quote)
    throw new Error("Missing independently calculated cart price.");
  const ratings = state.local.pricing.result.productRatingResult;
  const inquiryRatings = new Map(
    state.local.inquiries.flatMap((inquiry) =>
      rateInquiry(scope, inquiry).productRatingResult.map(
        (item) => [item.id, item] as const,
      ),
    ),
  );
  const schedule = state.quote.payment;
  const productAllInfos =
    state.local.pricing.selectedProduct.productAllInfos.map((row) => {
      const id = nativeComponentId(0, row),
        result = ratings.find((value) => value.id === id),
        inquiry = inquiryRatings.get(id);
      if (!result) return structuredClone(row);
      const payment = !schedule
        ? {}
        : state.billingMode === "RI"
          ? {
              perAmount: row._injectedMode
                ? result.amount / schedule.installments
                : Number(row.perPrice ?? 0) * row.productNum,
              installAmount: row._injectedMode ? 0 : (inquiry?.amount ?? 0),
              installNum: schedule.installments,
              installPeriodType: 2,
            }
          : {
              perAmount: inquiry?.perAmount ?? 0,
              installAmount: inquiry?.amount ?? 0,
              installNum: schedule.installments,
              installPeriodType: state.local!.pricing.result!.installPeriodType,
            };
      return {
        ...structuredClone(row),
        inquiryResult: {
          ...inquiry,
          ...result,
          originalAmount: result.amount,
          discountAmount: 0,
          ...payment,
          id: nativeComponentId(timeTag, row),
        },
      };
    });
  return {
    productAllInfos,
    ...(schedule
      ? {
          perAmount:
            schedule.recurring +
            schedule.extras.reduce((sum, extra) => sum + extra.recurring, 0),
          installAmount: schedule.upfront,
          installNum: schedule.installments,
          installPeriodType: state.local.pricing.result.installPeriodType,
        }
      : {}),
  };
}
