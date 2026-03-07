interface CredentialEmailParams {
    to: string;
    fullName: string;
    email: string;
    password: string;
    loginUrl: string;
}
export declare function sendCredentialsEmail(params: CredentialEmailParams): Promise<void>;
export {};
//# sourceMappingURL=mailer.d.ts.map