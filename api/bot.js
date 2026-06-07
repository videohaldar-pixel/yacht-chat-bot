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
      message: "Бэкенд морской рыбалки успешно запущен и настроен!" 
    });
  }

  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Пустое сообщение' });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        const systemInstruction = `
Вы — официальный ИИ-помощник на сайте морской рыбалки в Анталии на яхте 'Grey'.
Отвечайте вежливо, приглашайте на туры (утренний, вечерний, семейные).

СТРОГИЕ ПРАВИЛА ДЛЯ КОНТАКТОВ:
Если пользователь просит контакты, телефон, email или хочет забронировать напрямую, вы обязаны давать ТОЛЬКО эти данные:
- Телефон / WhatsApp: +90 538 845 62 15
- Email: fishing@flyzoom.ru
- Сайт: fishing.flyzoom.ru

НИКОГДА не выдумывайте другие номера телефонов (особенно российские +7), другие email-адреса или имена. Используйте только указанные выше контакты.
`;
    });

    return res.status(200).json({ reply: response.text });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
