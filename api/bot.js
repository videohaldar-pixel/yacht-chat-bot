import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini 2.5 Flash
const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Переменные окружения для уведомлений вам в ЛС
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

// Функция отправки уведомлений о телефонах вам в ЛС
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
  // Разрешаем CORS для сайта, чтобы не было блокировок в браузере
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.body;
    let userText = "";
    let isTelegram = false;
    let tgChatId = null;

    // ЖЕСТКАЯ ПРОВЕРКА ФОРМАТА ВХОДЯЩИХ ДАННЫХ
    if (body && typeof body === 'object' && body.message && body.message.chat) {
      // Это 100% запрос от Telegram-бота
      isTelegram = true;
      tgChatId = body.message.chat.id;
      userText = body.message.text ? String(body.message.text).trim() : "";
    } else if (body) {
      // Это запрос с сайта (приходит либо как строка, либо в объекте body.text)
      if (typeof body === 'string') {
        userText = body.trim();
      } else if (body.text) {
        userText = String(body.text).trim();
      } else {
        // Если прислали объект, но поле text пустой, пробуем прочесть весь JSON
        userText = JSON.stringify(body);
      }
    }

    // Если текст всё равно пустой, аккуратно закрываем запрос
    if (!userText || userText === '{}') {
      if (isTelegram) return res.status(200).send("OK");
      return res.status(200).json({ reply: "Капитан на связи! Напишите ваш вопрос в чат." });
    }

    // Обработка команды старта в Telegram
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
            await notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон клиента: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    // Инструкция Капитана для Gemini
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

    // ОТПРАВЛЯЕМ ОТВЕТ В ЗАВИСИМОСТИ ОТ ТОГО, КТО СПРОСИЛ
    if (isTelegram) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: replyText
      });
    } else {
      // Возвращаем чистый JSON объект для скрипта на вашем сайте
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Ошибка обработчика:", error);
    
    // Запасной план, чтобы пользователи не видели ошибку сервера
    const isTelegramFallback = !!(req.body && req.body.message && req.body.message.chat);
    if (isTelegramFallback) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: req.body.message.chat.id,
        text: "Извините, шторм глушит связь с ИИ. Попробуйте повторить ваш вопрос чуть позже!"
      });
    }
    
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" });
  }
}
