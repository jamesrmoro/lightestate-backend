// /api/webhook.js

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Only POST allowed' });
  }
  // Só para logar e conferir se está recebendo!
  console.log('Recebido do Postmark:', req.body);

  // Responde rápido para o Postmark não dar timeout
  res.status(200).json({ ok: true, received: req.body });
}
