import { Decimal } from "./decimal";
import type { Inquiry } from "../huawei-native/types";
import type { InquiryResponse } from "../huawei-native/quotes";
import type { ScopeSnapshot } from "./types";
import { catalogRows, matchingPlans, rateInquiry } from "./rating";
const compare = (a: Decimal, b: Decimal) =>
  a.numerator * b.denominator - b.numerator * a.denominator;

/** Rounded quotes define intervals for a missing catalog precision, rather than exact lower-bound rates. */
export function scaleFromRoundedQuotes(
  scope: ScopeSnapshot,
  cases: { request: Inquiry; response: InquiryResponse }[],
  rounding: "floor" | "round" | "round7-floor6",
) {
  const [below, above] =
    rounding === "round"
      ? ["0.0000005", "0.0000005"]
      : rounding === "round7-floor6"
        ? ["0.00000005", "0.00000095"]
        : ["0", "0.000001"];
  let lower = Decimal.of(0),
    upper: Decimal | undefined;
  for (const { request, response } of cases) {
    const exact = rateInquiry(scope, request, false).exactAmount as {
      numerator: string;
      denominator: string;
    };
    const raw = Decimal.ratio(exact.numerator, exact.denominator);
    if (raw.numerator <= BigInt(0)) return undefined;
    const low = Decimal.of(response.amount).sub(Decimal.of(below)).div(raw),
      high = Decimal.of(response.amount).add(Decimal.of(above)).div(raw);
    if (compare(low, lower) > BigInt(0)) lower = low;
    if (!upper || compare(high, upper) < BigInt(0)) upper = high;
  }
  if (!upper || compare(lower, upper) >= BigInt(0)) return undefined;
  const plan = matchingPlans(
    catalogRows(scope),
    cases[0].request,
    cases[0].request.productInfos[0],
  )[0].plan;
  const rate = plan.amount && Decimal.of(plan.amount);
  // Prefer the shortest decimal effective rate proven by all probes (Huawei often rounds converted hourly rates).
  if (rate)
    for (let places = 0; places <= 16; places++) {
      const candidate = rate
        .mul(lower.add(upper).div(2))
        .quantized(places)
        .div(rate);
      if (
        compare(candidate, lower) >= BigInt(0) &&
        compare(candidate, upper) < BigInt(0)
      )
        return {
          numerator: String(candidate.numerator),
          denominator: String(candidate.denominator),
        };
    }
  const candidate = lower.add(upper).div(2);
  return {
    numerator: String(candidate.numerator),
    denominator: String(candidate.denominator),
  };
}
