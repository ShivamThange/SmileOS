/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Structural
        bg: "var(--bg)",
        "bg-content": "var(--bg-content)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        "muted-strong": "var(--muted-strong)",
        "muted-2": "var(--muted-2)",
        "muted-3": "var(--muted-3)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        "border-faint": "var(--border-faint)",
        track: "var(--track)",
        // Brand
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          lift: "var(--primary-lift)",
          tint: "var(--primary-tint)",
          "tint-border": "var(--primary-tint-border)",
        },
        "on-primary": "var(--on-primary)",
        // Semantic
        warning: {
          DEFAULT: "var(--warning)",
          bg: "var(--warning-bg)",
          border: "var(--warning-border)",
          text: "var(--warning-text)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          bg: "var(--danger-bg)",
          border: "var(--danger-border)",
          text: "var(--danger-text)",
        },
        info: "var(--info)",
        "accent-purple": "var(--accent-purple)",
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["'IBM Plex Serif'", "ui-serif", "Georgia", "serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "7px",
        md: "8px",
        lg: "12px",
        xl: "14px",
      },
      boxShadow: {
        "card-hover": "0 2px 8px rgba(33,32,28,0.06)",
        raised: "0 4px 16px rgba(33,32,28,0.07)",
        dropdown: "0 8px 24px rgba(33,32,28,0.12)",
        drawer: "-16px 0 48px rgba(33,32,28,0.14)",
        palette: "0 24px 64px rgba(33,32,28,0.30)",
        toast: "0 8px 24px rgba(33,32,28,0.30)",
      },
      keyframes: {
        "dc-drawer": {
          from: { transform: "translateX(40px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "dc-toast": {
          from: { transform: "translateY(12px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "dc-fade": { from: { opacity: "0" }, to: { opacity: "1" } },
        "dc-fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "dc-drawer": "dc-drawer .18s ease",
        "dc-toast": "dc-toast .18s ease",
        "dc-fade": "dc-fade .12s ease",
        "dc-fade-up": "dc-fade-up .4s ease",
      },
    },
  },
  plugins: [],
};
