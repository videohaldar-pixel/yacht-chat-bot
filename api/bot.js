import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini 2.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Токены из Vercel для уведомлений в ЛС
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

// Функция для отправки уведомлений о номерах телефонов вам в ЛС
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
  const body = req.body || {};
  
  // Определяем, кто пришел: Telegram-бот или Сайт
  const isTelegram = !!(body.message && body.message.chat);

  // Настраиваем CORS ТОЛЬКО если запрос пришел С САЙТА
  if (!isTelegram) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    
    // Если это предзапрос браузера (OPTIONS), сразу тушим его ответом 200
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  }

  try {
    let userText = "";
    let tgChatId = null;

    // Распределяем данные в зависимости от источника
    if (isTelegram) {
      userText = body.message.text || "";
      tgChatId = body.message.chat.id;
    } else if (body.text) {
      userText = body.text;
    } else if (typeof body === 'string') {
      userText = body;
    }

    // Если текст пустой
    if (!userText) {
      if (isTelegram) return res.status(200).send("OK");
      return res.status(200).json({ reply: "Капитан на связи!" });
    }

    // Обработка старта в ТГ
    if (userText === '/start') {
      userText = "Привет! Расскажи про рыбалку на яхте Grey?";
    }

    // Поиск номера телефона
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 7 && /^\+?\d+$/.test(cleanPhone)) {
            const source = isTelegram ? "через Telegram-бота" : "с виджета на сайте";
            // Отправляем уведомление вам в ЛС (без await, чтобы не подвешивать чат)
            notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон клиента: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    // Инструкция для ИИ Капитана
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

    // ОТПРАВКА ОТВЕТОВ ПО РАЗНЫМ КАНАЛАМ
    if (isTelegram) {
      // Для Телеграма отдаем прямой Webhook ответ
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: replyText
      });
    } else {
      // Для сайта отдаем чистый JSON, который ждет скрипт
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Ошибка в работе кода:", error);
    if (isTelegram) return res.status(200).send("OK");
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" });
  }
}
