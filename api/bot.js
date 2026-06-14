import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export default async function handler(req, res) {
  // Для Telegram CORS не нужен, отдаем пустой OK на OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.body || {};
    
    // Если запрос не от Telegram — сбрасываем
    if (!body.message || !body.message.chat) {
      return res.status(200).send("OK");
    }

    const tgChatId = body.message.chat.id;
    let userText = body.message.text ? String(body.message.text).trim() : "";

    if (!userText) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: "⚓️ Капитан у штурвала! Напишите ваш вопрос текстом, пожалуйста."
      });
    }

    if (userText === '/start') {
      userText = "Привет! Расскажи про рыбалку на яхте Grey?";
    }

    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо, используй морскую тематику. Твоя главная цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя (русский, английский или турецкий).`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "Капитан на связи!";

    return res.status(200).json({
      method: "sendMessage",
      chat_id: tgChatId,
      text: replyText
    });

  } catch (error) {
    console.error("Ошибка бота:", error);
    if (req.body?.message?.chat?.id) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: req.body.message.chat.id,
        text: "Извините, шторм немного глушит связь. Повторите ваш вопрос чуть позже!"
      });
    }
    return res.status(200).send("OK");
  }
}
