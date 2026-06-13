import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

// Инициализируем Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
// Используем стабильную модель 1.5 Flash
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Бот Капитана яхты Grey работает!');
  }

  try {
    const { message } = req.body;

    if (!message || !message.text) {
      return res.status(200).send('No text message');
    }

    // ИГНОРИРУЕМ СТАРЫЕ СООБЩЕНИЯ (Защита от перегруза при перезапуске)
    // Если сообщению больше 2 минут (120 секунд), бот просто пропустит его, а не будет спамить в API
    const messageAge = Math.floor(Date.now() / 1000) - message.date;
    if (messageAge > 120) {
      console.log(`Пропущено устаревшее сообщение от чата ${message.chat.id}`);
      return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // Если пользователь нажал /start
    if (userText === '/start') {
      const welcomeMessage = "Приветствую на борту моторной яхты «Grey»! 🎣⚓\nЯ — Капитан вашего рыболовного тура в Кемере. Готовы выйти в открытое море за отличным уловом? Расскажите, вы один планируете или большой компанией?";
      await sendTelegram(chatId, welcomeMessage);
      return res.status(200).send('OK');
    }

    // Жесткая инструкция Капитана для Gemini
    const captainInstruction = `
      Ты — Капитан нашей моторной яхты «Grey» в Кемере (fishing.flyzoom.ru). 
      Отвечай гостю вежливо, кратко, в морском гостеприимном стиле.

      ПРАВИЛА:
      1. Отвечай СТРОГО по нашей программе: выходим из порта Кемер Марина в открытое Средиземное море. Ловим дораду, сибаса, тунца, ставриду.
      2. В туре ВКЛЮЧЕНО: трансфер из отеля и обратно, удочки, снасти, эхолот, а также завтрак и ОБЕД НА БОРТУ (жарим пойманную рыбу на гриле!). Бот подходит для всей семьи.
      3. ЗАПРЕЩЕНО называть цены в цифрах. Если спросят про стоимость — отвечай: "Для уточнения стоимости на ваши даты с вами свяжется менеджер в WhatsApp. Оставьте, пожалуйста, ваш номер телефона или ник?"
      4. ЗАПРЕЩЕНО выдумывать рыбалку с берега, другие страны (Испанию, Волгу) и запрещено посылать человека искать инфу на сайт. Твоя цель — взять телефон для WhatsApp.

      Вопрос от гостя: "${userText}"
    `;

    try {
      // Отправляем запрос в Gemini
      const aiResponse = await model.generateContent(captainInstruction);
      const botReply = aiResponse.response.text() || "Штиль на связи... Повторите вопрос, пожалуйста.";
      await sendTelegram(chatId, botReply);
    } catch (aiError) {
      // Выводим РЕАЛЬНУЮ ошибку в логи Vercel, чтобы мы знали её точную причину
      console.error('КРИТИЧЕСКАЯ ОШИБКА GEMINI API:', aiError);
      
      await sendTelegram(chatId, "⏳ Извините, море слегка штормит (лимит запросов). Пожалуйста, подождите пару секунд и повторите вопрос Капитану!");
    }

    return res.status(200).send('OK');

  } catch (error) {
    console.error('Общая ошибка сервера:', error);
    return res.status(500).send('Internal Error');
  }
}

// Функция отправки сообщений в Telegram
async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_TOKEN || "8618014725:AAEM0d-T_sKi6nndj1f78DQb46Ts-WajUKk";
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}
