import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { SITE_URL } from './api';

// Carrito persistente en el teléfono. El precio que se guarda es solo para
// mostrar: al pagar, el servidor vuelve a poner el precio y revisa el stock
// (página /carrito/desde-app de la web).

export type CartLine = { slug: string; name: string; nameKorean: string | null; priceCLP: number; image: string | null; qty: number; max: number };

type CartState = {
  lines: CartLine[];
  add: (line: Omit<CartLine, 'qty'>, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => CartLine | undefined;
  restore: (line: CartLine) => void;
  clear: () => void;
};

export const FREE_SHIPPING_THRESHOLD = 50000;

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add(line, qty = 1) {
        set((s) => {
          const found = s.lines.find((l) => l.slug === line.slug);
          if (found) {
            return { lines: s.lines.map((l) => (l.slug === line.slug ? { ...l, ...line, qty: Math.min(line.max, l.qty + qty) } : l)) };
          }
          return { lines: [...s.lines, { ...line, qty: Math.min(line.max, qty) }] };
        });
      },
      setQty(slug, qty) {
        if (qty <= 0) {
          get().remove(slug);
          return;
        }
        set((s) => ({ lines: s.lines.map((l) => (l.slug === slug ? { ...l, qty: Math.min(l.max, qty) } : l)) }));
      },
      remove(slug) {
        const line = get().lines.find((l) => l.slug === slug);
        set((s) => ({ lines: s.lines.filter((l) => l.slug !== slug) }));
        return line;
      },
      restore(line) {
        set((s) => (s.lines.some((l) => l.slug === line.slug) ? s : { lines: [...s.lines, line] }));
      },
      clear() {
        set({ lines: [] });
      },
    }),
    { name: 'hachiko-cart', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((a, l) => a + l.qty, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((a, l) => a + l.qty * l.priceCLP, 0);

/** URL del puente de pago: solo slug y cantidad (el servidor pone precio y stock). */
export function checkoutUrl(lines: CartLine[]) {
  const i = lines.map((l) => `${l.slug}:${l.qty}`).join(',');
  return `${SITE_URL}/carrito/desde-app?i=${encodeURIComponent(i)}`;
}

/** Enlace de regreso a la app (lo usa el navegador seguro al terminar el pago). */
export const returnUrl = () => Linking.createURL('pedido-confirmado');
