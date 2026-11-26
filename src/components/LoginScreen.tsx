import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// Google blocks sign-in inside the in-app browsers of WhatsApp, Facebook, Instagram, Telegram...
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|WhatsApp|Telegram|Line\/|; wv\)/i;

function GoogleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.470 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function LoginScreen({ adminMode = false }: { adminMode?: boolean }) {
  const { session, signInWithGoogle, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inAppBrowser = IN_APP_BROWSER.test(navigator.userAgent);

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    const { error } = await signInWithGoogle();
    // on success the browser leaves for Google, so only reset on failure
    if (error) {
      setError('تعذّر بدء تسجيل الدخول. حاول مرة ثانية.');
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked; the person can copy from the address bar */
    }
  };

  // Signed in, but this account is not an admin
  if (adminMode && session) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-bold text-white mb-2">ليس لديك صلاحية الدخول</h1>
          <p className="text-white/50 text-sm mb-6 break-all">{session.user.email}</p>
          <button
            onClick={signOut}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-colors"
          >
            تسجيل الخروج وتجربة حساب آخر
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-amber-400 mb-2">شحن مكس</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            {adminMode
              ? 'سجّل الدخول بحساب الإدارة'
              : 'سجّل الدخول لتشحن ألعابك وتتابع طلباتك من محفظتك'}
          </p>
        </div>

        {inAppBrowser && (
          <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200 leading-relaxed">
            جوجل لا يسمح بتسجيل الدخول من داخل متصفح واتساب أو فيسبوك. افتح الرابط في Chrome أو Safari.
            <button onClick={copyLink} className="mt-3 block w-full rounded-lg bg-amber-400 text-black font-bold py-2">
              {copied ? 'تم النسخ' : 'نسخ الرابط'}
            </button>
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-bold py-3.5 rounded-xl hover:bg-gray-100 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleLogo />}
          {busy ? 'جاري التحويل إلى جوجل...' : 'المتابعة باستخدام جوجل'}
        </button>

        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
            }
