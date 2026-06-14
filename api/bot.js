import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini 1.5 Flash
const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let rawBody = req.body;
    
    // БЕЗОПАСНЫЙ РАЗБОР СТРОКИ ИЗ ТЕКСТА В ОБЪЕКТ
    if (typeof rawBody === 'string') {
      try {
        rawBody = JSON.parse(rawBody);
      } catch (e) {
        // Если это не JSON, а просто текст с сайта — оставляем строкой
      }
    }

    let userText = "";
    let isTelegram = false;
    let tgChatId = null;

    // ОПРЕДЕЛЯЕМ ИСТОЧНИК ПО СТРУКТУРЕ ДАННЫХ
    if (rawBody && typeof rawBody === 'object' && rawBody.message && rawBody.message.chat) {
      isTelegram = true;
      tgChatId = rawBody.message.chat.id;
      userText = rawBody.message.text ? String(rawBody.message.text).trim() : "";
    } else if (rawBody) {
      if (typeof rawBody === 'string') {
        userText = rawBody.trim();
      } else if (rawBody.text) {
        userText = String(rawBody.text).trim();
      } else {
        userText = JSON.stringify(rawBody);
      }
    }

    // Если всё-таки пусто
    if (!userText || userText === '{}') {
      if (isTelegram) return res.status(200).send("OK");
      return res.status(200).json({ reply: "Капитан у штурвала! Напишите ваш вопрос." });
    }

    if (userText === '/start') {
      userText = "Привет! Расскажи про рыбалку на яхте Grey?";
    }

    // Ищем телефон
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 7 && /^\+?\d+$/.test(cleanPhone)) {
            const source = isTelegram ? "из Telegram-бота" : "с виджета на сайте";
            await notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон клиента: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо, используй морскую тематику. Твоя главная цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя (русский, английский или турецкий).
    Если пользователь прислал номер телефона, вежливо поблагодари его и скажи, что свяжешься в ближайшее время в WhatsApp.`;

    // Запрос к Gemini
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "Капитан на связи!";

    // ОТВЕТЫ СТРОГО ПО АДРЕСАТАМ
    if (isTelegram) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: replyText
      });
    } else {
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Критический шторм:", error);
    
    const isTelegramFallback = !!(req.body && typeof req.body === 'object' && req.body.message && req.body.message.chat);
    if (isTelegramFallback) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: req.body.message.chat.id,
        text: "Извините, шторм немного глушит связь. Попробуйте написать еще раз!"
      });
    }
    
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Напишите нам напрямую в WhatsApp!" });
  }
}
