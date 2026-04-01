export type CalculatorPriceVerificationCase = {
  id: string;
  serviceCode: string;
  description: string;
  tolerance: number;
  buildInquiryRequest(): {
    url: string;
    body: unknown;
  };
  getLocalAmount(): Promise<number>;
};
