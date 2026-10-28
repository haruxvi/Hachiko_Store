'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/src/lib/stores/cart';

export default function PaymentReturnCart({ paid, orderId }: { paid: boolean; orderId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (paid) {
      if (window.sessionStorage.getItem('hachiko-pending-payment') === orderId) {
        useCartStore.getState().clear();
        window.sessionStorage.removeItem('hachiko-pending-payment');
      }
      return;
    }

    // Mercado Pago puede regresar antes de que llegue su webhook.
    let checks = 0;
    const interval = window.setInterval(() => {
      if (++checks >= 15) window.clearInterval(interval);
      router.refresh();
    }, 2000);
    return () => window.clearInterval(interval);
  }, [paid, orderId, router]);

  return null;
}
