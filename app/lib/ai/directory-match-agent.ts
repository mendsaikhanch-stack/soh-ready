import { findDirectoryMatches } from '@/app/lib/directory/match';
import type { MatchAgent, MatchAgentInput, MatchAgentOutput } from './types';

// AI-аар сайжруулж болох matching эвристик-н орох цэг.
// Одоо: эвристик scorer-ыг ашиглана. LLM API нэмэгдсэн үед энд солигдоно.
//
// Хэрхэн plug хийх (ирээдүйд):
//   1) AI provider (Anthropic эсвэл OpenAI) credentials env-аас уншина.
//   2) prompt: "incomingRow + candidateRecords хоёрын хамгийн илүү таарахыг сонго"
//   3) JSON буцаах (structured output)
//   4) Confidence < 0.7 бол REVIEW_NEEDED, > 0.92 бол MATCH_EXISTING
//
// Process хооронд алдаа гарвал эвристикийн үр дүн дээр fallback хийдэг.

export const suggestDirectoryMatch: MatchAgent = async (input: MatchAgentInput): Promise<MatchAgentOutput> => {
  // Heuristic fallback (одоогийн default)
  const result = await findDirectoryMatches({
    officialName: input.incomingRow.officialName,
    district: input.incomingRow.district,
    khoroo: input.incomingRow.khoroo,
    address: input.incomingRow.address,
    sohCode: input.incomingRow.sohCode,
    aliases: input.incomingRow.aliases,
  });

  if (!result.best) {
    return {
      bestMatchId: null,
      confidence: 0,
      reason: 'no candidate found',
      action: 'CREATE_NEW',
    };
  }

  return {
    bestMatchId: result.best.directory.id,
    confidence: Math.min(result.best.score, 1),
    reason: `heuristic:${result.best.reasons.join('|')}`,
    action: result.action,
  };
};

// LLM-ыг идэвхжүүлэх эсэхийг env feature flag-аар шалгах placeholder
export function isAiMatchingEnabled(): boolean {
  return process.env.DIRECTORY_AI_MATCH === '1';
}
