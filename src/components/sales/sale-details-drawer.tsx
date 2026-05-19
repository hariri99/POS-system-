"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Minus,
  Package,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getNetLineProfit,
  getNetLineTotal,
  getRefundableQuantity,
  getRefundedLineTotal,
  getRefundedQuantity,
  getSaleNetTotal,
  getSaleRefundedAmount,
  getSaleRefundedUnits,
  isRefundableStatus,
} from "@/lib/sale-math";
import { type SaleItemRecord, type SaleRecord, type SaleRefundInput } from "@/lib/types";
import { cn, formatCurrency, formatDateTime, formatPaymentMethod, formatPercent } from "@/lib/utils";
import {
  getPaymentStatusClasses,
  getPaymentStatusLabel,
  getSaleEventDate,
  getSaleSignedTotal,
  getSaleTotalUnits,
} from "@/components/sales/transaction-view-utils";

interface SaleDetailsDrawerProps {
  sale: SaleRecord;
  onClose: () => void;
  busy?: boolean;
  onRefundSale?: (input: SaleRefundInput & { saleId: string }) => void | Promise<void>;
  allowPartialItemRefunds?: boolean;
  refundCapabilityMessage?: string | null;
}

type RefundReasonCode =
  | "customer_request"
  | "damaged_item"
  | "wrong_product"
  | "expired_product"
  | "other";

const REFUND_REASON_OPTIONS: Array<{
  value: RefundReasonCode;
  label: string;
  helper: string;
}> = [
  {
    value: "customer_request",
    label: "Customer request",
    helper: "Use when the customer changed their mind or no longer wants the item.",
  },
  {
    value: "damaged_item",
    label: "Damaged item",
    helper: "Use when the returned product arrived broken, opened, or unusable.",
  },
  {
    value: "wrong_product",
    label: "Wrong product",
    helper: "Use when the customer received the wrong SKU, flavor, or size.",
  },
  {
    value: "expired_product",
    label: "Expired product",
    helper: "Use when the item is expired or near-expiry and cannot be kept with the customer.",
  },
  {
    value: "other",
    label: "Other",
    helper: "Use for any custom operational explanation that should stay in the audit trail.",
  },
];

