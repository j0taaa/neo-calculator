/** Exact decimal/rational arithmetic for unit conversions and currency truncation. */
export class Decimal {
  private constructor(
    readonly numerator: bigint,
    readonly denominator: bigint,
  ) {}
  static of(value: number | string): Decimal {
    const text = String(value);
    if (!/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text))
      throw new Error("Invalid decimal amount");
    const [mantissa, exponent = "0"] = text.toLowerCase().split("e"),
      [whole, fraction = ""] = mantissa.split(".");
    const scale = fraction.length - Number(exponent),
      numerator = BigInt(whole + fraction);
    return scale >= 0
      ? new Decimal(numerator, BigInt(10) ** BigInt(scale))
      : new Decimal(numerator * BigInt(10) ** BigInt(-scale), BigInt(1));
  }
  static ratio(numerator: string, denominator: string) {
    return new Decimal(BigInt(numerator), BigInt(denominator));
  }
  rounded(places: number) {
    const scale = BigInt(10) ** BigInt(places);
    return (
      Number(
        (this.numerator * scale * BigInt(2) + this.denominator) /
          (this.denominator * BigInt(2)),
      ) / Number(scale)
    );
  }
  add(other: Decimal) {
    return new Decimal(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }
  sub(other: Decimal) {
    return new Decimal(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }
  mul(other: Decimal | number | string) {
    const value = other instanceof Decimal ? other : Decimal.of(other);
    return new Decimal(
      this.numerator * value.numerator,
      this.denominator * value.denominator,
    );
  }
  div(other: Decimal | number | string) {
    const value = other instanceof Decimal ? other : Decimal.of(other);
    if (value.numerator === BigInt(0))
      throw new Error("Invalid rate denominator");
    return new Decimal(
      this.numerator * value.denominator,
      this.denominator * value.numerator,
    );
  }
  truncated(places: number) {
    const scale = BigInt(10) ** BigInt(places);
    return Number((this.numerator * scale) / this.denominator) / Number(scale);
  }
  number() {
    return Number(this.numerator) / Number(this.denominator);
  }
}
