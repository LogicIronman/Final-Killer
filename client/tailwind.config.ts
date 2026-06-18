import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "Inter", "system-ui", "sans-serif"]
      },
      colors: {
        hp: {
          blue: "#024ad8",
          bright: "#296ef9",
          deep: "#0e3191",
          soft: "#c9e0fc"
        },
        ink: "#1a1a1a",
        graphite: "#636363",
        charcoal: "#3d3d3d",
        cloud: "#f7f7f7",
        fog: "#e8e8e8",
        steel: "#c2c2c2",
        danger: "#b3262b",
        success: "#26734d"
      },
      boxShadow: {
        soft: "0 2px 8px rgba(26, 26, 26, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
