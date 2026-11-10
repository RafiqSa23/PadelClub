/** Payment driver adapter (ADR 0007): `mock` default, `midtrans` bila keys tersedia. */

import { createHash, timingSafeEqual } from 'node:crypto';

export interface QrisChargeInput {
  orderId: string;
  amount: number;
  bookingCode: string;
  customerPhone?: string | null;
}

export interface QrisChargeResult {
  orderId: string;
  qrString: string;
  /** URL gambar QR dari Midtrans (`actions[].url`); kosong pada driver mock. */
  qrImageUrl?: string;
  /** ID transaksi sisi Midtrans (`transaction_id`); kosong pada driver mock. */
  transactionId?: string;
  amount: number;
  expiresAt: Date;
  raw: Record<string, unknown>;
}

export interface PaymentStatusResult {
  orderId: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  amount: number;
}

export interface SnapTransactionInput {
  orderId: string;
  amount: number;
  bookingCode: string;
  customerName?: string | null;
  customerPhone?: string | null;
  /** Sisa menit hingga booking kedaluwarsa (diselaraskan ke expiry Snap). */
  expiryMinutes: number;
}

export interface SnapTransactionResult {
  orderId: string;
  token: string;
  redirectUrl: string;
  amount: number;
  raw: Record<string, unknown>;
}

export interface WebhookPayload {
  orderId: string;
  /** Status dari gateway; mock memakai `PAID`, Midtrans `settlement`/`capture`. */
  status: string;
  amount?: number;
  signature?: string;
  // Field notifikasi asli Midtrans (snake_case) — diisi route webhook.
  statusCode?: string;
  grossAmount?: string | number;
  signatureKey?: string;
  transactionStatus?: string;
  fraudStatus?: string;
  paymentType?: string;
}

export interface PaymentDriver {
  name: string;
  createQrisCharge(input: QrisChargeInput): Promise<QrisChargeResult>;
  /**
   * Buat transaksi Snap (ADR 0008). Driver mock mengembalikan token palsu
   * (tidak dipakai — mock tetap jalur QR); driver midtrans memanggil API Snap.
   */
  createSnapTransaction(input: SnapTransactionInput): Promise<SnapTransactionResult>;
  /** Polling fallback bila webhook tidak sampai (Batch 4: baca DB di route). */
  getStatus(orderId: string): Promise<PaymentStatusResult | null>;
  /**
   * Verifikasi signature webhook. Mock: terima selama `orderId` ada.
   * Midtrans: SHA-512(order_id + status_code + gross_amount + serverKey)
   * dicocokkan timing-safe dengan `signature_key` (ADR 0007).
   */
  verifyWebhook(payload: WebhookPayload): Promise<boolean>;
}

export const PAYMENT_EXPIRY_MINUTES = 15; // ADR 0006

/** Error khusus: order_id sudah dipakai transaksi aktif di Midtrans (HTTP 406). */
export class DuplicateOrderIdError extends Error {
  readonly orderId: string;
  constructor(orderId: string) {
    super(`Order ID ${orderId} sudah dipakai di Midtrans`);
    this.name = 'DuplicateOrderIdError';
    this.orderId = orderId;
  }
}

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

  async createSnapTransaction(input: SnapTransactionInput): Promise<SnapTransactionResult> {
    // Mock tidak memakai Snap popup — token palsu agar interface terpenuhi.
    return {
      orderId: input.orderId,
      token: `MOCK-SNAP:${input.orderId}:${input.amount}`,
      redirectUrl: '',
      amount: input.amount,
      raw: { driver: 'mock', bookingCode: input.bookingCode },
    };
  }

  async verifyWebhook(payload: WebhookPayload): Promise<boolean> {
    // Mock: cukup pastikan orderId ada.
    return typeof payload.orderId === 'string' && payload.orderId.length > 0;
  }
}

interface MidtransChargeResponse {
  status_code: string;
  status_message?: string;
  transaction_id?: string;
  order_id?: string;
  gross_amount?: string;
  payment_type?: string;
  transaction_status?: string;
  fraud_status?: string;
  qr_string?: string;
  acquirer?: string;
  expire_time?: string;
  actions?: Array<{ name?: string; method?: string; url?: string }>;
}

interface MidtransStatusResponse {
  status_code: string;
  order_id?: string;
  gross_amount?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
}

function midtransBaseUrl(): string {
  return process.env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com';
}

function midtransAuthHeader(): string {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';
  return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;
}

class MidtransPaymentDriver implements PaymentDriver {
  name = 'midtrans';

