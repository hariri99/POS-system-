"use client";

import { useEffect, useMemo, useState } from "react";
import { TransactionListPanel } from "@/components/sales/transaction-list-panel";
import { Card } from "@/components/ui/card";
import { getSaleNetTotal, isRefundableStatus } from "@/lib/sale-math";
import { type SaleRecord, type SaleRefundInput } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type RefundCapabilities = {
  fullOrderRefunds: boolean;
  partialItemRefunds: boolean;
  migrationPath: string | null;
  message: string | null;
};

export function SalesManager({ initialSales }: { initialSales: SaleRecord[] }) {
  const [sales, setSales] = useState(initialSales);
  const [message, setMessage] = useState<string | null>(null);
  const [busySaleId, setBusySaleId] = useState<string | null>(null);
  const [refundCapabilities, setRefundCapabilities] = useState<RefundCapabilities | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRefundCapabilities() {
      try {
        const response = await fetch("/api/sales/refund-capabilities", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: RefundCapabilities }
          | null;

        if (!cancelled && response.ok && payload?.success && payload.data) {
          setRefundCapabilities(payload.data);
        }
      } catch {
        // Keep the safe default and let the refund API remain the source of truth.
      }
    }

    void loadRefundCapabilities();

    return () => {
      cancelled = true;
    };
  }, []);

  const pendingSales = useMemo(
    () =>
      sales.filter((sale) => sale.status === "completed" && sale.paymentStatus === "pending"),
    [sales],
  );
  const settledSales = useMemo(
    () =>
      sales.filter(
        (sale) =>
          sale.status === "completed" &&
          isRefundableStatus(sale.paymentStatus) &&
          getSaleNetTotal(sale) > 0,
      ),
    [sales],
  );

  const pendingAmount = pendingSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const completedSales = useMemo(
    () => sales.filter((sale) => sale.status === "completed"),
    [sales],
  );
  const partialItemRefundsEnabled = refundCapabilities?.partialItemRefunds ?? false;
  const refundCapabilityMessage = refundCapabilities?.message ?? null;

  async function markAsPaid(saleId: string) {
    setMessage(null);
    setBusySaleId(saleId);

    try {
      const response = await fetch(`/api/sales/${saleId}/settle`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; message?: string; data?: SaleRecord }
        | null;

      if (!response.ok || !payload?.success || !payload.data) {
        setMessage(payload?.message ?? "Unable to mark this unpaid order as paid.");
        return;
      }

      setSales((current) =>
        current.map((sale) => (sale.id === payload.data!.id ? payload.data! : sale)),
      );
      setMessage(`Order ${payload.data.invoiceNumber} marked as paid.`);
    } catch {
      setMessage("Unexpected error while marking the order as paid.");
    } finally {
      setBusySaleId(null);
    }
  }

  async function deletePendingSale(saleId: string) {
    setMessage(null);
    setBusySaleId(saleId);

    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; message?: string; data?: SaleRecord }
        | null;

      if (!response.ok || !payload?.success) {
        setMessage(payload?.message ?? "Unable to delete this unpaid order.");
        return;
      }

      setSales((current) => current.filter((sale) => sale.id !== saleId));
      setMessage("Unpaid order deleted and stock restored.");
    } catch {
      setMessage("Unexpected error while deleting the unpaid order.");
    } finally {
      setBusySaleId(null);
    }
  }

  async function refundSale(input: SaleRefundInput & { saleId: string }) {
    setMessage(null);
    setBusySaleId(input.saleId);

    try {
      const response = await fetch(`/api/sales/${input.saleId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: input.scope,
          saleItemId: input.saleItemId,
          quantity: input.quantity,
          reason: input.reason,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; message?: string; data?: SaleRecord }
        | null;

      if (!response.ok || !payload?.success || !payload.data) {
        const nextMessage = payload?.message ?? "Unable to refund this paid order.";
        setMessage(nextMessage);
        throw new Error(nextMessage);
      }

      setSales((current) =>
        current.map((sale) => (sale.id === payload.data!.id ? payload.data! : sale)),
      );
      setMessage(
        input.scope === "item"
          ? `Product refund saved for ${payload.data.invoiceNumber} and inventory restored.`
          : `Order refund saved for ${payload.data.invoiceNumber} and inventory restored.`,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      const nextMessage = "Unexpected error while refunding the sale.";
      setMessage(nextMessage);
      throw new Error(nextMessage);
    } finally {
      setBusySaleId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Unpaid orders
          </p>
          <p className="text-3xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
            {pendingSales.length}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Orders waiting for customer payment.
          </p>
        </Card>
        <Card className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Receivable total
          </p>
          <p className="text-3xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
            {formatCurrency(pendingAmount)}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Amount still owed from pay-later orders.
          </p>
        </Card>
        <Card className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Revenue-active sales
          </p>
          <p className="text-3xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
            {settledSales.length}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Paid and partially refunded orders still contributing to net revenue.
          </p>
        </Card>
      </div>

      {message ? (
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
          {message}
        </div>
      ) : null}

      {!partialItemRefundsEnabled && refundCapabilityMessage ? (
        <div className="rounded-[18px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-[var(--heading)] dark:text-white">
          Single-product refunds are temporarily unavailable on this database.
          {" "}
          {refundCapabilityMessage}
        </div>
      ) : null}

      <TransactionListPanel
        title="Transaction control center"
        description={
          refundCapabilities?.partialItemRefunds === false
            ? "Switch between paid, unpaid, partially refunded, and refunded invoices, open invoice details to process full-order refunds, and keep stock and revenue in sync while the line-item refund migration is still pending."
            : "Switch between paid, unpaid, partially refunded, and refunded invoices, open invoice details to process either a full-order refund or a single-product refund, and keep stock and revenue in sync."
        }
        sales={completedSales}
        defaultStatus="all"
        availableStatuses={["all", "pending", "paid", "partially_refunded", "refunded"]}
        showStatusTabs
        allowSearch
        allowTimeFilter
        badge={`${completedSales.length} tracked`}
        pageSize={10}
        className="h-[48rem]"
        emptyMessage="No transactions matched the selected status, timeframe, or search query."
        busySaleId={busySaleId}
        onMarkAsPaid={markAsPaid}
        onDeleteSale={deletePendingSale}
        onRefundSale={refundSale}
        allowPartialItemRefunds={partialItemRefundsEnabled}
        refundCapabilityMessage={refundCapabilityMessage}
      />
    </div>
  );
}
