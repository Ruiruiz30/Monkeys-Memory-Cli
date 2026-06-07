import { getApiUrl, getToken, trimTrailingSlash } from './config.js';
export async function apiRequest(method, pathName, options = {}) {
    const { data, params, tokenRequired = true, apiUrl } = options;
    const base = trimTrailingSlash(apiUrl ?? await getApiUrl());
    const url = new URL(pathName.startsWith('http') ? pathName : `${base}${pathName.startsWith('/') ? pathName : `/${pathName}`}`);
    for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== null)
            url.searchParams.set(key, String(value));
    }
    const headers = { Accept: 'application/json', ...(options.headers ?? {}) };
    const token = await getToken();
    if (tokenRequired) {
        if (!token)
            throw new Error('not logged in; run `monkeys-memory login`');
        headers.Authorization = `Bearer ${token}`;
    }
    else if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    if (data !== undefined)
        headers['Content-Type'] = 'application/json';
    const response = await fetch(url, {
        method,
        headers,
        body: data === undefined ? undefined : JSON.stringify(data),
    });
    const text = await response.text();
    let body = {};
    if (text) {
        try {
            body = JSON.parse(text);
        }
        catch (error) {
            throw new Error(`${method} ${url.pathname} expected JSON but received ${response.headers.get('content-type') ?? 'unknown content type'} (${response.status})`);
        }
    }
    if (!response.ok)
        throw new Error(String(body?.error ?? `${method} ${url.pathname} failed (${response.status})`));
    return body;
}
export async function apiResponse(method, pathName, options = {}) {
    try {
        return { ok: true, data: await apiRequest(method, pathName, options) };
    }
    catch (error) {
        return { ok: false, error: error };
    }
}
//# sourceMappingURL=http.js.map