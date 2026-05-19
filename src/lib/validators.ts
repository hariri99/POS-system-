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
  wholesalePrice: z.coerce.number().min(0),
  discountPrice: z.coerce.number().min(0).nullable().optional(),
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
        pricingTier: z.enum(["retail", "wholesale", "discount"]).default("retail"),
        discountAmount: z.coerce.number().min(0).default(0),
      }),
    )
    .min(1),
  paymentMethod: z.enum(["cash", "whish_money"]),
  paymentStatus: z.enum(["paid", "pending"]).default("paid"),
  notes: z.string().optional(),
  customerName: z.string().optional(),
});

export const saleRefundSchema = z.object({
  scope: z.enum(["order", "item"]).default("order"),
  saleItemId: z.string().min(1).optional(),
  quantity: z.coerce.number().int().positive().optional(),
  reason: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
}).superRefine((value, context) => {
  if (value.scope === "item" && !value.saleItemId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["saleItemId"],
      message: "A product line must be selected for an item refund.",
    });
  }

  if (value.scope === "item" && !value.quantity) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["quantity"],
      message: "Choose how many units to refund.",
    });
  }
});
