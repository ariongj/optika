import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarCheck, Check, Link2, Pencil, RotateCcw, Ruler, ScanFace } from 'lucide-react';
import type { L10n, Product } from '@/lib/types';
import { Accent, Img } from '@/components/ui/misc';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Price } from '@/site/components/Price';
import { ProductBadges } from '@/site/components/ProductCard';
import { copyText } from '@/site/components/content/posts';
import { tryOnPath } from '@/site/components/product/optical';
import { openBooking } from '@/site/components/utility/Booking';
import { useDict, useL } from '@/i18n';
import { useActiveProducts, useCategories } from '@/store/hooks';
import { href } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { ChoiceGroup, type Choice } from './ChoiceGroup';
import { FF } from './finderDict';
import { FIT_SIZE, OPTIONS, STEPS, type Answers, type Face, type Fit, type Material, type StepKey } from './finderData';
import { answersFromParams, answersToQuery, clearSaved, isComplete, loadSaved, save, scoreFrames, type FrameMatch } from './finderScore';
import { FaceGlyph, FrameGlyph, MatchRing, MaterialSwatch, WidthGlyph } from './FinderVisuals';

interface QuizState {
  answers: Answers;
  step: number;
  done: boolean;
  /** editing one answer from the result — the next pick goes straight back to the result */
  edit?: boolean;
}

const LAST = STEPS.length - 1;
const firstMissing = (a: Answers) => {
  const i = STEPS.findIndex((s) => !a[s.key]);
  return i < 0 ? LAST : i;
};

/** URL answers win (shared links), then the last saved quiz, then a fresh start. */
function initialState(params: URLSearchParams): QuizState {
  const fromUrl = answersFromParams(params);
  if (Object.keys(fromUrl).length) {
    const done = isComplete(fromUrl);
    return { answers: fromUrl, step: done ? LAST : firstMissing(fromUrl), done };
  }
  return loadSaved() ?? { answers: {}, step: 0, done: false };
}

/** Visual per answer value. */
function visualFor(key: StepKey, id: string): ReactNode {
  const box = (n: ReactNode) => <span className="flex h-14 items-center sm:h-16">{n}</span>;
  switch (key) {
    case 'kind':
      if (id === 'both')
        return box(
          <span className="relative block h-12 w-28 text-ink">
            <FrameGlyph shape="rectangle" className="absolute left-0 top-0 h-9 w-[86px]" />
            <FrameGlyph shape="aviator" tint="sun" build="metal" className="absolute bottom-0 right-0 h-9 w-[86px]" />
          </span>,
        );
      return box(id === 'sun' ? <FrameGlyph shape="square" tint="sun" className="h-11 w-28 text-ink" /> : <FrameGlyph shape="rectangle" className="h-11 w-28 text-ink" />);
    case 'face':
      return box(<FaceGlyph face={id as Face} className="h-16 w-14 text-ink sm:h-[68px] sm:w-[58px]" />);
    case 'style': {
      const g = { classic: <FrameGlyph shape="rectangle" />, minimal: <FrameGlyph shape="round" build="metal" />, bold: <FrameGlyph shape="square" />, sport: <FrameGlyph shape="wrap" tint="sun" /> }[id];
      return box(<span className="block h-11 w-28 text-ink [&>svg]:h-full [&>svg]:w-full">{g}</span>);
    }
    case 'material':
      return box(<MaterialSwatch material={id as Material} className="h-12 w-12 sm:h-14 sm:w-14" />);
    case 'fit':
      return box(<WidthGlyph fit={id as Fit} className="h-11 w-28 text-ink" />);
    default:
      return null;
  }
}

const GRID: Record<StepKey, string> = {
  kind: 'grid gap-2.5 sm:grid-cols-3 sm:gap-3',
  face: 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3',
  style: 'grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4',
  material: 'grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4',
  fit: 'grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4',
};

