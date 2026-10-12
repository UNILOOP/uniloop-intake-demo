/**
 * Host-side entry point for the shared browser HIPAA output filter. The
 * implementation lives in the survey package (a standalone git submodule that
 * must not import host files); app code imports this re-export via
 * `@/lib/analyticsHipaaFilter`, and lib/analytics.ts via `./analyticsHipaaFilter`.
 */
export * from '../packages/survey-form-package/src/analytics/hipaaFilter';
