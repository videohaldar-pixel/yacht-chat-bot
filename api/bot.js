import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini 1.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Универсальный перехват токена (поддерживает оба варианта из Vercel)
const TG_TOKEN = (process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim(); 
const MY_TELEGRAM_ID = (process.env.MY_TELEGRAM_ID || "").trim(); 

// Безопасная функция уведомления админа
async function notifyAdmin(text) {
  if (!TG_TOKEN || !MY_TELEGRAM_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(MY_TELEGRAM_ID), text: text })
    });
  } catch (e) {
    console.error("Ошибка отправки админу:", e);
  }
}

export default async function handler(req, res) {
  // Настройка CORS заголовков для сайта
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.body || {};
    let userText = "";
    let isTelegram = false;
    let tgChatId = null;

    // Определяем источник сообщения
    if (body.text) {
      userText = body.text;
    } else if (body.message && body.message.text) {
      userText = body.message.text;
      isTelegram = true;
      tgChatId = body.message.chat.id;
    } else if (typeof body === 'string') {
      userText = body;
    }

    if (!userText) return res.status(200).send("OK");

    // Обработка старта в ТГ
    if (userText === '/start') {
      userText = "Привет! Расскажи про туры и рыбалку на яхте Grey?";
    }

    // Регулярное выражение для поиска телефона
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    let cleanPhone = null;
    
    if (foundPhone) {
        const potentialPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (potentialPhone.length >= 7 && /^\+?\d+$/.test(potentialPhone)) {
            cleanPhone = potentialPhone;
        }
    }

    // Системная инструкция для Капитана
    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо, используй морскую тематику. Твоя главная цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя.
    Если пользователь нажал кнопку "🗺️ Маршруты и туры", опиши рыбалку в открытом море.
    Если пользователь нажал "🛥️ О яхте Grey", опиши её комфорт и надежность.
    Если пользователь прислал номер телефона, вежливо поблагодари его и скажи, что свяжешься в ближайшее время в WhatsApp.`;

    // Запрос к Gemini 1.5 Flash
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "Капитан на связи!";

    // Если был найден телефон, отправляем уведомление админу БЕЗ await (в фоновом режиме)
    if (cleanPhone) {
      const source = isTelegram ? "через Telegram-бота" : "с виджета на сайте";
      notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон клиента: ${cleanPhone}\n💬 Текст: "${userText}"`);
    }

    // Отправляем ответ пользователю
    if (isTelegram) {
      const keyboard = {
        keyboard: [
          [{ text: "🗺️ Маршруты и туры" }, { text: "🛥️ О яхте Grey" }],
          [{ text: "📞 Оставить контакты" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };

      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: replyText,
        reply_markup: JSON.stringify(keyboard)
      });
    } else {
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Критическая ошибка скрипта:", error);
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" });
  }
}
