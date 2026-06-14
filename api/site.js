import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini 2.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Токены из настроек Vercel
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

// Функция уведомления вас о найденных телефонах
async function notifyAdmin(text) {
  if (!TELEGRAM_TOKEN || !MY_TELEGRAM_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(MY_TELEGRAM_ID), text: text })
    });
  } catch (e) {
    console.error("Ошибка отправки админу:", e);
  }
}

export default async function handler(req, res) {
  // Разрешаем CORS на всякий случай, чтобы запросы не висли
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.body || {};
    
    // Проверяем, что запрос точно от Telegram
    if (!body.message || !body.message.chat) {
      // Если это сайт, просто отдаем ему базовый ответ (для совместимости)
      if (body.text) {
         return res.status(200).json({ reply: "Капитан на связи через сайт!" });
      }
      return res.status(200).send("OK");
    }

    const tgChatId = body.message.chat.id;
    let userText = body.message.text ? String(body.message.text).trim() : "";

    // Если текста нет (например, пользователь прислал стикер или локацию)
    if (!userText) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: "⚓️ Капитан видит ваше сообщение! Пожалуйста, напишите ваш вопрос текстом."
      });
    }

    // Обработка команды старта
    if (userText === '/start') {
      userText = "Привет! Расскажи про рыбалку на яхте Grey?";
    }

    // Регулярное выражение для поиска телефона
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 7 && /^\+?\d+$/.test(cleanPhone)) {
            // Обязательно дожидаемся отправки вам уведомления в ЛС
            await notifyAdmin(`🎣 Новая заявка из Telegram-бота!\n📞 Телефон клиента: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    // Инструкция Капитана для Gemini
    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо, используй морскую тематику. Твоя главная цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя (русский, английский или турецкий).
    Если пользователь прислал номер телефона, вежливо поблагодари его и скажи, что свяжешься в ближайшее время в WhatsApp.`;

    // Запрос к нейросети
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "Капитан на связи! Повторите, пожалуйста, вопрос, связь немного барахлит.";

    // Строгий и гарантированный ответ обратно в Telegram
    return res.status(200).json({
      method: "sendMessage",
      chat_id: tgChatId,
      text: replyText
    });

  } catch (error) {
    console.error("Ошибка выполнения:", error);
    // В случае падения пытаемся отправить пользователю хоть какой-то ответ, чтобы бот не «выглядел мертвым»
    try {
      if (req.body && req.body.message && req.body.message.chat) {
        return res.status(200).json({
          method: "sendMessage",
          chat_id: req.body.message.chat.id,
          text: "Извините, шторм немного глушит связь. Повторите ваш вопрос чуть позже или напишите нам в WhatsApp!"
        });
      }
    } catch (e) {}
    return res.status(200).send("OK");
  }
}
