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
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.contactPerson ?? "-"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.email ?? "-"}</td>
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

export async function sendFormSubmissionNotificationEmail(params: {
  to: string;
  adminName: string;
  supplierCompany: string;
  contactPerson?: string | null;
  supplierEmail?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  product?: string | null;
  country?: string | null;
  city?: string | null;
  viewFormUrl: string;
}): Promise<void> {
  const { to, adminName, supplierCompany, contactPerson, supplierEmail, phone, whatsapp, product, country, city, viewFormUrl } = params;

  const submittedAt = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const fieldRows = [
    ["Company", supplierCompany],
    ["Contact Person", contactPerson],
    ["Email", supplierEmail],
    ["Phone", phone],
    ["WhatsApp", whatsapp],
    ["Product", product],
    ["Country", country],
    ["City", city],
  ]
    .filter(([, v]) => v)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:600;width:140px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">${label}</td>
          <td style="padding:10px 16px;color:#1a1a2e;font-size:13px;border-bottom:1px solid #e5e7eb;">${value}</td>
        </tr>`
    )
    .join("");

  await transporter.sendMail({
    from: `"Élan Exports CRM" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: `✅ ${supplierCompany} has submitted their sourcing form`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

      <!-- Header -->
      <tr>
        <td style="background:#1a1a2e;padding:24px 32px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">Élan Exports</p>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">Supplier Sourcing CRM</p>
        </td>
      </tr>

      <!-- Success Banner -->
      <tr>
        <td style="background:#f0fdf4;padding:18px 32px;border-bottom:1px solid #d1fae5;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:36px;height:36px;background:#16a34a;border-radius:50%;text-align:center;vertical-align:middle;">
                <span style="color:#ffffff;font-size:18px;line-height:36px;">✓</span>
              </td>
              <td style="padding-left:14px;">
                <p style="margin:0;color:#15803d;font-weight:bold;font-size:16px;">Sourcing Form Successfully Submitted</p>
                <p style="margin:2px 0 0;color:#16a34a;font-size:12px;">All form sections have been filled and submitted by the supplier.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hello <strong>${adminName}</strong>,</p>
          <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
            <strong>${supplierCompany}</strong> has successfully completed and submitted their sourcing form.
            All details are now available in the CRM for your review.
          </p>

          <!-- Supplier Summary Card -->
          <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
            <div style="background:#1a1a2e;padding:12px 16px;">
              <p style="margin:0;color:#ffffff;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Supplier Summary</p>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${fieldRows}
            </table>
          </div>

          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:8px 0 28px;">
                <a href="${viewFormUrl}"
                   style="display:inline-block;background:#1a1a2e;color:#ffffff;padding:14px 36px;text-decoration:none;border-radius:7px;font-weight:bold;font-size:15px;letter-spacing:0.3px;">
                  View Filled Form →
                </a>
              </td>
            </tr>
          </table>

          <!-- Submitted at -->
          <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Submitted on ${submittedAt} IST</p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#6b7280;font-size:12px;">
            Élan Exports &amp; Consultancy &nbsp;|&nbsp;
            <a href="mailto:${process.env.SMTP_EMAIL}" style="color:#1a1a2e;text-decoration:none;">${process.env.SMTP_EMAIL}</a>
          </p>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">This is an automated notification from your CRM.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
  });
}

