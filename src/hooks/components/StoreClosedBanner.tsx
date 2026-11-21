import { AlertCircle } from 'lucide-react';

export function StoreClosedBanner({ message }: { message: string }) {
  return (
    <div role="status" className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div>
        <p className="font-bold text-red-300 text-sm">المتجر مغلق حالياً</p>
        <p className="text-red-200/70 text-sm mt-0.5">{message || 'نعود قريباً'}</p>
      </div>
    </div>
  );
}