export function FrameQuiz() {
  const t = useDict(FF);
  const l = useL();
  const reduce = useReducedMotion();
  const products = useActiveProducts();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<QuizState>(() => initialState(params));
  const { answers, step, done } = state;
  const key = STEPS[step].key;
  const rootRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const names = t('stepNames').split('|');

  // Persist the last answers (wrapped — storage may be unavailable).
  useEffect(() => save(state), [state]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Shareable result: mirror finished answers into the query string (and clear it on restart).
  const query = done ? answersToQuery(answers) : '';
  useEffect(() => {
    const current = answersToQuery(answersFromParams(params));
    if (current === query) return;
    const next = new URLSearchParams(params);
    for (const s of STEPS) next.delete(s.param);
    if (query) new URLSearchParams(query).forEach((v, k) => next.set(k, v));
    setParams(next, { replace: true, preventScrollReset: true });
  }, [query, params, setParams]);

  const matches = useMemo(() => (done ? scoreFrames(products, answers).slice(0, 3) : []), [done, products, answers]);

  /** Keep the quiz top in view after a step change (phones scroll past the options). */
  const settle = () => {
    focusPending.current = true;
    const el = rootRef.current;
    if (el && el.getBoundingClientRect().top < 72) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const goTo = (i: number, finished = false, edit = false) => {
    window.clearTimeout(timer.current);
    setState((s) => ({ ...s, step: Math.max(0, Math.min(LAST, i)), done: finished, edit }));
    settle();
  };
  const toResult = state.edit && isComplete(answers);
  const next = () => (toResult || step >= LAST ? goTo(LAST, isComplete(answers)) : goTo(step + 1));
  const choose = (k: StepKey, v: string) => setState((s) => ({ ...s, answers: { ...s.answers, [k]: v } }));
  const pick = (k: StepKey, v: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setState((s) => {
        const a = { ...s.answers, [k]: v };
        const i = STEPS.findIndex((x) => x.key === k);
        if (s.edit && isComplete(a)) return { answers: a, step: LAST, done: true };
        if (i >= LAST) return isComplete(a) ? { answers: a, step: LAST, done: true } : { answers: a, step: firstMissing(a), done: false };
        return { answers: a, step: i + 1, done: false };
      });
      settle();
    }, 260);
  };
  const restart = () => {
    window.clearTimeout(timer.current);
    clearSaved();
    setState({ answers: {}, step: 0, done: false });
    settle();
  };
  const share = async () => {
    const url = `${window.location.origin}${href(`/gjej-kornizen?${answersToQuery(answers)}`)}`;
    try {
      await copyText(url);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFail'));
    }
  };

  const headingRef = (el: HTMLHeadingElement | null) => {
    if (el && focusPending.current) {
      focusPending.current = false;
      el.focus({ preventScroll: true });
    }
  };

  const reachable = firstMissing(answers);
  const answered = STEPS.filter((s) => answers[s.key]).length;
  const motionProps = reduce
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0 } } }
    : { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const } };

  const options: Choice<string>[] = (OPTIONS[key] as readonly { id: string; label: L10n; hint: L10n }[]).map((o) => ({
    id: o.id,
    label: l(o.label),
    hint: l(o.hint),
    visual: visualFor(key, o.id),
  }));

  return (
    <div ref={rootRef} className="scroll-mt-24">
      <AnimatePresence mode="wait" initial={false}>
        {!done ? (
          <motion.div key="quiz" {...(reduce ? { initial: false } : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } })}>
            <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-[0_40px_80px_-56px_rgba(28,26,23,0.55)] ring-1 ring-line sm:rounded-[36px]">
              {/* Step header */}
              <div className="flex items-center justify-between gap-4 px-5 pb-4 pt-5 sm:px-10 sm:pt-7">
                <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand-600">{t('step', { n: step + 1, total: STEPS.length })}</span>
                <ol className="hidden items-center gap-1 md:flex">
                  {STEPS.map((s, i) => (
                    <li key={s.key}>
                      <button
                        type="button"
                        disabled={i > reachable}
                        onClick={() => goTo(i)}
                        aria-current={i === step ? 'step' : undefined}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none',
                          i === step ? 'bg-ink text-paper' : answers[s.key] ? 'text-ink hover:bg-sand' : 'text-muted',
                        )}
                      >
                        {answers[s.key] && i !== step ? <Check className="h-3.5 w-3.5 text-brand-600" strokeWidth={3} /> : <span className="tabular-nums">{i + 1}</span>}
                        {names[i]}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
              <div role="progressbar" aria-label={t('progress')} aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={answered} className="h-1 bg-sand">
                <div className="h-full rounded-r-full bg-brand-600 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${(Math.max(answered, step) / STEPS.length) * 100}%` }} />
              </div>

              {/* Question */}
              <div className="min-h-[320px] px-5 py-7 sm:px-10 sm:py-9">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={key} {...motionProps}>
                    <h2 ref={headingRef} id={`ff-q-${key}`} tabIndex={-1} className="display text-[30px] leading-[1.08] text-ink outline-none sm:text-[40px]">
                      {t(`q_${key}`)}
                    </h2>
                    <p id={`ff-h-${key}`} className="mt-2 text-[15px] text-muted">
                      {t(`h_${key}`)}
                    </p>
                    <ChoiceGroup
                      labelledBy={`ff-q-${key}`}
                      describedBy={`ff-h-${key}`}
                      value={answers[key]}
                      onChange={(v) => choose(key, v)}
                      onPick={(v) => pick(key, v)}
                      variant="tile"
                      className={cn('mt-7', GRID[key])}
                      options={options}
                    />
                    {key === 'fit' && <WidthCalculator onUse={(v) => { choose('fit', v); pick('fit', v); }} />}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Back / next */}
              <div className="flex items-center justify-between gap-3 border-t border-line bg-paper/60 px-5 py-4 sm:px-10">
                <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0} icon={<ArrowLeft className="h-4 w-4" />}>
                  {t('back')}
                </Button>
                <Button variant="dark" onClick={next} disabled={!answers[key]} iconRight={<ArrowRight className="h-4 w-4" />}>
                  {toResult || step >= LAST ? t('seeResult') : t('next')}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="result" {...(reduce ? { initial: false } : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.4 } })}>
            <Results
              answers={answers}
              matches={matches}
              headingRef={headingRef}
              onEdit={(i) => goTo(i, false, true)}
              onRestart={restart}
              onShare={share}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Frame width from the numbers on the temple                           */