export function buildSupplierThankYouEmailHtml(params: {
  contactPerson?: string | null;
  supplierCompany: string;
  senderName: string;
  senderEmail: string;
}): { subject: string; html: string } {
  const { contactPerson, supplierCompany, senderName, senderEmail } = params;
  const recipientName = contactPerson ?? supplierCompany;

  const subject = `Thank you for submitting your supplier form - Élan Exports`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

      <!-- Header -->
      <tr>
        <td style="background:#1a1a2e;padding:24px 32px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">Élan Exports</p>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">Export &amp; Consultancy</p>
        </td>
      </tr>

      <!-- Hero accent line -->
      <tr><td style="background:#d97706;height:3px;"></td></tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 32px 28px;">
          <p style="margin:0 0 6px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Form Submission Confirmed</p>
          <h2 style="margin:0 0 24px;color:#1a1a2e;font-size:22px;font-weight:bold;line-height:1.3;">
            Thank you, ${recipientName}!
          </h2>

          <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">
            We have successfully received your supplier form for
            <strong>${supplierCompany}</strong>. Thank you for taking the time to provide us
            with your details - we truly appreciate it.
          </p>

          <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">
            Our sourcing team is now reviewing your information. We will carefully go
            through everything you have shared and get back to you shortly with the
            next steps.
          </p>

          <!-- Highlight box -->
          <div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #d97706;border-radius:6px;padding:16px 20px;margin:24px 0;">
            <p style="margin:0 0 6px;color:#92400e;font-size:13px;font-weight:bold;">What happens next?</p>
            <ul style="margin:0;padding:0 0 0 18px;color:#78350f;font-size:13px;line-height:1.8;">
              <li>Our team reviews your submission within 1-2 business days</li>
              <li>We may reach out for any additional clarification</li>
              <li>If there is a mutual fit, we will schedule an introductory call</li>
            </ul>
          </div>

          <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.7;">
            In the meantime, if you have any questions or would like to share
            additional information, please feel free to reply to this email - we
            are happy to help.
          </p>

          <p style="margin:0 0 4px;color:#374151;font-size:15px;">Warm regards,</p>
          <p style="margin:0;color:#1a1a2e;font-size:15px;font-weight:bold;">${senderName}</p>
          <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">Élan Exports &amp; Consultancy</p>
          <p style="margin:2px 0 0;"><a href="mailto:${senderEmail}" style="color:#d97706;font-size:13px;text-decoration:none;">${senderEmail}</a></p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#6b7280;font-size:12px;">
            Élan Exports &amp; Consultancy &nbsp;|&nbsp;
            <a href="mailto:${senderEmail}" style="color:#1a1a2e;text-decoration:none;">${senderEmail}</a>
          </p>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">You are receiving this because you submitted a supplier form to Élan Exports.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

export async function sendSupplierThankYouEmail(params: {
  to: string;
  contactPerson?: string | null;
  supplierCompany: string;
  senderName: string;
  senderEmail: string;
}): Promise<void> {
  const { to, ...rest } = params;
  const { subject, html } = buildSupplierThankYouEmailHtml(rest);
  await transporter.sendMail({
    from: `"${rest.senderName} - Élan Exports" <${process.env.SMTP_EMAIL}>`,
    to,
    subject,
    html,
  });
}

export async function sendImmediateReplyAlert(params: {
  to: string;
  company: string;
  contactPerson?: string | null;
  companyEmail?: string | null;
  entityType: "buyer" | "supplier";
  crmLink: string;
}): Promise<void> {
  const { to, company, contactPerson, companyEmail, entityType, crmLink } = params;
  const label = entityType === "buyer" ? "Buyer" : "Supplier";
  const subject = `⚡ [Reply Now] ${company} has responded`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;">
      <div style="background:#f59e0b;color:#fff;padding:12px 20px;border-radius:6px;margin-bottom:20px;">
        <strong style="font-size:16px;">⚡ Immediate Reply Required</strong>
      </div>
      <p style="color:#111827;font-size:15px;margin:0 0 16px;">
        <strong>${company}</strong> (${label}) has replied to your email and is awaiting your response.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
        <tr><td style="padding:8px;background:#f9fafb;color:#6b7280;width:140px;border:1px solid #e5e7eb;">Company</td><td style="padding:8px;border:1px solid #e5e7eb;">${company}</td></tr>
        ${contactPerson ? `<tr><td style="padding:8px;background:#f9fafb;color:#6b7280;border:1px solid #e5e7eb;">Contact</td><td style="padding:8px;border:1px solid #e5e7eb;">${contactPerson}</td></tr>` : ""}
        ${companyEmail ? `<tr><td style="padding:8px;background:#f9fafb;color:#6b7280;border:1px solid #e5e7eb;">Email</td><td style="padding:8px;border:1px solid #e5e7eb;">${companyEmail}</td></tr>` : ""}
        <tr><td style="padding:8px;background:#f9fafb;color:#6b7280;border:1px solid #e5e7eb;">Type</td><td style="padding:8px;border:1px solid #e5e7eb;">${label}</td></tr>
      </table>
      <a href="${crmLink}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Open in CRM →</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Elan Exports CRM — Reply to this ${label.toLowerCase()} promptly to keep the conversation warm.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? "noreply@eectrade.com",
    to,
    subject,
    html,
  });
}

