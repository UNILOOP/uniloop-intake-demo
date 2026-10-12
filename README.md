# Uniloop Enrollment Demo

The `uniloop-demo` branch provides a local workspace for developing custom Uniloop EMR enrollment blocks. It loads real treatment plans and enrollment forms from Uniloop, renders them with the shared EMR enrollment utilities, and lets you edit each form in SurveyFormBuilder.

## Run locally

Install dependencies and start the demo with Bun:

```bash
bun install
bun run dev
```

Open [http://localhost:3000/emr-demo](http://localhost:3000/emr-demo). The same workspace is available at `/emr-builder-demo`.

To use a different port:

```bash
bun run dev --port 3010
```

Then open [http://localhost:3010/emr-demo](http://localhost:3010/emr-demo).

## Connect to Uniloop

1. Enter the **Uniloop base URL** for your merchant's enrollment domain, such as `https://my.example.com`. Use the origin, without an enrollment path. HTTPS domains and HTTP loopback development URLs are supported.
2. Enter a **Uniloop merchant token** with the `enrollment:read` scope.
3. Click **Save connection & load plans**.
4. Select a treatment plan. Its enrollment forms appear in their configured order.

The connection is saved in this browser's local storage:

| Setting | Storage key |
| --- | --- |
| Merchant token | `uniloop_emr_demo_token` |
| Uniloop base URL | `uniloop_emr_demo_base_url` |

Returning to the page restores the connection and reloads the plans. Changes to these storage keys in another tab update the connection. **Clear token** disconnects the demo and retains the base URL setting.

Leave the base URL blank to use the server configuration. You can set the default in `.env.local`:

```dotenv
UNILOOP_API_URL=https://my.example.com
```

The fallback order is `UNILOOP_API_URL`, then `LARAVEL_API_URL`, then `https://my.ivyrx.com`.

## Render and edit forms

Choose a form from the list and use:

- **Render form** to run the selected form against the current EMR session.
- **Edit in SurveyFormBuilder** to change its blocks, settings, logic, or theme. Switch back to **Render form** to try your edits.
- **Full page** to hide the connection controls and form list. It works in both the renderer and builder. **Exit full page** restores the controls.
- **Restart rendering** to clear the form answers and return to the first form while retaining your edited schemas.

Form edits stay in memory and do not update published Uniloop forms. Reloading or loading a treatment plan again replaces those edits with the API schemas. Answers are retained when moving between forms, and enrollment draft data uses the shared utilities' local storage.

Completing a form advances to the next one. Completing the last form attempts enrollment submission using the shared EMR utilities and checkout data. Refill intakes are currently outside this demo's scope.

## Patient authentication and API requests

Treatment plan loading and patient actions use separate credentials:

| Operation | Upstream routes | Authentication |
| --- | --- | --- |
| Load treatment plans and schemas | `/api/v1/merchant/plans` and `/api/v1/merchant/plans/{slug}` | Merchant token in `Authorization: Bearer …` |
| Send and verify OTP | `/api/v2/patient/send-otp` and `/api/v2/patient/validate` | Patient token is not required before authentication |
| Profile, vitals, coupons, payments, and billing | The original patient-facing paths used by the EMR utilities | Patient token in `Authorization: Bearer …` once authenticated |
| Enrollment submission and preferred drugs | `/emr/enroll/{slug}` and `/emr/enroll/{slug}/preferred-drugs` | Patient bearer token; see the hosted-route limitation below |

Every EMR utility request uses the configured Uniloop origin, preserving its original path and HTTP method. The merchant token is used only for plan loading and is never attached to patient actions. Pending profile details are saved with the patient token after authentication and remain queued if saving fails.

The browser calls local Next.js proxies to avoid cross-origin requests:

- `/api/uniloop` forwards merchant plan requests.
- `/api/uniloop-patient` forwards patient enrollment requests.

Seeing the local demo port in the browser's Network panel is expected. The connection panel shows the upstream Uniloop origin.

Stripe setup and authorization intents, saved payment methods, coupons, store credits, and billing quotes use Uniloop's patient APIs. No local Stripe secret is needed. These are real operations against the configured Uniloop account.

### Hosted-route limitation

The current Uniloop web routes for enrollment submission and preferred-drug resolution require a hosted session/CSRF token. Sending a patient bearer token alone may return **419**. The demo reports this explicitly; those backend routes need patient-bearer support to run locally. The demo does not substitute merchant-authenticated actions or bypass CSRF protection.

## Develop custom blocks

Create your block definition under `src/app/emr-demo/custom-blocks/`. Import it in `src/app/emr-demo/custom-blocks/index.ts` and add it to the list returned by `getSystemBlocks()`. That list registers the block for rendering and makes it available in the builder.

Each form receives one shared `EmrEnrollmentUtils` instance through `customData`:

```tsx
import { useSurveyForm } from '@/packages/survey-form-package/src';
import type { EmrEnrollmentUtils } from '@/lib/emr-enrollment-utils';

// Inside your block's React component:
const { customData } = useSurveyForm();
const utils = customData?.emrEnrollmentUtils as EmrEnrollmentUtils | undefined;
const selection = utils?.getEmrCheckoutSelectionState();
```

The supplied custom data includes:

- `emrEnrollmentUtils`: the shared EMR session for authentication, selections, patient data, and checkout.
- `enrollmentModule`: a compatibility adapter backed by that same session.
- `enrollmentForms`: the loaded enrollment forms.
- `currentEnrollmentForm`: the selected form's metadata.
- `completedFormResponses`: the workspace's retained answers.

Local block definitions take precedence over merchant-published blocks with the same type. `loadMerchantComponents` loads other published ESM blocks and layouts, exposes the shared React and survey dependencies they expect, and registers the blocks. Merchant CSS is also loaded from the plan. Published module URLs must allow browser imports from your local origin.

A form error boundary keeps the workspace available if a block or layout fails to render, so you can edit it or select another form.

## Main files

| File | Purpose |
| --- | --- |
| `src/app/emr-demo/page.tsx` | Connection controls, plan selection, form editing, rendering, and submission |
| `src/app/emr-demo/custom-blocks/index.ts` | Local EMR block registration |
| `src/app/emr-demo/merchant-components.ts` | Published block and layout loading |
| `src/lib/emr-enrollment-utils.ts` | Shared EMR enrollment session API |
| `src/lib/enrollment-api-transport.ts` | Routes utility calls through the patient proxy |
| `src/app/api/uniloop/[...path]/route.ts` | Merchant API proxy |
| `src/app/api/uniloop-patient/[...path]/route.ts` | Patient API proxy |

## Validate changes

```bash
bun run test:emr
bun run typecheck:emr
```

The tests cover credential routing, patient API paths, OTP/profile updates, connection settings, proxy behavior, form normalization, and the merchant layout logo contract. The EMR type check covers this workspace and its imported dependencies. The full-project type check also includes copied patient-portal helpers that require Uniloop's Inertia environment and are not used by this demo.
