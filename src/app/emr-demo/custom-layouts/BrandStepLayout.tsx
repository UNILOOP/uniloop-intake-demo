import React, { useEffect, useRef, useState } from 'react';
import type { LayoutProps } from '@/packages/survey-form-package/src/types';
import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import { CurrentBlock, NavigationButtons } from '@/packages/survey-form-package/src';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import { ArrowLeft, ArrowRight, ArrowUpRight, Lock, ShieldCheck } from 'lucide-react';

/**
 * Brand step layout: a header with Back, the logo and a secure badge, a thin progress bar,
 * the step in a card, and a Next bar that stays at the bottom of the screen (fixed on
 * phones, sticky on wider screens). Colours, fonts and rounding come from the
 * form's theme, so each brand re-skins it through its theme alone.
 *
 * The current block can set:
 * - `hideBack`: no Back on this step.
 * - `hideProgress`: an empty progress track on this step, for screens that end the flow.
 * - `hidePrivacy`: no privacy line under the card, for steps that don't ask anything.
 * - `pageTone: 'dark'`: a dark page without the card, for blocks that draw their own sections.
 * - `nextText`: the Next label on this step.
 * - `nextHref`: the bar opens this link instead of moving on, labelled with `nextText`.
 * - `showContinueButton: false` (core's own setting): no Next bar.
 */

// The layout's own copy. Each brand edits these in its copy of the layout.
const BACK_TEXT = 'Back';
const NEXT_TEXT = 'Continue';
const SUBMIT_TEXT = 'Continue';
const BADGE_TEXT = 'Secure checkout';
const PRIVACY_TEXT = 'Your answers are private and protected by HIPAA.';

// Below Tailwind's `sm`, where the Next bar is fixed to the bottom of the screen
const PHONE_QUERY = '(max-width: 639px)';

/** A theme colour at a given strength, without a colour literal in the source */
const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

// Text spans take their parent's line height. Public pages load the portal's stylesheet,
// which gives every span without a `font-` class a line height of 1.6
const inheritLine = { lineHeight: 'inherit' } as const;

// Each set block is a page; without sets, the items are one page
const setPages = (items: any[] = []): any[][] => {
  const sets = items.filter((item) => item.type === 'set');
  if (!sets.length) return items.length ? [items] : [];
  return sets.filter((set) => set.items?.length).map((set) => set.items);
};

/**
 * The form's pages in core's order (its getSurveyPages, which the portal's core doesn't export): one
 * block per page when the root holds no set blocks, else the root's sets, then each section's
 */
const listPages = (node: any, paged: boolean): any[][] => {
  if (!paged) return (node.items || []).map((item: any) => [item]);
  const pages = setPages(node.items);
  for (const child of node.nodes || []) {
    if (typeof child === 'string' || child.type !== 'section') continue;
    pages.push(...setPages(child.items));
    if (child.nodes?.length) pages.push(...listPages(child, true));
  }
  return pages;
};

const MotionFragment = motion.create(React.Fragment);