function clampQuantity(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getRefundReasonLabel(reasonCode: RefundReasonCode) {
  return REFUND_REASON_OPTIONS.find((option) => option.value === reasonCode)?.label ?? "Other";
}

function buildRefundReasonValue(reasonCode: RefundReasonCode, note: string) {
  const trimmedNote = note.trim();
  const label = getRefundReasonLabel(reasonCode);
  return trimmedNote ? `${label}: ${trimmedNote}` : label;
}

function getProductRefundTone(item: SaleItemRecord) {
  const refundableQuantity = getRefundableQuantity(item);
  const refundedQuantity = getRefundedQuantity(item);

  if (refundableQuantity === 0) {
    return {
      label: "Finalized",
      className: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
    };
  }

  if (refundedQuantity > 0) {
    return {
      label: "Partial refund",
      className: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-200",
    };
  }

  return {
    label: "Fully refundable",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  };
}

function getPerUnitRefundAmount(item: SaleItemRecord, quantity: number) {
  if (item.quantity <= 0) {
    return 0;
  }

  return (item.lineTotal / item.quantity) * quantity;
}

export function SaleDetailsDrawer({
  sale,
  onClose,
  busy = false,
  onRefundSale,
  allowPartialItemRefunds = true,
  refundCapabilityMessage = null,
}: SaleDetailsDrawerProps) {
  const signedTotal = getSaleSignedTotal(sale);
  const netTotal = getSaleNetTotal(sale);
  const totalUnits = getSaleTotalUnits(sale);
  const refundedAmount = getSaleRefundedAmount(sale);
  const refundedUnits = getSaleRefundedUnits(sale);
  const refundableItems = sale.items.filter((item) => getRefundableQuantity(item) > 0);
  const refundableUnitsBefore = refundableItems.reduce(
    (sum, item) => sum + getRefundableQuantity(item),
    0,
  );
  const hasMultiUnitRefundChoice = refundableItems.some((item) => getRefundableQuantity(item) > 1);
  const allowItemRefundChoice =
    allowPartialItemRefunds && (refundableItems.length > 1 || hasMultiUnitRefundChoice);
  const showPartialRefundUnavailableNotice =
    !allowPartialItemRefunds && (refundableItems.length > 1 || hasMultiUnitRefundChoice);
  const shouldDefaultToItemScope =
    allowItemRefundChoice && refundableItems.length === 1 && hasMultiUnitRefundChoice;
  const [refundScopeOverride, setRefundScopeOverride] = useState<"order" | "item" | null>(null);
  const [selectedSaleItemId, setSelectedSaleItemId] = useState(refundableItems[0]?.id ?? "");
  const [selectedRefundQuantity, setSelectedRefundQuantity] = useState(1);
  const [refundReasonCode, setRefundReasonCode] = useState<RefundReasonCode>("customer_request");
  const [refundReasonNote, setRefundReasonNote] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const canRefund =
    isRefundableStatus(sale.paymentStatus) && refundableItems.length > 0 && Boolean(onRefundSale);
  const refundBusy = busy || isSubmittingRefund;
  const refundScope = refundScopeOverride ?? (shouldDefaultToItemScope ? "item" : "order");
  const selectedRefundItem =
    refundableItems.find((item) => item.id === selectedSaleItemId) ?? refundableItems[0] ?? null;
  const maxSelectedRefundQuantity = selectedRefundItem
    ? getRefundableQuantity(selectedRefundItem)
    : 0;
  const effectiveRefundQuantity =
    maxSelectedRefundQuantity > 0
      ? clampQuantity(selectedRefundQuantity, 1, maxSelectedRefundQuantity)
      : 1;
  const effectiveScope = allowItemRefundChoice ? refundScope : "order";
  const selectedRefundLines =
    effectiveScope === "order"
      ? refundableItems.map((item) => ({
          item,
          quantity: getRefundableQuantity(item),
        }))
      : selectedRefundItem
        ? [
            {
              item: selectedRefundItem,
              quantity: effectiveRefundQuantity,
            },
          ]
        : [];
  const selectedProductsCount = selectedRefundLines.length;
  const operationUnits = selectedRefundLines.reduce((sum, line) => sum + line.quantity, 0);
  const operationSubtotal = selectedRefundLines.reduce((sum, line) => {
    return sum + getPerUnitRefundAmount(line.item, line.quantity);
  }, 0);
  const projectedRefundedAmount = Math.min(sale.totalAmount, refundedAmount + operationSubtotal);
  const projectedNetTotal = Math.max(0, sale.totalAmount - projectedRefundedAmount);
  const remainingUnitsAfterOperation = Math.max(0, refundableUnitsBefore - operationUnits);
  const projectedPaymentStatus =
    remainingUnitsAfterOperation === 0 ? "refunded" : "partially_refunded";
  const refundReasonValue = buildRefundReasonValue(refundReasonCode, refundReasonNote);
  const refundHistory = [...sale.refundEvents].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (confirmOpen) {
          setConfirmOpen(false);
          return;
        }

        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [confirmOpen, onClose]);

  function setRefundQuantity(quantity: number) {
    if (maxSelectedRefundQuantity <= 0) {
      return;
    }

    setSelectedRefundQuantity(clampQuantity(quantity, 1, maxSelectedRefundQuantity));
  }

  function selectRefundItem(itemId: string) {
    setSelectedSaleItemId(itemId);
    setSelectedRefundQuantity(1);
    setRefundScopeOverride("item");
    setRefundError(null);
  }

  function buildRefundRequest() {
    if (!onRefundSale) {
      return null;
    }

    if (effectiveScope === "item" && !selectedRefundItem) {
      setRefundError("Select the product line you want to refund.");
      return null;
    }

    if (effectiveScope === "item") {
      if (effectiveRefundQuantity < 1 || effectiveRefundQuantity > maxSelectedRefundQuantity) {
        setRefundError("Choose a valid quantity to refund.");
        return null;
      }
    }

    setRefundError(null);

    return {
      saleId: sale.id,
      scope: effectiveScope,
      saleItemId: effectiveScope === "item" ? selectedRefundItem?.id : undefined,
      quantity: effectiveScope === "item" ? effectiveRefundQuantity : undefined,
      reason: refundReasonValue,
    } satisfies SaleRefundInput & { saleId: string };
  }

  function openConfirmation() {
    const request = buildRefundRequest();
    if (!request) {
      return;
    }

    setConfirmOpen(true);
  }

  async function handleRefund() {
    if (!onRefundSale) {
      return;
    }

    const request = buildRefundRequest();
    if (!request) {
      return;
    }

    setIsSubmittingRefund(true);

    try {
      await onRefundSale(request);
      setConfirmOpen(false);
      onClose();
    } catch (error) {
      setConfirmOpen(false);
      setRefundError(error instanceof Error ? error.message : "Unable to refund this sale.");
    } finally {
      setIsSubmittingRefund(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/25 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="absolute inset-y-0 right-0 flex w-full justify-end xl:max-w-[74rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex h-full w-full flex-col border-l border-[var(--border)] bg-[var(--background-muted)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4 backdrop-blur-[8px]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={getPaymentStatusClasses(sale.paymentStatus)}>
                    {getPaymentStatusLabel(sale.paymentStatus)}
                  </Badge>
                  <Badge>{formatPaymentMethod(sale.paymentMethod)}</Badge>
                  <Badge>{sale.invoiceNumber}</Badge>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
                    Refund workspace
                  </h3>
                  <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
                    Review the exact products sold on this invoice, choose the units that should
                    return to stock, and preview the financial impact before the refund is posted.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="size-10 rounded-xl px-0"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="subtle-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Original total" value={formatCurrency(sale.totalAmount)} />
              <MetricTile label="Already refunded" value={formatCurrency(refundedAmount)} />
              <MetricTile
                label={sale.paymentStatus === "refunded" ? "Net cash impact" : "Net retained"}
                value={formatCurrency(sale.paymentStatus === "refunded" ? signedTotal : netTotal)}
              />
              <MetricTile
                label={refundedUnits > 0 ? "Refundable units left" : "Units sold"}
                value={`${refundableUnitsBefore > 0 ? refundableUnitsBefore : totalUnits}`}
              />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="space-y-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
                <SectionHeading
                  icon={<Package className="size-4" />}
                  title="Products and refund selection"
                  description="Select a refund strategy, then adjust quantities directly inside the product card that belongs to the invoice."
                />

                {canRefund ? (
                  <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                          Refund strategy
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                          Choose between refunding the remaining invoice balance or returning
                          specific product units.
                        </p>
                      </div>
                      {allowItemRefundChoice ? (
                        <div className="grid min-w-[20rem] gap-2 sm:grid-cols-2">
                          <StrategyButton
                            active={effectiveScope === "order"}
                            title="Remaining order"
                            description="Refund every refundable unit left on this invoice."
                            onClick={() => setRefundScopeOverride("order")}
                            disabled={refundBusy}
                          />
                          <StrategyButton
                            active={effectiveScope === "item"}
                            title="Product units"
                            description="Select one product line and choose the exact units to return."
                            onClick={() => setRefundScopeOverride("item")}
                            disabled={refundBusy}
                          />
                        </div>
                      ) : (
                        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                          This invoice can only be refunded as a remaining-order operation from the
                          current database setup.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {sale.paymentStatus === "partially_refunded" ? (
                  <div className="rounded-[20px] border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm leading-6 text-[var(--heading)] dark:text-white">
                    This invoice already contains posted refund activity. Remaining units stay
                    refundable, and every new refund will extend the audit trail instead of
                    replacing the previous event.
                  </div>
                ) : null}

                {showPartialRefundUnavailableNotice && refundCapabilityMessage ? (
                  <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-[var(--heading)] dark:text-white">
                    Single-product refunds are unavailable on the current database.{" "}
                    {refundCapabilityMessage}
                  </div>
                ) : null}

                <div className="space-y-3">
                  {sale.items.map((item) => {
                    const refundableQuantity = getRefundableQuantity(item);
                    const refundedQuantity = getRefundedQuantity(item);
                    const refundTone = getProductRefundTone(item);
                    const isSelected =
                      effectiveScope === "item" && selectedRefundItem?.id === item.id;
                    const canSelectItem =
                      allowItemRefundChoice && effectiveScope === "item" && refundableQuantity > 0;
                    const selectedLineRefundTotal = isSelected
                      ? getPerUnitRefundAmount(item, effectiveRefundQuantity)
                      : 0;
                    const remainingAfterThisSelection = isSelected
                      ? Math.max(0, refundableQuantity - effectiveRefundQuantity)
                      : refundableQuantity;
                    const margin =
                      item.lineTotal > 0 ? item.lineProfit / item.lineTotal : 0;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-[24px] border p-4 transition-colors",
                          isSelected
                            ? "border-[var(--brand)] bg-[var(--brand-surface)]/40 shadow-[0_12px_32px_rgba(37,99,235,0.08)]"
                            : "border-[var(--border)] bg-[var(--surface-soft)]",
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex gap-3">
                            <div className="flex size-14 shrink-0 items-center justify-center rounded-[18px] border border-[var(--border)] bg-[var(--surface)] text-[var(--heading)]">
                              <Package className="size-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-[var(--heading)]">
                                  {item.productName}
                                </p>
                                <span className={cn("status-pill", refundTone.className)}>
                                  {refundTone.label}
                                </span>
                                {isSelected ? (
                                  <span className="status-pill border-[var(--brand)]/20 bg-[var(--brand-surface)] text-[var(--brand)]">
                                    Selected for refund
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
                                <span>SKU {item.sku || "N/A"}</span>
                                <span>{item.quantity} sold</span>
                                <span>{formatCurrency(item.unitPrice)} each</span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <InlineMetric label="Sold" value={`${item.quantity} units`} />
                                <InlineMetric
                                  label="Refunded"
                                  value={`${refundedQuantity} unit${refundedQuantity === 1 ? "" : "s"}`}
                                />
                                <InlineMetric
                                  label="Refundable"
                                  value={`${refundableQuantity} unit${refundableQuantity === 1 ? "" : "s"}`}
                                />
                                <InlineMetric
                                  label="Refunded value"
                                  value={formatCurrency(getRefundedLineTotal(item))}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="min-w-[14rem] rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                              Admin financial view
                            </p>
                            <p className="mt-2 text-lg font-semibold text-[var(--heading)]">
                              {formatCurrency(item.lineTotal)}
                            </p>
                            <div className="mt-2 space-y-1 text-sm text-[var(--muted-foreground)]">
                              <p>Profit {formatCurrency(item.lineProfit)}</p>
                              <p>Margin {formatPercent(margin)}</p>
                              <p>Remaining value {formatCurrency(getNetLineTotal(item))}</p>
                              <p>Remaining profit {formatCurrency(getNetLineProfit(item))}</p>
                            </div>
                          </div>
                        </div>

                        {effectiveScope === "order" ? (
                          <div className="mt-4 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--muted-foreground)]">
                            {refundableQuantity > 0
                              ? `${refundableQuantity} refundable unit${refundableQuantity === 1 ? "" : "s"} from this line will be included in the remaining-order refund.`
                              : "This line is already finalized and will not be included in any new refund."}
                          </div>
                        ) : null}

                        {effectiveScope === "item" ? (
                          <div className="mt-4 rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                                    Product refund control
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                                    Quantities stay connected to the product line so the invoice,
                                    stock, and audit trail remain aligned.
                                  </p>
                                </div>

                                {canSelectItem ? (
                                  isSelected ? (
                                    <QuantityStepper
                                      value={effectiveRefundQuantity}
                                      min={1}
                                      max={refundableQuantity}
                                      onDecrement={() => setRefundQuantity(effectiveRefundQuantity - 1)}
                                      onIncrement={() => setRefundQuantity(effectiveRefundQuantity + 1)}
                                      onChange={(nextValue) => setRefundQuantity(nextValue)}
                                      disabled={refundBusy}
                                    />
                                  ) : (
                                    <Button
                                      variant="secondary"
                                      className="h-11 rounded-2xl"
                                      onClick={() => selectRefundItem(item.id)}
                                      disabled={refundBusy}
                                    >
                                      Refund this product
                                    </Button>
                                  )
                                ) : (
                                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                                    {refundableQuantity > 0
                                      ? "Switch the refund strategy to product units to control this line directly."
                                      : "This product line no longer has refundable units available."}
                                  </div>
                                )}
                              </div>

                              <div className="min-w-[17rem] rounded-[20px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                                  Live refund preview
                                </p>
                                <div className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
                                  <SummaryRow
                                    label="Refund subtotal"
                                    value={
                                      isSelected
                                        ? formatCurrency(selectedLineRefundTotal)
                                        : formatCurrency(0)
                                    }
                                  />
                                  <SummaryRow
                                    label="Units returning to stock"
                                    value={`${isSelected ? effectiveRefundQuantity : 0}`}
                                  />
                                  <SummaryRow
                                    label="Remaining after this refund"
                                    value={`${remainingAfterThisSelection} unit${remainingAfterThisSelection === 1 ? "" : "s"}`}
                                  />
                                </div>
                                {isSelected ? (
                                  <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
                                    {effectiveRefundQuantity} unit
                                    {effectiveRefundQuantity === 1 ? "" : "s"} will be returned to
                                    inventory stock if this refund is processed.
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="space-y-4">
                <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <SectionHeading
                    icon={<ReceiptText className="size-4" />}
                    title="Invoice context"
                    description="Operational metadata stays visible while you work so refund decisions stay tied to the actual invoice."
                  />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DetailField label="Invoice ID" value={sale.invoiceNumber} />
                    <DetailField label="Customer" value={sale.customerName || "Walk-in customer"} />
                    <DetailField label="Cashier" value={sale.employeeName} />
                    <DetailField label="Employee ID" value={sale.employeeId} />
                    <DetailField label="Payment method" value={formatPaymentMethod(sale.paymentMethod)} />
                    <DetailField
                      label={
                        sale.paymentStatus === "refunded"
                          ? "Refunded at"
                          : sale.paymentStatus === "partially_refunded"
                            ? "Last refund"
                            : sale.paymentStatus === "pending"
                              ? "Created at"
                              : "Paid at"
                      }
                      value={formatDateTime(getSaleEventDate(sale))}
                    />
                    <DetailField label="Original total" value={formatCurrency(sale.totalAmount)} />
                    <DetailField label="Net retained" value={formatCurrency(netTotal)} />
                  </div>

                  <div className="mt-4 rounded-[20px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--heading)]">
                      <UserRound className="size-4" />
                      <p className="text-sm font-semibold">Invoice notes</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                      {sale.notes || "No notes were captured for this invoice."}
                    </p>
                  </div>
                </section>

                <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <SectionHeading
                    icon={<RotateCcw className="size-4" />}
                    title="Refund summary"
                    description="Preview the financial, inventory, and invoice impact before any refund is posted."
                  />

                  {sale.paymentStatus === "refunded" ? (
                    <div className="mt-4 rounded-[22px] border border-sky-500/20 bg-sky-500/10 px-4 py-4 text-sm leading-6 text-[var(--heading)] dark:text-white">
                      This invoice is fully refunded. Inventory has already been returned to stock,
                      and the refund history below remains available for audit review.
                    </div>
                  ) : canRefund ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                              Refund authorization preview
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                              {effectiveScope === "order"
                                ? "Every refundable unit left on the invoice will be returned."
                                : "Only the selected product units below will be returned."}
                            </p>
                          </div>
                          <div className="rounded-[18px] bg-[var(--surface)] px-4 py-3 text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                              Final refund
                            </p>
                            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
                              {formatCurrency(operationSubtotal)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                          <SummaryRow
                            label="Products selected"
                            value={`${selectedProductsCount}`}
                          />
                          <SummaryRow label="Units refunded" value={`${operationUnits}`} />
                          <SummaryRow
                            label="Refund subtotal"
                            value={formatCurrency(operationSubtotal)}
                          />
                          <SummaryRow label="Tax adjustment" value={formatCurrency(0)} />
                          <SummaryRow
                            label="Projected retained total"
                            value={formatCurrency(projectedNetTotal)}
                            emphasized
                          />
                          <SummaryRow
                            label="Projected invoice status"
                            value={getPaymentStatusLabel(projectedPaymentStatus)}
                          />
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                        <div className="flex items-center gap-2 text-[var(--heading)]">
                          <Calculator className="size-4" />
                          <p className="text-sm font-semibold">Operational safeguards</p>
                        </div>
                        <div className="mt-3 space-y-3">
                          <SafetyCallout
                            icon={<Package className="size-4" />}
                            title="Inventory reintegration"
                            body={`${operationUnits} unit${operationUnits === 1 ? "" : "s"} will be returned to inventory stock when this refund is processed.`}
                          />
                          <SafetyCallout
                            icon={<CheckCircle2 className="size-4" />}
                            title="Remaining refundable balance"
                            body={`${remainingUnitsAfterOperation} refundable unit${remainingUnitsAfterOperation === 1 ? "" : "s"} will remain on this invoice after this operation.`}
                          />
                          <SafetyCallout
                            icon={<ShieldCheck className="size-4" />}
                            title="Audit trail"
                            body="The refund reason, quantities, and operator attribution will be written to the invoice audit history."
                          />
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                        <div className="flex items-center gap-2 text-[var(--heading)]">
                          <ClipboardList className="size-4" />
                          <p className="text-sm font-semibold">Refund reason</p>
                        </div>
                        <div className="mt-4 space-y-3">
                          <label className="block space-y-2">
                            <span className="field-label">Reason category</span>
                            <Select
                              value={refundReasonCode}
                              onChange={(event) =>
                                setRefundReasonCode(event.target.value as RefundReasonCode)
                              }
                              disabled={refundBusy}
                            >
                              {REFUND_REASON_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                            <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                              {REFUND_REASON_OPTIONS.find((option) => option.value === refundReasonCode)
                                ?.helper ?? ""}
                            </p>
                          </label>

                          <label className="block space-y-2">
                            <span className="field-label">Reason details</span>
                            <Textarea
                              value={refundReasonNote}
                              onChange={(event) => setRefundReasonNote(event.target.value)}
                              placeholder="Add any customer context, damage note, or approval detail you want saved with this refund."
                              disabled={refundBusy}
                            />
                          </label>
                        </div>
                      </div>

                      {refundError ? (
                        <div className="rounded-[20px] border border-[var(--danger)]/18 bg-[var(--danger)]/10 px-4 py-3 text-sm leading-6 text-[var(--heading)] dark:text-white">
                          {refundError}
                        </div>
                      ) : null}

                      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 size-4 text-[var(--danger)]" />
                          <div>
                            <p className="text-sm font-semibold text-[var(--heading)]">
                              Financial confirmation required
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                              Posting this refund updates inventory, invoice totals, and audit logs.
                              Review the preview above, then confirm the action.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                          <Button
                            variant="secondary"
                            className="h-11 flex-1 rounded-2xl"
                            onClick={onClose}
                            disabled={refundBusy}
                          >
                            Close workspace
                          </Button>
                          <Button
                            variant="danger"
                            className="h-11 flex-1 rounded-2xl"
                            onClick={openConfirmation}
                            disabled={refundBusy || selectedRefundLines.length === 0}
                          >
                            {refundBusy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                            Process Refund
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4 text-sm leading-6 text-[var(--muted-foreground)]">
                      Only paid or partially refunded completed sales with remaining items can be
                      refunded from this workspace.
                    </div>
                  )}
                </section>

                <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <SectionHeading
                    icon={<ClipboardList className="size-4" />}
                    title="Refund history"
                    description="Each refund event is tied back to the invoice so managers can review who approved it, what changed, and when it happened."
                  />
                  <div className="mt-4 space-y-3">
                    {refundHistory.length === 0 ? (
                      <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4 text-sm leading-6 text-[var(--muted-foreground)]">
                        No refund events have been recorded for this invoice yet.
                      </div>
                    ) : (
                      refundHistory.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="status-pill border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-200">
                                  Refunded by {event.actorName}
                                </span>
                                <span className="status-pill border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]">
                                  {formatDateTime(event.createdAt)}
                                </span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                                {event.reason || "No refund reason was saved for this event."}
                              </p>
                            </div>
                            <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-right">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                                Refund amount
                              </p>
                              <p className="mt-2 text-lg font-semibold text-[var(--heading)]">
                                {formatCurrency(event.amount)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {event.items.map((item) => (
                              <span
                                key={`${event.id}-${item.saleItemId}`}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--heading)]"
                              >
                                {item.productName}
                                <span className="text-[var(--muted-foreground)]">
                                  {item.quantity} unit{item.quantity === 1 ? "" : "s"}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>

          {confirmOpen ? (
            <RefundConfirmationModal
              refundBusy={refundBusy}
              scope={effectiveScope}
              lines={selectedRefundLines}
              refundTotal={operationSubtotal}
              projectedStatus={projectedPaymentStatus}
              onCancel={() => setConfirmOpen(false)}
              onConfirm={() => void handleRefund()}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile rounded-[20px] px-4 py-4">
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--heading)]">{value}</p>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[var(--heading)]">
        <span className="flex size-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]">
          {icon}
        </span>
        <h4 className="font-semibold">{title}</h4>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-[var(--heading)]">{value}</p>
    </div>
  );
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--heading)]">
      <span className="font-semibold text-[var(--muted-foreground)]">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function SummaryRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className={cn("font-medium text-[var(--heading)]", emphasized && "text-base font-semibold")}>
        {value}
      </span>
    </div>
  );
}

function SafetyCallout({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--heading)]">
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--heading)]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{body}</p>
        </div>
      </div>
    </div>
  );
}

function StrategyButton({
  active,
  title,
  description,
  onClick,
  disabled,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-[20px] border px-4 py-3 text-left transition-colors",
        active
          ? "border-[var(--brand)] bg-[var(--brand-surface)] text-[var(--heading)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)]",
      )}
    >
      <p className="text-sm font-semibold text-[var(--heading)]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{description}</p>
    </button>
  );
}

function QuantityStepper({
  value,
  min,
  max,
  onDecrement,
  onIncrement,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  onDecrement: () => void;
  onIncrement: () => void;
  onChange: (nextValue: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        className="size-11 rounded-2xl px-0"
        onClick={onDecrement}
        disabled={disabled || value <= min}
      >
        <Minus className="size-4" />
      </Button>
      <Input
        type="number"
        min={min}
        max={max}
        value={String(value)}
        disabled={disabled}
        inputMode="numeric"
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (!Number.isFinite(nextValue)) {
            return;
          }

          onChange(nextValue);
        }}
        className="h-11 w-20 rounded-2xl px-3 text-center text-base font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Button
        variant="secondary"
        className="size-11 rounded-2xl px-0"
        onClick={onIncrement}
        disabled={disabled || value >= max}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

function RefundConfirmationModal({
  refundBusy,
  scope,
  lines,
  refundTotal,
  projectedStatus,
  onCancel,
  onConfirm,
}: {
  refundBusy: boolean;
  scope: "order" | "item";
  lines: Array<{ item: SaleItemRecord; quantity: number }>;
  refundTotal: number;
  projectedStatus: "partially_refunded" | "refunded";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/35 p-5">
      <div className="w-full max-w-xl rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Confirm refund
            </p>
            <h4 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
              Process this refund now?
            </h4>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Review the selected quantities and financial impact one more time before posting the
              refund.
            </p>
          </div>
          <Button variant="ghost" className="size-10 rounded-xl px-0" onClick={onCancel}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-5 space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          {lines.map((line) => (
            <div
              key={line.item.id}
              className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--heading)]">
                  {line.item.productName}
                </p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {line.quantity} unit{line.quantity === 1 ? "" : "s"} selected
                </p>
              </div>
              <p className="text-sm font-semibold text-[var(--heading)]">
                {formatCurrency(getPerUnitRefundAmount(line.item, line.quantity))}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <SafetyCallout
            icon={<Package className="size-4" />}
            title="Inventory update"
            body="Selected units will be returned to stock immediately after the refund is posted."
          />
          <SafetyCallout
            icon={<Calculator className="size-4" />}
            title="Invoice update"
            body={`The invoice will move to ${getPaymentStatusLabel(projectedStatus).toLowerCase()} after this ${scope === "order" ? "remaining-order" : "product-unit"} refund.`}
          />
          <SafetyCallout
            icon={<ShieldCheck className="size-4" />}
            title="Audit logging"
            body="The system will capture the refund reason, affected quantities, and operator attribution."
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Refund amount
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
              {formatCurrency(refundTotal)}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" className="h-11 rounded-2xl" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="h-11 rounded-2xl"
              onClick={onConfirm}
              disabled={refundBusy}
            >
              {refundBusy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Process Refund
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
