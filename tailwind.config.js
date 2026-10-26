/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF9F2",
        blush: "#FFE9E3",
        peach: "#FFD9C7",
        butter: "#FFF3C4",
        mint: "#D9F2E6",
        sky: "#DDEBFF",
        lilac: "#E8DEF8",
        rose: "#FFD1DC",
        cocoa: "#4A3F35",
        latte: "#8A7A6B",
        salmon: "#FF8A7A",
        matcha: "#7FB69E"
      },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        soft: "0 8px 30px rgba(74,63,53,0.08)",
        card: "0 4px 16px rgba(74,63,53,0.08)",
        pop: "0 12px 40px rgba(255,138,122,0.18)"
      },
      fontFamily: { rounded: ['"Nunito"','ui-rounded','system-ui','sans-serif'] }
    }
  },
  plugins: []
};
