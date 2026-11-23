import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { StoreClosedBanner } from '@/components/StoreClosedBanner';
import type { Game, Package, Wallet } from '@/types';
import {
  ChevronRight, Loader2, User, CheckCircle2, Send, AlertCircle, Wallet as WalletIcon, Plus,
} from 'lucide-react';

interface GameDetailPageProps {
  gameId: string;
  onBack: () => void;
  onOrderComplete: (orderNumber: string) => void;
  onOpenWallet: () => void;
}

export function GameDetailPage({ gameId, onBack, onOrderComplete, onOpenWallet }: GameDetailPageProps) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const { settings } = useStoreSettings();

  const [game, setGame] = useState<Game | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    Promise.all([
      supabase.from('games').select('*').eq('id', gameId).maybeSingle(),
      supabase.from('packages').select('*').eq('game_id', gameId).eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('wallets').select('*').eq('user_id', uid).maybeSingle(),
    ]).then(([gameRes, pkgRes, walletRes]) => {
      if (gameRes.data) setGame(gameRes.data);
      if (pkgRes.data) setPackages(pkgRes.data);
      if (walletRes.data) setWallet(walletRes.data);
      setLoading(false);
    });
  }, [gameId, uid]);

  // TikTok identifies accounts by username; the other games use numeric IDs
  const isUsername = game?.slug === 'tiktok';
  const minLength = isUsername ? 3 : 5;
  const sanitize = (v: string) => (isUsername ? v.replace(/[^A-Za-z0-9._]/g, '') : v.replace(/\D/g, ''));

  const formatPrice = (price: number, currency: string) =>
    new Intl.NumberFormat('en-US').format(price) + ' ' + currency;

  const storeOpen = settings.is_open;
  const idValid = playerId.length >= minLength;
  const hasSufficientBalance = !!wallet && !!selectedPackage && Number(wallet.balance) >= selectedPackage.price;
  const canSubmit = !!selectedPackage && idValid && hasSufficientBalance && storeOpen && !submitting;

  const handleOrder = async () => {
    if (!canSubmit || !selectedPackage) return;
    setConfirming(false);
    setSubmitting(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('place_order_with_wallet', {
        p_game_id: selectedPackage.game_id,
        p_package_id: selectedPackage.id,
        p_player_id: playerId,
      });

      if (rpcError) throw new Error('فشل إنشاء الطلب');
      if (data?.error) {
        if (data.error === 'insufficient_balance') {
          setError(
            `رصيدك غير كافي. رصيدك الحالي: ${Number(data.balance).toLocaleString('en-US')} ل.س. سعر الباقة: ${Number(data.price).toLocaleString('en-US')} ل.س`
          );
        } else if (data.error === 'store_closed') {
          setError(data.message || 'المتجر مغلق حالياً');
        } else if (data.error === 'rate_limited') {
          setError('تم تجاوز الحد المسموح — 5 طلبات كحد أقصى في الساعة');
        } else if (data.error === 'duplicate_order') {
          setError('تم إرسال طلب مماثل للتو — انتظر قليلاً قبل المحاولة مجدداً');
        } else if (data.error === 'invalid_player_id') {
          setError('رقم اللاعب غير صحيح');
        } else if (data.error === 'package_not_found') {
          setError('هذه الباقة لم تعد متاحة، حدّث الصفحة');
        } else {
          setError('فشل إنشاء الطلب');
        }
        return;
      }

      onOrderComplete(data.order_number);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="text-center py-20">
        <p className="text-white/40">اللعبة غير موجودة</p>
        <button onClick={onBack} className="mt-4 text-amber-400 text-sm font-medium">العودة</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-white/50 hover:text-amber-400 text-sm font-medium mb-6 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
        رجوع
      </button>

      {!storeOpen && <StoreClosedBanner message={settings.closed_message} />}

      <div className="flex items-center gap-4 mb-8 animate-fade-up">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center overflow-hidden">
          {game.logo_url ? (
            <img src={game.logo_url} alt={game.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-amber-400" />
          )}
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">{game.name}</h2>
          <p className="text-white/40 text-sm">اختر الباقة المناسبة</p>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        {packages.map((pkg, idx) => {
          const isSelected = selectedPackage?.id === pkg.id;
          return (
            <button
              key={pkg.id}
              onClick={() => { setSelectedPackage(pkg); setError(null); }}
              className={`w-full text-right animate-fade-up transition-all duration-200 ${
                isSelected ? 'scale-[1.02]' : ''
              }`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
                    : 'glass border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'border-amber-400 bg-amber-400' : 'border-white/20'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-black" />}
                  </div>
                  <span className={`font-bold ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                    {pkg.name}
                  </span>
                </div>
                <span className={`font-bold text-sm ${isSelected ? 'text-amber-400' : 'text-white/50'}`}>
                  {formatPrice(pkg.price, pkg.currency)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedPackage && (
        <div className="animate-scale-in mb-6">
          <label className="block text-sm font-bold text-white/80 mb-2">
            {isUsername ? 'اسم المستخدم (Username)' : 'رقم اللاعب (Player ID)'}
          </label>
          <div className="relative">
            <input
              type="text"
              dir="ltr"
              inputMode={isUsername ? 'text' : 'numeric'}
              autoCapitalize="none"
              autoCorrect="off"
              value={playerId}
              onChange={(e) => setPlayerId(sanitize(e.target.value))}
              placeholder={isUsername ? 'بدون علامة @' : 'أدخل أرقام فقط'}
              className="w-full bg-white/5 border-2 border-white/10 focus:border-amber-500/50 rounded-2xl px-4 py-4 text-white placeholder-white/25 outline-none transition-colors text-lg font-medium tracking-wider"
            />
            <User className="absolute top-1/2 -translate-y-1/2 left-4 w-5 h-5 text-white/20" />
          </div>
          {playerId.length > 0 && !idValid && (
            <p className="text-amber-400/70 text-xs mt-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              تأكد من صحة الرقم
            </p>
          )}
        </div>
      )}

      {selectedPackage && idValid && (
        <div className="animate-scale-in space-y-4">
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-white/10" />
            <WalletIcon className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white/60">الدفع من المحفظة</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {wallet && (
            <div className={`rounded-2xl p-4 border-2 ${
              hasSufficientBalance
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <WalletIcon className={`w-5 h-5 ${hasSufficientBalance ? 'text-green-400' : 'text-red-400'}`} />
                  <span className="text-sm text-white/60 font-medium">رصيد المحفظة</span>
                </div>
                <span className={`font-bold text-sm ${hasSufficientBalance ? 'text-green-400' : 'text-red-400'}`}>
                  {Number(wallet.balance).toLocaleString('en-US')} ل.س
                </span>
              </div>
              {!hasSufficientBalance && (
                <p className="text-red-300/80 text-xs">
                  سعر الباقة: {formatPrice(selectedPackage.price, selectedPackage.currency)}
                </p>
              )}
            </div>
          )}

          {hasSufficientBalance ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={!canSubmit}
              className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                canSubmit
                  ? 'bg-gradient-to-l from-green-400 to-emerald-500 text-black hover:shadow-lg hover:shadow-green-500/25 active:scale-[0.98]'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري التنفيذ...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  {storeOpen ? 'متابعة' : 'المتجر مغلق'}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onOpenWallet}
              className="w-full bg-gradient-to-l from-amber-400 to-yellow-500 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-amber-500/25 active:scale-[0.98] transition-all"
            >
              <Plus className="w-5 h-5" />
              شحن المحفظة
            </button>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 animate-scale-in">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Player ID confirmation: a wrong ID means lost money, so show it big before paying */}
      {confirming && selectedPackage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-md bg-[#14141c] border border-white/10 rounded-3xl p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white text-center mb-1">تأكيد الطلب</h3>
            <p className="text-white/40 text-sm text-center mb-5">تأكد من الرقم قبل الدفع، لا يمكن تعديله لاحقاً</p>

            <div className="bg-black/40 rounded-2xl p-4 text-center mb-4">
              <p className="text-xs text-white/40 mb-1">{isUsername ? 'اسم المستخدم' : 'رقم اللاعب'}</p>
              <p dir="ltr" className="text-3xl font-black text-amber-400 tracking-wider break-all">{playerId}</p>
            </div>

            <div className="space-y-1.5 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-white/40">اللعبة</span>
                <span className="text-white font-bold">{game.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">الباقة</span>
                <span className="text-white font-bold">{selectedPackage.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">السعر</span>
                <span className="text-white font-bold">{formatPrice(selectedPackage.price, selectedPackage.currency)}</span>
              </div>
            </div>

            <button
              onClick={handleOrder}
              className="w-full py-3.5 rounded-2xl font-bold bg-gradient-to-l from-green-400 to-emerald-500 text-black active:scale-[0.98] transition-all mb-2"
            >
              نعم، الرقم صحيح — ادفع الآن
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="w-full py-3.5 rounded-2xl font-bold bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
            >
              تعديل الرقم
            </button>
          </div>
        </div>
      )}
    </div>
  );
    }
