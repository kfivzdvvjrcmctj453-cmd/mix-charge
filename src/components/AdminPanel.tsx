import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { AdminOrder, Game, Package, StoreSettings, WalletTransaction } from '@/types';
import { Loader2, RefreshCw, Copy, Check, LogOut, Search, Download } from 'lucide-react';

type Tab = 'orders' | 'customers' | 'catalog' | 'settings';

interface CustomerRow {
  user_id: string;
  code: string;
  balance: number;
  email: string;
  created_at: string;
}

interface TabProps {
  users: Record<string, string>;
  tick: number;
  notify: (ok: boolean, text: string) => void;
  onChanged: () => void;
}

const fmt = (n: number | string) => Number(n).toLocaleString('en-US');
const when = (iso: string) => new Date(iso).toLocaleString('ar-EG');

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'قيد الانتظار', cls: 'bg-amber-500/15 text-amber-300' },
  processing: { label: 'قيد المعالجة', cls: 'bg-blue-500/15 text-blue-300' },
  completed: { label: 'مكتمل', cls: 'bg-green-500/15 text-green-300' },
  canceled: { label: 'ملغي', cls: 'bg-red-500/15 text-red-300' },
  rejected: { label: 'مرفوض', cls: 'bg-red-500/15 text-red-300' },
};

const ERRORS: Record<string, string> = {
  not_admin: 'ليس لديك صلاحية',
  already_final: 'الطلب منتهٍ مسبقاً',
  invalid_amount: 'المبلغ غير صحيح',
  wallet_not_found: 'المحفظة غير موجودة',
  insufficient_balance: 'رصيد الزبون لا يكفي للخصم',
  order_not_found: 'الطلب غير موجود',
  duplicate_reference: 'رقم العملية هذا مُستخدم من قبل، يبدو أنك أضفت هذا التحويل سابقاً',
};

const card = 'glass rounded-2xl border border-white/5 p-4';
const input =
  'w-full bg-white/5 border border-white/10 focus:border-amber-500/50 rounded-xl px-3 py-2.5 text-white placeholder-white/25 outline-none text-sm';
const btn = 'px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97] disabled:opacity-50';

// ---------------------------------------------------------------- CSV
function csvCell(v: unknown): string {
  if (typeof v === 'number') return String(v);
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8' }); // BOM: Arabic opens correctly in Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-white/30 text-sm py-12">{text}</p>;
}

