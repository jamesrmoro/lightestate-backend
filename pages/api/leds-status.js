// pages/api/leds-status.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Recebe o ID do empreendimento via querystring
  const empreendimento_id = req.query.empreendimento_id;
  if (!empreendimento_id) {
    return res.status(400).json({ error: 'Informe empreendimento_id na querystring.' });
  }

  // Busca o empreendimento e sua config.base
  const { data: empData, error: empError } = await supabase
    .from('empreendimentos')
    .select('id, config')
    .eq('id', empreendimento_id)
    .single();

  if (empError || !empData) {
    return res.status(404).json({ error: 'Empreendimento não encontrado.' });
  }

  const config = typeof empData.config === "string"
    ? JSON.parse(empData.config)
    : empData.config;
  const base = Number(config.base) || 1;
  const total = Number(config.total) || 49; // Use o total definido no empreendimento/config

  // Busca todas as vendas deste empreendimento
  const { data: vendas, error: vendasError } = await supabase
    .from('vendas')
    .select('numero_apartamento')
    .eq('empreendimento_id', empreendimento_id);

  if (vendasError) {
    return res.status(500).json({ error: 'Erro ao buscar vendas.', detail: vendasError });
  }

  // Converte para índices relativos
  // Só aceita apartamentos no range do total de LEDs
  const leds = (vendas || [])
    .map(v => Number(v.numero_apartamento))
    .map(apto => {
      const andar = Math.floor(apto / 100);
      const coluna = apto % 100;
      const index = (andar - 1) * 7 + coluna; // LED 1–49
      return index;
    })
    .filter(idx => idx >= 1 && idx <= total);

  // Ex: { "leds": [1,3,5] }
  return res.status(200).json({ leds });
}