  async createQrisCharge(input: QrisChargeInput): Promise<QrisChargeResult> {
    const acquirer = (process.env.MIDTRANS_QRIS_ACQUIRER ?? 'gopay').toLowerCase();
    const res = await fetch(`${midtransBaseUrl()}/v2/charge`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: midtransAuthHeader(),
      },
      body: JSON.stringify({
        payment_type: 'qris',
        transaction_details: {
          order_id: input.orderId,
          gross_amount: input.amount,
        },
        qris: { acquirer },
        customer_details: {
          phone: input.customerPhone ?? undefined,
        },
      }),
    });

    const json = (await res.json().catch(() => null)) as MidtransChargeResponse | null;
    if (res.status === 406) {
      // Order ID bentrok dengan transaksi aktif di Midtrans — route menangani
      // dengan cek status / order_id baru.
      throw new DuplicateOrderIdError(input.orderId);
    }
    if (!res.ok || !json || !json.qr_string) {
      throw new Error(
        `Midtrans charge gagal (${res.status}): ${json?.status_message ?? 'tanpa respons'}`,
      );
    }

    const qrImageUrl = json.actions?.find((a) => a.name === 'generate-qr-code')?.url;
    return {
      orderId: json.order_id ?? input.orderId,
      qrString: json.qr_string,
      qrImageUrl,
      transactionId: json.transaction_id,
      amount: input.amount,
      // Sumber kebenaran expiry tetap `bookings.expiresAt` server (ADR 0006).
      expiresAt: new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60 * 1000),
      raw: {
        driver: 'midtrans',
        bookingCode: input.bookingCode,
        status_code: json.status_code,
        transaction_id: json.transaction_id,
        expire_time: json.expire_time,
        acquirer: json.acquirer,
        actions: json.actions,
      },
    };
  }

  async createSnapTransaction(input: SnapTransactionInput): Promise<SnapTransactionResult> {
    // Semua metode pembayaran Snap dibuka (pengecualian PRD disetujui, ADR 0008)
    // → `enabled_payments` sengaja tidak dikirim.
    const publicBase = (process.env.APP_PUBLIC_URL ?? '').replace(/\/$/, '');
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: midtransAuthHeader(),
    };
    // Webhook per-transaksi (ke URL publik aktif) — tanpa setting dashboard.
    if (publicBase) headers['X-Override-Notification'] = `${publicBase}/api/webhooks/payment`;

    const durationMinutes = Math.max(1, Math.min(60, Math.round(input.expiryMinutes)));
    const body: Record<string, unknown> = {
      transaction_details: {
        order_id: input.orderId,
        gross_amount: input.amount,
      },
      customer_details: {
        first_name: input.customerName ?? undefined,
        phone: input.customerPhone ?? undefined,
      },
      expiry: {
        start_time: formatSnapTime(new Date()),
        unit: 'minute',
        duration: durationMinutes,
      },
    };
    if (publicBase) {
      body.callbacks = {
        finish: `${publicBase}/tiket/${input.bookingCode}`,
      };
    }

    const res = await fetch(`${midtransSnapBaseUrl()}/snap/v1/transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => null)) as MidtransSnapResponse | null;
    if (res.status === 406) throw new DuplicateOrderIdError(input.orderId);
    if (!res.ok || !json?.token) {
      throw new Error(
        `Midtrans Snap gagal (${res.status}): ${json?.error_messages?.join('; ') ?? 'tanpa respons'}`,
      );
    }
    return {
      orderId: input.orderId,
      token: json.token,
      redirectUrl: json.redirect_url ?? '',
      amount: input.amount,
      raw: { driver: 'midtrans', bookingCode: input.bookingCode },
    };
  }

  async getStatus(orderId: string): Promise<PaymentStatusResult | null> {
    const res = await fetch(`${midtransBaseUrl()}/v2/${encodeURIComponent(orderId)}/status`, {
      headers: { Accept: 'application/json', Authorization: midtransAuthHeader() },
    });
    if (res.status === 404) return null;
    const json = (await res.json().catch(() => null)) as MidtransStatusResponse | null;
    if (!res.ok || !json?.transaction_status) return null;

    const normalized = json.transaction_status.toLowerCase();
    const status: PaymentStatusResult['status'] =
      normalized === 'settlement' || normalized === 'capture'
        ? 'paid'
        : normalized === 'pending'
          ? 'pending'
          : normalized === 'expire' || normalized === 'cancel' || normalized === 'deny'
            ? 'expired'
            : 'failed';
    return {
      orderId: json.order_id ?? orderId,
      status,
      amount: Number.parseInt(String(json.gross_amount ?? '0'), 10) || 0,
    };
  }

  async verifyWebhook(payload: WebhookPayload): Promise<boolean> {
    const serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';
    if (!serverKey || !payload.orderId || !payload.signatureKey) return false;
    // SHA512(order_id + status_code + gross_amount + ServerKey) — docs Midtrans.
    // gross_amount dipakai persis seperti string yang dikirim Midtrans.
    const input = `${payload.orderId}${payload.statusCode ?? ''}${payload.grossAmount ?? ''}${serverKey}`;
    const expected = createHash('sha512').update(input).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(payload.signatureKey);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}

interface MidtransSnapResponse {
  token?: string;
  redirect_url?: string;
  error_messages?: string[];
}

function midtransSnapBaseUrl(): string {
  return process.env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://app.midtrans.com'
    : 'https://app.sandbox.midtrans.com';
}

/** Format waktu Snap: `YYYY-MM-DD HH:MM:SS +0700` (WIB). */
function formatSnapTime(d: Date): string {
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${wib.getUTCFullYear()}-${p(wib.getUTCMonth() + 1)}-${p(wib.getUTCDate())} ` +
    `${p(wib.getUTCHours())}:${p(wib.getUTCMinutes())}:${p(wib.getUTCSeconds())} +0700`
  );
}
export function getPaymentDriver(): PaymentDriver {
  const selected = (process.env.PAYMENT_DRIVER ?? 'mock').toLowerCase();
  if (selected === 'midtrans' && (process.env.MIDTRANS_SERVER_KEY ?? '').length > 0) {
    return new MidtransPaymentDriver();
  }
  return new MockPaymentDriver();
}

/** True bila driver Midtrans aktif (kredensial tersedia). Dipakai route/UI. */
export function isMidtransActive(): boolean {
  return getPaymentDriver().name === 'midtrans';
}
