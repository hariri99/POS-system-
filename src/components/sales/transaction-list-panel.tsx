"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { format, isSameDay, parseISO, startOfMonth, startOfWeek, subDays } from "date-fns";
import { ArrowUpRight, Search } from "lucide-react";
import { ScrollableWidget } from "@/components/dashboard/scrollable-widget";
import { SaleDetailsDrawer } from "@/components/sales/sale-details-drawer";
import { SaleProductsPreview } from "@/components/sales/sale-products-preview";
import {
  getPaymentStatusClasses,
  getPaymentStatusLabel,
  getPendingAgeDays,
  getSaleEventDate,
  getSaleSignedProfit,
  getSaleSignedTotal,
  getSaleTotalUnits,
} from "@/components/sales/transaction-view-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getSaleRefundedAmount, isRefundableStatus } from "@/lib/sale-math";
import { type PaymentStatus, type SaleRecord, type SaleRefundInput } from "@/lib/types";
import { cn, formatCurrency, formatDateTime, formatPaymentMethod } from "@/lib/utils";

type TransactionTab = PaymentStatus | "all";
type TimeframeFilter = "today" | "week" | "month" | "all";

interface TransactionListPanelProps {
  title: string;
  description: string;
  sales: SaleRecord[];
  defaultStatus?: TransactionTab;
  availableStatuses?: TransactionTab[];
  showStatusTabs?: boolean;
  allowSearch?: boolean;
  allowTimeFilter?: boolean;
  actionHref?: string;
  actionLabel?: string;
  badge?: string;
  pageSize?: number;
  className?: string;
  emptyMessage?: string;
  groupByDay?: boolean;
  busySaleId?: string | null;
  onMarkAsPaid?: (saleId: string) => void | Promise<void>;
  onDeleteSale?: (saleId: string) => void | Promise<void>;
  onRefundSale?: (input: SaleRefundInput & { saleId: string }) => void | Promise<void>;
  allowPartialItemRefunds?: boolean;
  refundCapabilityMessage?: string | null;
}

const DEFAULT_STATUSES: TransactionTab[] = ["all", "paid", "pending", "partially_refunded", "refunded"];

