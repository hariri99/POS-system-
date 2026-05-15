"use client";

import { create } from "zustand";
import { type PosCartLine, type ProductRecord } from "@/lib/types";

interface PosStore {
  cart: PosCartLine[];
  addProduct: (product: ProductRecord) => void;
  removeProduct: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
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
            unitPrice: product.salePrice,
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

