export type JsonObject = Record<string, unknown>;

export type CLIArgs = JsonObject & {
  _: string[];
  help?: boolean;
  apiUrl?: string;
  noOpen?: boolean;
  noReport?: boolean;
  noAutoActions?: boolean;
  includeSensitive?: boolean;
  deviceName?: string;
  repo?: string;
  workspace?: string;
  path?: string | string[];
  task?: string | string[];
  entity?: string | string[];
  title?: string;
  claim?: string;
  kind?: string;
  ruleId?: string;
  outcome?: string;
  note?: string;
  adopted?: string;
  confidence?: string;
  branch?: string;
  tag?: string;
  commit?: string;
  userId?: string;
  teamId?: string;
  templateId?: string;
  limit?: string;
  json?: string;
  data?: string;
  params?: string;
  actionId?: string;
  manifestHash?: string;
  type?: string;
  evidenceType?: string;
  evidenceRef?: string;
  evidence?: string | string[];
};

export type AgentAction = {
  id: string;
  type: string;
  payload?: {
    manifest_url?: string;
    manifest_hash?: string;
    [key: string]: unknown;
  };
};

export type AgentCapabilities = {
  installation_id: string;
  skills: Record<string, { sha256: string | null }>;
};

export type RepoScanResult = {
  schema_version: 1;
  scanned_at: string;
  branch: string | null;
  commit: string | null;
  known_paths: string[];
  changed_paths: string[];
  deleted_paths: string[];
  renamed_paths: Array<{ from: string; to: string }>;
  code_entities: unknown[];
};

export type SkillManifestItem = {
  name: string;
  path: string;
  url?: string;
  sha256: string;
};

export type SkillManifest = {
  schema_version?: number;
  generated_at?: string;
  manifest_hash: string;
  skills: SkillManifestItem[];
};
