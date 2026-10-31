import { Space_Grotesk, Spectral } from "next/font/google";

// Marketing only (app/(marketing)/CLAUDE.md): Space Grotesk for interface text, Spectral italic for the headline's turn.
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const spectralItalic = Spectral({
  subsets: ["latin"],
  weight: ["500"],
  style: ["italic"],
  display: "swap",
  variable: "--font-spectral-italic",
});

export const marketingFontVariables = [spaceGrotesk.variable, spectralItalic.variable].join(" ");
