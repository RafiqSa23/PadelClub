/** Bentuk user sesi pemain yang dipakai UI (navbar, halaman akun). */
export interface SessionUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}
