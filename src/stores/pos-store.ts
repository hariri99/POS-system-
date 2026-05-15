"use client";

import { create } from "zustand";
import { type PosCartLine, type ProductPricingTier, type ProductRecord } from "@/lib/types";

function resolvePriceForTier(product: ProductRecord, pricingTier: ProductPricingTier) {
  if (pricingTier === "wholesale") {
    return product.wholesalePrice;
  }

  if (pricingTier === "discount" && product.discountPrice != null) {
    return product.discountPrice;
  }

  return product.salePrice;
}

function resolveCartPriceForTier(item: PosCartLine, pricingTier: ProductPricingTier) {
  if (pricingTier === "wholesale") {
    return item.wholesalePrice;
  }

  if (pricingTier === "discount" && item.discountPrice != null) {
    return item.discountPrice;
  }

  return item.retailPrice;
}

interface PosStore {
  cart: PosCartLine[];
  addProduct: (product: ProductRecord) => void;
  removeProduct: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updatePricingTier: (productId: string, pricingTier: ProductPricingTier) => void;
  updateDiscount: (productId: string, discountAmount: number) => void;
  clearCart: () => void;
}

export const usePosStore = create<PosStore>((set) => ({
  cart: [],
  addProduct: (product) =>
    set((state) => {
      const existing = state.cart.find((item) => item.productId === product.id);
      if (existing) {
        return {
          cart: state.cart.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  quantity: Math.min(item.quantity + 1, product.stockQuantity),
                }
              : item,
          ),
        };
      }

      return {
        cart: [
          ...state.cart,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            unitPrice: resolvePriceForTier(product, "retail"),
            pricingTier: "retail",
            retailPrice: product.salePrice,
            wholesalePrice: product.wholesalePrice,
            discountPrice: product.discountPrice,
            costPrice: product.costPrice,
            quantity: 1,
            discountAmount: 0,
            stockQuantity: product.stockQuantity,
          },
        ],
      };
    }),
  removeProduct: (productId) =>
    set((state) => ({
      cart: state.cart.filter((item) => item.productId !== productId),
    })),
  updateQuantity: (productId, quantity) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: Math.max(1, Math.min(quantity, item.stockQuantity)),
            }
          : item,
      ),
    })),
  updatePricingTier: (productId, pricingTier) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.productId === productId
          ? {
              ...item,
              pricingTier,
              unitPrice: resolveCartPriceForTier(item, pricingTier),
            }
          : item,
      ),
    })),
  updateDiscount: (productId, discountAmount) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.productId === productId
          ? {
              ...item,
              discountAmount: Math.max(0, discountAmount),
            }
          : item,
      ),
    })),
  clearCart: () => set({ cart: [] }),
}));
