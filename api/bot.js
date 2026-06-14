import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Telegram Bot Active');

  try {
    const body = req.body || {};
    
    // Если это не сообщение из ТГ, просто выходим
    if (!body.message || !body.message.chat) return res.status(200).send('OK');

    let userText = body.message.text || "";
    const tgChatId = body.message.chat.id;

    if (userText === '/start') {
      userText = "Привет! Расскажи про рыбалку на яхте Grey?";
    }

    const systemPrompt = `Ты — Капитан моторной яхты «Grey». Отвечай кратко и вежливо. 
    Твоя цель — получить номер телефона для WhatsApp. Цены не называй, говори "Цена договорная".`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "Капитан на связи!";

    // Прямой мгновенный ответ в Телеграм
    return res.status(200).json({
      method: "sendMessage",
      chat_id: tgChatId,
      text: replyText
    });

  } catch (error) {
    console.error("Ошибка ТГ:", error);
    return res.status(200).send('OK');
  }
}