// ---------------------------------------------------------------- Orders
function OrdersTab({ users, tick, notify, onChanged }: TabProps) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'completed' | 'closed' | 'all'>('active');
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from('orders')
      .select('*, games(name), packages(name, price, currency)')
      .order('created_at', { ascending: false })
      .limit(150)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) notify(false, 'تعذّر تحميل الطلبات');
        else setOrders(data as unknown as AdminOrder[]);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const visible = useMemo(
    () =>
      orders.filter((o) => {
        if (filter === 'all') return true;
        if (filter === 'active') return o.status === 'pending' || o.status === 'processing';
        if (filter === 'completed') return o.status === 'completed';
        return o.status === 'rejected' || o.status === 'canceled';
      }),
    [orders, filter]
  );

  const setStatus = async (o: AdminOrder, status: string) => {
    if (status === 'rejected') {
      const msg =
        o.payment_method === 'wallet'
          ? 'سيتم رفض الطلب وإرجاع المبلغ إلى محفظة الزبون. متابعة؟'
          : 'رفض الطلب؟';
      if (!window.confirm(msg)) return;
    }
    setBusy(o.id);
    const { data, error } = await supabase.rpc('admin_set_order_status', {
      p_order_id: o.id,
      p_status: status,
    });
    setBusy(null);
    if (error || data?.error) {
      notify(false, ERRORS[data?.error] ?? 'فشل تحديث الطلب');
      return;
    }
    notify(true, data.refunded > 0 ? `تم الرفض وإرجاع ${fmt(data.refunded)} ل.س` : 'تم تحديث الطلب');
    onChanged();
  };

  const copyId = async (o: AdminOrder) => {
    try {
      await navigator.clipboard.writeText(o.player_id);
      setCopied(o.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard may be blocked */
    }
  };

  const exportOrders = async () => {
    setExporting(true);
    const all: AdminOrder[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('orders')
        .select('*, games(name), packages(name, price, currency)')
        .order('created_at', { ascending: false })
        .range(from, from + 999);
      if (error) {
        notify(false, 'فشل التصدير');
        setExporting(false);
        return;
      }
      const page = (data ?? []) as unknown as AdminOrder[];
      all.push(...page);
      if (page.length < 1000) break;
    }
    downloadCsv(
      `orders-${stamp()}.csv`,
      ['order_number', 'created_at', 'email', 'game', 'package', 'price', 'player_id', 'status', 'payment_method'],
      all.map((o) => [
        o.order_number,
        o.created_at,
        users[o.user_id] ?? o.user_id,
        o.games?.name,
        o.packages?.name,
        o.packages ? Number(o.packages.price) : '',
        o.player_id,
        o.status,
        o.payment_method,
      ])
    );
    setExporting(false);
    notify(true, `تم تصدير ${all.length} طلب`);
  };

  const chips: Array<[typeof filter, string]> = [
    ['active', 'نشطة'],
    ['completed', 'مكتملة'],
    ['closed', 'مرفوضة'],
    ['all', 'الكل'],
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-2 overflow-x-auto flex-1">
          {chips.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`${btn} whitespace-nowrap ${
                filter === key ? 'bg-amber-400 text-black' : 'bg-white/5 text-white/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={exportOrders}
          disabled={exporting}
          className={`${btn} bg-white/5 text-white/70 flex items-center gap-1.5 shrink-0`}
          aria-label="تصدير الطلبات CSV"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          CSV
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Empty text="لا توجد طلبات" />
      ) : (
        <div className="space-y-3">
          {visible.map((o) => {
            const s = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
            const open = o.status === 'pending' || o.status === 'processing';
            return (
              <div key={o.id} className={card}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-bold text-white">
                      {o.games?.name} — {o.packages?.name}
                    </p>
                    <p className="text-xs text-white/30 font-mono">{o.order_number}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${s.cls}`}>{s.label}</span>
                </div>

                <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2 mb-2">
                  <span className="text-xs text-white/40">Player ID</span>
                  <span className="font-mono font-bold text-amber-400 flex-1 break-all" dir="ltr">
                    {o.player_id}
                  </span>
                  <button onClick={() => copyId(o)} className="text-white/50 hover:text-amber-400" aria-label="نسخ">
                    {copied === o.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-white/40 mb-3">
                  <span>{users[o.user_id] ?? 'زبون'}</span>
                  <span>{o.packages ? `${fmt(o.packages.price)} ${o.packages.currency}` : ''}</span>
                  <span>{when(o.created_at)}</span>
                </div>

                {open && (
                  <div className="flex gap-2">
                    {o.status === 'pending' && (
                      <button
                        disabled={busy === o.id}
                        onClick={() => setStatus(o, 'processing')}
                        className={`${btn} flex-1 bg-blue-500/15 text-blue-300`}
                      >
                        قيد المعالجة
                      </button>
                    )}
                    <button
                      disabled={busy === o.id}
                      onClick={() => setStatus(o, 'completed')}
                      className={`${btn} flex-1 bg-green-500 text-black`}
                    >
                      {busy === o.id ? '...' : 'تم التنفيذ'}
                    </button>
                    <button
                      disabled={busy === o.id}
                      onClick={() => setStatus(o, 'rejected')}
                      className={`${btn} flex-1 bg-red-500/15 text-red-300`}
                    >
                      رفض
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Customers
function CustomersTab({ tick, notify, onChanged }: TabProps) {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.rpc('admin_list_wallets').then(({ data, error }) => {
      if (!alive) return;
      if (error) notify(false, 'تعذّر تحميل الزباين');
      else setRows(data as CustomerRow[]);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const totalBalance = useMemo(() => rows.reduce((sum, r) => sum + Number(r.balance), 0), [rows]);

  const loadTxs = async (userId: string) => {
    const { data } = await supabase.rpc('admin_user_transactions', { p_user_id: userId });
    setTxs((data as WalletTransaction[]) ?? []);
  };

  const toggle = (row: CustomerRow) => {
    if (openId === row.user_id) {
      setOpenId(null);
      return;
    }
    setOpenId(row.user_id);
    setAmount('');
    setReference('');
    setNote('');
    setTxs([]);
    loadTxs(row.user_id);
  };

  const apply = async (row: CustomerRow, sign: 1 | -1) => {
    const amt = Number(amount);
    if (!(amt > 0)) {
      notify(false, 'أدخل مبلغاً صحيحاً');
      return;
    }
    const verb = sign > 0 ? 'إضافة' : 'خصم';
    if (!window.confirm(`${verb} ${fmt(amt)} ل.س ${sign > 0 ? 'إلى' : 'من'} رصيد ${row.email}؟`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_add_balance', {
      p_user_id: row.user_id,
      p_amount: sign * amt,
      p_note: note.trim() || null,
      p_reference: sign > 0 ? reference.trim() || null : null,
    });
    setBusy(false);
    if (error || data?.error) {
      notify(false, ERRORS[data?.error] ?? 'فشلت العملية');
      return;
    }
    notify(true, 'تمت العملية');
    setAmount('');
    setReference('');
    setNote('');
    loadTxs(row.user_id);
    onChanged();
  };

  const exportBalances = () => {
    downloadCsv(
      `balances-${stamp()}.csv`,
      ['email', 'wallet_code', 'balance', 'joined'],
      rows.map((r) => [r.email, r.code, Number(r.balance), r.created_at])
    );
  };

  const exportLedger = async () => {
    setExporting(true);
    const all: WalletTransaction[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.rpc('admin_list_transactions', { p_offset: offset, p_limit: 1000 });
      if (error) {
        notify(false, 'فشل التصدير');
        setExporting(false);
        return;
      }
      const page = (data ?? []) as WalletTransaction[];
      all.push(...page);
      if (page.length < 1000) break;
    }
    const emailByUser: Record<string, string> = {};
    for (const r of rows) emailByUser[r.user_id] = r.email;
    downloadCsv(
      `ledger-${stamp()}.csv`,
      ['created_at', 'email', 'type', 'amount', 'reference', 'note', 'order_id'],
      all.map((t) => [t.created_at, emailByUser[t.user_id] ?? t.user_id, t.type, Number(t.amount), t.reference, t.note, t.order_id])
    );
    setExporting(false);
    notify(true, `تم تصدير ${all.length} معاملة`);
  };

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    return !s || r.email?.toLowerCase().includes(s) || r.code.toLowerCase().includes(s);
  });

  return (
    <div>
      <div className={`${card} mb-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40">مجموع أرصدة الزباين (المستحق لهم)</p>
            <p className="text-xl font-black text-white">
              {fmt(totalBalance)} <span className="text-xs text-white/40">ل.س</span>
            </p>
            <p className="text-xs text-white/30">{rows.length} زبون</p>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={exportBalances} className={`${btn} bg-white/5 text-white/70 flex items-center gap-1.5`}>
              <Download className="w-4 h-4" />
              الأرصدة
            </button>
            <button
              onClick={exportLedger}
              disabled={exporting}
              className={`${btn} bg-white/5 text-white/70 flex items-center gap-1.5`}
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              السجل
            </button>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-white/30" />
        <input
          className={`${input} pr-9`}
          placeholder="ابحث برمز المحفظة أو الإيميل"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Empty text="لا يوجد زباين" />
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <div key={row.user_id} className={card}>
              <button onClick={() => toggle(row)} className="w-full text-right">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white break-all">{row.email}</p>
                    <p className="text-xs text-amber-400 font-mono">{row.code}</p>
                  </div>
                  <p className="font-black text-white shrink-0">
                    {fmt(row.balance)} <span className="text-xs text-white/40">ل.س</span>
                  </p>
                </div>
              </button>

              {openId === row.user_id && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                  <input
                    className={input}
                    inputMode="numeric"
                    placeholder="المبلغ"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  />
                  <input
                    className={input}
                    dir="ltr"
                    placeholder="رقم عملية شام كاش (يمنع تكرار الإضافة)"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                  <input
                    className={input}
                    placeholder="ملاحظة (مثلاً: رصيد افتتاحي)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => apply(row, 1)} className={`${btn} flex-1 bg-green-500 text-black`}>
                      إضافة
                    </button>
                    <button disabled={busy} onClick={() => apply(row, -1)} className={`${btn} flex-1 bg-red-500/15 text-red-300`}>
                      خصم
                    </button>
                  </div>

                  {txs.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <p className="text-xs text-white/40">آخر المعاملات</p>
                      {txs.slice(0, 10).map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-white/50 truncate">{t.note ?? t.type}</span>
                          <span className={`font-bold shrink-0 ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {t.amount > 0 ? '+' : ''}
                            {fmt(t.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Catalog
function CatalogTab({ tick, notify }: TabProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [pkgs, setPkgs] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const load = useCallback(async () => {
    const [g, p] = await Promise.all([
      supabase.from('games').select('*').order('sort_order', { ascending: true }),
      supabase.from('packages').select('*').order('sort_order', { ascending: true }),
    ]);
    if (g.data) setGames(g.data);
    if (p.data) setPkgs(p.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  // update + verify that a row was really changed (RLS silently skips rows)
  const update = async (table: 'games' | 'packages', id: string, values: Record<string, unknown>) => {
    const { data, error } = await supabase.from(table).update(values).eq('id', id).select('id');
    if (error || !data || data.length === 0) {
      notify(false, 'لم يتم الحفظ');
      return false;
    }
    notify(true, 'تم الحفظ');
    await load();
    return true;
  };

  const savePrice = async (p: Package) => {
    const price = Number(prices[p.id]);
    if (!(price > 0)) {
      notify(false, 'السعر غير صحيح');
      return;
    }
    if (await update('packages', p.id, { price })) {
      setPrices((x) => {
        const next = { ...x };
        delete next[p.id];
        return next;
      });
    }
  };

  const addPackage = async (game: Game) => {
    const price = Number(newPrice);
    if (!newName.trim() || !(price > 0)) {
      notify(false, 'أدخل اسم الباقة وسعراً صحيحاً');
      return;
    }
    const max = Math.max(0, ...pkgs.filter((p) => p.game_id === game.id).map((p) => p.sort_order));
    const { data, error } = await supabase
      .from('packages')
      .insert({ game_id: game.id, name: newName.trim(), price, currency: 'SYP', sort_order: max + 1 })
      .select('id');
    if (error || !data?.length) {
      notify(false, 'تعذّرت الإضافة');
      return;
    }
    notify(true, 'تمت إضافة الباقة');
    setNewName('');
    setNewPrice('');
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      {games.map((g) => {
        const list = pkgs.filter((p) => p.game_id === g.id);
        return (
          <div key={g.id} className={card}>
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setOpen(open === g.id ? null : g.id)} className="flex-1 text-right font-bold text-white">
                {g.name} <span className="text-xs text-white/30">({list.length})</span>
              </button>
              <button
                onClick={() => update('games', g.id, { is_active: !g.is_active })}
                className={`${btn} ${g.is_active ? 'bg-green-500/15 text-green-300' : 'bg-white/5 text-white/40'}`}
              >
                {g.is_active ? 'ظاهرة' : 'مخفية'}
              </button>
            </div>

            {open === g.id && (
              <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                {list.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className={`flex-1 text-sm ${p.is_active ? 'text-white' : 'text-white/30 line-through'}`}>{p.name}</span>
                    <input
                      className={`${input} !w-28`}
                      inputMode="numeric"
                      value={prices[p.id] ?? String(p.price)}
                      onChange={(e) => setPrices((x) => ({ ...x, [p.id]: e.target.value.replace(/\D/g, '') }))}
                    />
                    {prices[p.id] !== undefined && prices[p.id] !== String(p.price) && (
                      <button onClick={() => savePrice(p)} className={`${btn} bg-amber-400 text-black`}>
                        حفظ
                      </button>
                    )}
                    <button
                      onClick={() => update('packages', p.id, { is_active: !p.is_active })}
                      className={`${btn} ${p.is_active ? 'bg-green-500/15 text-green-300' : 'bg-white/5 text-white/40'}`}
                    >
                      {p.is_active ? 'فعّالة' : 'متوقفة'}
                    </button>
                  </div>
                ))}

                <div className="pt-3 border-t border-white/5 space-y-2">
                  <p className="text-xs text-white/40">إضافة باقة جديدة</p>
                  <input className={input} placeholder="اسم الباقة (مثلاً 60 UC)" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <input
                    className={input}
                    inputMode="numeric"
                    placeholder="السعر بالليرة"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value.replace(/\D/g, ''))}
                  />
                  <button onClick={() => addPackage(g)} className={`${btn} w-full bg-amber-400 text-black`}>
                    إضافة
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Settings
function SettingsTab({ tick, notify }: TabProps) {
  const [s, setS] = useState<StoreSettings | null>(null);
  const [message, setMessage] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();
    if (data) {
      setS(data as StoreSettings);
      setMessage(data.closed_message);
      setAddress(data.sham_cash_address);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  const save = async (values: Partial<StoreSettings>, okText: string) => {
    setBusy(true);
    const { data, error } = await supabase.from('store_settings').update(values).eq('id', 1).select('id');
    setBusy(false);
    if (error || !data?.length) {
      notify(false, 'لم يتم الحفظ');
      return;
    }
    notify(true, okText);
    load();
  };

  if (!s) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="font-bold text-white mb-1">حالة المتجر</p>
        <p className="text-xs text-white/40 mb-3">
          عند الإغلاق لا يستطيع أي زبون إنشاء طلب جديد، وتظهر له الرسالة أدناه.
        </p>
        <button
          disabled={busy}
          onClick={() => {
            const next = !s.is_open;
            if (!next && !window.confirm('إغلاق المتجر ومنع الطلبات الجديدة؟')) return;
            save({ is_open: next }, next ? 'تم فتح المتجر' : 'تم إغلاق المتجر');
          }}
          className={`${btn} w-full ${s.is_open ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}
        >
          {s.is_open ? 'المتجر مفتوح — اضغط للإغلاق' : 'المتجر مغلق — اضغط للفتح'}
        </button>

        <label className="block text-xs text-white/40 mt-4 mb-1">رسالة الإغلاق</label>
        <input className={input} value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} />
        <button
          disabled={busy || message.trim() === s.closed_message}
          onClick={() => save({ closed_message: message.trim() || 'المتجر مغلق حالياً، نعود قريباً' }, 'تم حفظ الرسالة')}
          className={`${btn} w-full bg-white/5 text-white/80 mt-2`}
        >
          حفظ الرسالة
        </button>
      </div>

      <div className={card}>
        <p className="font-bold text-white mb-1">عنوان شام كاش</p>
        <p className="text-xs text-white/40 mb-3">يظهر للزباين في صفحة المحفظة. يمكنك تغييره بدون إعادة نشر الموقع.</p>
        <input className={input} dir="ltr" value={address} maxLength={120} onChange={(e) => setAddress(e.target.value.trim())} />
        <button
          disabled={busy || !address || address === s.sham_cash_address}
          onClick={() => {
            if (!window.confirm('تأكد من العنوان: الزباين سيحوّلون الأموال إليه. متابعة؟')) return;
            save({ sham_cash_address: address }, 'تم حفظ العنوان');
          }}
          className={`${btn} w-full bg-amber-400 text-black mt-2`}
        >
          حفظ العنوان
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Panel
export function AdminPanel() {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('orders');
  const [tick, setTick] = useState(0);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [activeOrders, setActiveOrders] = useState(0);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const bump = useCallback(() => setTick((t) => t + 1), []);
  const notify = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // live updates when orders change
  useEffect(() => {
    const channel = supabase
      .channel(`admin-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, bump)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bump]);

  // email lookup + pending count for the tab badge
  useEffect(() => {
    let alive = true;
    (async () => {
      const [u, o] = await Promise.all([
        supabase.rpc('admin_list_users'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
      ]);
      if (!alive) return;
      if (u.data) {
        const map: Record<string, string> = {};
        for (const row of u.data as Array<{ id: string; email: string }>) map[row.id] = row.email;
        setUsers(map);
      }
      setActiveOrders(o.count ?? 0);
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  const tabs: Array<[Tab, string, number]> = [
    ['orders', 'الطلبات', activeOrders],
    ['customers', 'الزباين', 0],
    ['catalog', 'الباقات', 0],
    ['settings', 'الإعدادات', 0],
  ];
  const props: TabProps = { users, tick, notify, onChanged: bump };

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a0a0f] pb-16">
      <div className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-black text-amber-400">لوحة الإدارة</h1>
          <div className="flex items-center gap-1">
            <button onClick={bump} className="w-10 h-10 rounded-xl text-white/60 hover:text-amber-400 flex items-center justify-center" aria-label="تحديث">
              <RefreshCw className="w-5 h-5" />
            </button>
            <a href="/" className="text-xs text-white/50 hover:text-amber-400 px-2">الموقع</a>
            <button onClick={signOut} className="w-10 h-10 rounded-xl text-white/60 hover:text-amber-400 flex items-center justify-center" aria-label="تسجيل الخروج">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {tabs.map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`${btn} whitespace-nowrap flex items-center gap-1.5 ${
                tab === key ? 'bg-amber-400 text-black' : 'bg-white/5 text-white/60'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[10px] font-black px-1.5 rounded-full ${tab === key ? 'bg-black/20' : 'bg-amber-400 text-black'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed top-24 inset-x-4 z-50 max-w-md mx-auto rounded-xl px-4 py-3 text-sm font-bold text-center shadow-lg ${
            toast.ok ? 'bg-green-500 text-black' : 'bg-red-500 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pt-4">
        {tab === 'orders' && <OrdersTab {...props} />}
        {tab === 'customers' && <CustomersTab {...props} />}
        {tab === 'catalog' && <CatalogTab {...props} />}
        {tab === 'settings' && <SettingsTab {...props} />}
      </div>
    </div>
  );
        }
