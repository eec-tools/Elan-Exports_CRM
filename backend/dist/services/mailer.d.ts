interface CredentialEmailParams {
    to: string;
    fullName: string;
    email: string;
    password: string;
    loginUrl: string;
}
export interface FollowupReminderSupplier {
    company: string;
    email: string | null;
    contactPerson: string | null;
    step: number;
    dueDate: Date;
}
export declare function sendFollowupReminderEmail(params: {
    to: string;
    adminName: string;
    suppliers: FollowupReminderSupplier[];
}): Promise<void>;
export declare function sendCredentialsEmail(params: CredentialEmailParams): Promise<void>;
export {};
//# sourceMappingURL=mailer.d.ts.map