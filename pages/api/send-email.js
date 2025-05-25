export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { property, emails } = req.body;
  const POSTMARK_TOKEN = process.env.POSTMARK_TOKEN;
  const ENDPOINT_INBOUND = 'd92b43c3f4789894b5f32edec838ccb9@inbound.postmarkapp.com';

  // Validação básica do array de e-mails
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'Nenhum e-mail enviado.' });
  }

  // Se houver mais de um destinatário, NUNCA envie para o endpoint inbound junto (evita notificação duplicada)
  if (emails.length > 1 && emails.some(email => email.trim().toLowerCase() === ENDPOINT_INBOUND)) {
    return res.status(400).json({ error: 'Você não pode enviar e-mail para o endpoint inbound do Postmark junto com outros destinatários. Isso gera notificações duplicadas para todos.' });
  }

  // Se estiver enviando apenas para o endpoint inbound, OK (esse caso é para trigger de push)
  if (
    emails.length === 1 &&
    emails[0].trim().toLowerCase() === ENDPOINT_INBOUND
  ) {
    // Vai enviar o trigger de push
  } else {
    // Remova o endpoint inbound, caso alguém tente enviar para a equipe e sem querer inclua ele
    emails = emails.filter(email => email.trim().toLowerCase() !== ENDPOINT_INBOUND);
  }

  // Depois do filtro, se não sobrou destinatário (ex: só tinha o endpoint inbound e você removeu), bloqueia
  if (emails.length === 0) {
    return res.status(400).json({ error: 'Nenhum destinatário válido para enviar e-mail.' });
  }

  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': POSTMARK_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        From: 'contato@sprintcodes.com.br',
        To: emails.join(','),
        Subject: `Venda registrada: ${property}`,
        TextBody: `O imóvel ${property} foi marcado como vendido.`,
        MessageStream: 'outbound'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(500).json({ error: 'Erro ao enviar e-mail', detail: error });
    }

    return res.status(200).json({ message: 'E-mail enviado com sucesso' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno', detail: err.message });
  }
}
