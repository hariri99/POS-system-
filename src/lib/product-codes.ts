import { nanoid } from "nanoid";
import { slugify } from "@/lib/utils";

function compactSegment(value: string | undefined) {
  return slugify(value ?? "")
    .replace(/-/g, "")
    .toUpperCase();
}

export function ensureProductSku(input: {
  sku?: string;
  name?: string;
  flavor?: string;
  sizeLabel?: string;
}) {
  const sku = (input.sku ?? "").trim().toUpperCase();
  if (sku.length >= 3) {
    return sku;
  }

  const base = [compactSegment(input.name), compactSegment(input.flavor), compactSegment(input.sizeLabel)]
    .filter(Boolean)
    .join("-")
    .slice(0, 18);

  if (base.length >= 3) {
    return `${base}-${nanoid(4).toUpperCase()}`;
  }

  return `SKU-${nanoid(8).toUpperCase()}`;
}

export function ensureProductBarcode(input: { barcode?: string }) {
  const barcode = (input.barcode ?? "").replace(/\D/g, "");
  if (barcode.length >= 6) {
    return barcode;
  }

  const timestampPart = Date.now().toString().slice(-9);
  const randomPart = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `${timestampPart}${randomPart}`;
}

