'use client';

import { useEffect } from 'react';

export default function PaymentFailureCart() {
  useEffect(() => {
    window.sessionStorage.removeItem('hachiko-pending-payment');
  }, []);

  return null;
}
