import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Gemini 1.5 Flash
const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Токены из настроек Vercel для уведомлений вам в ЛС
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

// Функция для гарантированной отправки контактов клиента вам в ЛС
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
  // Так как это только Telegram, CORS настройки не нужны. Просто отвечаем на OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.body || {};
    
    // Проверяем, что запрос пришел именно от Telegram
    if (!body.message || !body.message.chat) {
      return res.status(200).send("OK");
    }

    const tgChatId = body.message.chat.id;
    let userText = body.message.text ? String(body.message.text).trim() : "";

    // Если пользователь прислал не текст (например, локацию или фото)
    if (!userText) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: "🚗 Рад приветствовать вас! Пожалуйста, напишите ваш вопрос или пожелания по автомобилю текстом."
      });
    }

    // Если клиент только запустил бота
    if (userText === '/start') {
      userText = "Привет! Какие машины у вас есть в аренду и какие условия?";
    }

    // Регулярное выражение для поиска номера телефона
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 7 && /^\+?\d+$/.test(cleanPhone)) {
            // Отправляем заявку вам в личные сообщения Telegram
            await notifyAdmin(`🚗 Новая заявка на АРЕНДУ АВТО!\n📞 Телефон клиента: ${cleanPhone}\n💬 Сообщение: "${userText}"`);
        }
    }

    // Системная инструкция для ИИ (Промпт Менеджера по автопрокату)
    const systemPrompt = `Ты — дружелюбный и профессиональный менеджер по аренде автомобилей.
    Твоя цель — помочь клиенту выбрать машину и взять у него номер телефона для связи в WhatsApp, чтобы менеджер завершил оформление.
    Отвечай вежливо, кратко, используй автомобильную тематику (например: "Поехали!", "Комфортных дорог!").
    Не называй точных цен, говори: "Цена зависит от автомобиля и срока аренды, у нас очень гибкие условия. Оставьте телефон, мы пришлем прайс в WhatsApp".
    Язык ответа должен строго совпадать с языком пользователя (русский, английский или турецкий).
    Если пользователь прислал номер телефона, тепло поблагодари его и напиши, что свяжешься с ним в WhatsApp в течение нескольких минут.`;

    // Запрос к нейросети Gemini
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "🚗 Менеджер на связи! Повторите, пожалуйста, ваш запрос.";

    // Гарантированный ответ обратно в чат клиенту
    return res.status(200).json({
      method: "sendMessage",
      chat_id: tgChatId,
      text: replyText
    });

  } catch (error) {
    console.error("Ошибка авто-бота:", error);
    // Защита от падения: если что-то пошло не так, бот вежливо ответит, а не замолчит
    if (req.body?.message?.chat?.id) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: req.body.message.chat.id,
        text: "Извините, связь с сервером немного барахлит. Пожалуйста, попробуйте написать еще раз или свяжитесь с нами напрямую!"
      });
    }
    return res.status(200).send("OK");
  }
}
