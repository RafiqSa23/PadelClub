/** Payment driver adapter (ADR 0007): `mock` default, `midtrans` bila keys tersedia. */

export interface QrisChargeInput {
  orderId: string;
  amount: number;
  bookingCode: string;
  customerPhone?: string | null;
}

export interface QrisChargeResult {
  orderId: string;
  qrString: string;
  amount: number;
  expiresAt: Date;
  raw: Record<string, unknown>;
}

export interface PaymentStatusResult {
  orderId: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  amount: number;
}

export interface WebhookPayload {
  orderId: string;
  /** Status dari gateway; mock memakai `PAID`, Midtrans `settlement`/`capture`. */
  status: string;
  amount?: number;
  signature?: string;
}

export interface PaymentDriver {
  name: string;
  createQrisCharge(input: QrisChargeInput): Promise<QrisChargeResult>;
  /** Polling fallback bila webhook tidak sampai (Batch 4: baca DB di route). */
  getStatus(orderId: string): Promise<PaymentStatusResult | null>;
  /**
   * Verifikasi signature webhook. Mock: terima selama `orderId` ada
   * (siap diganti SHA-512 Midtrans: order_id+gross_amount+status_code+serverKey).
   */
  verifyWebhook(payload: WebhookPayload): Promise<boolean>;
}

export const PAYMENT_EXPIRY_MINUTES = 15; // ADR 0006

class MockPaymentDriver implements PaymentDriver {
  name = 'mock';

  async createQrisCharge(input: QrisChargeInput): Promise<QrisChargeResult> {
    const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60 * 1000);
    // QR mock berbentuk payload teks (bukan QR valid produksi) — diganti
    // driver midtrans saat kredensial sandbox tersedia.
    const qrString = `MOCK-QRIS:${input.orderId}:${input.amount}`;
    return {
      orderId: input.orderId,
      qrString,
      amount: input.amount,
      expiresAt,
      raw: { driver: 'mock', bookingCode: input.bookingCode },
    };
  }

  async getStatus(): Promise<PaymentStatusResult | null> {
    // Mock tidak punya gateway eksternal — status sumber kebenaran dibaca
    // dari tabel `payments` di route handler. Kembalikan null agar route
    // memakai data DB.
    return null;
  }

  async verifyWebhook(payload: WebhookPayload): Promise<boolean> {
    // Mock: cukup pastikan orderId ada. Driver `midtrans` (menyusul)
    // memverifikasi SHA-512(order_id + status_code + gross_amount + serverKey).
    return typeof payload.orderId === 'string' && payload.orderId.length > 0;
  }
}

export function getPaymentDriver(): PaymentDriver {
  const selected = (process.env.PAYMENT_DRIVER ?? 'mock').toLowerCase();
  // Driver `midtrans` diimplementasikan di Batch 4 saat sandbox keys tersedia.
  // Sementara fallback ke mock agar API tetap berjalan end-to-end.
  if (selected === 'midtrans') return new MockPaymentDriver();
  return new MockPaymentDriver();
}
