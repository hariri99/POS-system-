"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { ChevronDown } from "lucide-react";
import { ScrollableWidget } from "@/components/dashboard/scrollable-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { type ProductRecord, type SaleRecord } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type RiskSort = "low-stock" | "fast-selling" | "expiring-soon";

interface InventoryRiskPanelProps {
  products: ProductRecord[];
  sales: SaleRecord[];
  pageSize?: number;
  className?: string;
}

export function InventoryRiskPanel({
  products,
  sales,
  pageSize = 6,
  className,
}: InventoryRiskPanelProps) {
  const [sortMode, setSortMode] = useState<RiskSort>("low-stock");
  const [query, setQuery] = useState("");
  const [visibleState, setVisibleState] = useState({ key: "", count: pageSize });
  const deferredQuery = useDeferredValue(query);
  const filterKey = `${sortMode}|${deferredQuery.trim().toLowerCase()}`;

  const soldUnitsByProductId = useMemo(() => {
    const units = new Map<string, number>();

    sales
      .filter((sale) => sale.status === "completed")
      .forEach((sale) => {
        sale.items.forEach((item) => {
          units.set(item.productId, (units.get(item.productId) ?? 0) + item.quantity);
        });
      });

    return units;
  }, [sales]);

  const riskProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return products
      .filter((product) => {
        const expiringDays = getDaysUntilExpiry(product.expiryDate);
        const isRisk =
          product.stockQuantity <= product.reorderPoint ||
          (expiringDays !== null && expiringDays <= 30);

        if (!isRisk) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = [product.name, product.brandName, product.categoryName, product.sku]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (sortMode === "fast-selling") {
          return (soldUnitsByProductId.get(right.id) ?? 0) - (soldUnitsByProductId.get(left.id) ?? 0);
        }

        if (sortMode === "expiring-soon") {
          const leftDays = getDaysUntilExpiry(left.expiryDate) ?? Number.POSITIVE_INFINITY;
          const rightDays = getDaysUntilExpiry(right.expiryDate) ?? Number.POSITIVE_INFINITY;
          return leftDays - rightDays;
        }

        const leftGap = left.stockQuantity - left.reorderPoint;
        const rightGap = right.stockQuantity - right.reorderPoint;

        if (leftGap === rightGap) {
          return (soldUnitsByProductId.get(right.id) ?? 0) - (soldUnitsByProductId.get(left.id) ?? 0);
        }

        return leftGap - rightGap;
      });
  }, [deferredQuery, products, soldUnitsByProductId, sortMode]);

  const visibleCount = visibleState.key === filterKey ? visibleState.count : pageSize;
  const visibleProducts = riskProducts.slice(0, visibleCount);
  const hasMore = visibleCount < riskProducts.length;

  return (
    <ScrollableWidget
      title="At-risk inventory"
      description="Track low-stock, fast-moving, and expiry-sensitive products without letting the dashboard stretch endlessly."
      badge={`${riskProducts.length} watchlist`}
      actionHref="/admin/products"
      className={cn("h-[44rem]", className)}
      controls={
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product, brand, category, or SKU"
          />
          <Select value={sortMode} onChange={(event) => setSortMode(event.target.value as RiskSort)}>
            <option value="low-stock">Lowest stock</option>
            <option value="fast-selling">Fastest selling</option>
            <option value="expiring-soon">Expiring soon</option>
          </Select>
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[var(--muted-foreground)]">
            Showing {visibleProducts.length} of {riskProducts.length} tracked products.
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
            <p className="text-sm text-[var(--muted-foreground)]">All current inventory alerts are visible.</p>
          )}
        </div>
      }
    >
      {riskProducts.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-8 text-sm text-[var(--muted-foreground)]">
          No at-risk products matched the current inventory filters.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleProducts.map((product) => (
            <InventoryRiskRow
              key={product.id}
              product={product}
              soldUnits={soldUnitsByProductId.get(product.id) ?? 0}
            />
          ))}
        </div>
      )}
    </ScrollableWidget>
  );
}

function InventoryRiskRow({
  product,
  soldUnits,
}: {
  product: ProductRecord;
  soldUnits: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const expiryDays = getDaysUntilExpiry(product.expiryDate);
  const priority = getInventoryPriority(product, expiryDays);

  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.8fr))]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-[var(--heading)]">
              {product.name}
              {product.flavor ? ` / ${product.flavor}` : ""}
            </p>
            <span className={cn("status-pill", priority.className)}>{priority.label}</span>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {product.categoryName} / {product.brandName}
          </p>
        </div>

        <StatCell label="On hand" value={`${product.stockQuantity}`} />
        <StatCell label="Reorder point" value={`${product.reorderPoint}`} />
        <StatCell
          label={soldUnits > 0 ? "Recent units sold" : "Expiry date"}
          value={soldUnits > 0 ? `${soldUnits}` : formatDate(product.expiryDate)}
        />
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-[var(--border)] pt-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {expiryDays !== null ? (
            <span className="status-pill border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]">
              {expiryDays < 0
                ? "Expired"
                : expiryDays === 0
                  ? "Expires today"
                  : `${expiryDays} day${expiryDays === 1 ? "" : "s"} to expiry`}
            </span>
          ) : null}
          {soldUnits > 0 ? (
            <span className="status-pill border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]">
              Fast mover signal
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)] transition-colors hover:text-[var(--brand-strong)]"
        >
          {expanded ? "Hide details" : "Expand details"}
          <ChevronDown className={cn("size-4 transition-transform", expanded ? "rotate-180" : "")} />
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 grid gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface-soft)] p-4 md:grid-cols-2">
          <DetailField label="SKU" value={product.sku || "N/A"} />
          <DetailField label="Expiry date" value={formatDate(product.expiryDate)} />
          <DetailField label="Available stock" value={`${product.stockQuantity}`} />
          <DetailField label="Replenishment threshold" value={`${product.reorderPoint}`} />
        </div>
      ) : null}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 font-semibold text-[var(--heading)]">{value}</p>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-[var(--heading)]">{value}</p>
    </div>
  );
}

function getDaysUntilExpiry(expiryDate: string | null) {
  if (!expiryDate) {
    return null;
  }

  return differenceInCalendarDays(parseISO(expiryDate), new Date());
}

function getInventoryPriority(product: ProductRecord, expiryDays: number | null) {
  if (product.stockQuantity <= Math.max(1, Math.floor(product.reorderPoint * 0.5))) {
    return {
      label: "Critical stock",
      className: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
    };
  }

  if (expiryDays !== null && expiryDays <= 7) {
    return {
      label: "Expiry urgent",
      className: "border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-200",
    };
  }

  if (product.stockQuantity <= product.reorderPoint) {
    return {
      label: "Reorder soon",
      className: "border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-200",
    };
  }

  return {
    label: "Watchlist",
    className: "border-sky-500/20 bg-sky-500/12 text-sky-700 dark:text-sky-200",
  };
}
