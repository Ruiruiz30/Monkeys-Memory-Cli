import type { CLIArgs } from '../types/api.js';
export declare function login(args: CLIArgs): Promise<void>;
export declare function logout(): Promise<void>;
export declare function authStatus(): Promise<void>;
