import type { Config } from "tailwindcss";

/**
 * Monochrome by construction.
 *
 * Every palette the app uses is remapped onto one grey ramp, so the hundreds of
 * existing `text-stone-500` / `border-rose-300` classes keep working and simply
 * stop being coloured. What they lose in hue they keep in value: the semantic
 * palettes are graded light-to-dark by severity, so emerald (fine) reads lighter
 * than amber (worth a look) which reads lighter than rose (fix this). In a black
 * and white interface, attention is bought with ink, not colour.
 */

const GREY = {
  0: "#ffffff",
  50: "#fafafa",
  100: "#f4f4f4",
  200: "#e6e6e6",
  300: "#d4d4d4",
  400: "#a3a3a3",
  500: "#737373",
  600: "#525252",
  700: "#404040",
  800: "#262626",
  900: "#111111",
  950: "#000000",
};

/** Neutral chrome: surfaces, hairlines, body text. */
const stone = {
  50: GREY[50],
  100: GREY[100],
  200: GREY[200],
  300: GREY[300],
  400: GREY[400],
  500: GREY[500],
  600: GREY[600],
  700: GREY[700],
  800: GREY[800],
  900: GREY[900],
};

/** Lightest: nothing to do here. */
const emerald = {
  50: GREY[0],
  100: GREY[100],
  200: GREY[200],
  300: GREY[300],
  500: GREY[400],
  600: GREY[600],
  700: GREY[700],
  800: GREY[800],
  900: GREY[900],
};

/** Middle weight: worth a look. */
const amber = {
  50: GREY[50],
  100: GREY[100],
  200: GREY[300],
  300: GREY[400],
  500: GREY[600],
  800: GREY[800],
  900: GREY[900],
};

/** Heaviest: fix this. */
const rose = {
  50: GREY[100],
  100: GREY[200],
  200: GREY[300],
  300: GREY[500],
  500: GREY[900],
  600: GREY[900],
  700: GREY[950],
  800: GREY[950],
  900: GREY[950],
};

/** Annotation issue types: distinguished by label, not by colour. */
const tag = {
  50: GREY[50],
  100: GREY[100],
  300: GREY[300],
  800: GREY[800],
  900: GREY[900],
};

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // gray is remapped too: Tailwind's preflight reaches for gray-200 as the
      // default border colour and gray-400 for placeholders, and both of those
      // are faintly blue.
      colors: { stone, emerald, amber, rose, gray: stone, purple: tag, sky: tag, orange: tag },
      borderColor: { DEFAULT: GREY[200] },
      fontFamily: {
        sans: ["var(--font-space-mono)", "ui-monospace", "monospace"],
        mono: ["var(--font-space-mono)", "ui-monospace", "monospace"],
      },
      // Minimal means no soft edges and no depth: square corners, flat surfaces,
      // and hairlines doing the separating.
      borderRadius: { DEFAULT: "0", sm: "0", md: "0", lg: "0", xl: "0", full: "0" },
      boxShadow: { DEFAULT: "none", sm: "none", md: "none", lg: "none", xl: "none" },
    },
  },
  plugins: [],
};

export default config;
