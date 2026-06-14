import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini 2.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

// Функция уведомления админа
async function notifyAdmin(text) {
  if (!TELEGRAM_TOKEN || !MY_TELEGRAM_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(MY_TELEGRAM_ID), text: text })
    });
  } catch (e) {
    console.error("Ошибка уведомления:", e);
  }
}

export default async function handler(req, res) {
  // CORS заголовки для сайта
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.body || {};
    let userText = "";
    let isTelegram = false;
    let tgChatId = null;

    // ЖЕСТКАЯ ПРОВЕРКА ОТКУДА ПРИШЕЛ ЗАПРОС
    if (body.message && body.message.chat) {
      // Это 100% Telegram
      userText = body.message.text || "";
      isTelegram = true;
      tgChatId = body.message.chat.id;
    } else if (body.text) {
      // Это 100% ваш сайт
      userText = body.text;
    } else if (typeof body === 'string') {
      // На всякий случай для текстовых запросов
      userText = body;
    }

    if (!userText) return res.status(200).json({ reply: "Капитан на связи!" });

    if (userText === '/start') {
      userText = "Привет! Расскажи про рыбалку на яхте Grey?";
    }

    // Проверка телефона
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 10) {
            const source = isTelegram ? "через Telegram-бота" : "с виджета на сайте";
            // Отправляем тихо, не задерживая ответ пользователю
            notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    // Промпт для Gemini
    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо. Твоя цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "Капитан на связи!";

    // РАЗДЕЛЯЕМ ОТВЕТЫ НА 2 ИЗОЛИРОВАННЫХ МИРА
    if (isTelegram) {
      // ОТВЕТ ДЛЯ ТЕЛЕГРАМА
      if (tgChatId && TELEGRAM_TOKEN) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgChatId, text: replyText })
        });
      }
      return res.status(200).send("OK");
    } else {
      // ОТВЕТ ДЛЯ САЙТА (Чистый JSON, без примесей телеграма)
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Ошибка:", error);
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" });
  }
}
