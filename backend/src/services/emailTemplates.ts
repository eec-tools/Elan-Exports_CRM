export interface SignatureLink {
  label: string;
  url: string;
}

export interface SignatureData {
  name: string;
  role?: string;
  company?: string;
  tagline?: string;
  links?: SignatureLink[];
}

interface TemplateData {
  company: string;
  contactPerson?: string | null;
  product?: string | null;
  formLink: string;
  fromEmail: string;
  signature?: SignatureData | null;
}

function displayUrl(url: string): string {
  if (url.startsWith("mailto:")) return url.slice(7);
  if (url.startsWith("tel:")) return url.slice(4);
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

function buildSignatureHtml(sig: SignatureData | null | undefined, salutation: string, _fallbackEmail: string): string {
  if (!sig) {
    return `<p style="margin:24px 0 0;color:#374151;font-size:15px;">${salutation},</p>`;
  }

  const linkRows = (sig.links ?? [])
    .map((l) => `
      <p style="margin:0 0 2px;">
        <span style="color:#6b7280;font-size:12px;">${l.label}: </span>
        <a href="${l.url}" style="color:#1a1a2e;font-size:12px;text-decoration:none;">${displayUrl(l.url)}</a>
      </p>`)
    .join("");

  return `
<p style="margin:24px 0 8px;color:#374151;font-size:15px;">${salutation},</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>
    <td style="width:3px;background:#d97706;border-radius:2px;">&nbsp;</td>
    <td style="padding-left:12px;">
      <p style="margin:0 0 1px;font-size:16px;font-weight:bold;color:#1a1a2e;">${sig.name}</p>
      ${sig.role ? `<p style="margin:0 0 1px;font-size:13px;color:#d97706;font-weight:600;">${sig.role}</p>` : ""}
      ${sig.company ? `<p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#374151;">${sig.company}</p>` : `<p style="margin:0 0 8px;"></p>`}
      ${linkRows}
      ${sig.tagline ? `<p style="margin:8px 0 0;font-size:11px;color:#9ca3af;font-style:italic;">${sig.tagline}</p>` : ""}
    </td>
  </tr>
</table>`;
}

interface EmailTemplate {
  subject: string;
  html: string;
}

function baseLayout(content: string, fromEmail: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">Élan Exports</p>
              <p style="margin:4px 0 0;color:#a0aec0;font-size:12px;">Premium Agri-Commodity Trading</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#6b7280;font-size:12px;">
                Élan Exports &amp; Consultancy &nbsp;|&nbsp;
                <a href="mailto:${fromEmail}" style="color:#1a1a2e;text-decoration:none;">${fromEmail}</a>
              </p>
              <p style="margin:6px 0 0;color:#9ca3af;font-size:11px;">
                This email was sent as part of a supplier onboarding process. If you believe this was sent in error, please ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(link: string, text: string): string {
  return `
<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background:#1a1a2e;border-radius:6px;padding:0;">
      <a href="${link}" target="_blank"
         style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;border-radius:6px;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}

function formLinkBox(link: string): string {
  return `
<div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:12px 16px;margin:16px 0;">
  <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Form Link</p>
  <a href="${link}" style="color:#1a1a2e;font-size:13px;word-break:break-all;">${link}</a>
</div>`;
}

export function introEmailTemplate(data: TemplateData): EmailTemplate {
  const greeting = data.contactPerson ? `Dear ${data.contactPerson},` : `Dear Sir/Madam,`;
  const productLine = data.product ?? "your product category";
  const content = `
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${greeting}</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  Greetings from <strong>Elan Exports Consultancy</strong>.
</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  We are a Singapore-headquartered sourcing and execution consultancy working with international buyers across regions, including Europe, the Middle East, Africa, Australia, and North America.
</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  We are currently expanding our supplier network for <strong>${productLine}</strong> and are evaluating reliable manufacturers/exporters for ongoing and upcoming international sourcing requirements.
</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  At this stage, we are identifying partners based on product capability, export readiness, pricing competitiveness, documentation strength, and responsiveness.
</p>

<p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6;">
  We would request you to kindly share the following details:
</p>

<ul style="margin:8px 0 16px;padding-left:20px;color:#374151;font-size:15px;line-height:1.8;">
  <li>Company profile</li>
  <li>Product catalogue / key SKUs</li>
  <li>Export markets currently served</li>
  <li>MOQ details</li>
  <li>Certifications (e.g., ISO, HACCP, BRC, etc.)</li>
  <li>Lead times</li>
  <li>Packaging options</li>
  <li>Indicative pricing for relevant products</li>
  <li>Factory / production details</li>
  <li>Contact details of your export / commercial team</li>
</ul>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  You can submit the above details directly using our Supplier Information Form:
</p>

${ctaButton(data.formLink, "Fill in Supplier Form →")}
${formLinkBox(data.formLink)}

<p style="margin:16px 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  Please note that buyer-specific details are not being disclosed at this stage, as we are currently in the supplier evaluation and onboarding phase.
</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  Please note that Elan Exports Consultancy operates through a structured sourcing and execution model, where we remain the central point of coordination across supplier evaluation, commercial discussions, and transaction management. This approach ensures consistency, pricing discipline, and smooth execution across all stages of the sourcing process. Accordingly, all communication and commercial alignment are managed through EEC.
</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  We look forward to reviewing your profile and exploring a potential working relationship.
</p>

${buildSignatureHtml(data.signature, "Warm regards", data.fromEmail)}`;

  return {
    subject: `Export Supply Partnership Inquiry – ${productLine}`,
    html: baseLayout(content, data.fromEmail),
  };
}

export function followup1Template(data: TemplateData): EmailTemplate {
  const greeting = data.contactPerson ? `Dear ${data.contactPerson},` : `Dear Sir/Madam,`;
  const content = `
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${greeting}</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  I hope this message finds you well. I am writing to follow up on my previous email regarding a potential supplier partnership between <strong>${data.company}</strong> and <strong>Élan Exports &amp; Consultancy</strong>.
</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  In case my earlier email was missed, I wanted to share the Supplier Information Form once more. It only takes around 10–15 minutes and will help us move forward with evaluating a partnership:
</p>

${ctaButton(data.formLink, "Fill in Supplier Form →")}
${formLinkBox(data.formLink)}

<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6;">
  If you have any questions or would prefer to connect over a call, please do not hesitate to reach out directly.
</p>

${buildSignatureHtml(data.signature, "Best regards", data.fromEmail)}`;

  return {
    subject: `Following Up — Supplier Form | Élan Exports × ${data.company}`,
    html: baseLayout(content, data.fromEmail),
  };
}

export function followup2Template(data: TemplateData): EmailTemplate {
  const greeting = data.contactPerson ? `Dear ${data.contactPerson},` : `Dear Sir/Madam,`;
  const content = `
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${greeting}</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  I wanted to reach out one more time regarding our partnership inquiry with <strong>${data.company}</strong>. We are genuinely interested in what you offer and would love the opportunity to work together.
</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  Please take a moment to complete the Supplier Information Form — it helps us understand your products, certifications, and capacity so we can explore the right opportunities for you in our buyer network:
</p>

${ctaButton(data.formLink, "Complete Supplier Form →")}
${formLinkBox(data.formLink)}

<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6;">
  If this is not the right time or you are not interested, no worries at all — please let us know and we will not follow up further.
</p>

${buildSignatureHtml(data.signature, "Best regards", data.fromEmail)}`;

  return {
    subject: `Reminder — Partnership Opportunity with Élan Exports | ${data.company}`,
    html: baseLayout(content, data.fromEmail),
  };
}

export function followup3Template(data: TemplateData): EmailTemplate {
  const greeting = data.contactPerson ? `Dear ${data.contactPerson},` : `Dear Sir/Madam,`;
  const content = `
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${greeting}</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  This is our final follow-up regarding the supplier partnership inquiry we sent to <strong>${data.company}</strong>. We have reached out a few times and want to respect your time.
</p>

<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
  If you are interested in exploring an export partnership with Élan Exports, we would be delighted to connect. Please fill in the form below at your earliest convenience:
</p>

${ctaButton(data.formLink, "Fill in Supplier Form →")}
${formLinkBox(data.formLink)}

<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6;">
  If we do not hear back, we will close this inquiry — but you are always welcome to reach out to us directly in the future if circumstances change.
</p>

${buildSignatureHtml(data.signature, "Best regards", data.fromEmail)}`;

  return {
    subject: `Last Follow-Up — Élan Exports Partnership Inquiry | ${data.company}`,
    html: baseLayout(content, data.fromEmail),
  };
}

// ─── Custom template support ─────────────────────────────────────────────────

export interface CustomEmailTemplate {
    introSubject: string;
    introBody: string;
    followup1Subject: string;
    followup1Body: string;
    followup2Subject: string;
    followup2Body: string;
    followup3Subject: string;
    followup3Body: string;
}

function stripTrailingSignoff(text: string): string {
    // Remove any trailing sign-off block (e.g. "Warm regards,\nJohn\nCompany") so the dynamic signature isn't duplicated
    return text
        .replace(/[\r\n\s]*(warm regards|best regards|kind regards|regards|sincerely|yours sincerely|best|cheers)[,.]?[\s\S]*$/i, "")
        .trimEnd();
}

function renderSubject(subjectTemplate: string, data: TemplateData): string {
    return subjectTemplate
        .replace(/\{\{company\}\}/g, data.company)
        .replace(/\{\{product\}\}/g, data.product ?? "your product category")
        .replace(/\{\{contactPerson\}\}/g, data.contactPerson ?? "");
}

function renderBodyText(bodyTemplate: string, data: TemplateData): string {
    const greeting = data.contactPerson ? `Dear ${data.contactPerson},` : `Dear Sir/Madam,`;
    const productLine = data.product ?? "your product category";
    const formButtonHtml = `${ctaButton(data.formLink, "Fill in Supplier Form →")}${formLinkBox(data.formLink)}`;

    let text = bodyTemplate
        .replace(/\{\{greeting\}\}/g, greeting)
        .replace(/\{\{company\}\}/g, data.company)
        .replace(/\{\{contactPerson\}\}/g, data.contactPerson ?? "")
        .replace(/\{\{product\}\}/g, productLine)
        .replace(/\{\{fromEmail\}\}/g, data.fromEmail)
        .replace(/\{\{formButton\}\}/g, formButtonHtml)
        .replace(/\{\{formLink\}\}/g, data.formLink);

    const blocks: string[] = [];
    for (const para of text.split(/\n\n+/)) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        // Already HTML from {{formButton}} substitution
        if (trimmed.startsWith("<")) {
            blocks.push(trimmed);
            continue;
        }

        const lines = trimmed.split("\n");
        const listLines = lines.filter((l) => /^[-•]\s/.test(l.trim()));

        if (listLines.length > 0 && listLines.length >= lines.length - 1) {
            const prefixLines = lines.filter((l) => !/^[-•]\s/.test(l.trim()) && l.trim());
            if (prefixLines.length > 0) {
                blocks.push(`<p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6;">${prefixLines.join("<br />")}</p>`);
            }
            const liHtml = listLines.map((l) => `<li>${l.trim().replace(/^[-•]\s+/, "")}</li>`).join("");
            blocks.push(`<ul style="margin:8px 0 16px;padding-left:20px;color:#374151;font-size:15px;line-height:1.8;">${liHtml}</ul>`);
            continue;
        }

        const htmlPara = trimmed.replace(/\n/g, "<br />");
        blocks.push(`<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${htmlPara}</p>`);
    }

    return blocks.join("\n");
}