export async function sendReplyPendingReminderEmail(params: {
  to: string;
  pendingBuyers: Array<{ company: string; email: string | null; contactPerson: string | null; respondedAt?: string | null }>;
  pendingSuppliers: Array<{ company: string; email: string | null; contactPerson: string | null; respondedAt?: string | null }>;
}): Promise<void> {
  const { to, pendingBuyers, pendingSuppliers } = params;
  const totalCount = pendingBuyers.length + pendingSuppliers.length;
  if (totalCount === 0) return;

  const daysAgo = (dateStr?: string | null): string => {
    if (!dateStr) return "—";
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  const rowColor = (dateStr?: string | null): string => {
    const days = dateStr ? Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    if (days >= 3) return "#fff5f5";
    if (days >= 1) return "#fffbeb";
    return "#ffffff";
  };

  const buildRows = (items: typeof pendingBuyers) =>
    items
      .map(
        (item) => `
      <tr style="background:${rowColor(item.respondedAt)}">
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${item.company}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.contactPerson ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.email ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${(item.respondedAt && Math.floor((Date.now() - new Date(item.respondedAt).getTime()) / 86400000) >= 1) ? "#dc2626" : "#374151"};font-weight:600;">${daysAgo(item.respondedAt)}</td>
      </tr>`,
      )
      .join("");

  const tableHeader = `
    <tr style="background:#f5f5f5;">
      <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Company</th>
      <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Contact Person</th>
      <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Email</th>
      <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Responded</th>
    </tr>`;

  const buyersSection =
    pendingBuyers.length > 0
      ? `
    <h3 style="color:#1a1a2e;font-size:15px;margin:24px 0 8px;">Buyers (${pendingBuyers.length})</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead>${tableHeader}</thead>
      <tbody>${buildRows(pendingBuyers)}</tbody>
    </table>`
      : "";

  const suppliersSection =
    pendingSuppliers.length > 0
      ? `
    <h3 style="color:#1a1a2e;font-size:15px;margin:24px 0 8px;">Suppliers (${pendingSuppliers.length})</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead>${tableHeader}</thead>
      <tbody>${buildRows(pendingSuppliers)}</tbody>
    </table>`
      : "";

  await transporter.sendMail({
    from: `"Élan Exports CRM" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: `[Reply Needed] ${totalCount} company response${totalCount > 1 ? "s" : ""} awaiting your reply`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <div style="background:#1a1a2e;padding:20px 28px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:bold;">Élan Exports</p>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">Pending Reply Reminder</p>
        </div>
        <div style="background:#fef3c7;border-bottom:2px solid #f59e0b;padding:14px 28px;">
          <p style="margin:0;color:#92400e;font-weight:bold;">
            ⚠️ ${totalCount} contact${totalCount > 1 ? "s have" : " has"} replied to your outreach — you haven't replied back yet.
          </p>
        </div>
        <div style="padding:24px 28px;">
          <p style="color:#374151;font-size:14px;margin:0 0 8px;">
            Please log in to the CRM and reply to the following ${totalCount > 1 ? "companies" : "company"}:
          </p>
          ${buyersSection}
          ${suppliersSection}
          <p style="margin-top:28px;color:#9ca3af;font-size:12px;">
            This is an automated daily reminder from Élan Exports CRM (9:05 AM IST).
            Once you reply, this contact will no longer appear in tomorrow's reminder.
          </p>
        </div>
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
          If you do not check out in time, you are not a good <strong>Employee</strong>.
        </p>
        <p>Before checkout, upload at least one work proof file (PDF/image/document).</p>
      </div>
    `,
  });
}
