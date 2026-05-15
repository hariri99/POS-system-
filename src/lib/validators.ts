import { z } from "zod";

export const productMutationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3),
  description: z.string().optional(),
  categoryId: z.string().min(1),
  brandId: z.string().optional(),
  brandName: z.string().trim().min(2),
  supplierId: z.string().nullable().optional(),
  flavor: z.string().optional(),
  sizeLabel: z.string().optional(),
  sku: z.string().min(3),
  barcode: z.string().min(6),
  salePrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),
  stockQuantity: z.coerce.number().int().min(0),
  reorderPoint: z.coerce.number().int().min(0),
  expiryDate: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal("")),
  isActive: z.coerce.boolean().optional(),
});

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().min(1),
  quantityDelta: z.coerce.number().int(),
  note: z.string().min(3),
  supplierId: z.string().nullable().optional(),
});

export const posSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        unitPrice: z.coerce.number().min(0),
        discountAmount: z.coerce.number().min(0).default(0),
      }),
    )
    .min(1),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "mixed"]),
  notes: z.string().optional(),
  customerName: z.string().optional(),
  discountAmount: z.coerce.number().min(0).optional(),
});
