import type { Config } from "tailwindcss";

/**
 * Rally Design System — Tailwind CSS v4 Configuration
 *
 * Dark mode only. Gold-on-black brand. 4px spacing grid.
 * This is the single source of truth for all visual tokens.
 */
const config: Config = {
  darkMode: "class",
  content: [
    // Each app extends this config and overrides content paths
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    /**
     * 4px base spacing grid.
     * Tailwind default is 4px (1 unit = 0.25rem = 4px), so we keep the
     * default scale and add Rally-specific named sizes where needed.
     */
    extend: {
      colors: {
        // ── Brand ──────────────────────────────────────────────
        rally: {
          gold: "#D4A017",
          goldLight: "#E8C547",
          goldDim: "#A67C13",
          goldMuted: "#3D3209",
        },

        // ── Surface (dark mode only) ──────────────────────────
        surface: {
          base: "#09090B",
          raised: "#111114",
          overlay: "#18181B",
          border: "#27272A",
          borderHover: "#3F3F46",
        },

        // ── Text ──────────────────────────────────────────────
        text: {
          primary: "#FAFAFA",
          secondary: "#A1A1AA",
          tertiary: "#71717A",
          disabled: "#52525B",
          inverse: "#09090B",
        },

        // ── Status ────────────────────────────────────────────
        status: {
          success: "#22C55E",
          warning: "#EAB308",
          error: "#EF4444",
          info: "#3B82F6",
        },

        // ── Vehicle Activity ──────────────────────────────────
        activity: {
          showVideo: "#3B82F6",
          testDrive: "#8B5CF6",
          offLot: "#F97316",
          fueling: "#22C55E",
          runCharge: "#06B6D4",
          sold: "#EF4444",
          available: "#22C55E",
        },

        // ── Battery Health ────────────────────────────────────
        battery: {
          healthy: "#22C55E",
          warning: "#EAB308",
          critical: "#EF4444",
        },
      },

      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },

      // ── Named spacing tokens (4px grid) ───────────────────
      spacing: {
        "rally-xs": "4px",    // 1 unit
        "rally-sm": "8px",    // 2 units
        "rally-md": "16px",   // 4 units
        "rally-lg": "24px",   // 6 units
        "rally-xl": "32px",   // 8 units
        "rally-2xl": "48px",  // 12 units
        "rally-3xl": "64px",  // 16 units
      },

      borderRadius: {
        rally: "8px",
        "rally-lg": "12px",
        "rally-xl": "16px",
      },

      fontSize: {
        /** StockHero component: 40pt bold monospace */
        "stock-hero": [
          "2.5rem",
          { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.02em" },
        ],
      },

      boxShadow: {
        "rally-sm": "0 1px 2px 0 rgba(0, 0, 0, 0.4)",
        rally: "0 2px 8px 0 rgba(0, 0, 0, 0.5)",
        "rally-lg": "0 8px 24px 0 rgba(0, 0, 0, 0.6)",
        "rally-glow": "0 0 16px 0 rgba(212, 160, 23, 0.15)",
      },

      animation: {
        "rally-pulse": "rally-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "rally-fade-in": "rally-fade-in 0.2s ease-out",
        "rally-slide-up": "rally-slide-up 0.3s ease-out",
      },

      keyframes: {
        "rally-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "rally-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "rally-slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} as const;

export default config;
