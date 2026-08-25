import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ssru: {
          crimson: "#A6192E",
          dark: "#7D1222",
          light: "#C8233B",
          50: "#FDF2F4",
          100: "#FBE4E8",
          500: "#A6192E",
          600: "#8E1426",
          700: "#76101F",
          900: "#45060F",
        },
        neutral: {
          charcoal: "#2C2C2C",
          surface: "#F8FAFC",
          card: "#FFFFFF",
        },
        track: {
          hw: "#D97706",
          sw: "#2563EB",
          nw: "#059669",
          db: "#7C3AED",
        }
      },
      fontFamily: {
        sans: ["var(--font-sarabun)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-kanit)", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 25px -5px rgba(166, 25, 46, 0.25)',
      },
      keyframes: {
        pulseFast: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'pulse-fast': 'pulseFast 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
};
export default config;
