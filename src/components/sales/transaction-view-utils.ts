import { differenceInCalendarDays, parseISO } from "date-fns";
import { type PaymentStatus, type SaleRecord } from "@/lib/types";
import { getSaleDisplayProfit, getSaleDisplayTotal, getSaleNetUnits } from "@/lib/sale-math";

export function getSaleEventDate(sale: SaleRecord) {
  return sale.refundedAt ?? sale.paidAt ?? sale.createdAt;
}

export function getSaleProfit(sale: SaleRecord) {
  return getSaleDisplayProfit(sale);
}

export function getSaleSignedTotal(sale: SaleRecord) {
  return getSaleDisplayTotal(sale);
}

export function getSaleSignedProfit(sale: SaleRecord) {
  return getSaleDisplayProfit(sale);
}

export function getSaleTotalUnits(sale: SaleRecord) {
  return getSaleNetUnits(sale);
}

export function getPaymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Unpaid";
    case "partially_refunded":
      return "Partially refunded";
    case "refunded":
      return "Refunded";
    case "void":
      return "Void";
    default:
      return status;
  }
}

export function getPaymentStatusClasses(status: PaymentStatus) {
  switch (status) {
    case "paid":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
    case "pending":
      return "border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-200";
    case "partially_refunded":
      return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-200";
    case "refunded":
      return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200";
    case "void":
      return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200";
    default:
      return "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]";
  }
}

export function getPendingAgeDays(sale: SaleRecord) {
  return differenceInCalendarDays(new Date(), parseISO(sale.createdAt));
}
