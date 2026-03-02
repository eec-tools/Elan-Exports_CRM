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
        <p style="color: #888; font-size: 12px; margin-top: 24px;">
          ⚠️ Please keep your password safe and do not share it with anyone.
        </p>
      </div>
    `,
  });
}
