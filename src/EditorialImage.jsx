import { editorialMedia, safeEditorialImage } from './editorialMedia.js';

export default function EditorialImage({ name, value, alt, priority = false, sizes = '(max-width: 600px) 100vw, 50vw', className }) {
  const [, fallback, responsive] = editorialMedia[name];
  const source = safeEditorialImage(value) || fallback;
  const srcSet = source === fallback && responsive ? `${fallback.replace('.webp', '-small.webp')} 768w, ${fallback} 1536w` : undefined;
  return <img className={className} src={source} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={alt} width="1536" height="1024" loading={priority ? 'eager' : 'lazy'} fetchpriority={priority ? 'high' : undefined} decoding="async" onError={(event) => { if (event.currentTarget.getAttribute('src') !== fallback) { event.currentTarget.removeAttribute('srcset'); event.currentTarget.src = fallback; } }} />;
}
