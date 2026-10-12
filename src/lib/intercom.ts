import { enrollmentFetch } from './enrollment-api-transport';
interface IntercomSettings {
    app_id: string;
    api_base: string;
    user_id?: string;
    intercom_user_jwt?: string;
}

type IntercomFunction = ((command: string, ...args: unknown[]) => void) & { q?: unknown[][] };
let identity: string | null = null;
let script: HTMLScriptElement | null = null;
let latest: IntercomSettings | null = null;
let identityRequest = 0;

function client(): Window & { Intercom?: IntercomFunction } {
    return window as Window & { Intercom?: IntercomFunction };
}

export function updateIntercom(value: unknown): void {
    const settings = value as IntercomSettings | null | undefined;
    const previous = latest;
    latest = settings?.app_id ? settings : null;
    if (!latest || latest.app_id !== previous?.app_id) identityRequest++;
    const nextIdentity = latest ? `${latest.app_id}:${latest.user_id ?? 'visitor'}` : null;
    if (identity !== nextIdentity) {
        const upgradingVisitor = previous?.app_id === latest?.app_id && !previous?.user_id && Boolean(latest?.user_id);
        if (!upgradingVisitor) client().Intercom?.('shutdown');
        identity = nextIdentity;
        if (latest) {
            if (!client().Intercom) {
                const queue: unknown[][] = [];
                const stub: IntercomFunction = (command, ...args) => {
                    queue.push([command, ...args]);
                };
                stub.q = queue;
                client().Intercom = stub;
            }
            client().Intercom?.(upgradingVisitor ? 'update' : 'boot', latest);
        }
    } else if (latest) {
        client().Intercom?.('update', latest);
    }
    if (latest && !script) {
        script = document.createElement('script');
        script.async = true;
        script.src = `https://widget.intercom.io/widget/${encodeURIComponent(latest.app_id)}`;
        script.onerror = () => {
            script?.remove();
            script = null;
        };
        document.head.appendChild(script);
    }
}

export async function identifyIntercom(token: string): Promise<void> {
    if (!latest) return;
    const appId = latest.app_id;
    const requestId = ++identityRequest;
    try {
        const response = await enrollmentFetch('/api/patient/intercom', {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (requestId === identityRequest && latest?.app_id === appId && data.intercom?.app_id === appId) updateIntercom(data.intercom);
    } catch {
        // Support availability must not interrupt authentication or checkout.
    }
}
