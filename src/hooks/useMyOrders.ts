import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { AdminOrder } from '@/types';

export function useMyOrders() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from('orders')
      .select('*, games(name, logo_url), packages(name, price, currency)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setOrders(data as unknown as AdminOrder[]);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    load();
    const channel = supabase
      .channel(`my-orders-${uid}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${uid}` },
        () => { load(); }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, load]);

  return { orders, loading, reload: load };
}
