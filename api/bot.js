import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini 2.5 Flash (проверенная рабочая модель)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Ваши переменные из Vercel
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID; 

// Функция для тихой отправки уведомлений вам в ЛС
async function notifyAdmin(text) {
  if (!TELEGRAM_TOKEN || !MY_TELEGRAM_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: MY_TELEGRAM_ID, text: text })
    });
  } catch (e) {
    console.error("Ошибка уведомления админа:", e);
  }
}

export default async function handler(req, res) {
  // Настройка CORS для сайта
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).send('Bot is active');

  try {
    const body = req.body || {};
    
    let userText = "";
    let isTelegram = false;
    let tgChatId = null;

    // Проверяем, откуда пришел запрос
    if (body.text) {
      // С виджета на сайте
      userText = body.text;
    } else if (body.message && body.message.text) {
      // Из Telegram-бота
      userText = body.message.text;
      isTelegram = true;
      tgChatId = body.message.chat.id;
    } else if (typeof body === 'string') {
      userText = body;
    }

    if (!userText) return res.status(200).send("OK");

    // Поиск номера телефона в тексте
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 10) {
            const source = isTelegram ? "через Telegram-бота" : "с виджета на сайте";
            await notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон клиента: ${cleanPhone}\n💬 Сообщение: "${userText}"`);
        }
    }

    // Системный промпт Капитана
    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо. Твоя цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя (русский, английский или турецкий).
    Если пользователь уже прислал номер телефона, вежливо поблагодари его и скажи, что свяжешься в ближайшее время в WhatsApp.`;

    // Запрос к нейросети
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text();

    // ОТВЕЧАЕМ НАПРЯМУЮ ЧЕРЕЗ FETCH (Это исправит ошибку на сайте!)
    if (isTelegram) {
      // Вместо "method: sendMessage" отправляем прямой запрос в Телеграм
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChatId, text: replyText })
      });
      return res.status(200).send("OK");
    } else {
      // Обычный чистый ответ для сайта
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Ошибка:", error);
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" });
  }
}
