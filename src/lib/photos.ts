import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pose } from './poses.js';

/*
 * Fotos de acompanhamento (frente, costas e laterais) de cada avaliação.
 *
 * - Cada foto é guardada primeiro neste aparelho (IndexedDB): aparece na hora e funciona sem internet.
 * - Quando a avaliação já existe no banco e a nuvem de fotos está ativa (tabela "fotos_avaliacao" +
 *   bucket privado "fotos-avaliacoes"), a foto sobe sozinha e a cópia local é apagada.
 * - Enquanto a nuvem de fotos não existir, as fotos ficam só neste aparelho (o app avisa).
 */
export type { Pose };
export type PhotoMeta = { id: string; owner: string; assessmentId: string; profileId: string; pose: Pose; w: number; h: number; createdAt: number; path: string | null };
export type PhotoStore = ReturnType<typeof photoStore>;

export const PHOTO_BUCKET = 'fotos-avaliacoes';
const TABLE = 'fotos_avaliacao';
const POSE_DB: Record<Pose, string> = { front: 'frente', back: 'costas', right: 'lado_direito', left: 'lado_esquerdo' };
const POSE_APP: Record<string, Pose> = { frente: 'front', costas: 'back', lado_direito: 'right', lado_esquerdo: 'left' };
const loose = supabase as unknown as SupabaseClient;

/* ---------- IndexedDB (mínimo) ---------- */
const DB_NAME = 'avf-fotos';
let dbp: Promise<IDBDatabase> | null = null;
function idb(): Promise<IDBDatabase> {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' }); if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  });
  return dbp;
}
function req<T>(store: 'meta' | 'blobs', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return idb().then((d) => new Promise<T>((res, rej) => { const t = d.transaction(store, mode); const q = fn(t.objectStore(store)); q.onsuccess = () => res(q.result as T); q.onerror = () => rej(q.error); }));
}
const idbPut = (store: 'meta' | 'blobs', value: unknown, key?: string) => req<IDBValidKey>(store, 'readwrite', (s) => s.put(value, key));
const idbGet = <T>(store: 'meta' | 'blobs', key: string) => req<T | undefined>(store, 'readonly', (s) => s.get(key));
const idbDel = (store: 'meta' | 'blobs', key: string) => req<undefined>(store, 'readwrite', (s) => s.delete(key));
/*
 * Guardar a foto: o Safari em janela privada recusa arquivo (Blob) no IndexedDB.
 * Tenta o arquivo; se recusar, guarda os bytes; se nem isso der, fica na memória desta aba
 * (a foto sobe para a nuvem quando a avaliação é salva, então não se perde).
 */
const memBlobs = new Map<string, Blob>();
type StoredBlob = Blob | { buf: ArrayBuffer; type: string };
async function putBlob(id: string, blob: Blob) {
  try { await idbPut('blobs', blob, id); memBlobs.delete(id); return; } catch { /* tenta como bytes */ }
  try { await idbPut('blobs', { buf: await blob.arrayBuffer(), type: blob.type || 'image/jpeg' }, id); memBlobs.delete(id); return; } catch { /* fica na memória */ }
  memBlobs.set(id, blob);
}
async function getBlob(id: string): Promise<Blob | undefined> {
  const m = memBlobs.get(id); if (m) return m;
  const v = await idbGet<StoredBlob>('blobs', id).catch(() => undefined);
  if (!v) return undefined;
  if (v instanceof Blob) return v;
  return v.buf ? new Blob([v.buf], { type: v.type || 'image/jpeg' }) : undefined;
}
async function delBlob(id: string) { memBlobs.delete(id); await idbDel('blobs', id).catch(() => {}); }
const idbAll = <T>(store: 'meta') => req<T[]>(store, 'readonly', (s) => s.getAll());

