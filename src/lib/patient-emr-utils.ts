import { format, formatDistanceToNow, isPast } from 'date-fns';

export function formatEpochDate(epoch: number | null, fallback = 'N/A'): string {
    if (!epoch) return fallback;
    return format(new Date(epoch * 1000), 'MMM d, yyyy');
}

export function formatRelativeDate(epoch: number | null): string | null {
    if (!epoch) return null;
    return formatDistanceToNow(new Date(epoch * 1000), { addSuffix: true });
}

export function isRefillOverdue(nextRefillDate: number | null): boolean {
    if (!nextRefillDate) return false;
    return isPast(new Date(nextRefillDate * 1000));
}

export function getEnrollmentStatusColor(status: string): string {
    const colors: Record<string, string> = {
        active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        paused: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        discontinued: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
        pending_push: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
    };
    return colors[status] ?? 'bg-gray-100 text-gray-800';
}

export function getStatusGradient(status: string): string {
    const gradients: Record<string, string> = {
        active: 'bg-gradient-to-r from-emerald-600 to-emerald-700',
        paused: 'bg-gradient-to-r from-amber-500 to-amber-600',
        completed: 'bg-gradient-to-r from-blue-500 to-blue-600',
        discontinued: 'bg-gradient-to-r from-gray-500 to-gray-600',
        pending_push: 'bg-gradient-to-r from-slate-400 to-slate-500',
    };
    return gradients[status] ?? 'bg-gradient-to-r from-gray-500 to-gray-600';
}

export function getRefillProgress(completed: number, max: number | null): number | null {
    if (!max || max === 0) return null;
    return Math.round((completed / max) * 100);
}

export function formatScheduleType(scheduleType: string | null): string {
    const labels: Record<string, string> = {
        monthly: 'Monthly',
        quarterly: 'Quarterly',
        six_monthly: 'Every 6 Months',
        yearly: 'Yearly',
        custom: 'Custom Schedule',
    };
    return labels[scheduleType ?? ''] ?? scheduleType ?? 'Flexible';
}
