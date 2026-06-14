import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

// Функция уведомления админа ТЕПЕРЬ СТРОГО С ДОСТАВКОЙ
async function notifyAdmin(text) {
  if (!TELEGRAM_TOKEN || !MY_TELEGRAM_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(MY_TELEGRAM_ID), text: text })
    });
    console.log("Уведомление админу успешно отправлено");
  } catch (e) {
    console.error("Ошибка уведомления админа:", e);
  }
}

export default async function handler(req, res) {
  // Настройка CORS заголовков БЕЗ исключений (для стабильности сайта)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  // Если браузер проверяет соединение (OPTIONS), мгновенно закрываем его
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.body || {};
    
    // Проверяем, кто шлет запрос
    const isTelegram = !!(body.message && body.message.chat);

    let userText = "";
    let tgChatId = null;

    if (isTelegram) {
      userText = body.message.text || "";
      tgChatId = body.message.chat.id;
    } else if (body.text) {
      userText = body.text;
    } else if (typeof body === 'string') {
      userText = body;
    }

    // Если пустой текст
    if (!userText.trim()) {
      if (isTelegram) return res.status(200).send("OK");
      return res.status(200).json({ reply: "Капитан на связи! Жду штурманских указаний." });
    }

    // ТГ старт
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
            // ТЕПЕРЬ С АВАЙТОМ: Vercel не закроет скрипт, пока уведомление не уйдет вам!
            await notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон клиента: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    // Инструкция Капитана
    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо, используй морскую тематику. Твоя главная цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя (русский, английский или турецкий).
    Если пользователь прислал номер телефона, вежливо поблагодари его и скажи, что свяжешься в ближайшее время в WhatsApp.`;

    // Запрос к ИИ
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "Капитан на связи!";

    // ФИНАЛЬНЫЙ ОТВЕТ
    if (isTelegram) {
      // Для Telegram возвращаем sendMessage структурой в вебхук
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: replyText
      });
    } else {
      // Для сайта отдаем чистый, валидный JSON объект
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Критическая ошибка бэкенда:", error);
    
    // Запасной выход при ошибках
    const isTelegramFallback = !!(req.body && req.body.message && req.body.message.chat);
    if (isTelegramFallback) return res.status(200).send("OK");
    
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" });
  }
}
