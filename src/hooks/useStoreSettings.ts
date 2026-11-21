import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { StoreSettings } from '@/types';

const DEFAULTS: StoreSettings = { id: 1, is_open: true, closed_message: '', sham_cash_address: '' };

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();
      if (!alive) return;
      if (data) setSettings(data as StoreSettings);
      setLoaded(true);
    };
    load();
    const channel = supabase
      .channel(`store-settings-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, () => {
        load();
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loaded };
  }
