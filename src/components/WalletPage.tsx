import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { SUPPORT_PHONE } from '@/config';
import type { Wallet, WalletTransaction } from '@/types';
import {
  ChevronRight, Wallet as WalletIcon, Copy, Check, Loader2,
  ArrowDownLeft, ArrowUpRight, Info, MessageCircle,
} from 'lucide-react';

const TX_LABELS: Record<string, string> = {
  topup: 'شحن رصيد',
  order_payment: 'دفع طلب',
  refund: 'استرجاع',
  adjustment: 'تعديل إداري',
};

interface WalletPageProps {
  onBack: () => void;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div className="text-sm text-white/60 flex-1">{children}</div>
    </div>
  );
}

export function WalletPage({ onBack }: WalletPageProps) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const { settings } = useStoreSettings();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const fetchData = useCallback(async () => {
    if (!uid) return;
    const [walletRes, txRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('wallet_transactions').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    ]);
    if (walletRes.data) setWallet(walletRes.data);
    if (txRes.data) setTransactions(txRes.data);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    fetchData();
    // balance refreshes by itself when the admin credits the wallet
    const channel = supabase
      .channel(`my-wallet-${uid}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${uid}` },
        () => { fetchData(); }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, fetchData]);

  const copyToClipboard = async (text: string, which: 'code' | 'address') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      }
    } catch {
      // clipboard may be blocked
    }
  };

  const whatsappUrl = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(
    `مرحباً، قمت بتحويل مبلغ إلى شام كاش.\nرمز محفظتي: ${wallet?.code ?? ''}`
  )}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
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

      <div className="animate-fade-up space-y-5">
        <h2 className="text-2xl font-black text-white">المحفظة</h2>

        {/* Balance card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/15 to-yellow-700/10 border border-amber-500/20 p-6">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <WalletIcon className="w-5 h-5 text-amber-400" />
              <span className="text-sm text-white/50 font-medium">رصيد المحفظة</span>
            </div>
            <p className="text-4xl font-black text-white mb-1">
              {wallet ? Number(wallet.balance).toLocaleString('en-US') : '0'}
              <span className="text-lg text-white/40 mr-2">ل.س</span>
            </p>
            {wallet && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-white/40">رمز المحفظة:</span>
                <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5">
                  <span className="font-mono font-bold text-amber-400 text-sm tracking-wider">{wallet.code}</span>
                  <button
                    onClick={() => copyToClipboard(wallet.code, 'code')}
                    className="text-white/40 hover:text-amber-400 transition-colors"
                    aria-label="نسخ رمز المحفظة"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sham Cash top-up instructions */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400" />
            كيفية شحن المحفظة
          </h3>

          <div className="space-y-4">
            <Step n={1}>حوّل المبلغ إلى محفظة شام كاش التالية:</Step>

            {settings.sham_cash_address ? (
              <div className="flex items-center gap-3 mr-9">
                <div className="flex-1 bg-black/30 rounded-xl px-4 py-3 font-mono text-amber-400 text-sm font-bold tracking-wide break-all">
                  {settings.sham_cash_address}
                </div>
                <button
                  onClick={() => copyToClipboard(settings.sham_cash_address, 'address')}
                  aria-label="نسخ العنوان"
                  className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                    copiedAddress ? 'bg-green-500 text-black' : 'bg-amber-500 text-black hover:bg-amber-400'
                  }`}
                >
                  {copiedAddress ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            ) : (
              <p className="mr-9 text-sm text-white/40">العنوان غير متوفر حالياً، تواصل مع الدعم.</p>
            )}

            <Step n={2}>
              اكتب <span className="text-amber-400 font-bold">رمز محفظتك</span> في ملاحظات التحويل
            </Step>

            <Step n={3}>
              <span>تأكد من وصول الرصيد بعد التأكيد من الإدارة، وإذا تأخر أرسل لنا:</span>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 text-green-400 font-bold py-3 rounded-xl transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                أرسل تأكيد التحويل عبر واتساب
              </a>
            </Step>
          </div>
        </div>

        {/* Transaction history */}
        <div>
          <h3 className="font-bold text-white text-sm mb-3">سجل المعاملات</h3>
          {transactions.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center border border-white/5">
              <p className="text-white/30 text-sm">لا توجد معاملات بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <div key={tx.id} className="glass rounded-xl p-4 border border-white/5 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isPositive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {isPositive ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{TX_LABELS[tx.type] ?? tx.type}</p>
                      <p className="text-xs text-white/30 truncate">{tx.note ?? '—'}</p>
                      <p className="text-xs text-white/20 mt-0.5">{new Date(tx.created_at).toLocaleString('ar-EG')}</p>
                    </div>
                    <span className={`font-bold text-sm shrink-0 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? '+' : ''}{Number(tx.amount).toLocaleString('en-US')} ل.س
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
      }
