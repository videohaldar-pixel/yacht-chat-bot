import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini
const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

async function notifyAdmin(text) {
  if (!TELEGRAM_TOKEN || !MY_TELEGRAM_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(MY_TELEGRAM_ID), text: text })
    });
  } catch (e) {
    console.error("Ошибка уведомления админа:", e);
  }
}

export default async function handler(req, res) {
  // Этот файл больше НЕ обслуживает сайт, возвращаем статус 200 для ТГ
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  try {
    const body = req.body || {};
    
    // Если запрос пришел не от Telegram, а с сайта, мягко отправляем его на правильный путь
    if (!body.message || !body.message.chat) {
      return res.status(200).json({ reply: "Пожалуйста, используйте эндпоинт /api/site для сайта." });
    }

    const tgChatId = body.message.chat.id;
    let userText = body.message.text ? String(body.message.text).trim() : "";

    if (!userText) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: "⚓️ Жду вашего текстового сообщения, друг!"
      });
    }

    if (userText === '/start') {
      userText = "Привет! Расскажи про рыбалку на яхте Grey?";
    }

    // Поиск телефона
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 7) {
            await notifyAdmin(`🎣 Новая заявка из Telegram-бота!\n📞 Телефон: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо, используй морскую тематику. Твоя главная цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя.`;

    // Запрос к Gemini
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
    console.error("Ошибка Telegram бота:", error);
    if (req.body?.message?.chat?.id) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: req.body.message.chat.id,
        text: "Извините, шторм глушит связь с ИИ. Попробуйте написать еще раз!"
      });
    }
    return res.status(200).send("OK");
  }
}
