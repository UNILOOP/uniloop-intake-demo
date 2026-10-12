export interface UniemrEventGroup {
  label: string;
  badge: string;
}

export const UNIEMR_EVENT_GROUPS: Record<string, UniemrEventGroup> = {
  conversation: {
    label: 'Provider Conversation',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  },
  treatment_enrollment: {
    label: 'Enrollment',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  treatment_refill: {
    label: 'Refill',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  encounter: {
    label: 'Encounter',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  prescription: {
    label: 'Prescription',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  },
  form_submission: {
    label: 'Form Submission',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  },
};

export function eventGroupFor(eventType: string): UniemrEventGroup | null {
  const prefix = eventType.split('.')[0];
  return UNIEMR_EVENT_GROUPS[prefix] ?? null;
}
