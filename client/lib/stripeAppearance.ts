import type { Appearance } from "@stripe/stripe-js";

/** Stripe Elements appearance aligned with Triboo semantic tokens. */
export function buildStripeAppearance(isDark: boolean): Appearance {
  return {
    theme: isDark ? "night" : "stripe",
    variables: {
      colorPrimary: "#FF5A1F",
      colorBackground: isDark ? "#0c1019" : "#ffffff",
      colorText: isDark ? "#f5f5f5" : "#0b0f1a",
      colorDanger: "#ef4444",
      borderRadius: "10px",
      fontFamily: "Archivo, system-ui, sans-serif",
    },
    rules: {
      ".Input": {
        border: isDark ? "1px solid rgba(55, 65, 81, 0.8)" : "1px solid hsl(228 18% 86%)",
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.6)" : "#ffffff",
      },
      ".Tab": {
        border: isDark ? "1px solid rgba(55, 65, 81, 0.5)" : "1px solid hsl(228 18% 86%)",
      },
      ".Tab--selected": {
        borderColor: "rgba(255, 90, 31, 0.5)",
      },
    },
  };
}
