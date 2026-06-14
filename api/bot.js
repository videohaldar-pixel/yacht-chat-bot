import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini 1.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Токены из Vercel для уведомлений вам в ЛС
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

// Функция для тихой отправки уведомлений в ваш Telegram
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
  // ЖЕЛЕЗНЫЕ НАСТРОЙКИ CORS ДЛЯ САЙТА (РЕШАЮТ ОШИБКУ ИЗ КОНСОЛИ)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // Кэширование предзапроса на 24 часа

  // Если браузер делает предварительную проверку (OPTIONS), сразу отвечаем 200 OK
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.body || {};
    let userText = "";
    let isTelegram = false;
    let tgChatId = null;

    // Четкое разделение: кто к нам стучится?
    if (body.message && body.message.chat) {
      // Это запрос от Телеграм-бота
      userText = body.message.text || "";
      isTelegram = true;
      tgChatId = body.message.chat.id;
    } else if (body.text) {
      // Это запрос с виджета на сайте
      userText = body.text;
    } else if (typeof body === 'string') {
      userText = body;
    }

    // Если запрос пустой
    if (!userText) {
      return res.status(200).json({ reply: "Капитан на связи! Чем могу помочь?" });
    }

    // Обработка команды /start для ТГ
    if (userText === '/start') {
      userText = "Привет! Расскажи про рыбалку на яхте Grey?";
    }

    // Поиск номера телефона в тексте
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 7 && /^\+?\d+$/.test(cleanPhone)) {
            const source = isTelegram ? "через Telegram-бота" : "с виджета на сайте";
            // Отправляем уведомление вам в ЛС (без await, чтобы не тормозить скрипт)
            notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон клиента: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    // Системный промпт Капитана для ИИ
    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо, используй морскую тематику. Твоя главная цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя (русский, английский или турецкий).
    Если пользователь прислал номер телефона, вежливо поблагодари его и скажи, что свяжешься в ближайшее время в WhatsApp.`;

    // Запрос к нейросети Gemini
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "Капитан на связи!";

    // ОТПРАВЛЯЕМ ОТВЕТ В ЗАВИСИМОСТИ ОТ ИСТОЧНИКА
    if (isTelegram) {
      // Ответ для Телеграма (Webhook Reply)
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: replyText
      });
    } else {
      // Идеальный JSON ответ для сайта, который больше не заблокирует CORS
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Критическая ошибка:", error);
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" });
  }
}
