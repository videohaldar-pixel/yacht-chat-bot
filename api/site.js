import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN?.trim(); 
const MY_TELEGRAM_ID = process.env.MY_TELEGRAM_ID?.trim(); 

async function notifyAdmin(text) {
  if (!TELEGRAM_TOKEN || !MY_TELEGRAM_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(MY_TELEGRAM_ID), text: text })
    });
  } catch (e) {
    console.error("Ошибка уведомления:", e);
  }
}

export default async function handler(req, res) {
  // Разрешаем сайту обращаться к этому файлу (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.body || {};
    const userText = body.text || (typeof body === 'string' ? body : "");

    if (!userText.trim()) {
      return res.status(200).json({ reply: "Капитан приветствует вас! Чем могу помочь?" });
    }

    // Проверка телефона в тексте с сайта
    const phoneRegex = /(\+?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d?[\s-]?\d?[\s-]?\d?[\s-]?\d?)/;
    const foundPhone = userText.match(phoneRegex);
    
    if (foundPhone) {
        const cleanPhone = foundPhone[0].replace(/[\s-]/g, '');
        if (cleanPhone.length >= 7) {
            await notifyAdmin(`🎣 Новая заявка С ВИДЖЕТА НА САЙТЕ!\n📞 Телефон клиента: ${cleanPhone}\n💬 Текст: "${userText}"`);
        }
    }

    const systemPrompt = `Ты — Капитан моторной яхты «Grey» (fishing.flyzoom.ru). 
    Отвечай кратко, вежливо, используй морскую тематику. Твоя главная цель — получить номер телефона для WhatsApp. 
    Не называй цены в цифрах, всегда отвечай "Цена договорная". 
    Язык ответа должен строго совпадать с языком пользователя (русский, английский или турецкий).`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nПользователь: ${userText}` }] }]
    });

    const replyText = result.response.text() || "Капитан у штурвала!";
    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Ошибка ИИ на сайте:", error);
    return res.status(200).json({ reply: "Извините, шторм немного глушит связь. Пожалуйста, напишите нам напрямую в WhatsApp!" });
  }
}
