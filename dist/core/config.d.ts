export declare const DEFAULT_API_URL: string;
export declare const CONFIG_DIR: string;
export declare const CONFIG_FILE: string;
export type CLIConfig = {
    apiUrl?: string;
    token?: string;
    tokenId?: string;
    expiresAt?: string;
};
export declare function trimTrailingSlash(value: unknown): string;
export declare function pathExists(targetPath: string): Promise<boolean>;
export declare function ensureDir(targetPath: string): Promise<void>;
export declare function atomicWrite(filePath: string, value: string | Buffer, mode?: number): Promise<void>;
export declare function readConfig(): Promise<CLIConfig>;
export declare function writeConfig(config: CLIConfig): Promise<void>;
export declare function getApiUrl(args?: {
    apiUrl?: string;
}): Promise<string>;
export declare function getToken(): Promise<string | null>;
