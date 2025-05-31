export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  let { property, emails } = req.body;
  const POSTMARK_TOKEN = process.env.POSTMARK_TOKEN;
  const ENDPOINT_INBOUND = 'd92b43c3f4789894b5f32edec838ccb9@inbound.postmarkapp.com';

  // Basic validation of emails array
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'No email addresses provided.' });
  }

  // If there is more than one recipient, NEVER include the inbound endpoint together (avoids duplicate notifications)
  if (emails.length > 1 && emails.some(email => email.trim().toLowerCase() === ENDPOINT_INBOUND)) {
    return res.status(400).json({ error: 'You cannot send an email to the Postmark inbound endpoint along with other recipients. This causes duplicate notifications for everyone.' });
  }

  // If sending only to the inbound endpoint, OK (this is for push trigger)
  if (
    emails.length === 1 &&
    emails[0].trim().toLowerCase() === ENDPOINT_INBOUND
  ) {
    // Will send the push trigger
  } else {
    // Remove the inbound endpoint in case someone tries to include it by mistake
    emails = emails.filter(email => email.trim().toLowerCase() !== ENDPOINT_INBOUND);
  }

  // After filtering, if no recipients remain (e.g., only the inbound endpoint was included), block the send
  if (emails.length === 0) {
    return res.status(400).json({ error: 'No valid recipients to send email.' });
  }

  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': POSTMARK_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        From: 'Light Estate <contato@sprintcodes.com.br>',
        To: emails.join(','),
        Subject: `🏠 New Sale Registered: ${property}`,
        HtmlBody: `
          <div style="background:#f8fafc;padding:32px 0;min-height:100vh;">
            <table align="center" cellpadding="0" cellspacing="0" style="max-width:430px;width:100%;background:#fff;border-radius:16px;box-shadow:0 4px 24px #0002;font-family:sans-serif;">
              <tr>
                <td style="padding:32px 32px 16px 32px;text-align:center;">
                  <img src="https://lightestate-backend.vercel.app/assets/logo.png" alt="Light Estate" style="width:155px;margin-bottom:16px;">
                  <h2 style="color:#1B6EBE;margin-bottom:8px;">Sale Completed!</h2>
                  <p style="color:#333;font-size:17px;margin:0 0 18px;">
                    Hello! A new property sale has just been registered in the system:
                  </p>
                  <table style="background:#f4f8ff;border-radius:12px;padding:18px;width:100%;margin-bottom:16px;">
                    <tr>
                      <td style="font-weight:bold;color:#1B6EBE;padding-right:12px;">Property:</td>
                      <td style="color:#333;">${property}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;color:#1B6EBE;padding-right:12px;">Status:</td>
                      <td style="color:#318834;">SOLD</td>
                    </tr>
                  </table>
                  <a href="https://lightestate.vercel.app/dashboard" style="display:inline-block;margin-top:14px;padding:13px 30px;border-radius:8px;background:#318834;color:#fff;font-weight:bold;text-decoration:none;font-size:16px;box-shadow:0 1px 6px #31883433;">View in Dashboard</a>
                  <p style="color:#A8669C;margin-top:22px;font-size:15px;">
                    Light Estate &mdash; Innovation for the Real Estate Market
                  </p>
                </td>
              </tr>
            </table>
          </div>
        `,
        MessageStream: 'outbound'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(500).json({ error: 'Failed to send email.', detail: error });
    }

    return res.status(200).json({ message: 'Email sent successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.', detail: err.message });
  }
}
