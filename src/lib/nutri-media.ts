import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_BUCKET } from './photos';

/*
 * Imagens do perfil do nutricionista: foto, logo do consultório e assinatura.
 * Ficam no mesmo armazenamento privado das fotos de avaliação, na pasta da própria conta
 * ("<usuário>/perfil/..."), que as regras de acesso já protegem. O perfil guarda só o caminho.
 * Para mostrar, o app pede um link temporário (1 hora), guardado em memória por 50 minutos.
 */
export type MediaKind = 'photo' | 'logo' | 'sign';
export type MediaUrls = { photo: string; logo: string; sign: string };
export type MediaStore = {
  upload: (kind: MediaKind, blob: Blob) => Promise<string>;
  remove: (path: string | null | undefined) => Promise<void>;
  url: (path: string | null | undefined) => Promise<string>;
  urls: (n: { photoPath?: string | null; logoPath?: string | null; signPath?: string | null }) => Promise<MediaUrls>;
};
const loose = supabase as unknown as SupabaseClient;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export function nutriMedia(userId: string): MediaStore {
  const cache = new Map<string, { url: string; at: number }>();
  const url = async (path: string | null | undefined) => {
    if (!path) return '';
    const c = cache.get(path); if (c && Date.now() - c.at < 50 * 60e3) return c.url;
    const { data, error } = await loose.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return '';
    cache.set(path, { url: data.signedUrl, at: Date.now() });
    return data.signedUrl;
  };
  return {
    async upload(kind, blob) {
      const path = `${userId}/perfil/${kind}-${Date.now()}.${EXT[blob.type] ?? 'png'}`;
      const { error } = await loose.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type || 'image/png', upsert: true });
      if (error) throw error;
      return path;
    },
    async remove(path) {
      if (!path || !path.startsWith(userId + '/perfil/')) return;
      cache.delete(path);
      await loose.storage.from(PHOTO_BUCKET).remove([path]).catch(() => {});
    },
    url,
    async urls(n) {
      const [photo, logo, sign] = await Promise.all([url(n.photoPath), url(n.logoPath), url(n.signPath)].map((p) => p.catch(() => '')));
      return { photo: photo!, logo: logo!, sign: sign! };
    },
  };
}
