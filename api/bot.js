import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

async function notifyAdmin(cleanPhone, originalText) {
  if (!TELEGRAM_TOKEN || !MY_TELEGRAM_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: Number(MY_TELEGRAM_ID), 
        text: `🎣 Новая заявка из Telegram-бота!\n📞 Телефон: ${cleanPhone}\n💬 Сообщение: "${originalText}"` 
      })
    });
  } catch (e) {
    console.error("Ошибка уведомления:", e);
  }
}

export default async function handler(req, res) {
  // Для Телеграма никакой CORS не нужен, сразу работаем с боди
  try {
    const body = req.body || {};
    
    // Если это не сообщение из телеги, просто гасим запрос
    if (!body.message || !body.message.chat) {
      return res.status(200).send("OK");
    }

    const tgChatId = body.message.chat.id;
    let userText = body.message.text || "";

    if (!userText.trim()) {
      return res.status(200).send("OK");
    }

    if (userText === '/start') {
      userText = "Привет! Расскажи про рыбалку на яхте Grey?";
    }

    // Проверка телефона
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    if (foundPhone) {
      const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
      if (cleanPhone.length >= 7) {
        await notifyAdmin(cleanPhone, userText);
      }
    }

    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо, используй морскую тематику. Твоя главная цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя (русский, английский или турецкий).
    Если пользователь прислал номер телефона, вежливо поблагодари его и скажи, что свяжешься в ближайшее время в WhatsApp.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "Капитан на связи!";

    // Строгий формат Webhook-ответа для Телеграм
    return res.status(200).json({
      method: "sendMessage",
      chat_id: tgChatId,
      text: replyText
    });

  } catch (error) {
    console.error("Ошибка бота:", error);
    return res.status(200).send("OK");
  }
}
