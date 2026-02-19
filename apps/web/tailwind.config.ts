/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49",
        },
      },
      typography: (theme: (arg: string) => string) => ({
        DEFAULT: {
          css: {
            maxWidth: "none",
            color: theme("colors.gray.700"),
            a: {
              color: theme("colors.brand.600"),
              "&:hover": {
                color: theme("colors.brand.800"),
              },
            },
            "code::before": { content: '""' },
            "code::after": { content: '""' },
          },
        },
        dark: {
          css: {
            color: theme("colors.gray.300"),
            a: {
              color: theme("colors.brand.400"),
              "&:hover": {
                color: theme("colors.brand.300"),
              },
            },
            h1: { color: theme("colors.gray.100") },
            h2: { color: theme("colors.gray.100") },
            h3: { color: theme("colors.gray.100") },
            h4: { color: theme("colors.gray.100") },
            strong: { color: theme("colors.gray.100") },
            blockquote: { color: theme("colors.gray.400") },
            code: { color: theme("colors.gray.300") },
          },
        },
      }),
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
