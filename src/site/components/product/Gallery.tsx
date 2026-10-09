import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { Img } from '@/components/ui/misc';
import { Modal } from '@/components/ui/Overlay';
import { useDict } from '@/i18n';
import { cn } from '@/lib/utils';
import { PD } from './dict';

/**
 * Product gallery: swipeable main image (scroll-snap) with a subtle
 * cursor-following zoom on desktop, a thumbnail strip and a fullscreen lightbox.
 */
export function Gallery({ images, alt, className }: { images: string[]; alt: string; className?: string }) {
  const t = useDict(PD);
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const list = images.length ? images : [''];
  const many = list.length > 1;

  const go = useCallback(
    (i: number, smooth = true) => {
      const n = (i + list.length) % list.length;
      setIndex(n);
      const el = track.current;
      if (el) el.scrollTo({ left: n * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    },
    [list.length],
  );

  // keep index in sync when the shopper swipes
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index && i >= 0 && i < list.length) setIndex(i);
  };

  const zoomMove = (e: MouseEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const inner = e.currentTarget.firstElementChild as HTMLElement | null;
    if (inner) inner.style.transformOrigin = `${((e.clientX - box.left) / box.width) * 100}% ${((e.clientY - box.top) / box.height) * 100}%`;
  };

  return (
    <div className={cn('flex flex-col gap-3 lg:flex-row-reverse lg:gap-4', className)}>
      <div className="group/gal relative min-w-0 flex-1">
        <div ref={track} onScroll={onScroll} className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-3xl bg-sand">
          {list.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => {
                setIndex(i);
                setLightbox(true);
              }}
              onMouseMove={zoomMove}
              aria-label={t('zoom')}
              className="group/slide relative h-full w-full shrink-0 snap-center overflow-hidden lg:cursor-zoom-in"
            >
              <div className="h-full w-full transition-transform duration-500 ease-out lg:group-hover/slide:scale-[1.35]">
                {src && <Img src={src} eager={i === 0} alt={i === 0 ? alt : ''} className="h-full w-full object-cover" />}
              </div>
            </button>
          ))}
        </div>

        {/* overlay controls */}
        <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-ink/70 px-3 py-1 text-[12px] font-semibold tabular-nums text-white backdrop-blur">
          {index + 1} / {list.length}
        </span>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          aria-label={t('zoom')}
          className="absolute bottom-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white"
        >
          <Expand className="h-4 w-4" />
        </button>
        {many && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={t('prev')}
              className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow-sm backdrop-blur transition hover:bg-white group-hover/gal:opacity-100 lg:grid"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={t('next')}
              className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow-sm backdrop-blur transition hover:bg-white group-hover/gal:opacity-100 lg:grid"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {many && (
        <div className="no-scrollbar -m-1 flex gap-2.5 overflow-x-auto p-1 lg:w-[92px] lg:shrink-0 lg:flex-col lg:overflow-visible">
          {list.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => go(i)}
              aria-label={`${i + 1} / ${list.length}`}
              aria-current={i === index}
              className={cn(
                'relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl bg-sand transition-all lg:w-full',
                i === index ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'opacity-70 hover:opacity-100',
              )}
            >
              <Img src={src} small alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <Lightbox open={lightbox} onClose={() => setLightbox(false)} images={list} index={index} onIndex={(i) => go(i, false)} alt={alt} />
    </div>
  );
}

function Lightbox({ open, onClose, images, index, onIndex, alt }: { open: boolean; onClose: () => void; images: string[]; index: number; onIndex: (i: number) => void; alt: string }) {
  const t = useDict(PD);
  const n = images.length;
  const [dir, setDir] = useState(0);
  const step = useCallback(
    (d: number) => {
      setDir(d);
      onIndex((index + d + n) % n);
    },
    [index, n, onIndex],
  );

  useEffect(() => {
    if (!open || n < 2) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, n, step]);

  return (
    <Modal open={open} onClose={onClose} size="full" className="h-[92vh] bg-ink! sm:h-[90vh]">
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between px-5 py-4 text-white sm:px-6">
          <span className="text-[13px] font-semibold tabular-nums text-white/70">
            {index + 1} / {n}
          </span>
          <span className="mx-4 hidden min-w-0 truncate text-sm font-semibold sm:block">{alt}</span>
          <button type="button" onClick={onClose} aria-label={t('close')} className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false} custom={dir}>
            <motion.div
              key={index}
              custom={dir}
              initial={{ opacity: 0, x: dir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -60 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center justify-center px-4 sm:px-20"
              drag={n > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) step(1);
                else if (info.offset.x > 60) step(-1);
              }}
            >
              {images[index] && <img src={images[index]} alt={alt} draggable={false} className="max-h-full max-w-full rounded-2xl object-contain select-none" />}
            </motion.div>
          </AnimatePresence>
          {n > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} aria-label={t('prev')} className="absolute left-3 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white hover:text-ink sm:left-6">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label={t('next')} className="absolute right-3 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white hover:text-ink sm:right-6">
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
        {n > 1 && (
          <div className="flex justify-center gap-2.5 px-5 py-4">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => {
                  setDir(i > index ? 1 : -1);
                  onIndex(i);
                }}
                aria-label={`${i + 1} / ${n}`}
                className={cn('h-14 w-12 overflow-hidden rounded-lg transition-all', i === index ? 'ring-2 ring-white ring-offset-2 ring-offset-ink' : 'opacity-50 hover:opacity-90')}
              >
                <Img src={src} small alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
