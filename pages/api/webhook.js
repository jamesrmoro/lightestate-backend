// pages/api/webhook.js

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { JWT } from 'google-auth-library';

// --- Carrega Service Account ---
let serviceAccount;
try {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.log('Lendo Service Account do ENV...');
    serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.FIREBASE_ADMIN_JSON) {
    console.log('Lendo Service Account do ENV (FIREBASE_ADMIN_JSON)...');
    serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_JSON);
  } else {
    // Fallback para ambiente local
    const fs = require('fs');
    const path = require('path');
    const saPath = path.resolve(process.cwd(), 'service-account.json');
    serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  }
  console.log('Service account carregada, client_email:', serviceAccount.client_email);
} catch (err) {
  console.error('Erro ao carregar service account:', err);
  throw err;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];
const projectId = serviceAccount.project_id;
const messagingEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

// --- Access Token JWT para FCM v1 ---
async function getAccessToken() {
  try {
    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: SCOPES,
    });
    // O authorize pode retornar access_token ou token, dependendo da versão
    const tokens = await client.authorize();
    const token = tokens.access_token || tokens.token;
    if (!token) {
      throw new Error('Access token não retornado pelo Google Auth.');
    }
    // Mostra um trecho do token só para debug (nunca mostre tudo em produção)
    console.log('AccessToken obtido:', token.slice(0, 24) + '... (' + token.length + ' chars)');
    return token;
  } catch (err) {
    console.error('Erro ao obter access token:', err);
    throw err;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Only POST allowed' });
  }

  try {
    const { ToFull, Subject, TextBody } = req.body || {};
    const destinatario = ToFull && ToFull[0]?.Email;

    console.log('Webhook recebido!');
    console.log('Destinatário:', destinatario);
    console.log('Assunto:', Subject);

    if (!destinatario) {
      console.warn('Nenhum destinatário encontrado no payload.');
      return res.status(200).json({ ok: false, message: 'No destination email found.' });
    }

    // Busca tokens FCM no Supabase
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

    // Exibe todos tokens encontrados para debug
    tokens.forEach((t, i) => {
      console.log(`[Token #${i + 1}] Token do destinatário para push:`, t.token);
    });

    // Monta o conteúdo da notificação
    const title = Subject || 'Novo e-mail recebido';
    const body = TextBody
      ? (TextBody.length > 180 ? TextBody.slice(0, 180) + '...' : TextBody)
      : 'Você recebeu um novo e-mail!';

    // Access token válido FCM API v1
    let accessToken;
    try {
      accessToken = await getAccessToken();
    } catch (err) {
      console.error('ERRO ao obter access token (provável erro de JSON ou permissão):', err);
      return res.status(500).json({ ok: false, message: 'Failed to get access token', error: err.message });
    }

    // Envia a notificação push para cada token
    for (const t of tokens) {
      try {
        console.log('Enviando push para token:', t.token);

        const payload = {
          message: {
            token: t.token,
            notification: { title, body },
            webpush: {
              fcm_options: {
                link: "https://lightestate.jamesrmoro.me" // ou o domínio do seu app
              }
            }
          }
        };
        // Também exibe o payload que será enviado
        console.log('Payload da notificação:', JSON.stringify(payload));

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
  } catch (err) {
    console.error('ERRO GERAL no handler:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
