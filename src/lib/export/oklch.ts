/**
 * OKLCH -> sRGB-Hex. react-pdf und ältere Browser kennen kein oklch(); die DSS-Tokens (tokens.css)
 * liegen aber als OKLCH vor. Reine Funktion ohne Abhängigkeit, Farben außerhalb des sRGB-Gamuts
 * werden pro Kanal begrenzt.
 */
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

const gammaEncode = (linear: number): number => {
  const v = clamp01(linear)
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

export function oklchToHex(lightness: number, chroma: number, hueDegrees: number): string {
  const hue = (hueDegrees * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  return (
    '#' +
    [red, green, blue]
      .map(channel => Math.round(gammaEncode(channel) * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}
