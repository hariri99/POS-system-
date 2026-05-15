import { ProductManager } from "@/components/products/product-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/platform";

export default async function AdminProductsPage() {
  const session = await requireRole("admin");
  const snapshot = await getDashboardSnapshot(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Products and variants"
        description="Create, adjust, archive, and price supplement inventory with clean merchandising details, stock thresholds, and expiry tracking."
        badge={`${snapshot.products.length} products`}
      />
      <ProductManager
        products={snapshot.products}
        categories={snapshot.categories}
      />
    </div>
  );
}
