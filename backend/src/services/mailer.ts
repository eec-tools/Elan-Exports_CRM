import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_APP_PASSWORD,
  },
});

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
  step: number; // 1=followup1, 2=followup2, 3=followup3
  dueDate: Date;
}

export async function sendFollowupReminderEmail(params: {
  to: string;
  adminName: string;
  suppliers: FollowupReminderSupplier[];
}): Promise<void> {
  const { to, adminName, suppliers } = params;

  const stepLabel = (step: number) =>
    step === 1 ? "Follow-up 1" : step === 2 ? "Follow-up 2" : "Follow-up 3";

  const rows = suppliers
    .map(
      (s) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.company}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.contactPerson ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.email ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${stepLabel(s.step)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.dueDate.toDateString()}</td>
      </tr>`,
    )
    .join("");

  await transporter.sendMail({
    from: `"Élan Exports CRM" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: `[Action Required] ${suppliers.length} Supplier Follow-up Email${suppliers.length > 1 ? "s" : ""} Due Today`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <h2 style="color:#1a1a2e;">Supplier Follow-up Reminders</h2>
        <p>Hello <strong>${adminName}</strong>,</p>
        <p>The following supplier${suppliers.length > 1 ? "s require" : " requires"} a follow-up email today:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;">Company</th>
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;">Contact Person</th>
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;">Email</th>
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;">Step</th>
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;">Due Date</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:24px;color:#888;font-size:12px;">
          Log in to the CRM to mark these emails as sent.
        </p>
      </div>
    `,
  });
}

export async function sendCredentialsEmail(
  params: CredentialEmailParams,
): Promise<void> {
  const { to, fullName, email, password, loginUrl } = params;

  await transporter.sendMail({
    from: `"Élan Exports CRM" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: "Your Élan Exports CRM Login Credentials",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Welcome to Élan Exports</h2>
        <p>Hello <strong>${fullName}</strong>,</p>
        <p>Your account has been created. Here are your login credentials:</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 4px 0;"><strong>Password:</strong> ${password}</p>
        </div>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${loginUrl}" style="background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Go to Login
          </a>
        </div>
        <p style="color: #888; font-size: 12px; margin-top: 32px;">
          ⚠️ Please keep your password safe and do not share it with anyone.
        </p>
      </div>
    `,
  });
}

export async function sendAttendanceCheckoutWarningEmail(params: {
  to: string;
  fullName: string;
  graceMinutes: number;
}): Promise<void> {
  const { to, fullName, graceMinutes } = params;

  await transporter.sendMail({
    from: `"Elan Exports CRM" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: "Urgent: CRM Checkout Reminder",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b91c1c; margin-bottom: 8px;">Checkout Reminder</h2>
        <p>Hello <strong>${fullName}</strong>,</p>
        <p>Your work end time has passed, but your attendance is still open.</p>
        <p style="margin: 14px 0; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
          Please check out within <strong>${graceMinutes} minutes</strong> in the Attendance screen.
          If you do not check out in time, your are not a good <strong>Employee</strong>.
        </p>
        <p>Before checkout, upload at least one work proof file (PDF/image/document).</p>
      </div>
    `,
  });
}
