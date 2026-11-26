import { ChevronRight, Loader2, Clock, RefreshCw, CheckCircle2, XCircle, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMyOrders } from '@/hooks/useMyOrders';

interface TrackOrderProps {
  onBack: () => void;
}

const STATUS: Record<string, { label: string; hint: string; cls: string; Icon: LucideIcon }> = {
  pending: {
    label: 'قيد الانتظار',
    hint: 'وصلنا طلبك وسنبدأ بتنفيذه قريباً',
    cls: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    Icon: Clock,
  },
  processing: {
    label: 'قيد المعالجة',
    hint: 'نعمل على تنفيذ طلبك الآن',
    cls: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
    Icon: RefreshCw,
  },
  completed: {
    label: 'مكتمل',
    hint: 'تم شحن حسابك بنجاح',
    cls: 'bg-green-500/15 text-green-300 border-green-500/20',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'مرفوض',
    hint: 'تعذّر تنفيذ الطلب',
    cls: 'bg-red-500/15 text-red-300 border-red-500/20',
    Icon: XCircle,
  },
  canceled: {
    label: 'ملغي',
    hint: 'تم إلغاء الطلب',
    cls: 'bg-red-500/15 text-red-300 border-red-500/20',
    Icon: XCircle,
  },
};

export function TrackOrder({ onBack }: TrackOrderProps) {
  const { orders, loading } = useMyOrders();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-white/50 hover:text-amber-400 text-sm font-medium mb-6 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
        رجوع
      </button>

      <h2 className="text-2xl font-black text-white mb-5">طلباتي</h2>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center border border-white/5">
          <Package className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">لا توجد طلبات بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const s = STATUS[o.status] ?? STATUS.pending;
            const refunded = o.payment_method === 'wallet' && (o.status === 'rejected' || o.status === 'canceled');
            return (
              <div key={o.id} className="glass rounded-2xl p-4 border border-white/5 animate-fade-up">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">
                      {o.games?.name ?? 'لعبة'} — {o.packages?.name ?? ''}
                    </p>
                    <p className="text-xs text-white/30 font-mono mt-0.5">{o.order_number}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${s.cls}`}>
                    <s.Icon className="w-3.5 h-3.5" />
                    {s.label}
                  </span>
                </div>

                <p className="text-sm text-white/50 mb-2">{s.hint}</p>
                {refunded && (
                  <p className="text-sm text-green-300/90 mb-2">تم إرجاع المبلغ إلى محفظتك</p>
                )}

                <div className="flex items-center justify-between text-xs text-white/30">
                  <span dir="ltr">ID: {o.player_id}</span>
                  <span>{new Date(o.created_at).toLocaleString('ar-EG')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
