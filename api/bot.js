import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.body || {};
    
    // 1. ОПРЕДЕЛЯЕМ ИСТОЧНИК (САЙТ ИЛИ ТЕЛЕГРАМ)
    let userText = "";
    let isTelegram = false;

    if (body.text) {
      userText = body.text; // Запрос с сайта
    } else if (body.message && body.message.text) {
      userText = body.message.text; // Запрос из Telegram
      isTelegram = true;
    }

    if (!userText) return res.status(200).send("OK");

    // 2. ИНСТРУКЦИЯ
    const systemPrompt = `Ты — Капитан моторной яхты «Grey». 
    Отвечай кратко, вежливо. Твоя цель — получить номер телефона для WhatsApp. 
    Не называй цены, пиши "Цена договорная".`;

    // 3. ОТВЕТ
    const result = await model.generateContent(`${systemPrompt}\n\nПользователь: ${userText}`);
    const replyText = result.response.text();

    // 4. ВОЗВРАТ ВЕРНОГО ФОРМАТА
    if (isTelegram) {
      // Для Telegram нужно вернуть JSON, который Телеграм поймет как ответ
      return res.status(200).json({
        method: "sendMessage",
        chat_id: body.message.chat.id,
        text: replyText
      });
    } else {
      // Для сайта
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    return res.status(200).json({ reply: "Ошибка связи, попробуйте снова." });
  }
}