export const BrandStepLayout: React.FC<LayoutProps> = ({ logo }) => {
  const {
    theme,
    surveyData,
    currentPage,
    currentBlockIndex,
    canGoBack,
    goToPreviousBlock,
    getActualProgress,
  } = useSurveyForm();

  const root: any = surveyData.rootNode;
  const pages = listPages(root, !root.items?.length || root.items.some((item: any) => item.type === 'set'));
  const block: any = (pages[currentPage] || [])[currentBlockIndex];
  const dark = block?.pageTone === 'dark';
  const showBack = canGoBack && !block?.hideBack;
  const showProgress = !block?.hideProgress;
  const showNext = block?.showContinueButton !== false;
  const nextHref: string = block?.nextHref || '';
  const progress = getActualProgress();
  const contentKey = `page-${currentPage}-block-${currentBlockIndex}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const nextBarRef = useRef<HTMLElement>(null);
  const [pin, setPin] = useState<{ left: number; right: number } | null>(null);

  // On phones the Next bar is fixed to the bottom of the screen, so it never scrolls, and
  // the page gets the bar's height as bottom padding so its last line (on public forms, the
  // "Powered by" footer under the form) can scroll clear of it. Wider screens keep the bar
  // sticky, so a portal editor's preview doesn't pin it to the editor window.
  useEffect(() => {
    const root = rootRef.current;
    const bar = nextBarRef.current;
    if (!root || !bar) return;
    const phone = window.matchMedia(PHONE_QUERY);
    const { body } = document;
    const previousPadding = body.style.paddingBottom;
    const fit = () => {
      if (!phone.matches) {
        setPin(null);
        body.style.paddingBottom = previousPadding;
        return;
      }
      const box = root.getBoundingClientRect();
      setPin({ left: box.left, right: window.innerWidth - box.right });
      body.style.paddingBottom = `${bar.offsetHeight}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    observer.observe(bar);
    phone.addEventListener('change', fit);
    return () => {
      observer.disconnect();
      phone.removeEventListener('change', fit);
      body.style.paddingBottom = previousPadding;
    };
  }, [showNext]);

  const ink = theme.colors.text;
  const pageColor = dark ? ink : theme.colors.background;
  const textColor = dark ? 'white' : ink;
  // The theme's surface class; on a dark page the header joins the page
  const surfaceClass = dark ? '' : theme.container.card;

  const renderLogo = () => {
    if (!logo) return null;
    const mark = typeof logo === 'function' ? logo('h-full w-auto') : logo;
    // 20px tall on phones, 24px from about 470px wide
    return (
      <div
        style={{
          height: 'clamp(20px, 5.1vw, 24px)',
          filter: dark ? 'brightness(0) invert(1)' : undefined,
        }}
      >
        {mark}
      </div>
    );
  };

  const barButtonStyle = { display: 'flex', maxWidth: 454, margin: '0 auto' } as const;
  const arrowChip = (Icon: typeof ArrowRight) => (
    <span
      className="flex items-center justify-center rounded-full"
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        bottom: 6,
        aspectRatio: '1',
        backgroundColor: theme.colors.secondary,
        color: ink,
      }}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );

  return (
    <div
      ref={rootRef}
      className="brand-step-layout flex flex-col w-full"
      style={{ minHeight: '100svh', backgroundColor: pageColor, color: textColor }}
    >
      <header className={surfaceClass} style={dark ? { backgroundColor: pageColor } : undefined}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            height: 'clamp(56px, 5vw, 72px)',
            // 16px at 393 wide, rising to 120px at 1440
            padding: '0 clamp(16px, calc(9.93vw - 23px), 120px)',
          }}
        >
          <div>
            {showBack && (
              <button
                type="button"
                onClick={goToPreviousBlock}
                className="inline-flex items-center gap-1.5 text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: textColor }}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {BACK_TEXT}
              </button>
            )}
          </div>
          {renderLogo()}
          <div className="flex justify-end">
            {/* 20px tall on phones, 28px on desktop, as in the Figma */}
            <span
              className="inline-flex items-center font-medium"
              style={{
                gap: 'clamp(3px, 1vw, 5px)',
                height: 'clamp(20px, 5.1vw, 28px)',
                paddingRight: 'clamp(4px, 1vw, 6px)',
                border: `1px solid ${textColor}`,
                fontSize: 'clamp(8px, 2.2vw, 12px)',
                lineHeight: 1.1,
              }}
            >
              <span
                className="inline-flex items-center justify-center h-full"
                style={{ aspectRatio: '1', backgroundColor: textColor, color: pageColor }}
              >
                <ShieldCheck style={{ width: '60%', height: '60%' }} aria-hidden />
              </span>
              <span style={{ ...inheritLine, width: 'min-content' }}>{BADGE_TEXT}</span>
            </span>
          </div>
        </div>

        <div
          role={showProgress ? 'progressbar' : undefined}
          aria-valuenow={showProgress ? Math.round(progress) : undefined}
          aria-valuemin={showProgress ? 0 : undefined}
          aria-valuemax={showProgress ? 100 : undefined}
          style={{
            height: 6,
            backgroundColor: dark ? tint('white', 15) : theme.colors.border,
          }}
        >
          {showProgress && (
            <motion.div
              className={theme.progress.bar || undefined}
              style={{
                height: '100%',
                borderRadius: '0 6px 6px 0',
                backgroundColor: theme.progress.bar ? undefined : theme.colors.primary,
              }}
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          )}
        </div>
      </header>

      <main
        className="flex-1 w-full"
        style={{ padding: dark ? '0' : 'clamp(16px, 2.2vw, 32px) 8px' }}
      >
        <AnimatePresence mode="wait">
          <MotionFragment
            key={contentKey}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {dark ? (
              <CurrentBlock className="w-full" />
            ) : (
              <div
                className={cn('w-full', theme.card)}
                style={{
                  maxWidth: 520,
                  margin: '0 auto',
                  // 32px on phones too, as in the Figma phone frames
                  padding: 32,
                  boxShadow: `0 12px 40px -8px ${tint(ink, 8)}`,
                }}
              >
                <CurrentBlock className="space-y-4" />
                {!block?.hidePrivacy && (
                  <p
                    className="text-xs font-medium text-center"
                    style={{ marginTop: 24, color: tint(ink, 70) }}
                  >
                    <Lock
                      className="inline h-3 w-3"
                      style={{ marginRight: 6, verticalAlign: '-1px' }}
                      aria-hidden
                    />
                    {PRIVACY_TEXT}
                  </p>
                )}
              </div>
            )}
          </MotionFragment>
        </AnimatePresence>
      </main>

      {showNext && (
        <footer
          ref={nextBarRef}
          className={surfaceClass}
          style={{
            position: pin ? 'fixed' : 'sticky',
            left: pin?.left,
            right: pin?.right,
            bottom: 0,
            zIndex: 30,
            padding: '12px 12px calc(24px + env(safe-area-inset-bottom))',
            backgroundColor: dark ? pageColor : undefined,
          }}
        >
          {nextHref ? (
            <a
              href={nextHref}
              className={cn(theme.button.primary, 'relative cursor-pointer')}
              style={barButtonStyle}
            >
              <span style={inheritLine}>{block?.nextText || NEXT_TEXT}</span>
              {arrowChip(ArrowUpRight)}
            </a>
          ) : (
            <NavigationButtons
              variant="custom"
              showPrevious={false}
              nextText={block?.nextText || NEXT_TEXT}
              submitText={block?.nextText || SUBMIT_TEXT}
              className="w-full"
              renderNextButton={({ disabled, text }) => (
                <button
                  type="submit"
                  disabled={disabled}
                  className={cn(
                    theme.button.primary,
                    'relative',
                    disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                  )}
                  style={barButtonStyle}
                >
                  <span style={inheritLine}>{text}</span>
                  {arrowChip(ArrowRight)}
                </button>
              )}
            />
          )}
        </footer>
      )}
    </div>
  );
};

export default BrandStepLayout;
