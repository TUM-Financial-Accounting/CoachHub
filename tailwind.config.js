/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "var(--surface)",
          hover: "var(--surface-hover)",
          raised: "var(--surface-raised)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          foreground: "#ffffff",
        },
        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        muted: "var(--text-muted)",
        dimmed: "var(--text-dimmed)",
        overlay: "var(--overlay)",
        ring: "var(--ring)",
      },
      borderRadius: {
        lg: "1rem",
        xl: "1.25rem",
      }
    },
  },
  plugins: [],
}