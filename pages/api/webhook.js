import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { JWT } from 'google-auth-library';

// --- Carrega Service Account do arquivo local ou variável de ambiente ---
let serviceAccount;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
} else {
  // Apenas para ambiente local
  const fs = require('fs');
  const path = require('path');
  serviceAccount = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'service-account.json'), 'utf8')
  );
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use a service key!
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];
const projectId = serviceAccount.project_id;
const messagingEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

// --- Função para obter access token OAuth2 ---
async function getAccessToken() {
  const client = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: SCOPES,
  });
  const { token } = await client.authorize();
  return token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Only POST allowed' });
  }

  const { ToFull, Subject, TextBody } = req.body || {};
  const destinatario = ToFull && ToFull[0]?.Email;

  console.log('Webhook recebido!');
  console.log('Destinatário:', destinatario);
  console.log('Assunto:', Subject);

  if (!destinatario) {
    console.warn('Nenhum destinatário encontrado no payload.');
    return res.status(200).json({ ok: false, message: 'No destination email found.' });
  }

  // Busca todos os tokens FCM desse destinatário no Supabase
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

  // Monta o conteúdo da notificação
  const title = Subject || 'Novo e-mail recebido';
  const body = TextBody
    ? (TextBody.length > 180 ? TextBody.slice(0, 180) + '...' : TextBody)
    : 'Você recebeu um novo e-mail!';

  // Obtém access token válido para FCM API v1
  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error('Erro ao obter access token OAuth2:', err);
    return res.status(500).json({ ok: false, message: 'Failed to get access token' });
  }

  // Envia a notificação push para cada token
  for (const t of tokens) {
    try {
      console.log('Enviando push para token:', t.token);
      const payload = {
        message: {
          token: t.token,
          notification: { title, body }
        }
      };
      const response = await axios.post(messagingEndpoint, payload, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Push enviado para', destinatario, t.token, 'Response:', response.data);
    } catch (e) {
      console.error('Erro ao enviar push:', e?.response?.data || e.message, 'Token:', t.token);
    }
  }

  res.status(200).json({ ok: true, sent: tokens.length });
}
