import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

async function notifyAdmin(text) {
  if (!TELEGRAM_TOKEN || !MY_TELEGRAM_ID) {
    console.error("Переменные окружения не настроены в Vercel!");
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: MY_TELEGRAM_ID, text: text })
    });
    const resData = await response.json();
    if (!resData.ok) {
      console.error("Ошибка Telegram API при отправке админу:", resData.description);
    }
  } catch (e) {
    console.error("Сбой сети при отправке админу:", e);
  }
}

export default async function handler(req, res) {
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

    // Улучшенный поиск номеров телефонов (ищет любые цепочки от 7 до 15 цифр)
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        // Если это длинная последовательность цифр (номер телефона)
        if (cleanPhone.length >= 7 && /^\+?\d+$/.test(cleanPhone)) {
            const source = isTelegram ? "через Telegram-бота" : "с виджета на сайте";
            await notifyAdmin(`🎣 Новая заявка ${source}!\n📞 Телефон клиента: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо. Твоя цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя.
    Если пользователь уже прислал номер телефона, вежливо поблагодари его и скажи, что свяжешься в ближайшее время в WhatsApp.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text();

    if (isTelegram) {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: tgChatId,
        text: replyText
      });
    } else {
      return res.status(200).json({ reply: replyText });
    }

  } catch (error) {
    console.error("Критическая ошибка:", error);
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" });
  }
}
