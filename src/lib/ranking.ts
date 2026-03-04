import type { GoalWeights, CandidateItem, Preferences } from "@/lib/types";

interface RankingContext {
    goalWeights: GoalWeights;
    maxCommitmentsPerDay: number;
    existingCommitmentsToday: number;
    now: Date;
}

/**
 * Deterministic rank score for a candidate item.
 * Higher score = higher priority in inbox.
 *
 * score = Σ(user_goal_weight[tag] * tag_presence) + urgency_bonus - overload_penalty - low_confidence_penalty
 */
export function calculateRankScore(
    item: CandidateItem,
    ctx: RankingContext
): number {
    const extracted = item.extracted_json;
    let score = 0;

    // Goal weight contribution
    for (const tag of extracted.goal_tags) {
        const weight = ctx.goalWeights[tag] ?? 1;
        score += weight;
    }

    // Urgency bonus
    const dueDate = extracted.due_at || extracted.start_at;
    if (dueDate) {
        const due = new Date(dueDate);
        const hoursUntilDue = (due.getTime() - ctx.now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilDue <= 0) {
            score += 5; // overdue!
        } else if (hoursUntilDue <= 48) {
            score += 3; // due within 48 hours
        } else if (hoursUntilDue <= 168) {
            // 7 days
            score += 1;
        }
    }

    // Commitment strength bonus
    const strengthBonus: Record<string, number> = {
        confirmed: 2,
        likely: 1,
        soft: 0,
        FYI: -1,
    };
    score += strengthBonus[extracted.commitment_strength] ?? 0;

    // Overload penalty
    if (ctx.existingCommitmentsToday >= ctx.maxCommitmentsPerDay) {
        score -= 5;
    } else if (ctx.existingCommitmentsToday >= ctx.maxCommitmentsPerDay - 1) {
        score -= 2;
    }

    // Low confidence penalty
    if (extracted.confidence < 0.5) {
        score -= 2;
    } else if (extracted.confidence < 0.7) {
        score -= 1;
    }

    return Math.round(score * 10) / 10;
}

/**
 * Rank a list of candidate items by score (descending).
 */
export function rankCandidates(
    items: CandidateItem[],
    preferences: Preferences,
    existingCommitmentsToday: number = 0
): (CandidateItem & { rank_score: number })[] {
    const ctx: RankingContext = {
        goalWeights: preferences.goal_weights,
        maxCommitmentsPerDay: preferences.max_commitments_per_day,
        existingCommitmentsToday,
        now: new Date(),
    };

    return items
        .map((item) => ({
            ...item,
            rank_score: calculateRankScore(item, ctx),
        }))
        .sort((a, b) => b.rank_score - a.rank_score);
}
