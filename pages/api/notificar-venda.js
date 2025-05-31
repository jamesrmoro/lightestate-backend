// pages/api/notificar-venda.js
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');

// --- CORS ---
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// --- Firebase Admin Init ---
const serviceAccount =
  process.env.FIREBASE_ADMIN_JSON && process.env.FIREBASE_ADMIN_JSON.trim().length > 0
    ? JSON.parse(process.env.FIREBASE_ADMIN_JSON)
    : null;

if (!admin.apps.length && serviceAccount && serviceAccount.project_id) {
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

// --- Supabase Init ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST requests are allowed.' });

  const { empreendimento, numero_apartamento, andar, usuario, data } = req.body || {};
  if (!empreendimento || !numero_apartamento || !andar || !usuario || !data) {
    res.status(400).json({ error: 'Missing required fields.' });
    return;
  }

  // Fetch tokens
  const { data: tokensData, error } = await supabase
    .from('push_tokens')
    .select('token');
  if (error) return res.status(500).json({ error: 'Supabase error', detail: error });

  const tokens = (tokensData || []).map(t => t.token).filter(Boolean);
  if (!tokens.length) return res.json({ success: true, warnings: 'No registered tokens.' });

  // Data-only message (does not show notification on web, background tasks only)
  const mensagem = {
    data: {
      title: 'New sale!',
      body: `Apt ${numero_apartamento} (${empreendimento}) sold.`,
      empreendimento: String(empreendimento),
      numero_apartamento: String(numero_apartamento),
      andar: String(andar),
      usuario: String(usuario || ''),
      venda_data: String(data || ''),
    }
  };

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      data: mensagem.data // Data-only message
    });
    res.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      results: response.responses // Details for each send
    });
  } catch (err) {
    console.error('Error sending push notification:', err, err.stack, JSON.stringify(err, null, 2));
    res.status(500).json({ error: 'Error sending push notification', detail: err.message });
  }
};
