"use client";

import Image from "next/image";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Archive,
  Boxes,
  ClipboardPenLine,
  ImagePlus,
  Layers3,
  MoreHorizontal,
  Plus,
  Search,
  Tags,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type CategoryRecord, type ProductRecord, type SupplierRecord } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface ProductManagerProps {
  products: ProductRecord[];
  categories: CategoryRecord[];
  suppliers: SupplierRecord[];
}

type ProductFormState = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  brandName: string;
  supplierId: string;
  flavor: string;
  sizeLabel: string;
  sku: string;
  barcode: string;
  salePrice: string;
  costPrice: string;
  stockQuantity: string;
  reorderPoint: string;
  expiryDate: string;
  imageUrl: string;
  isActive: boolean;
};

type ProductStockFilter = "all" | "active" | "archived" | "low" | "out";
type ProductSortOption =
  | "updated-desc"
  | "name-asc"
  | "stock-desc"
  | "stock-asc"
  | "price-desc"
  | "price-asc";

const pageSize = 10;

const initialForm: ProductFormState = {
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

function buildFormFromProduct(product: ProductRecord): ProductFormState {
  return {
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
  };
}

function getProductHealth(product: ProductRecord) {
  if (!product.isActive) {
    return {
      label: "Archived",
      badgeClass:
        "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)]",
      indicatorClass: "bg-[var(--border-strong)]",
    };
  }

  if (product.stockQuantity === 0) {
    return {
      label: "Out of stock",
      badgeClass: "border-red-500/20 bg-red-500/10 text-red-200",
      indicatorClass: "bg-red-500",
    };
  }

  if (product.stockQuantity <= product.reorderPoint) {
    return {
      label: "Low stock",
      badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-200",
      indicatorClass: "bg-amber-500",
    };
  }

  return {
    label: "In stock",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    indicatorClass: "bg-emerald-500",
  };
}

function ProductStat({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="surface-card-strong rounded-[20px] px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            {label}
          </p>
          <p className="text-xl font-semibold tracking-[-0.03em] text-[var(--heading)]">{value}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2 text-[var(--brand)]">
          {icon}
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{helper}</p>
    </div>
  );
}

function DrawerSection({
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
    <section className="surface-card-strong rounded-[22px] p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2.5 text-[var(--brand)]">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--heading)]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ProductManager({
  products: initialProducts,
  categories,
  suppliers,
}: ProductManagerProps) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<ProductStockFilter>("all");
  const [sortBy, setSortBy] = useState<ProductSortOption>("updated-desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [previewUrl, setPreviewUrl] = useState("");
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const productCountByCategory = useMemo(() => {
    return products.reduce<Record<string, number>>((counts, product) => {
      counts[product.categoryId] = (counts[product.categoryId] ?? 0) + 1;
      return counts;
    }, {});
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    const nextProducts = products.filter((product) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          product.name,
          product.flavor,
          product.brandName,
          product.categoryName,
          product.supplierName,
        ].some((field) => field.toLowerCase().includes(normalizedQuery));

      const matchesCategory =
        categoryFilter === "all" ? true : product.categoryId === categoryFilter;

      const matchesStockFilter =
        stockFilter === "all"
          ? true
          : stockFilter === "active"
            ? product.isActive
            : stockFilter === "archived"
              ? !product.isActive
              : stockFilter === "out"
                ? product.isActive && product.stockQuantity === 0
                : product.isActive && product.stockQuantity <= product.reorderPoint;

      return matchesQuery && matchesCategory && matchesStockFilter;
    });

    nextProducts.sort((left, right) => {
      switch (sortBy) {
        case "name-asc":
          return left.name.localeCompare(right.name);
        case "stock-desc":
          return right.stockQuantity - left.stockQuantity;
        case "stock-asc":
          return left.stockQuantity - right.stockQuantity;
        case "price-desc":
          return right.salePrice - left.salePrice;
        case "price-asc":
          return left.salePrice - right.salePrice;
        case "updated-desc":
        default:
          return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      }
    });

    return nextProducts;
  }, [products, deferredQuery, categoryFilter, stockFilter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => products.some((product) => product.id === id)),
    );
  }, [products]);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredQuery, categoryFilter, stockFilter, sortBy]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [drawerOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveMenuId(null);
        setDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const pageSelectionIds = paginatedProducts.map((product) => product.id);
  const allVisibleSelected =
    pageSelectionIds.length > 0 && pageSelectionIds.every((id) => selectedIds.includes(id));

  const lowStockCount = products.filter(
    (product) => product.isActive && product.stockQuantity <= product.reorderPoint,
  ).length;
  const outOfStockCount = products.filter(
    (product) => product.isActive && product.stockQuantity === 0,
  ).length;
  const inventoryValue = products.reduce(
    (total, product) => total + product.costPrice * product.stockQuantity,
    0,
  );
  const categoryCount = new Set(products.map((product) => product.categoryId)).size;
  const selectedActiveIds = selectedIds.filter((id) =>
    products.some((product) => product.id === id && product.isActive),
  );

  function openCreateDrawer() {
    setDrawerMode("create");
    setForm(initialForm);
    setPreviewUrl("");
    setDrawerMessage(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(product: ProductRecord) {
    setDrawerMode("edit");
    setForm(buildFormFromProduct(product));
    setPreviewUrl(product.imageUrl ?? "");
    setDrawerMessage(null);
    setDrawerOpen(true);
    setActiveMenuId(null);
  }

  function duplicateProduct(product: ProductRecord) {
    const nextForm = buildFormFromProduct(product);
    nextForm.id = "";
    nextForm.name = `${product.name} Copy`;
    nextForm.sku = "";
    nextForm.barcode = "";

    setDrawerMode("create");
    setForm(nextForm);
    setPreviewUrl(product.imageUrl ?? "");
    setDrawerMessage("Duplicate opened as a new product draft.");
    setDrawerOpen(true);
    setActiveMenuId(null);
  }

  function toggleSelection(productId: string) {
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  function toggleSelectVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !pageSelectionIds.includes(id));
      }

      return Array.from(new Set([...current, ...pageSelectionIds]));
    });
  }

  async function uploadImage(file: File) {
    setDrawerMessage(null);
    setIsUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/uploads/product-image", {
        method: "POST",
        body,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        setDrawerMessage(payload?.message ?? "Unable to upload image.");
        return;
      }

      const uploadedUrl = payload.data?.url as string;
      setForm((state) => ({ ...state, imageUrl: uploadedUrl }));
      setPreviewUrl(uploadedUrl);
      setDrawerMessage("Image uploaded successfully.");
    } catch {
      setDrawerMessage("Unexpected error while uploading image.");
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

  async function archiveProducts(productIds: string[]) {
    if (productIds.length === 0) {
      return;
    }

    setFlashMessage(null);
    setDrawerMessage(null);
    setActiveMenuId(null);

    startTransition(async () => {
      try {
        const updatedProducts = await Promise.all(
          productIds.map(async (productId) => {
            const response = await fetch(`/api/products/${productId}`, {
              method: "DELETE",
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok || !payload?.success) {
              throw new Error(payload?.message ?? "Unable to archive product.");
            }

            return payload.data as ProductRecord;
          }),
        );

        setProducts((current) =>
          current.map((product) => {
            const updated = updatedProducts.find((candidate) => candidate.id === product.id);
            return updated ?? product;
          }),
        );
        setSelectedIds((current) => current.filter((id) => !productIds.includes(id)));
        setFlashMessage(
          productIds.length === 1 ? "Product archived." : `${productIds.length} products archived.`,
        );
      } catch (error) {
        setFlashMessage(
          error instanceof Error ? error.message : "Unexpected error while archiving products.",
        );
      }
    });
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDrawerMessage(null);
    setFlashMessage(null);

    startTransition(async () => {
      try {
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
            supplierId: form.supplierId || null,
            imageUrl: form.imageUrl || null,
          }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success) {
          setDrawerMessage(payload?.message ?? "Unable to save product.");
          return;
        }

        const nextProduct = payload.data as ProductRecord;
        setProducts((current) => {
          const existing = current.find((product) => product.id === nextProduct.id);
          return existing
            ? current.map((product) => (product.id === nextProduct.id ? nextProduct : product))
            : [nextProduct, ...current];
        });

        setFlashMessage(form.id ? "Product updated successfully." : "Product created successfully.");
        setDrawerOpen(false);
        setDrawerMode("create");
        setForm(initialForm);
        setPreviewUrl("");
      } catch {
        setDrawerMessage("Unexpected error while saving product.");
      }
    });
  }

  return (
    <div className="space-y-4" onClick={() => setActiveMenuId(null)}>
      <Card className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-[var(--border-accent)] bg-[var(--brand-surface)] text-[var(--brand)]">
                Product workspace
              </Badge>
              <Badge>{products.length} catalog items</Badge>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
                Catalog visibility comes first
              </h2>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
                Keep the table in focus, use quick filters for daily stock review, and open a
                dedicated drawer only when it is time to create or edit a product.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {selectedActiveIds.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void archiveProducts(selectedActiveIds)}
                disabled={isPending}
              >
                <Archive className="size-4" />
                Archive selected
              </Button>
            ) : null}
            <Button type="button" onClick={openCreateDrawer}>
              <Plus className="size-4" />
              Add Product
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <ProductStat
            icon={<Layers3 className="size-4" />}
            label="Total products"
            value={String(products.length)}
            helper="Full active and archived catalog"
          />
          <ProductStat
            icon={<TriangleAlert className="size-4" />}
            label="Low stock"
            value={String(lowStockCount)}
            helper="Needs restock planning"
          />
          <ProductStat
            icon={<Boxes className="size-4" />}
            label="Out of stock"
            value={String(outOfStockCount)}
            helper="Unavailable for checkout"
          />
          <ProductStat
            icon={<Tags className="size-4" />}
            label="Categories"
            value={String(categoryCount)}
            helper="Merchandising groups in use"
          />
          <ProductStat
            icon={<Wallet className="size-4" />}
            label="Stock value"
            value={formatCurrency(inventoryValue)}
            helper="Cost-basis inventory estimate"
          />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--border)] px-4 py-4 lg:px-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--heading)]">Product catalog</h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Search, filter, sort, and update inventory without leaving the workspace.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:w-[840px] xl:grid-cols-[minmax(0,1.25fr)_180px_180px_180px]">
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 py-2.5">
                  <Search className="size-4 text-[var(--muted-foreground)]" />
                  <Input
                    className="h-auto border-none bg-transparent px-0 text-[var(--heading)] focus:ring-0"
                    placeholder="Search product, flavor, brand, supplier"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>

                <Select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as ProductStockFilter)}>
                  <option value="all">All statuses</option>
                  <option value="active">Active only</option>
                  <option value="low">Low stock</option>
                  <option value="out">Out of stock</option>
                  <option value="archived">Archived</option>
                </Select>

                <Select value={sortBy} onChange={(event) => setSortBy(event.target.value as ProductSortOption)}>
                  <option value="updated-desc">Recently updated</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="stock-desc">Stock high to low</option>
                  <option value="stock-asc">Stock low to high</option>
                  <option value="price-desc">Highest price</option>
                  <option value="price-asc">Lowest price</option>
                </Select>

                <Button type="button" variant="secondary" className="justify-center" onClick={() => {
                  setQuery("");
                  setCategoryFilter("all");
                  setStockFilter("all");
                  setSortBy("updated-desc");
                }}>
                  Reset filters
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                  categoryFilter === "all"
                    ? "border-[var(--border-accent)] bg-[var(--brand-surface)] text-[var(--brand)]"
                    : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)] hover:text-[var(--heading)]",
                )}
              >
                All categories
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryFilter(category.id)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                    categoryFilter === category.id
                      ? "border-[var(--border-accent)] bg-[var(--brand-surface)] text-[var(--brand)]"
                      : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-foreground)] hover:text-[var(--heading)]",
                  )}
                >
                  {category.name}
                  <span className="ml-2 text-[11px] text-[var(--muted-foreground)]">
                    {productCountByCategory[category.id] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {flashMessage ? (
              <div className="surface-card-strong rounded-[18px] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                {flashMessage}
              </div>
            ) : null}

            {selectedIds.length > 0 ? (
              <div className="flex flex-col gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-[var(--border-accent)] bg-[var(--brand-surface)] text-[var(--brand)]">
                    {selectedIds.length} selected
                  </Badge>
                  <p className="text-[var(--muted-foreground)]">
                    Use bulk archive for discontinued or inactive lines.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void archiveProducts(selectedActiveIds)}
                    disabled={selectedActiveIds.length === 0 || isPending}
                  >
                    <Archive className="size-4" />
                    Archive selected
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSelectedIds([])}>
                    Clear selection
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="subtle-scroll overflow-x-auto">
          <table className="data-table text-left text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-10 bg-[var(--surface-strong)]/95 py-3 backdrop-blur">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectVisible}
                    aria-label="Select visible products"
                  />
                </th>
                <th className="sticky top-0 z-10 bg-[var(--surface-strong)]/95 py-3 backdrop-blur">Product</th>
                <th className="sticky top-0 z-10 bg-[var(--surface-strong)]/95 py-3 backdrop-blur">Category</th>
                <th className="sticky top-0 z-10 bg-[var(--surface-strong)]/95 py-3 backdrop-blur">Stock</th>
                <th className="sticky top-0 z-10 bg-[var(--surface-strong)]/95 py-3 backdrop-blur">Price</th>
                <th className="sticky top-0 z-10 bg-[var(--surface-strong)]/95 py-3 backdrop-blur">Supplier</th>
                <th className="sticky top-0 z-10 bg-[var(--surface-strong)]/95 py-3 backdrop-blur">Expiry</th>
                <th className="sticky top-0 z-10 bg-[var(--surface-strong)]/95 py-3 backdrop-blur">Status</th>
                <th className="sticky top-0 z-10 bg-[var(--surface-strong)]/95 py-3 text-right backdrop-blur">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((product) => {
                const health = getProductHealth(product);
                const selected = selectedIds.includes(product.id);

                return (
                  <tr key={product.id} className={selected ? "bg-[var(--table-row-hover)]" : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelection(product.id)}
                        aria-label={`Select ${product.name}`}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[var(--border)] bg-[#0d0f12]">
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt={product.name}
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImagePlus className="size-4 text-[var(--muted-foreground)]" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium text-[var(--heading)]">
                            {product.name}
                            {product.flavor ? ` / ${product.flavor}` : ""}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                            <span>{product.brandName}</span>
                            <span className="text-[var(--border-strong)]">/</span>
                            <span>{product.sizeLabel || "No size"}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge className="border-[var(--border)] bg-[var(--surface-soft)] normal-case tracking-normal text-[12px]">
                        {product.categoryName}
                      </Badge>
                    </td>
                    <td>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", health.indicatorClass)} />
                          <span className="font-medium text-[var(--heading)]">{product.stockQuantity}</span>
                          <span className="text-xs text-[var(--muted-foreground)]">
                            min {product.reorderPoint}
                          </span>
                        </div>
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              product.stockQuantity === 0
                                ? "w-[8%] bg-red-500"
                                : product.stockQuantity <= product.reorderPoint
                                  ? "w-[38%] bg-amber-500"
                                  : "w-[72%] bg-emerald-500",
                            )}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <p className="font-medium text-[var(--heading)]">{formatCurrency(product.salePrice)}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Cost {formatCurrency(product.costPrice)}
                        </p>
                      </div>
                    </td>
                    <td className="text-[var(--muted-foreground)]">
                      {product.supplierName || "Unassigned"}
                    </td>
                    <td className="text-[var(--muted-foreground)]">{formatDate(product.expiryDate)}</td>
                    <td>
                      <div className="space-y-1">
                        <span className={cn("status-pill", health.badgeClass)}>{health.label}</span>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {product.isActive ? "Selling" : "Hidden from checkout"}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div className="relative flex justify-end" onClick={(event) => event.stopPropagation()}>
                        <Button
                          type="button"
                          variant="ghost"
                          className="size-9 rounded-lg px-0"
                          onClick={() =>
                            setActiveMenuId((current) => (current === product.id ? null : product.id))
                          }
                          title={`Open actions for ${product.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>

                        {activeMenuId === product.id ? (
                          <div className="surface-card-strong absolute right-0 top-11 z-20 w-44 rounded-[18px] p-1.5 shadow-[var(--shadow-card)]">
                            <button
                              type="button"
                              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-[var(--heading)] transition-colors hover:bg-[var(--surface-soft)]"
                              onClick={() => openEditDrawer(product)}
                            >
                              Edit product
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-[var(--heading)] transition-colors hover:bg-[var(--surface-soft)]"
                              onClick={() => duplicateProduct(product)}
                            >
                              Duplicate as new
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-[var(--danger)] transition-colors hover:bg-[var(--surface-soft)] disabled:opacity-50"
                              onClick={() => void archiveProducts([product.id])}
                              disabled={!product.isActive || isPending}
                            >
                              Archive product
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 text-sm lg:flex-row lg:items-center lg:justify-between">
          <p className="text-[var(--muted-foreground)]">
            Showing{" "}
            <span className="font-medium text-[var(--heading)]">
              {filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium text-[var(--heading)]">
              {Math.min(currentPage * pageSize, filteredProducts.length)}
            </span>{" "}
            of <span className="font-medium text-[var(--heading)]">{filteredProducts.length}</span>{" "}
            products
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Badge>
              Page {currentPage} / {pageCount}
            </Badge>
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3"
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
              disabled={currentPage === pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {filteredProducts.length === 0 ? (
        <Card>
          <div className="rounded-[18px] px-2 py-3 text-center text-sm text-[var(--muted-foreground)]">
            No products matched the current search and filter set.
          </div>
        </Card>
      ) : null}

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/18 backdrop-blur-[2px]"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="absolute inset-y-0 right-0 flex w-full justify-end sm:w-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-full w-full max-w-[680px] flex-col border-l border-[var(--border)] bg-[var(--background-muted)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
              <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4 backdrop-blur-[8px]">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-[var(--border-accent)] bg-[var(--brand-surface)] text-[var(--brand)]">
                        {drawerMode === "edit" ? "Edit product" : "New product"}
                      </Badge>
                      {form.isActive ? <Badge>Active catalog item</Badge> : <Badge>Archived state</Badge>}
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
                        {drawerMode === "edit" ? "Update product details" : "Create a product"}
                      </h3>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--muted-foreground)]">
                        Work through the commercial details in one focused panel without losing the
                        catalog context behind it.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="size-10 rounded-xl px-0"
                    onClick={() => setDrawerOpen(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              <form className="flex min-h-0 flex-1 flex-col" onSubmit={submitProduct}>
                <div className="subtle-scroll flex-1 overflow-y-auto px-5 py-5">
                  <div className="space-y-4">
                    <DrawerSection
                      icon={<ClipboardPenLine className="size-4" />}
                      title="Basic info"
                      description="Customer-facing identity, merchandising details, and catalog placement."
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
                    </DrawerSection>

                    <DrawerSection
                      icon={<Wallet className="size-4" />}
                      title="Pricing"
                      description="Set the customer price, base cost, and review gross margin at a glance."
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

                        <div className="surface-card rounded-[18px] px-4 py-3 sm:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                            Gross margin preview
                          </p>
                          <p className="mt-2 text-lg font-semibold text-[var(--heading)]">
                            {formatCurrency(Number(form.salePrice || 0) - Number(form.costPrice || 0))}
                          </p>
                        </div>
                      </div>
                    </DrawerSection>

                    <DrawerSection
                      icon={<Boxes className="size-4" />}
                      title="Inventory"
                      description="Track opening stock, reorder thresholds, and catalog availability."
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
                          <span className="field-label">Minimum stock</span>
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
                          <span className="field-label">Catalog status</span>
                          <Select
                            value={form.isActive ? "active" : "archived"}
                            onChange={(event) =>
                              setForm((state) => ({
                                ...state,
                                isActive: event.target.value === "active",
                              }))
                            }
                          >
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                          </Select>
                        </label>
                      </div>
                    </DrawerSection>

                    <DrawerSection
                      icon={<Tags className="size-4" />}
                      title="Supplier and expiry"
                      description="Connect the product to a supplier and apply optional expiry tracking."
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2">
                          <span className="field-label">Supplier</span>
                          <Select
                            value={form.supplierId}
                            onChange={(event) =>
                              setForm((state) => ({ ...state, supplierId: event.target.value }))
                            }
                          >
                            <option value="">Unassigned supplier</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </option>
                            ))}
                          </Select>
                        </label>

                        <label className="space-y-2">
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
                    </DrawerSection>

                    <DrawerSection
                      icon={<ImagePlus className="size-4" />}
                      title="Product media"
                      description="Upload a consistent image for the catalog, POS, and future customer-facing views."
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
                          onDrop={async (event) => {
                            event.preventDefault();
                            setIsDraggingImage(false);
                            await handleFileSelection(event.dataTransfer.files);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              fileInputRef.current?.click();
                            }
                          }}
                          className={cn(
                            "rounded-[20px] border border-dashed p-5 transition-colors",
                            isDraggingImage
                              ? "border-[var(--brand)] bg-[var(--brand-surface)]"
                              : "border-[var(--border)] bg-[var(--surface-soft)] hover:bg-[var(--surface-hover)]",
                          )}
                        >
                          {previewUrl ? (
                            <div className="grid gap-4 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center">
                              <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[#0d0f12]">
                                <Image
                                  src={previewUrl}
                                  alt="Product preview"
                                  width={160}
                                  height={160}
                                  className="h-32 w-full object-cover"
                                />
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <p className="font-medium text-[var(--heading)]">Image ready</p>
                                  <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                                    This media will appear in the product catalog and cashier flow.
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
                                    {isUploading ? "Uploading..." : "Replace image"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setForm((state) => ({ ...state, imageUrl: "" }));
                                      setPreviewUrl("");
                                      setDrawerMessage("Image removed from the product draft.");
                                    }}
                                    disabled={isUploading}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                              <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-[var(--brand)]">
                                <ImagePlus className="size-5" />
                              </div>
                              <div className="space-y-1">
                                <p className="font-medium text-[var(--heading)]">Drop an image here</p>
                                <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                                  Or click to choose a file. PNG, JPG, and WEBP are supported up to 5MB.
                                </p>
                              </div>
                              <Button type="button" variant="secondary" disabled={isUploading}>
                                {isUploading ? "Uploading..." : "Choose image"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </DrawerSection>
                  </div>
                </div>

                <div className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 backdrop-blur-[8px]">
                  <div className="flex flex-col gap-3">
                    <div className="surface-card-strong rounded-[18px] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                      SKU and barcode are generated automatically and preserved during edits.
                    </div>

                    {drawerMessage ? (
                      <div className="surface-card-strong rounded-[18px] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                        {drawerMessage}
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setDrawerOpen(false)}
                        disabled={isPending || isUploading}
                      >
                        Cancel
                      </Button>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setForm(initialForm);
                            setPreviewUrl("");
                            setDrawerMessage("Draft cleared. Ready for a new product.");
                            setDrawerMode("create");
                          }}
                          disabled={isPending || isUploading}
                        >
                          Reset draft
                        </Button>
                        <Button type="submit" disabled={isPending || isUploading}>
                          {drawerMode === "edit" ? "Save changes" : "Create product"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
