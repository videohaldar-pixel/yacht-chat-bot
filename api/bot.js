import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export default async function handler(req, res) {
  // Настройка CORS для работы с вашим сайтом
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).send('Bot is active');

  try {
    const body = req.body || {};
    // УНИВЕРСАЛЬНЫЙ ПОИСК ТЕКСТА (и для сайта, и для Telegram)
    const userText = body.text || (body.message ? body.message.text : null) || "";

    if (!userText) {
      return res.status(200).json({ reply: "Капитан на связи! Но я не получил текст сообщения." });
    }

    // ИНСТРУКЦИЯ КАПИТАНА
    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо. Твоя цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, отвечай "Цена договорная". 
    Язык ответа должен совпадать с языком пользователя (русский, английский или турецкий).`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nГость: ${userText}` }] }]
    });

    const replyText = result.response.text();

    // Возвращаем ответ в формате JSON, который ждет ваш сайт
    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Критическая ошибка:", error);
    // Возвращаем понятный ответ, чтобы сайт не показывал ошибку
    return res.status(200).json({ reply: "Извините, шторм помешал связи. Повторите запрос!" });
  }
}
