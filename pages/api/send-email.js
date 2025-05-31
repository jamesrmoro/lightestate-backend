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
        Subject: `Sale registered: ${property}`,
        TextBody: `The property ${property} has been marked as sold.`,
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
