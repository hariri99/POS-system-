import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNowStrict, isBefore, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPaymentMethod(method: string) {
  switch (method) {
    case "cash":
      return "Cash";
    case "whish_money":
      return "Whish Money";
    case "bank_transfer":
      return "Bank transfer";
    default:
      return method
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(date: string | null) {
  if (!date) {
    return "N/A";
  }

  return format(parseISO(date), "dd MMM yyyy");
}

export function formatDateTime(date: string) {
  return format(parseISO(date), "dd MMM yyyy, HH:mm");
}

export function relativeTime(date: string | null) {
  if (!date) {
    return "Never";
  }

  return formatDistanceToNowStrict(parseISO(date), { addSuffix: true });
}

export function isExpiringSoon(date: string | null, days = 30) {
  if (!date) {
    return false;
  }

  const now = new Date();
  const expiryDate = parseISO(date);
  const windowDate = new Date(now);
  windowDate.setDate(now.getDate() + days);

  return isBefore(expiryDate, windowDate);
}

export function createInvoiceNumber(seed: number) {
  return `INV-${String(seed).padStart(6, "0")}`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
