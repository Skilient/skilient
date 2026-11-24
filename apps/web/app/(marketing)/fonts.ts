import { Spectral } from "next/font/google";

// Marketing only: Spectral italic for the headline's turn. Space Grotesk is the app-wide interface
// face since phase 14 (app/fonts.ts).
export const spectralItalic = Spectral({
  subsets: ["latin"],
  weight: ["500"],
  style: ["italic"],
  display: "swap",
  variable: "--font-spectral-italic",
});

export const marketingFontVariables = spectralItalic.variable;
