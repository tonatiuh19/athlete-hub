import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./client/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    fontFamily: {
      sans: ["Archivo", "system-ui", "sans-serif"],
      display: ["Archivo", "system-ui", "sans-serif"],
    },
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        "triboo-black": "#05070D",
        "triboo-orange": "#FF5A1F",
        "triboo-red": "#F23C35",
        cyan: "#FF5A1F",
        "cyan-light": "#FF8A5C",
        "blue-electric": "#F23C35",
        "purple-accent": "#F23C35",
        "navy-deep": "#05070D",
        "bg-dark": "#05070D",
        "surface-dark": "#0c1019",
        success: "#22c55e",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "slide-up": {
          from: {
            opacity: "0",
            transform: "translateY(20px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "counter": {
          from: {
            opacity: "0",
          },
          to: {
            opacity: "1",
          },
        },
        "featured-skeleton-shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "slide-up": "slide-up 0.6s ease-out",
        "counter": "counter 0.3s ease-out",
        "featured-skeleton-shimmer":
          "featured-skeleton-shimmer 2s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-dark": "linear-gradient(180deg, hsl(var(--page-gradient-start)) 0%, hsl(var(--page-gradient-end)) 100%)",
        "gradient-cyan": "linear-gradient(135deg, #FF5A1F 0%, #F23C35 100%)",
        "triboo-gradient": "linear-gradient(135deg, #FF5A1F 0%, #F23C35 100%)",
      },
      boxShadow: {
        "glow-cyan": "0 0 30px rgba(255, 90, 31, 0.35)",
        "glow-cyan-lg": "0 0 60px rgba(242, 60, 53, 0.4)",
        "glow-triboo": "0 0 30px rgba(255, 90, 31, 0.35)",
        "glow-triboo-lg": "0 0 50px rgba(242, 60, 53, 0.45)",
        "glow-blue": "0 0 30px rgba(242, 60, 53, 0.3)",
        "glow-purple": "0 0 30px rgba(255, 90, 31, 0.25)",
        panel: "0 24px 60px rgba(2, 6, 23, 0.45)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
