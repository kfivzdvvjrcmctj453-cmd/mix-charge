import { Bell, Wallet, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMyOrders } from '@/hooks/useMyOrders';
import type { AppView } from '@/types';

interface HeaderProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  isAdmin?: boolean;
}

export function Header({ view, onNavigate, isAdmin = false }: HeaderProps) {
  const { signOut } = useAuth();
  const { orders } = useMyOrders();
  const activeCount = orders.filter((o) => o.status === 'pending' || o.status === 'processing').length;

  const iconBtn = (selected: boolean) =>
    `relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
      selected ? 'bg-amber-400/15 text-amber-400' : 'text-white/60 hover:text-amber-400 hover:bg-white/5'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0f]/85 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => onNavigate({ name: 'home' })}
          className="text-xl font-black text-amber-400 tracking-tight"
          aria-label="الصفحة الرئيسية"
        >
          شحن مكس
        </button>

        <nav className="flex items-center gap-1">
          <button
            onClick={() => onNavigate({ name: 'track' })}
            className={iconBtn(view.name === 'track')}
            aria-label="طلباتي"
          >
            <Bell className="w-5 h-5" />
            {activeCount > 0 && (
              <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate({ name: 'wallet' })}
            className={iconBtn(view.name === 'wallet')}
            aria-label="المحفظة"
          >
            <Wallet className="w-5 h-5" />
          </button>

          {isAdmin && (
            <button
              onClick={() => onNavigate({ name: 'admin' })}
              className={iconBtn(view.name === 'admin')}
              aria-label="لوحة الإدارة"
            >
              <ShieldCheck className="w-5 h-5" />
            </button>
          )}

          <button onClick={signOut} className={iconBtn(false)} aria-label="تسجيل الخروج">
            <LogOut className="w-5 h-5" />
          </button>
        </nav>
      </div>
    </header>
  );
}