/* ---------- carregar ---------- */
type Row = { id: string; avaliacao_id: string; paciente_id: string; pose: string; caminho: string; largura: number | null; altura: number | null; created_at: string };
export async function loadPhotos(userId: string): Promise<{ cloud: boolean; metas: PhotoMeta[] }> {
  const metas: PhotoMeta[] = [];
  let cloud = false;
  try {
    const probe = await loose.from(TABLE).select('id').limit(1);
    cloud = !probe.error;
    if (cloud) for (let from = 0; ; from += 1000) {
      const { data, error } = await loose.from(TABLE).select('*').order('created_at').range(from, from + 999);
      if (error) break;
      for (const r of (data ?? []) as Row[]) {
        const pose = POSE_APP[r.pose]; if (!pose) continue;
        metas.push({ id: r.id, owner: userId, assessmentId: r.avaliacao_id, profileId: r.paciente_id, pose, w: r.largura ?? 1200, h: r.altura ?? 1600, createdAt: Date.parse(r.created_at), path: r.caminho });
      }
      if ((data?.length ?? 0) < 1000) break;
    }
  } catch { cloud = false; }
  try {
    for (const m of await idbAll<PhotoMeta>('meta')) if (m.owner === userId && !metas.some((x) => x.id === m.id)) metas.push({ ...m, path: null });
  } catch { /* navegador sem IndexedDB (ex.: janela privada antiga) */ }
  return { cloud, metas };
}

/* ---------- imagem: corrige orientação, reduz e converte em JPEG ---------- */
export async function toJpeg(src: Blob | HTMLCanvasElement, max = 1600, quality = 0.88): Promise<{ blob: Blob; w: number; h: number }> {
  let canvas: HTMLCanvasElement;
  if (src instanceof HTMLCanvasElement) canvas = src;
  else {
    const bmp = await createImageBitmap(src, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    canvas = document.createElement('canvas'); canvas.width = Math.round(bmp.width * s); canvas.height = Math.round(bmp.height * s);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height); bmp.close?.();
  }
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Não foi possível processar a foto'))), 'image/jpeg', quality));
  return { blob, w: canvas.width, h: canvas.height };
}

