export interface Game {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Package {
  id: string;
  game_id: string;
  name: string;
  price: number;
  currency: string;
  product_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'canceled' | 'rejected';
export type PaymentMethod = 'manual' | 'wallet';

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  game_id: string;
  package_id: string;
  player_id: string;
  receipt_url: string | null;
  status: OrderStatus;
  payment_method: PaymentMethod;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  code: string;
  balance: number;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: 'topup' | 'order_payment' | 'refund' | 'adjustment' | string;
  amount: number;
  note: string | null;
  reference: string | null;
  order_id: string | null;
  created_at: string;
}

export interface StoreSettings {
  id: number;
  is_open: boolean;
  closed_message: string;
  sham_cash_address: string;
}

export type AppView =
  | { name: 'home' }
  | { name: 'game'; gameId: string }
  | { name: 'confirmation'; orderNumber: string }
  | { name: 'track' }
  | { name: 'wallet' }
  | { name: 'admin' };

export interface AdminOrder extends Order {
  games?: Pick<Game, 'name'> & Partial<Pick<Game, 'logo_url'>>;
  packages?: Pick<Package, 'name' | 'price' | 'currency'>;
  user_email?: string;
  }
