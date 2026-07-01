export function clampMarkerLabel(input: string): string {
  return Array.from(input.trim()).slice(0, 4).join("");
}

export function deriveMarkerLabelFromName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/^[0-9０-９①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚]+[.\uFF0E、\s-]*/, "");

  return clampMarkerLabel(cleaned || name);
}

export function formatMarkerLabel(input: string): string[] {
  const label = clampMarkerLabel(input);
  const letters = Array.from(label);

  if (letters.length <= 3) {
    return [letters.join("")];
  }

  return [letters.slice(0, 2).join(""), letters.slice(2, 4).join("")];
}

export function getReadableTextColor(hex: string): "#ffffff" | "#111827" {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) {
    return "#111827";
  }

  const red = Number.parseInt(clean.slice(0, 2), 16);
  const green = Number.parseInt(clean.slice(2, 4), 16);
  const blue = Number.parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? "#111827" : "#ffffff";
}
