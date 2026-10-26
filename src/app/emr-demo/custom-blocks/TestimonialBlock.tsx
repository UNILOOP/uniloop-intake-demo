import React, { useEffect, useState } from 'react';
import type {
  BlockData,
  BlockDefinition,
  BlockRendererProps,
  ContentBlockItemProps,
  ThemeDefinition,
} from '@/packages/survey-form-package/src/types';
import { Input } from '@/packages/survey-form-package/src/components/ui/input';
import { Label } from '@/packages/survey-form-package/src/components/ui/label';
import { Textarea } from '@/packages/survey-form-package/src/components/ui/textarea';
import { Button } from '@/packages/survey-form-package/src/components/ui/button';
import { Card } from '@/packages/survey-form-package/src/components/ui/card';
import { themes } from '@/packages/survey-form-package/src/themes';
import { Plus, Quote, Star, Trash2 } from 'lucide-react';

/**
 * Testimonial: a patient's photo, star rating, quote and name, with up to three figures
 * under it and a footnote. It saves nothing. Every part is a setting and each one hides
 * when left empty, so a brand can drop the figures or the stars without a code change.
 */

interface Stat {
  value: string;
  label: string;
}

const MAX_STATS = 3;
const WIDE_QUERY = '(min-width: 640px)';

/** Whether the screen is at least 640px wide, where the figures sit in a row */
const useWide = () => {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
};

/** A theme colour at a given strength, without a colour literal in the source */
const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const getStats = (data: BlockData): Stat[] => (Array.isArray(data.stats) ? data.stats : []);

