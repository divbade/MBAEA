export type GoalTag = 'recruiting' | 'academics' | 'health' | 'relationships' | 'clubs' | 'admin';

export type CommitmentType = 'meeting' | 'deadline' | 'task' | 'invite' | 'fyi';

export type RequiredAction = 'attend' | 'reply' | 'submit' | 'prepare' | 'follow_up' | 'schedule';

export type CommitmentStrength = 'FYI' | 'soft' | 'likely' | 'confirmed';

export type CandidateStatus = 'NEW' | 'ACCEPTED' | 'DISMISSED';

export type PlanStatus = 'DRAFT' | 'APPLIED';

export type ItemSource = 'MANUAL' | 'CALENDAR' | 'GMAIL';

export type FeedbackItemType = 'CANDIDATE' | 'PLAN_BLOCK';

export interface ExtractedCommitment {
    title: string;
    type: CommitmentType;
    required_action: RequiredAction;
    start_at?: string;
    end_at?: string;
    due_at?: string;
    duration_mins?: number;
    prep_mins?: number;
    goal_tags: GoalTag[];
    commitment_strength: CommitmentStrength;
    confidence: number;
    rationale: string;
}

export interface CandidateItem {
    id: string;
    user_id: string;
    source: ItemSource;
    raw_text: string;
    extracted_json: ExtractedCommitment;
    status: CandidateStatus;
    created_at: string;
    rank_score?: number;
}

export interface Commitment {
    id: string;
    user_id: string;
    candidate_item_id?: string;
    title: string;
    type: CommitmentType;
    required_action: RequiredAction;
    start_at?: string;
    end_at?: string;
    due_at?: string;
    duration_mins?: number;
    prep_mins?: number;
    goal_tags: GoalTag[];
    commitment_strength: CommitmentStrength;
    confidence: number;
    rationale: string;
    created_at: string;
}

export interface GoalWeights {
    recruiting: number;
    academics: number;
    health: number;
    relationships: number;
    clubs: number;
    admin: number;
}

export interface Preferences {
    id: string;
    user_id: string;
    timezone: string;
    work_start: string; // HH:MM format
    work_end: string;
    max_commitments_per_day: number;
    focus_block_mins: number;
    goal_weights: GoalWeights;
    created_at: string;
    updated_at: string;
}

export interface PlanBlock {
    start: string; // ISO string
    end: string;
    title: string;
    block_type: 'fixed_event' | 'task' | 'focus_block' | 'prep';
    commitment_id?: string;
    reasoning: string;
    goal_tags?: GoalTag[];
}

export interface Plan {
    id: string;
    user_id: string;
    week_start: string;
    plan_json: PlanBlock[];
    status: PlanStatus;
    created_at: string;
    updated_at: string;
}

export interface Feedback {
    id: string;
    user_id: string;
    item_type: FeedbackItemType;
    ref_id: string;
    thumbs: number; // 1 or -1
    created_at: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
    is_mbaea?: boolean;
}

export interface Profile {
    id: string;
    display_name: string;
    avatar_url?: string;
    onboarded: boolean;
    created_at: string;
}
