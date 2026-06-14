import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Переменные для отправки уведомлений вам в личный Telegram (настраиваются в Vercel)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID; 

// Функция, которая тихо отправляет сообщение лично вам в Telegram
async function notifyAdmin(text) {
  if (!TELEGRAM_TOKEN || !MY_TELEGRAM_ID) {
    console.log("Уведомление не отправлено: не настроены токены администратора.");
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: MY_TELEGRAM_ID, text: text })
    });
  } catch (e) {
    console.error("Ошибка при отправке админу:", e);
  }
}

export default async function handler(req, res) {
  // Настройка CORS для работы с вашим основным сайтом и поддоменами
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).send('Bot is active');

  try {
    const body = req.body || {};
    
    // 1. ОПРЕДЕЛЯЕМ ОТКУДА ПРИШЕЛ ЗАПРОС И ИЗВЛЕКАЕМ ТЕКСТ
    let userText = "";
    let isTelegram = false;
    let tgChatId = null;

    if (body.text) {
      // Запрос пришел с сайта (в формате { text: "..." })
      userText = body.text;
    } else if (body.message && body.message.text) {
      // Запрос пришел от Telegram Webhook
      userText = body.message.text;
      isTelegram = true;
      tgChatId = body.message.chat.id;
    } else if (typeof body === 'string') {
      userText = body;
    }

    // Если текста нет вообще, просто закрываем запрос безопасности ради
    if (!userText) return res.status(200).send("OK");

    // 2. ПРОВЕРКА НА НАЛИЧИЕ НОМЕРА ТЕЛЕФОНА (РЕГЕНТ-ФУНКЦИЯ)
    // Ищет последовательность от 10 до 15 цифр, возможно с плюсом
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        // Очищаем найденный телефон от лишних пробелов или дефисов для красоты
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 10) {
            // Отправляем уведомление лично вам!
            const source = isTelegram ? "через Telegram-бота" : "с виджета на сайте";
            await notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон клиента: ${cleanPhone}\n💬 Сообщение: "${userText}"`);
        }
    }

    // 3. СИСТЕМНЫЙ ПРОМПТ ДЛЯ ИИ КАПИТАНА
    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо. Твоя цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя (русский, английский или турецкий).
    Если пользователь уже прислал номер телефона, вежливо поблагодари его и скажи, что свяжешься в ближайшее время в WhatsApp.`;

    // 4. ГЕНЕРАЦИЯ ОТВЕТА С ПОМОЩЬЮ GEMINI
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text();

    // 5. ФОРМИРОВАНИЕ ОТВЕТА В ЗАВИСИМОСТИ ОТ ОТПРАВИТЕЛЯ
    if (isTelegram) {
      // Если писал пользователь в Телеграм-бот, отдаем JSON-ответ для Телеграма
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: replyText
      });
    } else {
      // Если писал пользователь на сайте, отдаем стандартный JSON, который ждет fetch-скрипт сайта
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Критическая ошибка:", error);
    // Мягкий ответ в случае шторма/ошибок, чтобы интерфейс не зависал в режиме "Думает"
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" });
  }
}
