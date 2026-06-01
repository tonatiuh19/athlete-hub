const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  diners: "Diners",
  jcb: "JCB",
  unionpay: "UnionPay",
};

export function formatCardBrand(brand: string): string {
  return BRAND_LABELS[brand.toLowerCase()] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function formatCardExpiry(expMonth: number, expYear: number): string {
  const month = String(expMonth).padStart(2, "0");
  const year = String(expYear).slice(-2);
  return `${month}/${year}`;
}
