/**
 * Host-side entry point for the shared field-map entry + value-format module.
 * The implementation lives in the survey package (a standalone git submodule
 * that must not import host files); app code imports this re-export via
 * `@/lib/analyticsFieldFormats`, and lib/analytics.ts via `./analyticsFieldFormats`.
 */
export * from '../packages/survey-form-package/src/analytics/fieldFormats';
