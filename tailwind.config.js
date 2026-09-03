/** @type {import('tailwindcss').Config} */
/**
 * CodePath UI now follows Cloudflare Kumo's design-system rules:
 *  - Semantic color tokens ONLY (kumo-*), named by ROLE not hue, so the UI
 *    reads "surface / text / status" instead of raw colors.
 *  - No raw Tailwind colors (no bg-blue-500 / text-gray-900), no `dark:` variants.
 *  - Surface hierarchy: canvas -> base -> elevated -> recessed -> tint -> contrast.
 *  - Values are Kumo's light-mode tokens (light-only for this project).
 *  - Kumo typography scale (xs 12 / sm 13 / base 14 / lg 16).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Kumo surfaces (outermost -> innermost) ----
        kumo: {
          canvas: 'oklch(98.75% 0 0)', // page background behind everything
          base: '#ffffff', // default component background
          elevated: 'oklch(98% 0 0)', // LayerCard.Secondary
          recessed: 'oklch(96% 0 0)', // segmented control background
          tint: 'oklch(97% 0 0)', // tables / hover states
          contrast: 'oklch(8.5% 0 0)', // high-contrast inverted background
          overlay: 'oklch(97.5% 0 0)',
          control: '#ffffff',
          interact: 'oklch(87% 0 0)',
          fill: 'oklch(92.2% 0 0)',
          'fill-hover': 'oklch(96.5% 0 0)',

          // ---- Kumo brand (Cloudflare blue) ----
          brand: 'oklch(0.5772 0.2324 260)',
          'brand-hover': 'oklch(48.8% 0.243 264.376)',

          // ---- Kumo borders & rings ----
          line: 'oklch(14.5% 0 0 / 0.1)',
          hairline: 'oklch(93.5% 0 0)',
          focus: 'oklch(15% 0 0)',

          // ---- Kumo text colors (neutral shades) ----
          // nested under `text` so they read `text-kumo-text-{default,strong,...}`
          text: {
            default: 'oklch(21% 0.006 285.885)', // neutral-900
            strong: 'oklch(14.5% 0 0)', // neutral-950
            subtle: 'oklch(55.6% 0 0)', // neutral-500
            inactive: 'oklch(87% 0 0)', // neutral-300
            placeholder: 'oklch(70.8% 0 0)', // neutral-400
            inverse: 'oklch(97% 0 0)', // neutral-100
          },
        },

        // ---- Kumo status text colors (solid + -tint) ----
        kumoInfo: {
          DEFAULT: 'oklch(68.5% 0.169 237.323)', // blue-500
          tint: 'oklch(93.2% 0.032 255.6 / 0.45)',
        },
        kumoSuccess: {
          DEFAULT: 'oklch(59.6% 0.145 163.225)', // emerald-600
          tint: 'oklch(96.2% 0.043 156.7 / 0.57)',
        },
        kumoWarning: {
          DEFAULT: 'oklch(73.9% 0.177 58.2)',
          tint: 'oklch(93.1% 0.107 94.6 / 0.2)',
        },
        kumoDanger: {
          DEFAULT: 'oklch(63.7% 0.237 25.331)', // red-500
          tint: 'oklch(93.6% 0.032 17.7 / 0.42)',
        },

        // ---- Kumo text colors (role-based; darker in light for contrast) ----
        kumoText: {
          brand: 'oklch(42.4% 0.199 265.638)', // brand accent text (blue-800)
          link: 'oklch(42.4% 0.199 265.638)', // blue-800
          info: 'oklch(42.4% 0.199 265.638)', // blue-800
          success: 'oklch(43.2% 0.095 166.913)', // emerald-800
          warning: 'oklch(59.7% 0.144 57.5)',
          danger: 'oklch(50.5% 0.213 27.518)', // red-700
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'Cascadia Code', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Kumo type scale
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '1.176' }],
        base: ['14px', { lineHeight: '1.5' }],
        lg: ['16px', { lineHeight: '1.5' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)',
        'card-hover': '0 2px 4px rgba(15,23,42,0.06), 0 10px 24px rgba(15,23,42,0.08)',
      },
    },
  },
  plugins: [],
};
