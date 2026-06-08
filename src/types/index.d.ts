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

export interface SellerOrderView {
  orderNumber: number;
  id: string;
  items: { name: string; quantity: number }[];
  totalCLP: number;
  paymentStatus: 'PAID';
  status: OrderStatus;
  recipientName: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingApartment?: string;
  shippingCommune: string;
  shippingRegion: string;
  shippingPhone: string;
  shippingEmail: string;
  shippingNotes?: string;
  createdAt: Date;
}