/* ---------- loja de fotos ---------- */
export function photoStore(userId: string, cloud: boolean, initial: PhotoMeta[]) {
  let list = [...initial];
  const urls = new Map<string, { url: string; exp: number; local: boolean }>();
  const pending = new Map<string, Promise<string>>();
  let queue: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((fn) => fn());

  function cachedUrl(id: string) { const u = urls.get(id); return u && u.exp > Date.now() ? u.url : ''; }
  async function blobOf(m: PhotoMeta): Promise<Blob | null> {
    if (!m.path) return (await getBlob(m.id)) ?? null;
    const { data, error } = await loose.storage.from(PHOTO_BUCKET).download(m.path);
    return error ? null : data;
  }
  function url(m: PhotoMeta): Promise<string> {
    const c = cachedUrl(m.id); if (c) return Promise.resolve(c);
    const p = pending.get(m.id); if (p) return p;
    const job = (async () => {
      if (!m.path) {
        const b = await getBlob(m.id);
        if (!b) return '';
        const u = URL.createObjectURL(b); urls.set(m.id, { url: u, exp: Infinity, local: true }); return u;
      }
      const { data, error } = await loose.storage.from(PHOTO_BUCKET).createSignedUrl(m.path, 3600);
      if (error || !data?.signedUrl) return '';
      urls.set(m.id, { url: data.signedUrl, exp: Date.now() + 3500_000, local: false }); return data.signedUrl;
    })().finally(() => pending.delete(m.id));
    pending.set(m.id, job); return job;
  }
  function forget(id: string) { const u = urls.get(id); if (u?.local) URL.revokeObjectURL(u.url); urls.delete(id); }

  async function removeMeta(m: PhotoMeta) {
    list = list.filter((x) => x.id !== m.id); forget(m.id); changed();
    await Promise.all([idbDel('meta', m.id).catch(() => {}), delBlob(m.id)]);
    if (m.path) {
      await loose.storage.from(PHOTO_BUCKET).remove([m.path]);
      await loose.from(TABLE).delete().eq('id', m.id);
    }
  }

  return {
    cloud,
    list: () => list,
    of: (assessmentId: string) => list.filter((m) => m.assessmentId === assessmentId),
    get: (assessmentId: string, pose: Pose) => list.find((m) => m.assessmentId === assessmentId && m.pose === pose) ?? null,
    cachedUrl,
    url,
    blob: blobOf,
    subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); },
    /** guarda (ou substitui) a foto de uma pose */
    async add(info: { assessmentId: string; profileId: string; pose: Pose }, blob: Blob, w: number, h: number) {
      const meta: PhotoMeta = { id: crypto.randomUUID(), owner: userId, ...info, w, h, createdAt: Date.now(), path: null };
      await putBlob(meta.id, blob);
      await idbPut('meta', meta).catch(() => {}); // sem IndexedDB: a lista fica na memória
      const old = list.find((m) => m.assessmentId === info.assessmentId && m.pose === info.pose);
      list = [...list.filter((m) => m !== old), meta];
      urls.set(meta.id, { url: URL.createObjectURL(blob), exp: Infinity, local: true });
      changed();
      if (old) void removeMeta(old).catch(() => {});
      return meta;
    },
    async remove(id: string) { const m = list.find((x) => x.id === id); if (m) await removeMeta(m); },
    async removeAssessment(assessmentId: string) { for (const m of list.filter((x) => x.assessmentId === assessmentId)) await removeMeta(m).catch(() => {}); },
    /** envia para a nuvem as fotos locais cujas avaliações já estão salvas no banco */
    sync(saved: Set<string>) {
      if (!cloud) return queue;
      queue = queue.catch(() => {}).then(async () => {
        for (const m of list.filter((x) => !x.path && saved.has(x.assessmentId))) {
          const blob = await getBlob(m.id); if (!blob) continue;
          const path = `${userId}/${m.profileId}/${m.assessmentId}/${m.pose}-${m.id}.jpg`;
          const up = await loose.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
          if (up.error) continue;
          const ins = await loose.from(TABLE).insert({ id: m.id, owner_id: userId, avaliacao_id: m.assessmentId, paciente_id: m.profileId, pose: POSE_DB[m.pose], caminho: path, largura: m.w, altura: m.h });
          if (ins.error) { await loose.storage.from(PHOTO_BUCKET).remove([path]); continue; }
          m.path = path; // a URL local continua valendo nesta sessão
          await Promise.all([idbDel('meta', m.id).catch(() => {}), delBlob(m.id)]);
        }
      });
      return queue;
    },
  };
}

/* ---------- imagem lado a lado para baixar/compartilhar ---------- */
export async function composeComparison(store: PhotoStore, items: { meta: PhotoMeta; label: string; sub: string }[], title: string): Promise<Blob> {
  const bmps = await Promise.all(items.map(async (it) => { const b = await store.blob(it.meta); if (!b) throw new Error('Foto indisponível'); return createImageBitmap(b); }));
  const W = 900, H = 1200, pad = 36, head = 110, foot = 120;
  const c = document.createElement('canvas'); c.width = pad + items.length * (W + pad); c.height = head + H + foot;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#141414'; x.font = '600 44px Urbanist, system-ui, sans-serif'; x.fillText(title, pad, 70);
  bmps.forEach((bmp, i) => {
    const left = pad + i * (W + pad), s = Math.max(W / bmp.width, H / bmp.height), dw = bmp.width * s, dh = bmp.height * s;
    x.save(); x.beginPath(); x.roundRect(left, head, W, H, 28); x.clip();
    x.fillStyle = '#eeeeea'; x.fillRect(left, head, W, H);
    x.drawImage(bmp, left + (W - dw) / 2, head + (H - dh) / 2, dw, dh); x.restore();
    x.fillStyle = '#141414'; x.font = '600 40px Urbanist, system-ui, sans-serif'; x.fillText(items[i]!.label, left, head + H + 56);
    x.fillStyle = '#6b6b66'; x.font = '500 30px Urbanist, system-ui, sans-serif'; x.fillText(items[i]!.sub, left, head + H + 98);
    bmp.close?.();
  });
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar imagem'))), 'image/jpeg', 0.9));
}
