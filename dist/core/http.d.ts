import type { JsonObject } from '../types/api.js';
export type ApiRequestOptions = {
    data?: unknown;
    params?: JsonObject;
    tokenRequired?: boolean;
    apiUrl?: string;
};
export declare function apiRequest<T = JsonObject>(method: string, pathName: string, { data, params, tokenRequired, apiUrl }?: ApiRequestOptions): Promise<T>;
export declare function apiResponse<T = JsonObject>(method: string, pathName: string, options?: ApiRequestOptions): Promise<{
    ok: true;
    data: T;
} | {
    ok: false;
    error: Error;
}>;
