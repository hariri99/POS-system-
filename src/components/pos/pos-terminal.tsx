"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { usePosStore } from "@/stores/pos-store";
import { type PaymentMethod, type ProductRecord, type SaleRecord } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function PosTerminal({
  products: initialProducts,
  recentSales: initialSales,
}: {
  products: ProductRecord[];
  recentSales: SaleRecord[];
}) {
  const cart = usePosStore((state) => state.cart);
  const addProduct = usePosStore((state) => state.addProduct);
  const removeProduct = usePosStore((state) => state.removeProduct);
  const updateQuantity = usePosStore((state) => state.updateQuantity);
  const updateDiscount = usePosStore((state) => state.updateDiscount);
  const clearCart = usePosStore((state) => state.clearCart);
  const [query, setQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState("0");
  const [products, setProducts] = useState(initialProducts);
  const [recentSales, setRecentSales] = useState(initialSales);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredProducts = useMemo(() => {
    const normalized = query.toLowerCase();
    return products.filter((product) =>
      [product.name, product.flavor, product.sku, product.barcode]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [products, query]);

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const lineDiscounts = cart.reduce((sum, item) => sum + item.discountAmount, 0);
  const discount = Number(globalDiscount) + lineDiscounts;
  const total = Math.max(0, subtotal - discount);

  async function checkout() {
    if (cart.length === 0) {
      setMessage("Add at least one product to the cart.");
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/pos/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount,
          })),
          paymentMethod,
          notes,
          customerName,
          discountAmount: Number(globalDiscount),
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setMessage(payload.message ?? "Unable to complete sale.");
        return;
      }

      const sale = payload.data as SaleRecord;
      setProducts((current) =>
        current.map((product) => {
          const matchingLine = sale.items.find((item) => item.productId === product.id);
          if (!matchingLine) {
            return product;
          }

          return {
            ...product,
            stockQuantity: Math.max(0, product.stockQuantity - matchingLine.quantity),
          };
        }),
      );
      setRecentSales((current) => [sale, ...current]);
      clearCart();
      setNotes("");
      setCustomerName("");
      setGlobalDiscount("0");
      setMessage(`Sale completed. Receipt ${sale.invoiceNumber} for ${formatCurrency(sale.totalAmount)}.`);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
      <div className="space-y-6">
        <Card className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <span className="section-kicker">Sellable catalog</span>
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                  Quick product search
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  Search by product, flavor, SKU, or barcode and tap once to add to cart.
                </p>
              </div>
            </div>
            <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 py-2.5">
              <Search className="size-4 text-[var(--muted-foreground)]" />
              <Input
                className="h-auto border-none bg-transparent px-0 focus:ring-0"
                placeholder="Search product or barcode"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className="surface-card-strong group rounded-[20px] p-4 text-left transition-colors hover:border-[var(--brand)]/30 hover:bg-white/[0.06]"
                onClick={() => addProduct(product)}
              >
                <div className="relative mb-4 h-28 overflow-hidden rounded-[16px] border border-[var(--border)] bg-[#0d0f12]">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
                      No image
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="font-medium text-white">
                    {product.name}
                    {product.flavor ? ` / ${product.flavor}` : ""}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {product.brandName} / {product.sizeLabel || "No size"}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-lg font-semibold text-white">
                    {formatCurrency(product.salePrice)}
                  </span>
                  <span
                    className={`status-pill ${
                      product.stockQuantity <= product.reorderPoint
                        ? "border-amber-500/20 bg-amber-500/12 text-amber-200"
                        : "border-white/10 bg-white/[0.04] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {product.stockQuantity} in stock
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div>
            <h2 className="text-xl font-semibold text-white">Recent transactions</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Cashiers can confirm payment flow while managers audit timing and employee attribution.
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {recentSales.slice(0, 5).map((sale) => (
              <div
                key={sale.id}
                className="surface-card-strong flex flex-col gap-3 rounded-[18px] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-white">{sale.invoiceNumber}</p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {sale.employeeName} / {sale.paymentMethod}
                  </p>
                </div>
                <div className="md:text-right">
                  <p className="font-semibold text-white">{formatCurrency(sale.totalAmount)}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {new Date(sale.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="space-y-5 xl:sticky xl:top-28 xl:self-start">
        <div className="space-y-2">
          <span className="section-kicker">Checkout</span>
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">Cart summary</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Keep quantities, discounts, and totals readable so the cashier flow stays fast under
              pressure.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {cart.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-white/[0.03] p-5 text-sm text-[var(--muted-foreground)]">
              The cart is empty. Search or scan a product to start a sale.
            </div>
          ) : null}
          {cart.map((item) => (
            <div key={item.productId} className="surface-card-strong rounded-[18px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{formatCurrency(item.unitPrice)} each</p>
                </div>
                <Button
                  variant="ghost"
                  className="size-9 px-0"
                  onClick={() => removeProduct(item.productId)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="size-9 px-0"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="min-w-8 text-center font-semibold text-white">{item.quantity}</span>
                  <Button
                    variant="secondary"
                    className="size-9 px-0"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    className="w-28"
                    type="number"
                    min="0"
                    placeholder="Discount"
                    value={item.discountAmount}
                    onChange={(event) =>
                      updateDiscount(item.productId, Number(event.target.value || 0))
                    }
                  />
                  <span className="min-w-24 text-right font-semibold text-white">
                    {formatCurrency(item.quantity * item.unitPrice - item.discountAmount)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="field-label">Payment method</span>
            <Select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="mixed">Mixed</option>
            </Select>
          </label>
          <label className="space-y-2">
            <span className="field-label">Order discount</span>
            <Input
              type="number"
              min="0"
              value={globalDiscount}
              onChange={(event) => setGlobalDiscount(event.target.value)}
            />
          </label>
          <label className="space-y-2">
            <span className="field-label">Customer</span>
            <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="field-label">Notes</span>
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>

        <div className="surface-card-strong rounded-[20px] p-4">
          <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-[var(--muted-foreground)]">
            <span>Discounts</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4 text-lg font-semibold text-white">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button className="w-full" onClick={checkout} disabled={isPending}>
            Complete sale
          </Button>
          <Button className="w-full" variant="secondary" onClick={clearCart}>
            Cancel sale
          </Button>
        </div>

        {message ? (
          <div className="surface-card-strong rounded-[18px] px-4 py-3 text-sm text-[var(--muted-foreground)]">
            {message}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
