import { ProductManager } from "@/components/products/product-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getProductsPageData } from "@/lib/platform";

export default async function AdminProductsPage() {
  const session = await requireRole("admin");
  const data = await getProductsPageData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Products and variants"
        description="Create, adjust, delete, and price supplement inventory with clean merchandising details, stock thresholds, and expiry tracking."
        badge={`${data.products.length} products`}
      />
      <ProductManager products={data.products} categories={data.categories} />
    </div>
  );
}