const TestimonialUi: React.FC<{ data: BlockData; theme: ThemeDefinition }> = ({ data, theme }) => {
  const ink = theme.colors.text;
  const primary = theme.colors.primary;
  const wide = useWide();
  const stars = Math.max(0, Math.min(5, Number(data.stars) || 0));
  const stats = getStats(data)
    .filter((stat) => stat.value?.trim() || stat.label?.trim())
    .slice(0, MAX_STATS);

  return (
    <div>
      {data.heading && (
        <h2 className="text-2xl font-medium" style={{ marginBottom: 20, color: ink }}>
          {data.heading}
        </h2>
      )}
      {data.imageUrl && (
        <img
          src={data.imageUrl}
          alt={data.imageAlt || ''}
          className="block w-full object-cover"
          style={{ aspectRatio: wide ? '297 / 143' : '311 / 220', borderRadius: 16 }}
        />
      )}
      {stars > 0 && (
        <div
          className="flex gap-1.5"
          role="img"
          aria-label={`${stars} out of 5 stars`}
          style={{ marginTop: 20, color: primary }}
        >
          {Array.from({ length: stars }, (_, i) => (
            <Star key={i} style={{ width: 13, height: 13 }} fill="currentColor" strokeWidth={0} aria-hidden />
          ))}
        </div>
      )}
      {data.quote && (
        <blockquote
          className="font-medium"
          style={{
            marginTop: 16,
            fontSize: 'clamp(24px, 1.75vw, 26px)',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            color: ink,
          }}
        >
          “{data.quote}”
        </blockquote>
      )}
      {data.author && (
        <p className="text-sm" style={{ marginTop: 16, color: tint(ink, 65) }}>
          {data.author}
        </p>
      )}

      {/* Figures in a row from 640px; on phones each is a row with its label beside it */}
      {stats.length > 0 && (
        <div
          className="grid gap-2"
          style={{ marginTop: 24, gridTemplateColumns: `repeat(${wide ? stats.length : 1}, minmax(0, 1fr))` }}
        >
          {stats.map((stat, index) => (
            <div
              key={index}
              className="flex"
              style={{
                flexDirection: wide ? 'column' : 'row',
                alignItems: wide ? 'flex-start' : 'center',
                gap: wide ? 2 : 14,
                padding: '14px 16px',
                borderRadius: 12,
                backgroundColor: theme.colors.accent,
              }}
            >
              <span className="font-semibold" style={{ fontSize: 18, color: primary }}>
                {stat.value}
              </span>
              <span className="text-xs" style={{ color: tint(ink, 70) }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.footnote && (
        <p className="text-xs" style={{ marginTop: 20, color: tint(ink, 70) }}>
          {data.footnote}
        </p>
      )}
    </div>
  );
};

const TestimonialRenderer = React.forwardRef<HTMLDivElement, BlockRendererProps>(({ block, theme }, ref) => (
  <div ref={ref}>
    <TestimonialUi data={block} theme={theme ?? themes.default} />
  </div>
));

TestimonialRenderer.displayName = 'TestimonialRenderer';

const TestimonialForm: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
  const stats = getStats(data);
  const update = (patch: Record<string, unknown>) => onUpdate?.({ ...data, ...patch });
  const setStats = (next: Stat[]) => update({ stats: next });

  const text = (field: string, label: string, help?: string, rows = 0) => (
    <div className="space-y-2">
      <Label className="text-sm" htmlFor={`testimonial-${field}`}>
        {label}
      </Label>
      {rows ? (
        <Textarea
          id={`testimonial-${field}`}
          value={data[field] || ''}
          onChange={(e) => update({ [field]: e.target.value })}
          rows={rows}
        />
      ) : (
        <Input
          id={`testimonial-${field}`}
          value={data[field] ?? ''}
          onChange={(e) => update({ [field]: e.target.value })}
        />
      )}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      {text('heading', 'Heading (optional)')}
      {text('imageUrl', 'Photo URL', 'Cropped to about 2 : 1 on wide screens and 3 : 2 on phones.')}
      {text('imageAlt', 'Photo description', 'Read out by screen readers.')}
      <div className="space-y-2">
        <Label className="text-sm" htmlFor="testimonial-stars">
          Stars
        </Label>
        <select
          id="testimonial-stars"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={String(data.stars ?? 5)}
          onChange={(e) => update({ stars: Number(e.target.value) })}
        >
          {[5, 4, 3, 2, 1, 0].map((n) => (
            <option key={n} value={n}>
              {n === 0 ? 'None' : n}
            </option>
          ))}
        </select>
      </div>
      {text('quote', 'Quote', 'Without quotation marks; the block adds them.', 3)}
      {text('author', 'Name and details')}

      <div className="space-y-2">
        <Label className="text-sm">Figures (up to three)</Label>
        {stats.map((stat, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              aria-label={`Figure ${index + 1}`}
              className="w-28"
              value={stat.value}
              onChange={(e) => setStats(stats.map((s, i) => (i === index ? { ...s, value: e.target.value } : s)))}
            />
            <Input
              aria-label={`Figure ${index + 1} label`}
              value={stat.label}
              onChange={(e) => setStats(stats.map((s, i) => (i === index ? { ...s, label: e.target.value } : s)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove figure ${index + 1}`}
              onClick={() => setStats(stats.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {stats.length < MAX_STATS && (
          <Button type="button" variant="outline" size="sm" onClick={() => setStats([...stats, { value: '', label: '' }])}>
            <Plus className="h-4 w-4 mr-1" />
            Add figure
          </Button>
        )}
      </div>
      {text('footnote', 'Footnote')}
    </div>
  );
};

const TestimonialItem: React.FC<ContentBlockItemProps> = ({ data }) => (
  <Card className="p-4">
    <TestimonialUi data={data} theme={themes.default} />
  </Card>
);

const createDefaultData = (): BlockData => ({
  type: 'testimonial',
  heading: '',
  imageUrl: '',
  imageAlt: '',
  stars: 5,
  quote: 'Add the patient’s words here.',
  author: 'Name · City · Treatment',
  stats: [],
  footnote: 'Real patient. Individual results vary.',
  hidePrivacy: true,
});

export const TestimonialBlock: BlockDefinition = {
  type: 'testimonial',
  name: 'Testimonial',
  description: 'A patient quote with a photo, stars and up to three figures',
  icon: <Quote className="w-4 h-4" />,
  defaultData: createDefaultData(),
  generateDefaultData: createDefaultData,
  renderItem: (props) => <TestimonialItem {...props} />,
  renderFormFields: (props) => <TestimonialForm {...props} />,
  renderPreview: () => (
    <div className="w-full py-1">
      <TestimonialUi data={createDefaultData()} theme={themes.default} />
    </div>
  ),
  renderBlock: (props) => <TestimonialRenderer {...props} />,
  validate: (data) => (data.quote || data.imageUrl ? null : 'Add a quote or a photo'),
};

export default TestimonialBlock;
