import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim() || process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

async function notifyAdmin(text) {
  if (!TELEGRAM_TOKEN || !MY_TELEGRAM_ID) return;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(MY_TELEGRAM_ID), text: text })
    });
  } catch (e) {
    console.error("Ошибка отправки уведомления админу:", e);
  }
}

export default async function handler(req, res) {
  // Настройка CORS для сайта
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.body || {};
    let userText = "";
    let isTelegram = false;
    let tgChatId = null;

    // Четкое определение источника сообщения
    if (body.text) {
      userText = body.text;
    } else if (body.message && body.message.text) {
      userText = body.message.text;
      isTelegram = true;
      tgChatId = body.message.chat.id;
    } else if (typeof body === 'string') {
      userText = body;
    }

    if (!userText) return res.status(200).json({ reply: "Капитан на связи! Жду вашего сообщения." });

    // Если человек только зашел в ТГ бота
    if (userText === '/start') {
      userText = "Привет! Расскажи про ваши морские прогулки и рыбалку на яхте Grey?";
    }

    // Поиск номера телефона
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 7 && /^\+?\d+$/.test(cleanPhone)) {
            const source = isTelegram ? "через Telegram-бота" : "с виджета на сайте";
            await notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон клиента: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    // Инструкция для ИИ
    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо, используй морские фразы. Твоя главная цель — получить номер телефона для WhatsApp. 
    Не называй точные цены, всегда говори "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя.
    Если пользователь нажал кнопку "🗺️ Маршруты и туры", предложи лучшую рыбалку в открытом море и прогулки.
    Если нажал "🛥️ О яхте Grey", опиши её комфорт и надежность.
    Если прислали телефон, подтверди, что скоро свяжешься в WhatsApp.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "Капитан на связи!";

    if (isTelegram) {
      // Кнопки для Telegram (упаковываем структуру строго по правилам API)
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
        reply_markup: JSON.stringify(keyboard) // Жестко переводим в строку, чтобы ТГ не ругался
      });
    } else {
      // Ответ для виджета на сайте
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Критическая ошибка:", error);
    // Если на сайте штормит, отдаем мягкий ответ
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" });
  }
}
