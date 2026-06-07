import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: "ready", 
      message: "Новый бэкенд успешно запущен!" 
    });
  }
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Пусто' });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message
    });

    return res.status(200).json({ reply: response.text });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