const TIMEFRAME_OPTIONS: Array<{ value: TimeframeFilter; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

export function TransactionListPanel({
  title,
  description,
  sales,
  defaultStatus = "all",
  availableStatuses = DEFAULT_STATUSES,
  showStatusTabs = false,
  allowSearch = false,
  allowTimeFilter = true,
  actionHref,
  actionLabel,
  badge,
  pageSize = 8,
  className,
  emptyMessage = "No transactions matched the current search and filter set.",
  groupByDay = false,
  busySaleId,
  onMarkAsPaid,
  onDeleteSale,
  onRefundSale,
  allowPartialItemRefunds = true,
  refundCapabilityMessage,
}: TransactionListPanelProps) {
  const [activeStatus, setActiveStatus] = useState<TransactionTab>(defaultStatus);
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("month");
  const [query, setQuery] = useState("");
  const [visibleState, setVisibleState] = useState({ key: "", count: pageSize });
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const deferredQuery = useDeferredValue(query);
  const filterKey = `${activeStatus}|${timeframe}|${deferredQuery.trim().toLowerCase()}`;

  const filteredSales = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return sales.filter((sale) => {
      if (activeStatus !== "all" && sale.paymentStatus !== activeStatus) {
        return false;
      }

      if (!matchesTimeframe(sale, timeframe)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        sale.invoiceNumber,
        sale.customerName ?? "",
        sale.employeeName,
        sale.items.map((item) => item.productName).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [activeStatus, deferredQuery, sales, timeframe]);

  const visibleCount = visibleState.key === filterKey ? visibleState.count : pageSize;
  const visibleSales = filteredSales.slice(0, visibleCount);
  const groupedSales = useMemo(() => groupSalesByDay(visibleSales), [visibleSales]);
  const hasMore = visibleCount < filteredSales.length;
  const badgeLabel =
    badge ?? `${filteredSales.length} ${filteredSales.length === 1 ? "result" : "results"}`;

  return (
    <>
      <ScrollableWidget
        title={title}
        description={description}
        badge={badgeLabel}
        actionHref={actionHref}
        actionLabel={actionLabel}
        className={cn("h-[44rem]", className)}
        controls={
          <div className="space-y-3">
            {showStatusTabs ? (
              <div className="flex flex-wrap gap-2">
                {availableStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setActiveStatus(status)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                      activeStatus === status
                        ? "border-[var(--brand)] bg-[var(--brand-surface)] text-[var(--brand)]"
                        : "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--heading)]",
                    )}
                  >
                    {status === "all" ? "All" : getPaymentStatusLabel(status)}
                  </button>
                ))}
              </div>
            ) : null}

            {allowSearch || allowTimeFilter ? (
              <div
                className={cn(
                  "grid gap-3",
                  allowSearch && allowTimeFilter ? "md:grid-cols-[minmax(0,1fr)_13rem]" : "",
                )}
              >
                {allowSearch ? (
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search invoice, customer, cashier, or product"
                      className="pl-10"
                    />
                  </label>
                ) : null}

                {allowTimeFilter ? (
                  <Select
                    value={timeframe}
                    onChange={(event) => setTimeframe(event.target.value as TimeframeFilter)}
                  >
                    {TIMEFRAME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </div>
            ) : null}
          </div>
        }
        footer={
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">
              Showing {visibleSales.length} of {filteredSales.length} matching transactions.
            </p>
            {hasMore ? (
              <Button
                variant="secondary"
                onClick={() =>
                  setVisibleState({
                    key: filterKey,
                    count: visibleCount + pageSize,
                  })
                }
              >
                Load more
              </Button>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">End of the current result set.</p>
            )}
          </div>
        }
      >
        {filteredSales.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-8 text-sm text-[var(--muted-foreground)]">
            {emptyMessage}
          </div>
        ) : groupByDay ? (
          <div className="space-y-5">
            {groupedSales.map((group) => (
              <div key={group.label} className="space-y-3">
                <div className="sticky top-0 z-10 -mx-5 border-y border-[var(--border)] bg-[var(--background-muted)] px-5 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    {group.label}
                  </p>
                </div>
                <div className="space-y-3">
                  {group.sales.map((sale) => (
                    <CompactTransactionRow
                      key={sale.id}
                      sale={sale}
                      busy={busySaleId === sale.id}
                      onOpenDetails={() => setSelectedSale(sale)}
                      onMarkAsPaid={onMarkAsPaid}
                      onDeleteSale={onDeleteSale}
                      onRefundSale={onRefundSale}
                      variant="activity"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleSales.map((sale) => (
              <CompactTransactionRow
                key={sale.id}
                sale={sale}
                busy={busySaleId === sale.id}
                onOpenDetails={() => setSelectedSale(sale)}
                onMarkAsPaid={onMarkAsPaid}
                onDeleteSale={onDeleteSale}
                onRefundSale={onRefundSale}
              />
            ))}
          </div>
        )}
      </ScrollableWidget>

      {selectedSale ? (
        <SaleDetailsDrawer
          key={selectedSale.id}
          sale={selectedSale}
          busy={busySaleId === selectedSale.id}
          onClose={() => setSelectedSale(null)}
          onRefundSale={onRefundSale}
          allowPartialItemRefunds={allowPartialItemRefunds}
          refundCapabilityMessage={refundCapabilityMessage}
        />
      ) : null}
    </>
  );
}

function CompactTransactionRow({
  sale,
  busy,
  onOpenDetails,
  onMarkAsPaid,
  onDeleteSale,
  onRefundSale,
  variant = "default",
}: {
  sale: SaleRecord;
  busy: boolean;
  onOpenDetails: () => void;
  onMarkAsPaid?: (saleId: string) => void | Promise<void>;
  onDeleteSale?: (saleId: string) => void | Promise<void>;
  onRefundSale?: (input: SaleRefundInput & { saleId: string }) => void | Promise<void>;
  variant?: "default" | "activity";
}) {
  const saleDate = getSaleEventDate(sale);
  const totalUnits = getSaleTotalUnits(sale);
  const profit = getSaleSignedProfit(sale);
  const signedTotal = getSaleSignedTotal(sale);
  const refundedAmount = getSaleRefundedAmount(sale);
  const ageDays = sale.paymentStatus === "pending" ? getPendingAgeDays(sale) : 0;
  const timeLabel =
    variant === "activity" ? format(parseISO(saleDate), "HH:mm") : formatDateTime(saleDate);
  const isPending = sale.paymentStatus === "pending";
  const canRefund = isRefundableStatus(sale.paymentStatus) && totalUnits > 0 && Boolean(onRefundSale);
  const showReceivableActions = isPending && onMarkAsPaid && onDeleteSale;
  const eventLabel = isPending
    ? "Created"
    : sale.paymentStatus === "refunded"
      ? "Refunded at"
      : sale.paymentStatus === "partially_refunded"
        ? "Last refund"
        : "Paid at";

  return (
    <div className="group rounded-[22px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]">
      <div
        className={cn(
          "grid gap-3",
          variant === "activity"
            ? "lg:grid-cols-[4.5rem_minmax(0,1.35fr)_minmax(0,0.95fr)_auto]"
            : "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]",
        )}
      >
        {variant === "activity" ? (
          <div className="flex items-start gap-3 lg:block">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)] lg:flex-col lg:items-start lg:gap-1">
              <span>{timeLabel}</span>
              <span className="flex size-2 rounded-full bg-[var(--brand)]" />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-[var(--heading)]">{sale.invoiceNumber}</p>
            <span className={cn("status-pill", getPaymentStatusClasses(sale.paymentStatus))}>
              {getPaymentStatusLabel(sale.paymentStatus)}
            </span>
            <span className="status-pill border-white/10 bg-white/[0.04] text-[var(--muted-foreground)]">
              {formatPaymentMethod(sale.paymentMethod)}
            </span>
            {isPending ? (
              <span
                className={cn(
                  "status-pill",
                  ageDays >= 7
                    ? "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200"
                    : ageDays >= 3
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                      : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]",
                )}
              >
                {ageDays === 0 ? "Created today" : `${ageDays} day${ageDays === 1 ? "" : "s"} open`}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
            <p>
              Customer:{" "}
              <span className="font-medium text-[var(--heading)]">{sale.customerName || "Walk-in"}</span>
            </p>
            <p>
              Cashier: <span className="font-medium text-[var(--heading)]">{sale.employeeName}</span>
            </p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
          {variant === "activity" ? (
            <p className="font-medium text-[var(--heading)]">{formatDateTime(saleDate)}</p>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                {eventLabel}
              </p>
              <p className="font-medium text-[var(--heading)]">{timeLabel}</p>
            </>
          )}
          <p>{sale.items.length} line items</p>
        </div>

        <div className="space-y-2 lg:text-right">
          <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--heading)]">
            {formatCurrency(signedTotal)}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">Profit {formatCurrency(profit)}</p>
        </div>

        {variant !== "activity" ? (
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="ghost" className="h-9 px-3" onClick={onOpenDetails}>
              Details
            </Button>
            {canRefund ? (
              <Button variant="danger" className="h-9 px-3" disabled={busy} onClick={onOpenDetails}>
                {sale.paymentStatus === "partially_refunded" ? "Refund more" : "Refund"}
              </Button>
            ) : null}
            {showReceivableActions ? (
              <>
                <Button className="h-9 px-3" disabled={busy} onClick={() => void onMarkAsPaid(sale.id)}>
                  Mark paid
                </Button>
                <Button
                  variant="secondary"
                  className="h-9 px-3"
                  disabled={busy}
                  onClick={() => void onDeleteSale(sale.id)}
                >
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-[var(--border)] pt-3 lg:flex-row lg:items-center lg:justify-between">
        <SaleProductsPreview
          items={sale.items}
          compact
          displayMode="summary"
          summaryLabel={`${totalUnits} item${totalUnits === 1 ? "" : "s"} purchased`}
          showSummary={false}
        />

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {sale.notes ? (
            <span className="status-pill border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]">
              Notes saved
            </span>
          ) : null}
          {refundedAmount > 0 ? (
            <span className="status-pill border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-200">
              Refunded {formatCurrency(refundedAmount)}
            </span>
          ) : null}
          {variant === "activity" ? (
            <button
              type="button"
              onClick={onOpenDetails}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)] transition-colors hover:text-[var(--brand-strong)]"
            >
              View details
              <ArrowUpRight className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function groupSalesByDay(sales: SaleRecord[]) {
  return sales.reduce<Array<{ label: string; sales: SaleRecord[] }>>((groups, sale) => {
    const label = getDayBucketLabel(getSaleEventDate(sale));
    const existingGroup = groups.find((group) => group.label === label);

    if (existingGroup) {
      existingGroup.sales.push(sale);
      return groups;
    }

    groups.push({ label, sales: [sale] });
    return groups;
  }, []);
}

function getDayBucketLabel(date: string) {
  const parsedDate = parseISO(date);

  if (isSameDay(parsedDate, new Date())) {
    return "Today";
  }

  if (isSameDay(parsedDate, subDays(new Date(), 1))) {
    return "Yesterday";
  }

  return format(parsedDate, "dd MMM yyyy");
}

function matchesTimeframe(sale: SaleRecord, timeframe: TimeframeFilter) {
  if (timeframe === "all") {
    return true;
  }

  const saleDate = parseISO(getSaleEventDate(sale));
  const now = new Date();

  switch (timeframe) {
    case "today":
      return isSameDay(saleDate, now);
    case "week":
      return saleDate >= startOfWeek(now, { weekStartsOn: 1 });
    case "month":
      return saleDate >= startOfMonth(now);
    default:
      return true;
  }
}