/* ------------------------------------------------------------------ */
function WidthCalculator({ onUse }: { onUse: (v: Fit) => void }) {
  const t = useDict(FF);
  const l = useL();
  const [lens, setLens] = useState('');
  const [bridge, setBridge] = useState('');
  const a = Number(lens);
  const b = Number(bridge);
  const ok = a >= 38 && a <= 64 && b >= 12 && b <= 26;
  const width = ok ? Math.round(2 * a + b + 16) : null;
  const fit: Fit | null = width == null ? null : width < 135 ? 'narrow' : width <= 140 ? 'medium' : 'wide';
  return (
    <div className="mt-6 rounded-[22px] bg-paper p-4 ring-1 ring-line sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-brand-600 ring-1 ring-line">
          <Ruler className="h-4 w-4" />
        </span>
        <div>
          <div className="text-[14.5px] font-semibold text-ink">{t('calcTitle')}</div>
          <p className="mt-0.5 text-[13.5px] text-muted">{t('calcText')}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Input label={t('calcLens')} type="number" inputMode="numeric" min={38} max={64} placeholder="52" value={lens} onChange={(e) => setLens(e.target.value)} wrapClassName="w-[120px]" />
        <Input label={t('calcBridge')} type="number" inputMode="numeric" min={12} max={26} placeholder="18" value={bridge} onChange={(e) => setBridge(e.target.value)} wrapClassName="w-[120px]" />
        <div className="flex min-h-11 flex-1 flex-wrap items-center gap-3" aria-live="polite">
          {width != null && fit && (
            <>
              <span className="text-[14px] font-semibold text-ink tabular-nums">{t('calcResult', { width, size: l(FIT_SIZE[fit]) })}</span>
              <Button size="sm" variant="dark" onClick={() => onUse(fit)}>
                {t('calcUse')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                              */
/* ------------------------------------------------------------------ */
function Results({
  answers,
  matches,
  headingRef,
  onEdit,
  onRestart,
  onShare,
}: {
  answers: Answers;
  matches: FrameMatch[];
  headingRef: (el: HTMLHeadingElement | null) => void;
  onEdit: (i: number) => void;
  onRestart: () => void;
  onShare: () => void;
}) {
  const t = useDict(FF);
  const l = useL();
  const names = t('stepNames').split('|');
  const sportNote = answers.kind === 'optical' && answers.style === 'sport';
  const allHref = answers.kind === 'sun' ? '/produktet/syze-dielli' : answers.kind === 'optical' ? '/produktet/syze-optike' : '/produktet';

  return (
    <div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="eyebrow mb-3">{t('resEyebrow')}</div>
          <h2 ref={headingRef} tabIndex={-1} className="display text-[34px] leading-[1.05] text-ink outline-none sm:text-5xl">
            <Accent text={t('resTitle')} />
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">{t('resText')}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={onRestart} icon={<RotateCcw className="h-4 w-4" />}>
            {t('restart')}
          </Button>
          <Button variant="outline" onClick={onShare} icon={<Link2 className="h-4 w-4" />}>
            {t('share')}
          </Button>
          <Button onClick={() => openBooking('exam')} icon={<CalendarCheck className="h-4 w-4" />}>
            {t('book')}
          </Button>
        </div>
      </div>

      {/* Answers — each chip jumps back to its question */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{t('yourAnswers')}</span>
        {STEPS.map((s, i) => {
          const opt = (OPTIONS[s.key] as readonly { id: string; label: L10n }[]).find((o) => o.id === answers[s.key]);
          if (!opt) return null;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onEdit(i)}
              aria-label={t('edit', { q: `${names[i]} — ${l(opt.label)}` })}
              className="group inline-flex items-center gap-2 rounded-full bg-white py-1.5 pl-3 pr-2.5 text-[13px] ring-1 ring-line transition hover:ring-ink/30"
            >
              <span className="text-muted">{names[i]}:</span>
              <span className="font-semibold text-ink">{l(opt.label)}</span>
              <Pencil className="h-3 w-3 text-muted transition group-hover:text-brand-600" />
            </button>
          );
        })}
      </div>

      {matches.length > 0 ? (
        <ol className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((m, i) => (
            <MatchCard key={m.product.id} match={m} rank={i + 1} />
          ))}
        </ol>
      ) : (
        <p className="mt-8 rounded-[24px] bg-white p-6 text-[15px] text-muted ring-1 ring-line">{t('empty')}</p>
      )}

      {sportNote && <p className="mt-5 rounded-[20px] bg-brand-50 p-4 text-[14px] text-ink-soft ring-1 ring-brand-600/15">{t('sportNote')}</p>}

      <div className="mt-8 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted">{t('honest')}</p>
        <Link to={allHref} className="group inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-ink">
          <span className="link-u">{t('seeAll')}</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

function MatchCard({ match, rank }: { match: FrameMatch; rank: number }) {
  const t = useDict(FF);
  const l = useL();
  const cats = useCategories();
  const p: Product = match.product;
  const category = cats.find((c) => c.id === p.categoryId);
  const colours = p.options.find((o) => o.id === 'color')?.values ?? [];
  const ordered = match.colourId ? [...colours].sort((a, b) => Number(b.id === match.colourId) - Number(a.id === match.colourId)) : colours;
  const to = `/produkt/${p.slug}`;
  return (
    <li className={cn('group flex flex-col overflow-hidden rounded-[28px] bg-white ring-1', rank === 1 ? 'ring-2 ring-brand-600' : 'ring-line')}>
      <div className="relative aspect-[4/3] overflow-hidden bg-sand">
        <Link to={to} aria-label={l(p.name)} className="absolute inset-0">
          <Img src={p.images[0]} small alt={l(p.name)} className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05] motion-reduce:transition-none" />
        </Link>
        <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2">
          <span className="display grid h-9 w-9 place-items-center rounded-full bg-ink text-[16px] text-paper">{rank}</span>
          <ProductBadges product={p} />
        </span>
        <MatchRing pct={match.pct} label={t('match', { pct: match.pct })} className="pointer-events-none absolute right-4 top-4" />
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{category ? l(category.name) : ''}</span>
          {ordered.length > 0 && (
            <span className="flex shrink-0 items-center -space-x-1" title={ordered.map((v) => l(v.label)).join(' · ')}>
              {ordered.slice(0, 4).map((v) => (
                <span key={v.id} className={cn('h-4 w-4 rounded-full border-2 border-white ring-1', v.id === match.colourId ? 'ring-brand-600' : 'ring-ink/10')} style={{ background: v.swatch }} />
              ))}
            </span>
          )}
        </div>
        <h3 className="display mt-2 text-[27px] leading-[1.08] text-ink">
          <Link to={to} className="link-u">
            {l(p.name)}
          </Link>
        </h3>
        <Price product={p} size="sm" className="mt-1.5" />
        <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">{t('why')}</div>
        <ul className="mt-2.5 space-y-2">
          {match.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-soft">
              <span className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
              </span>
              {l(r)}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap gap-2 pt-6">
          <ButtonLink to={tryOnPath(p.slug)} size="sm" icon={<ScanFace className="h-4 w-4" />}>
            {t('tryOn')}
          </ButtonLink>
          <ButtonLink to={to} size="sm" variant="outline" iconRight={<ArrowUpRight className="h-4 w-4" />}>
            {t('view')}
          </ButtonLink>
        </div>
      </div>
    </li>
  );
}
