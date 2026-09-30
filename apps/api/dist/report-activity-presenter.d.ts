type ActivityLike = {
    action?: string | null;
    username?: string | null;
    createdAt: Date | string;
    newValue?: unknown;
};
export declare function presentActivity(log: ActivityLike): {
    time: string;
    actor: string;
    stage: string;
    activity: string;
    note: string;
};
export {};
