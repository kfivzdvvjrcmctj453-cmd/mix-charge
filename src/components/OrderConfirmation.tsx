import { useState } from 'react';
import { CheckCircle2, Copy, Check } from 'lucide-react';

interface OrderConfirmationProps {
  orderNumber: string;
  onHome: () => void;
  onTrack?: () => void;
}

export function OrderConfirmation({ orderNumber, onHome, onTrack }: OrderConfirmationProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked */
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-center animate-scale-in">
      <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-10 h-10 text-green-400" />
      </div>

      <h2 className="text-2xl font-black text-white mb-2">تم استلام طلبك</h2>
      <p className="text-white/50 text-sm mb-8 leading-relaxed">
        تم خصم المبلغ من محفظتك. تابع حالة الطلب من أيقونة الجرس في الأعلى.
      </p>

      <div className="glass rounded-2xl p-5 border border-white/5 mb-8">
        <p className="text-xs text-white/40 mb-2">رقم الطلب</p>
        <div className="flex items-center justify-center gap-3">
          <span className="font-mono font-bold text-amber-400 text-lg tracking-wider">{orderNumber}</span>
          <button onClick={copy} className="text-white/40 hover:text-amber-400 transition-colors" aria-label="نسخ رقم الطلب">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {onTrack && (
          <button
            onClick={onTrack}
            className="w-full bg-gradient-to-l from-amber-400 to-yellow-500 text-black font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all"
          >
            تتبّع طلباتي
          </button>
        )}
        <button
          onClick={onHome}
          className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-3.5 rounded-2xl transition-colors"
        >
          الرئيسية
        </button>
      </div>
    </div>
  );
}
