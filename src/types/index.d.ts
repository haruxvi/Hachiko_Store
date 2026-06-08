import type { Role, OrderStatus, PaymentStatus } from '@prisma/client';

export type { Role, OrderStatus, PaymentStatus };

export interface ApiResponse<T = undefined> {
  ok: true;
  data?: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResult<T = undefined> = ApiResponse<T> | ApiError;

// Solo los datos que el SELLER necesita para generar la etiqueta Starken
export interface SellerOrderView {
  orderNumber: number;
  id: string;
  items: { name: string; quantity: number }[];
  status: OrderStatus;
  recipientName: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingApartment?: string;
  shippingCommune: string;
  shippingRegion: string;
  shippingPhone: string;
  shippingNotes?: string;
  createdAt: Date;
}
