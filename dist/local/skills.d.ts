import type { AgentCapabilities, AgentAction } from '../types/api.js';
export declare function agentCapabilities(): Promise<AgentCapabilities>;
export declare function skillUpdateResult(action: Pick<AgentAction, 'payload'>): Promise<{
    schema_version: 1;
    installation_id: string;
    manifest_hash: string;
    updated: Array<{
        name: string;
        sha256: string;
    }>;
}>;
