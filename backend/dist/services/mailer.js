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
export async function sendFollowupReminderEmail(params) {
    const { to, adminName, suppliers } = params;
    const stepLabel = (step) => step === 1 ? "Follow-up 1" : step === 2 ? "Follow-up 2" : "Follow-up 3";
    const rows = suppliers
        .map((s) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.company}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.contactPerson ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.email ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${stepLabel(s.step)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.dueDate.toDateString()}</td>
      </tr>`)
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
export async function sendCredentialsEmail(params) {
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
        <p style="color: #888; font-size: 12px; margin-top: 24px;">
          ⚠️ Please keep your password safe and do not share it with anyone.
        </p>
      </div>
    `,
    });
}
//# sourceMappingURL=mailer.js.map