export function getCustomTemplate(step: number, customTpl: CustomEmailTemplate, data: TemplateData): EmailTemplate {
    const introSubject = renderSubject(customTpl.introSubject, data);
    let subject: string;
    let bodyText: string;
    let salutation: string;

    switch (step) {
        case 1:
            subject = introSubject;
            bodyText = customTpl.introBody;
            salutation = "Warm regards";
            break;
        case 2:
            subject = `Re: ${introSubject}`;
            bodyText = customTpl.followup1Body;
            salutation = "Best regards";
            break;
        case 3:
            subject = `Re: ${introSubject}`;
            bodyText = customTpl.followup2Body;
            salutation = "Best regards";
            break;
        case 4:
            subject = `Re: ${introSubject}`;
            bodyText = customTpl.followup3Body;
            salutation = "Best regards";
            break;
        default:
            throw new Error(`Unknown campaign step: ${step}`);
    }

    const bodyHtml = renderBodyText(stripTrailingSignoff(bodyText), data) + "\n" + buildSignatureHtml(data.signature, salutation, data.fromEmail);

    return {
        subject,
        html: baseLayout(bodyHtml, data.fromEmail),
    };
}

export function getTemplate(step: number, data: TemplateData): EmailTemplate {
  switch (step) {
    case 1: return introEmailTemplate(data);
    case 2: return followup1Template(data);
    case 3: return followup2Template(data);
    case 4: return followup3Template(data);
    default: throw new Error(`Unknown campaign step: ${step}`);
  }
}
