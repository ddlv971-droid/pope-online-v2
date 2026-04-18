// Provider-agnostic mail sender (Resend or SendGrid)

export async function sendMail({ to, from: customFrom, replyTo, subject, text, html, attachments=[] }) {
  const provider = (process.env.MAIL_PROVIDER || 'resend').toLowerCase();
  const from = customFrom || process.env.MAIL_FROM;
  const apiKey = process.env.MAIL_API_KEY;

  if (!to) throw new Error('MAIL: missing to');
  if (!from) throw new Error('MAIL_FROM manquant');
  if (!apiKey) throw new Error('MAIL_API_KEY manquant');

  if (provider === 'resend') {
    // https://resend.com/docs/api-reference/emails/send-email
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        html,
        reply_to: replyTo || undefined,
        attachments: attachments.length ? attachments : undefined
      })
    });
    const out = await r.text();
    if (!r.ok) {
      const e = new Error(out || 'Mail provider error');
      e.status = r.status;
      throw e;
    }
    return { ok: true, provider: 'resend' };
  }

  if (provider === 'sendgrid') {
    // https://docs.sendgrid.com/api-reference/mail-send/mail-send
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: (Array.isArray(to) ? to : [to]).map(email => ({ email })) }],
        from: { email: from },
        reply_to: replyTo ? { email: replyTo } : undefined,
        subject,
        attachments: attachments.length ? attachments.map((att) => ({ content: att.content, filename: att.filename, type: att.type, disposition: att.disposition || 'attachment' })) : undefined,
        content: [
          html ? { type: 'text/html', value: html } : null,
          text ? { type: 'text/plain', value: text } : null
        ].filter(Boolean)
      })
    });
    const out = await r.text();
    if (!r.ok) {
      const e = new Error(out || 'Mail provider error');
      e.status = r.status;
      throw e;
    }
    return { ok: true, provider: 'sendgrid' };
  }

  throw new Error(`MAIL_PROVIDER non supporté: ${provider}`);
}
