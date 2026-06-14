import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini 2.5 Flash
const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Переменные окружения для ваших уведомлений
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

// Функция для отправки уведомлений о телефонах вам в ЛС
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
  // ПРАВИЛЬНЫЙ CORS ДЛЯ САЙТА: Браузер больше не заблокирует запрос
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  // Если это предварительный запрос браузера (OPTIONS) — мгновенно одобряем его
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.body || {};
    
    // Проверяем источник: у Telegram всегда есть объект message.chat
    const isTelegram = !!(body.message && body.message.chat);

    let userText = "";
    let tgChatId = null;

    if (isTelegram) {
      userText = body.message.text ? String(body.message.text).trim() : "";
      tgChatId = body.message.chat.id;
    } else if (body.text) {
      userText = String(body.text).trim();
    } else if (typeof body === 'string') {
      userText = body.trim();
    }

    // Если текст пустой
    if (!userText) {
      if (isTelegram) return res.status(200).send("OK");
      return res.status(200).json({ reply: "Капитан на связи! Чем могу помочь?" });
    }

    // Обработка команды /start для Telegram
    if (userText === '/start') {
      userText = "Привет! Расскажи про рыбалку на яхте Grey?";
    }

    // Поиск номера телефона
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 7 && /^\+?\d+$/.test(cleanPhone)) {
            const source = isTelegram ? "из Telegram-бота" : "с виджета на сайте";
            // Обязательно ждём (await), чтобы Vercel не закрыл скрипт раньше времени
            await notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    // Инструкция Капитана для Gemini
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

    // РАЗДЕЛЕНИЕ ОТВЕТОВ
    if (isTelegram) {
      // Прямой ответ в Телеграм (Webhook Reply)
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: replyText
      });
    } else {
      // Идеальный JSON для скрипта чата на вашем сайте
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Критическая ошибка:", error);
    
    // Если упала сама нейросеть (например, из-за лимитов или ключа)
    const isTelegramFallback = !!(req.body && req.body.message && req.body.message.chat);
    if (isTelegramFallback) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: req.body.message.chat.id,
        text: "Извините, шторм немного глушит связь с ИИ. Попробуйте еще раз или напишите нам в WhatsApp!"
      });
    }
    
    return res.status(200).json({ 
      reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" 
    });
  }
}
