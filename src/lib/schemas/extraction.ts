import { z } from "zod";

export const GoalTagEnum = z.enum([
    "recruiting",
    "academics",
    "health",
    "relationships",
    "clubs",
    "admin",
]);

export const CommitmentTypeEnum = z.enum([
    "meeting",
    "deadline",
    "task",
    "invite",
    "fyi",
]);

export const RequiredActionEnum = z.enum([
    "attend",
    "reply",
    "submit",
    "prepare",
    "follow_up",
    "schedule",
]);

export const CommitmentStrengthEnum = z.enum([
    "FYI",
    "soft",
    "likely",
    "confirmed",
]);

export const ExtractedCommitmentSchema = z.object({
    title: z.string().min(1).max(200),
    type: CommitmentTypeEnum,
    required_action: RequiredActionEnum,
    start_at: z.string().optional(),
    end_at: z.string().optional(),
    due_at: z.string().optional(),
    duration_mins: z.number().int().positive().optional(),
    prep_mins: z.number().int().nonnegative().optional(),
    goal_tags: z.array(GoalTagEnum).min(1),
    commitment_strength: CommitmentStrengthEnum,
    confidence: z.number().min(0).max(1),
    rationale: z.string().min(1),
});

export type ExtractedCommitmentInput = z.infer<typeof ExtractedCommitmentSchema>;
