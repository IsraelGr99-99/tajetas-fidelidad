export type CardTheme = {
  businessName: string;
  background: string;
  secondary: string;
  text: string;
  logoUrl: string | null;
};

export const DEFAULT_CARD_THEME: CardTheme = {
  businessName: "Café Nómada",
  background: "#172b4d",
  secondary: "#f6bb54",
  text: "#ffffff",
  logoUrl: null,
};

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first: string, second: string): number {
  if (!isHexColor(first) || !isHexColor(second)) return 0;
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
