import { useEffect, useState } from 'react';
import { Loader2, Wallet as WalletIcon, ClipboardList, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { StoreClosedBanner } from '@/components/StoreClosedBanner';
import type { Game } from '@/types';

interface HomePageProps {
  onSelectGame: (gameId: string) => void;
  onTrackOrder: () => void;
  onOpenWallet: () => void;
}

export function HomePage({ onSelectGame, onTrackOrder, onOpenWallet }: HomePageProps) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const { settings } = useStoreSettings();
  const [games, setGames] = useState<Game[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [gamesRes, walletRes] = await Promise.all([
        supabase.from('games').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        uid
          ? supabase.from('wallets').select('balance').eq('user_id', uid).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!alive) return;
      if (gamesRes.data) setGames(gamesRes.data);
      if (walletRes.data) setBalance(Number(walletRes.data.balance));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {!settings.is_open && <StoreClosedBanner message={settings.closed_message} />}
      <div className="grid grid-cols-2 gap-3 mb-8 animate-fade-up">
        <button
          onClick={onOpenWallet}
          className="rounded-2xl bg-gradient-to-br from-amber-500/15 to-yellow-700/10 border border-amber-500/20 p-4 text-right active:scale-[0.98] transition-transform"
        >
          <WalletIcon className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-xs text-white/40">رصيدك</p>
          <p className="font-black text-white">
            {balance === null ? '—' : balance.toLocaleString('en-US')}
            <span className="text-xs text-white/40 mr-1">ل.س</span>
          </p>
        </button>
        <button
          onClick={onTrackOrder}
          className="glass rounded-2xl border border-white/5 p-4 text-right active:scale-[0.98] transition-transform"
        >
          <ClipboardList className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-xs text-white/40">طلباتك</p>
          <p className="font-black text-white flex items-center gap-1">
            تتبّع الطلبات
            <ChevronLeft className="w-4 h-4 text-white/30" />
          </p>
        </button>
      </div>

      <h2 className="text-lg font-black text-white mb-4">اختر لعبتك</h2>

      {games.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-12">لا توجد ألعاب متاحة حالياً</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {games.map((game, idx) => (
            <button
              key={game.id}
              onClick={() => onSelectGame(game.id)}
              className="glass rounded-2xl border border-white/5 hover:border-amber-500/30 p-4 flex flex-col items-center gap-3 active:scale-[0.97] transition-all animate-fade-up"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center overflow-hidden">
                {game.logo_url ? (
                  <img src={game.logo_url} alt={game.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-2xl font-black text-amber-400">{game.name.charAt(0)}</span>
                )}
              </div>
              <span className="font-bold text-white text-sm text-center leading-snug">{game.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
      }
