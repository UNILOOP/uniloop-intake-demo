import type { Page, VisitOptions } from '@inertiajs/core';

const storageKey = 'uniloop:paginated-lists';

type NavigationPage = Pick<Page, 'component' | 'props' | 'url' | 'clearHistory'>;
type NavigationStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isPaginator(value: unknown): boolean {
    if (!value || typeof value !== 'object' || !('data' in value) || !Array.isArray(value.data)) {
        return false;
    }

    return 'current_page' in value || ('prev_page_url' in value && 'next_page_url' in value);
}

function navigationScope(page: NavigationPage): string {
    const auth = page.props.auth as { user?: { id: number }; super_admin?: { id: number }; is_merchant?: boolean } | undefined;
    const merchant = page.props.merchant as { id?: number } | undefined;
    const patient = page.component.startsWith('patient/') ? (page.props.patient as { id?: number } | undefined) : undefined;

    return JSON.stringify([page.props.csrf_token, merchant?.id, auth?.user?.id, auth?.super_admin?.id, auth?.is_merchant, patient?.id]);
}

export function createPaginatedListNavigation(baseUrl: string, getStorage: () => NavigationStorage | undefined = () => undefined) {
    const origin = new URL(baseUrl).origin;
    let currentUrl: URL | undefined;
    let currentScope: string | undefined;
    const listUrls = new Map<string, string>();

    function persist(): void {
        try {
            getStorage()?.setItem(storageKey, JSON.stringify({ scope: currentScope, urls: [...listUrls] }));
        } catch {
            // Navigation still works when browser storage is unavailable.
        }
    }

    function rememberPage(page: NavigationPage): void {
        const scope = navigationScope(page);
        if (scope !== currentScope || page.clearHistory) {
            listUrls.clear();
            currentScope = scope;

            try {
                const saved = JSON.parse(getStorage()?.getItem(storageKey) ?? 'null');
                if (!page.clearHistory && saved?.scope === scope && Array.isArray(saved.urls)) {
                    for (const [path, href] of saved.urls) {
                        if (typeof path === 'string' && typeof href === 'string') {
                            const url = new URL(href, baseUrl);
                            if (url.origin === origin && url.pathname === path) {
                                listUrls.set(path, url.pathname + url.search);
                            }
                        }
                    }
                }
            } catch {
                listUrls.clear();
            }

            persist();
        }

        currentUrl = new URL(page.url, baseUrl);
        if (Object.values(page.props).some(isPaginator)) {
            listUrls.set(currentUrl.pathname, currentUrl.pathname + currentUrl.search);
            persist();
        }
    }

    function visitOptions(href: string, options: VisitOptions): VisitOptions {
        const url = new URL(href, currentUrl ?? baseUrl);
        if (
            (options.method ?? 'get') !== 'get' ||
            url.origin !== origin ||
            url.search ||
            url.pathname === currentUrl?.pathname ||
            (options.data && (options.data instanceof FormData || Object.keys(options.data).length > 0))
        ) {
            return {};
        }

        const rememberedUrl = listUrls.get(url.pathname);
        if (!rememberedUrl) {
            return {};
        }

        const data: Record<string, string> = {};
        const arrayIndexes = new Map<string, number>();
        for (const [key, value] of new URL(rememberedUrl, baseUrl).searchParams) {
            if (key.endsWith('[]')) {
                const index = arrayIndexes.get(key) ?? 0;
                data[`${key.slice(0, -2)}[${index}]`] = value;
                arrayIndexes.set(key, index + 1);
            } else {
                data[key] = value;
            }
        }

        return Object.keys(data).length > 0 ? { data } : {};
    }

    return { rememberPage, visitOptions };
}
