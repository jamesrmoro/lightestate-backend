// /api/webhook.js
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use a service key!
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Only POST allowed' });
  }

  // 1. Pegue o destinatário principal do e-mail
  const { ToFull, Subject, TextBody } = req.body || {};
  const destinatario = ToFull && ToFull[0]?.Email;

  console.log('Webhook recebido!');
  console.log('Destinatário:', destinatario);
  console.log('Assunto:', Subject);

  if (!destinatario) {
    console.warn('Nenhum destinatário encontrado no payload.');
    return res.status(200).json({ ok: false, message: 'No destination email found.' });
  }

  // 2. Busca todos os tokens FCM desse destinatário no Supabase
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('email', destinatario);

  if (error) {
    console.error('Erro buscando token:', error);
    return res.status(200).json({ ok: false, message: 'Token search failed' });
  }
  if (!tokens || tokens.length === 0) {
    console.warn('Nenhum token encontrado para', destinatario);
    return res.status(200).json({ ok: false, message: 'No tokens for this email.' });
  }

  console.log('Tokens encontrados:', tokens.map(t => t.token).join(', '));
  console.log('Server Key está setada?', !!FCM_SERVER_KEY);

  // 3. Monta o conteúdo da notificação
  const title = Subject || 'Novo e-mail recebido';
  const body = TextBody
    ? (TextBody.length > 180 ? TextBody.slice(0, 180) + '...' : TextBody)
    : 'Você recebeu um novo e-mail!';

  // 4. Envia a notificação push para cada token
  for (const t of tokens) {
    try {
      console.log('Enviando push para token:', t.token);

      const response = await axios.post('https://fcm.googleapis.com/fcm/send', {
        to: t.token,
        notification: {
          title,
          body
        }
      }, {
        headers: {
          'Authorization': 'key=' + FCM_SERVER_KEY,
          'Content-Type': 'application/json'
        }
      });

      console.log('Push enviado para', destinatario, t.token, 'Response:', response.data);
    } catch (e) {
      // Mostra erro completo e token
      console.error('Erro ao enviar push:', e?.response?.data || e.message, 'Token:', t.token);
    }
  }

  res.status(200).json({ ok: true, sent: tokens.length });
}
