// AI-туслагч matching-д зориулсан төрөл (interface)
// Одоохондоо stub. LLM нэмэгдсэний дараа энэ shape-аар нэгтгэгдэнэ.

import type { DirectoryRow } from '@/app/lib/directory/search';

export interface MatchAgentInput {
  // Импортын мөр эсвэл signup хайлтаас орж ирэх өгөгдөл
  incomingRow: {
    officialName: string;
    aliases?: string[];
    district?: string | null;
    khoroo?: string | null;
    address?: string | null;
    sohCode?: string | null;
    rawJson?: Record<string, unknown>;
  };
  candidateRecords: DirectoryRow[];
}

export interface MatchAgentOutput {
  bestMatchId: number | null;
  confidence: number; // 0..1
  reason: string; // human-readable тайлбар
  action: 'MATCH_EXISTING' | 'CREATE_NEW' | 'REVIEW_NEEDED';
}

export type MatchAgent = (input: MatchAgentInput) => Promise<MatchAgentOutput>;
