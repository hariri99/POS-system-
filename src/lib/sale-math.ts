import { type PaymentStatus, type SaleItemRecord, type SaleRecord } from "@/lib/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getRefundedQuantity(item: SaleItemRecord) {
  return clamp(Number(item.refundedQuantity ?? 0), 0, item.quantity);
}

export function getRefundableQuantity(item: SaleItemRecord) {
  return Math.max(0, item.quantity - getRefundedQuantity(item));
}

function allocateNetAmount(total: number, quantity: number, remainingQuantity: number) {
  if (quantity <= 0) {
    return 0;
  }

  return (total / quantity) * remainingQuantity;
}

export function getNetLineTotal(item: SaleItemRecord) {
  return allocateNetAmount(item.lineTotal, item.quantity, getRefundableQuantity(item));
}

export function getRefundedLineTotal(item: SaleItemRecord) {
  return item.lineTotal - getNetLineTotal(item);
}

export function getNetLineProfit(item: SaleItemRecord) {
  return allocateNetAmount(item.lineProfit, item.quantity, getRefundableQuantity(item));
}

export function getRefundedLineProfit(item: SaleItemRecord) {
  return item.lineProfit - getNetLineProfit(item);
}

export function getSaleRefundedAmount(sale: SaleRecord) {
  const derivedRefundedAmount = sale.items.reduce((sum, item) => sum + getRefundedLineTotal(item), 0);
  return Math.max(Number.isFinite(sale.refundedAmount) ? sale.refundedAmount : 0, derivedRefundedAmount);
}

export function getSaleNetTotal(sale: SaleRecord) {
  return Math.max(0, sale.totalAmount - getSaleRefundedAmount(sale));
}

export function getSaleNetProfit(sale: SaleRecord) {
  return sale.items.reduce((sum, item) => sum + getNetLineProfit(item), 0);
}

export function getSaleNetUnits(sale: SaleRecord) {
  return sale.items.reduce((sum, item) => sum + getRefundableQuantity(item), 0);
}

export function getSaleRefundedUnits(sale: SaleRecord) {
  return sale.items.reduce((sum, item) => sum + getRefundedQuantity(item), 0);
}

export function isRefundableStatus(status: PaymentStatus) {
  return status === "paid" || status === "partially_refunded";
}

export function isFullyRefundedSale(sale: SaleRecord) {
  return sale.paymentStatus === "refunded" || getSaleNetTotal(sale) === 0;
}

export function hasPartialRefund(sale: SaleRecord) {
  return sale.paymentStatus === "partially_refunded" || getSaleRefundedAmount(sale) > 0;
}

export function getSaleDisplayTotal(sale: SaleRecord) {
  if (sale.paymentStatus === "refunded") {
    return -getSaleRefundedAmount(sale);
  }

  return getSaleNetTotal(sale);
}

export function getSaleDisplayProfit(sale: SaleRecord) {
  if (sale.paymentStatus === "refunded") {
    return -sale.items.reduce((sum, item) => sum + getRefundedLineProfit(item), 0);
  }

  return getSaleNetProfit(sale);
}
