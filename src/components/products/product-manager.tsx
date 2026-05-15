"use client";

import Image from "next/image";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  Boxes,
  ClipboardPenLine,
  ImagePlus,
  PencilLine,
  Plus,
  Search,
  Tags,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type CategoryRecord, type ProductRecord } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface ProductManagerProps {
  products: ProductRecord[];
  categories: CategoryRecord[];
}

const initialForm = {
  id: "",
  name: "",
  description: "",
  categoryId: "",
  brandName: "",
  supplierId: "",
  flavor: "",
  sizeLabel: "",
  sku: "",
  barcode: "",
  salePrice: "0",
  costPrice: "0",
  stockQuantity: "0",
  reorderPoint: "0",
  expiryDate: "",
  imageUrl: "",
  isActive: true,
};

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="metric-tile rounded-[18px] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{value}</p>
    </div>
  );
}

function ProductSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card-strong rounded-[20px] p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-white/[0.04] p-2.5 text-[var(--brand-soft)]">
          {icon}
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ProductManager({
  products: initialProducts,
  categories,
}: ProductManagerProps) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    if (!query) {
      return products;
    }

    const normalized = query.toLowerCase();
    return products.filter((product) =>
      [product.name, product.flavor, product.brandName, product.categoryName].some((field) =>
        field.toLowerCase().includes(normalized),
      ),
    );
  }, [products, query]);

  const lowStockCount = products.filter(
    (product) => product.stockQuantity <= product.reorderPoint,
  ).length;

  function loadProduct(product: ProductRecord) {
    setForm({
      id: product.id,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      brandName: product.brandName,
      supplierId: product.supplierId,
      flavor: product.flavor,
      sizeLabel: product.sizeLabel,
      sku: product.sku,
      barcode: product.barcode,
      salePrice: String(product.salePrice),
      costPrice: String(product.costPrice),
      stockQuantity: String(product.stockQuantity),
      reorderPoint: String(product.reorderPoint),
      expiryDate: product.expiryDate?.slice(0, 10) ?? "",
      imageUrl: product.imageUrl ?? "",
      isActive: product.isActive,
    });
    setPreviewUrl(product.imageUrl ?? "");
    setMessage(`Editing ${product.name}. Internal system codes stay hidden and are preserved automatically.`);
  }

  function resetForm() {
    setForm(initialForm);
    setPreviewUrl("");
    setMessage("Ready for a new product. Upload an image if you want one, then fill the commercial details.");
  }

  async function uploadImage(file: File) {
    setMessage(null);
    setIsUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/uploads/product-image", {
        method: "POST",
        body,
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setMessage(payload.message ?? "Unable to upload image.");
        return;
      }

      const uploadedUrl = payload.data?.url as string;
      setForm((state) => ({ ...state, imageUrl: uploadedUrl }));
      setPreviewUrl(uploadedUrl);
      setMessage("Image uploaded successfully.");
    } catch {
      setMessage("Unexpected error while uploading image.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleFileSelection(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    await uploadImage(file);
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingImage(false);
    await handleFileSelection(event.dataTransfer.files);
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          salePrice: Number(form.salePrice),
          costPrice: Number(form.costPrice),
          stockQuantity: Number(form.stockQuantity),
          reorderPoint: Number(form.reorderPoint),
          expiryDate: form.expiryDate || null,
          imageUrl: form.imageUrl || null,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setMessage(payload.message ?? "Unable to save product.");
        return;
      }

      const nextProduct = payload.data as ProductRecord;
      setProducts((current) => {
        const existing = current.find((product) => product.id === nextProduct.id);
        return existing
          ? current.map((product) => (product.id === nextProduct.id ? nextProduct : product))
          : [nextProduct, ...current];
      });

      setMessage(
        form.id
          ? "Product updated successfully."
          : "Product created successfully with cloud-stored media and automatic internal coding.",
      );
      setForm(initialForm);
      setPreviewUrl("");
    });
  }

  async function archive(productId: string) {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setMessage(payload.message ?? "Unable to archive product.");
        return;
      }

      const nextProduct = payload.data as ProductRecord;
      setProducts((current) =>
        current.map((product) => (product.id === nextProduct.id ? nextProduct : product)),
      );
      setMessage("Product archived.");
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
      <Card className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <span className="section-kicker">Catalog entry</span>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                {form.id ? "Edit product" : "Create product"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Keep the form focused on the product itself. Internal SKU and barcode values are
                generated behind the scenes.
              </p>
            </div>
          </div>
          <Button variant="secondary" type="button" onClick={resetForm}>
            <Plus className="size-4" />
            New
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile label="Catalog" value={products.length} />
          <SummaryTile label="Low stock" value={lowStockCount} />
          <SummaryTile
            label="Active"
            value={products.filter((product) => product.isActive).length}
          />
        </div>

        <form className="space-y-4" onSubmit={submitProduct}>
          <ProductSection
            icon={<ClipboardPenLine className="size-4" />}
            title="Identity"
            description="Define the customer-facing name, flavor, size, and staff-friendly description."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="field-label">Product name</span>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, name: event.target.value }))
                  }
                  placeholder="Performance multivitamin"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="field-label">Flavor</span>
                <Input
                  value={form.flavor}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, flavor: event.target.value }))
                  }
                  placeholder="Unflavored"
                />
              </label>
              <label className="space-y-2">
                <span className="field-label">Size</span>
                <Input
                  value={form.sizeLabel}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, sizeLabel: event.target.value }))
                  }
                  placeholder="60 capsules"
                />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="field-label">Description</span>
                <Textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, description: event.target.value }))
                  }
                  placeholder="Short operational description for staff and future storefront use."
                />
              </label>
            </div>
          </ProductSection>

          <ProductSection
            icon={<Tags className="size-4" />}
            title="Classification"
            description="Place the product in the right category and type the brand name manually."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Category</span>
                <Select
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, categoryId: event.target.value }))
                  }
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2">
                <span className="field-label">Brand</span>
                <Input
                  value={form.brandName}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, brandName: event.target.value }))
                  }
                  placeholder="Optimum Fuel"
                  required
                />
              </label>
            </div>
          </ProductSection>

          <ProductSection
            icon={<ImagePlus className="size-4" />}
            title="Media"
            description="Attach a product image with click-to-select or drag-and-drop upload."
          >
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={(event) => void handleFileSelection(event.target.files)}
              />

              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingImage(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDraggingImage(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDraggingImage(false);
                }}
                onDrop={(event) => void handleDrop(event)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "rounded-[20px] border border-dashed p-5 transition-colors",
                  isDraggingImage
                    ? "border-[var(--brand)] bg-[var(--brand)]/10"
                    : "border-[var(--border)] bg-white/[0.03] hover:bg-white/[0.045]",
                )}
              >
                {previewUrl ? (
                  <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                    <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[#0d0f12]">
                      <Image
                        src={previewUrl}
                        alt="Product preview"
                        width={160}
                        height={160}
                        className="h-36 w-full object-cover"
                      />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-white">Image ready</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                          This media will appear in the catalog and cashier screens.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          disabled={isUploading}
                        >
                          <Upload className="size-4" />
                          {isUploading ? "Uploading..." : "Replace image"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            setForm((state) => ({ ...state, imageUrl: "" }));
                            setPreviewUrl("");
                            setMessage("Image removed from the product draft.");
                          }}
                          disabled={isUploading}
                        >
                          <X className="size-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-7 text-center">
                    <div className="rounded-[18px] border border-[var(--border)] bg-white/[0.05] p-3 text-[var(--brand-soft)]">
                      <ImagePlus className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-white">Drop an image here</p>
                      <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                        Or click to choose a file. PNG, JPG, and WEBP are supported up to 5MB.
                      </p>
                    </div>
                    <Button type="button" variant="secondary" disabled={isUploading}>
                      <Upload className="size-4" />
                      {isUploading ? "Uploading..." : "Choose image"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </ProductSection>

          <ProductSection
            icon={<Wallet className="size-4" />}
            title="Pricing"
            description="Set selling and cost values for clean margin tracking."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Sale price</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.salePrice}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, salePrice: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="field-label">Cost price</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, costPrice: event.target.value }))
                  }
                />
              </label>
            </div>
          </ProductSection>

          <ProductSection
            icon={<Boxes className="size-4" />}
            title="Inventory"
            description="Prepare the opening quantity, reorder threshold, and optional expiry tracking."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Opening stock</span>
                <Input
                  type="number"
                  min="0"
                  value={form.stockQuantity}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, stockQuantity: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="field-label">Low stock threshold</span>
                <Input
                  type="number"
                  min="0"
                  value={form.reorderPoint}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, reorderPoint: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="field-label">Expiry date</span>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, expiryDate: event.target.value }))
                  }
                />
              </label>
            </div>
          </ProductSection>

          <div className="surface-card-strong rounded-[18px] px-4 py-3 text-sm text-[var(--muted-foreground)]">
            Internal SKU and barcode codes are generated automatically and preserved during edits.
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="flex-1" type="submit" disabled={isPending || isUploading}>
              {form.id ? "Save changes" : "Create product"}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              type="button"
              onClick={resetForm}
              disabled={isPending || isUploading}
            >
              Reset form
            </Button>
          </div>

          {message ? (
            <div className="surface-card-strong rounded-[18px] px-4 py-3 text-sm text-[var(--muted-foreground)]">
              {message}
            </div>
          ) : null}
        </form>
      </Card>

      <Card className="space-y-5 overflow-hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <span className="section-kicker">Inventory catalog</span>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                Product catalog
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                Browse, edit, and archive products without exposing internal codes to daily staff.
              </p>
            </div>
          </div>
          <div className="flex w-full max-w-sm items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 py-2.5">
            <Search className="size-4 text-[var(--muted-foreground)]" />
            <Input
              className="h-auto border-none bg-transparent px-0 focus:ring-0"
              placeholder="Search product, flavor, brand, category"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="subtle-scroll overflow-x-auto">
          <table className="data-table text-left text-sm">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Expiry</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const lowStock = product.stockQuantity <= product.reorderPoint;

                return (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[var(--border)] bg-[#0d0f12]">
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt={product.name}
                              width={56}
                              height={56}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImagePlus className="size-4 text-[var(--muted-foreground)]" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-white">
                            {product.name}
                            {product.flavor ? ` / ${product.flavor}` : ""}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {product.brandName} / {product.sizeLabel || "No size"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-[var(--muted-foreground)]">{product.categoryName}</td>
                    <td>
                      <div className="space-y-1">
                        <p className="font-medium text-white">{product.stockQuantity}</p>
                        <span
                          className={`status-pill ${
                            lowStock
                              ? "border-amber-500/20 bg-amber-500/12 text-amber-200"
                              : "border-white/10 bg-white/[0.04] text-[var(--muted-foreground)]"
                          }`}
                        >
                          min {product.reorderPoint}
                        </span>
                      </div>
                    </td>
                    <td className="font-medium text-white">{formatCurrency(product.salePrice)}</td>
                    <td className="text-[var(--muted-foreground)]">{formatDate(product.expiryDate)}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          product.isActive
                            ? "border-emerald-500/20 bg-emerald-500/12 text-emerald-200"
                            : "border-white/10 bg-white/[0.04] text-[var(--muted-foreground)]"
                        }`}
                      >
                        {product.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          type="button"
                          className="size-10 px-0"
                          onClick={() => loadProduct(product)}
                          title={`Edit ${product.name}`}
                        >
                          <PencilLine className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          type="button"
                          className="size-10 px-0"
                          onClick={() => archive(product.id)}
                          disabled={!product.isActive || isPending}
                          title={`Archive ${product.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 ? (
          <div className="surface-card-strong rounded-[18px] px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
            No products matched your search.
          </div>
        ) : null}
      </Card>
    </div>
  );
}
