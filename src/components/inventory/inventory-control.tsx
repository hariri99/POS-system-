"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Boxes, History, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type ProductRecord, type StockMovementRecord, type SupplierRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function InventoryControl({
  products: initialProducts,
  suppliers,
  movements: initialMovements,
}: {
  products: ProductRecord[];
  suppliers: SupplierRecord[];
  movements: StockMovementRecord[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [movements, setMovements] = useState(initialMovements);
  const [form, setForm] = useState({
    productId: initialProducts[0]?.id ?? "",
    quantityDelta: "6",
    note: "Routine restock delivery",
    supplierId: suppliers[0]?.id ?? "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const lowStock = useMemo(
    () => products.filter((product) => product.stockQuantity <= product.reorderPoint),
    [products],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: form.productId,
          quantityDelta: Number(form.quantityDelta),
          note: form.note,
          supplierId: form.supplierId || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setMessage(payload.message ?? "Unable to adjust inventory.");
        return;
      }

      const movement = payload.data as StockMovementRecord;
      const quantityDelta = Number(form.quantityDelta);

      setProducts((current) =>
        current.map((product) =>
          product.id === form.productId
            ? {
                ...product,
                stockQuantity: product.stockQuantity + quantityDelta,
                updatedAt: new Date().toISOString(),
              }
            : product,
        ),
      );
      setMovements((current) => [movement, ...current]);
      setMessage("Inventory updated successfully.");
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card>
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <span className="section-kicker">Stock updates</span>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                Inventory adjustments
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Record restocks, corrections, damaged stock, and supplier-linked replenishment with
                a cleaner operations form.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="metric-tile rounded-[18px] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Products
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{products.length}</p>
            </div>
            <div className="metric-tile rounded-[18px] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Low stock
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{lowStock.length}</p>
            </div>
            <div className="metric-tile rounded-[18px] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Suppliers
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{suppliers.length}</p>
            </div>
          </div>

          <div className="surface-card-strong space-y-4 rounded-[20px] p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-white/[0.04] p-2.5 text-[var(--brand-soft)]">
                <PackagePlus className="size-4" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Adjustment details</h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Choose the product and stock change you want to apply.
                </p>
              </div>
            </div>

            <label className="space-y-2">
              <span className="field-label">Product</span>
              <Select
                value={form.productId}
                onChange={(event) => setForm((state) => ({ ...state, productId: event.target.value }))}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} {product.flavor ? `/ ${product.flavor}` : ""}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-2">
              <span className="field-label">Quantity delta</span>
              <Input
                type="number"
                value={form.quantityDelta}
                onChange={(event) =>
                  setForm((state) => ({ ...state, quantityDelta: event.target.value }))
                }
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Supplier</span>
              <Select
                value={form.supplierId}
                onChange={(event) => setForm((state) => ({ ...state, supplierId: event.target.value }))}
              >
                <option value="">Manual adjustment</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-2">
              <span className="field-label">Note</span>
              <Textarea
                value={form.note}
                onChange={(event) => setForm((state) => ({ ...state, note: event.target.value }))}
              />
            </label>
          </div>

          <Button className="w-full" type="submit" disabled={isPending}>
            Apply adjustment
          </Button>

          {message ? (
            <div className="surface-card-strong rounded-[18px] px-4 py-3 text-sm text-[var(--muted-foreground)]">
              {message}
            </div>
          ) : null}
        </form>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-[var(--border)] bg-white/[0.04] p-2.5 text-amber-200">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Low stock watchlist</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Products that need replenishment before the next rush.
                  </p>
                </div>
              </div>
            </div>
            <span className="status-pill border-amber-500/20 bg-amber-500/12 text-amber-200">
              {lowStock.length} flagged
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {lowStock.map((product) => (
              <div key={product.id} className="surface-card-strong rounded-[18px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">
                      {product.name} {product.flavor ? `/ ${product.flavor}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {product.categoryName} / {product.brandName}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-white/[0.04] p-2 text-[var(--brand-soft)]">
                    <Boxes className="size-4" />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="metric-tile rounded-[16px] px-4 py-3">
                    <p className="text-sm text-[var(--muted-foreground)]">On hand</p>
                    <p className="mt-1 font-semibold text-white">{product.stockQuantity}</p>
                  </div>
                  <div className="metric-tile rounded-[16px] px-4 py-3">
                    <p className="text-sm text-[var(--muted-foreground)]">Minimum</p>
                    <p className="mt-1 font-semibold text-white">{product.reorderPoint}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-white/[0.04] p-2.5 text-sky-200">
              <History className="size-4" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Movement log</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Each inventory change is timestamped for audit and reconciliation.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {movements.map((movement) => (
              <div
                key={movement.id}
                className="surface-card-strong flex flex-col gap-3 rounded-[18px] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium text-white">
                    {movement.productName} / {movement.quantityDelta > 0 ? "+" : ""}
                    {movement.quantityDelta}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">{movement.note}</p>
                </div>
                <div className="text-sm text-[var(--muted-foreground)] md:text-right">
                  <p>{movement.performedByName}</p>
                  <p>{formatDateTime(movement.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
