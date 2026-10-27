import { NotProvided } from '@/packages/survey-form-package/src/renderer/answers';
import { format } from 'date-fns';
import type React from 'react';

/** One labelled line in an answer view; a line with no value (nothing, '' or false) is left out. */
export interface AnswerField {
    label: string;
    value: React.ReactNode;
}

/** A trimmed string, or a finite number as text; anything else is no value. */
export const textOf = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value.trim() || undefined;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return undefined;
};

/** Ten US digits as (555) 123-4567; any other phone as saved. */
export const phoneText = (value: unknown): string | undefined => {
    const text = textOf(value);
    const digits = text?.replace(/\D/g, '') ?? '';
    const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    return local.length === 10 ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` : text;
};

/** An ISO time as "Oct 28, 2026 9:15 AM", or nothing when it isn't a date. */
export const timeText = (value: unknown): string | undefined => {
    const text = textOf(value);
    const date = text ? new Date(text) : undefined;
    return date && !Number.isNaN(date.getTime()) ? format(date, 'MMM d, yyyy h:mm a') : undefined;
};

/** A short label and value list, as doctor mode shows an object answer. */
export const AnswerFields = ({ fields }: { fields: AnswerField[] }) => {
    const shown = fields.filter(({ value }) => value !== undefined && value !== null && value !== '' && value !== false);
    if (shown.length === 0) return <NotProvided />;
    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {shown.map(({ label, value }) => (
                <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words">{value}</dd>
                </div>
            ))}
        </dl>
    );
};
