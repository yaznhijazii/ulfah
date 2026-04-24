import { supabase } from './supabase';

export interface CacheEntry {
  events: any[];
  memories: any[];
  greetings: any[];
  hasMore: boolean;
  ts: number;
}

const _sessionCache: Record<string, CacheEntry> = {};
const CACHE_TTL = 30 * 60 * 1000; // Increased to 30 minutes for better background persistence
export const PAGE_SIZE = 100;

export function readCache(pid: string): CacheEntry | null {
  const c = _sessionCache[pid];
  if (c && Date.now() - c.ts < CACHE_TTL) return c;
  return null;
}

export function writeCache(pid: string, data: Omit<CacheEntry, 'ts'>) {
  _sessionCache[pid] = { ...data, ts: Date.now() };
}

export function invalidateCache(pid: string) {
  delete _sessionCache[pid];
}

/**
 * Preloads essential calendar data in the background.
 * This should be called early (e.g. in App.tsx) to ensure the Calendar screen 
 * is instant when opened.
 */
export async function preloadCalendar(pid: string, userId: string): Promise<void> {
  const cached = readCache(pid);
  if (cached) return;

  console.log('[CalendarPreloader] Starting background sync...');

  try {
    // We fetch everything in parallel for maximum speed
    const [memRes, evRes, grRes] = await Promise.all([
      supabase.from('memories')
        .select('*, images:memory_images(image_url)')
        .eq('partnership_id', pid)
        .order('memory_date', { ascending: false })
        .limit(PAGE_SIZE),
      supabase.from('calendar_events')
        .select('*')
        .eq('partnership_id', pid)
        .order('event_date', { ascending: false })
        .limit(PAGE_SIZE),
      supabase.from('occasion_greetings')
        .select('*')
        .eq('partnership_id', pid)
        .eq('sender_id', userId)
        .order('target_date', { ascending: false })
    ]);

    if (memRes.data) {
      writeCache(pid, {
        events: evRes.data || [],
        memories: memRes.data,
        greetings: grRes.data || [],
        hasMore: memRes.data.length >= PAGE_SIZE
      });
      console.log('[CalendarPreloader] Background sync complete. Ready for instant load.');

      // Silently preload images into the browser's HTTP cache
      // so they appear instantly when the user navigates to the Calendar screen
      const imageUrlsToPreload = new Set<string>();
      
      // Extract from memories
      memRes.data.forEach((mem: any) => {
        if (mem.images && Array.isArray(mem.images)) {
          mem.images.forEach((img: any) => {
            if (img.image_url) imageUrlsToPreload.add(img.image_url);
          });
        }
      });

      // Extract from events (if they have images)
      if (evRes.data) {
        evRes.data.forEach((ev: any) => {
          if (ev.image_url) imageUrlsToPreload.add(ev.image_url);
        });
      }

      // Fire off preloads
      Array.from(imageUrlsToPreload).forEach(url => {
        const img = new Image();
        img.src = url;
      });
      
      console.log(`[CalendarPreloader] Preloading ${imageUrlsToPreload.size} images...`);
    }
  } catch (error) {
    console.error('[CalendarPreloader] Background sync failed:', error);
  }
}
