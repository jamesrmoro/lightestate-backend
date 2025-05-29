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

  // Consulta todos os apartamentos vendidos
  const { data, error } = await supabase
    .from('vendas')
    .select('numero_apartamento');

  if (error) return res.status(500).json({ error: 'Erro Supabase', detail: error });

  // Cria lista de LEDs (apartamentos vendidos)
  const leds = (data || []).map(v => Number(v.numero_apartamento)).filter(Boolean);

  return res.status(200).json({ leds });
}
