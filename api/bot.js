import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

// Инициализируем API. Ключ берется из переменных Vercel
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.0-flash" });

export default async function handler(req, res) {
  // Бот отвечает только на POST-запросы от Telegram
  if (req.method !== 'POST') {
    return res.status(200).send('Бот Капитана яхты Grey активен!');
  }

  try {
    const { message } = req.body;

    if (!message || !message.text) {
      return res.status(200).send('No text message');
    }

    // ЗАЩИТА ОТ ПЕРЕГРУЗА: Игнорируем сообщения старше 2 минут
    const messageAge = Math.floor(Date.now() / 1000) - message.date;
    if (messageAge > 120) {
      console.log(`Пропущено старое сообщение от чата ${message.chat.id}`);
      return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // Команда перезапуска /start
    if (userText === '/start') {
      const welcomeMessage = "Приветствую на борту моторной яхты «Grey»! 🎣⚓\nЯ — Капитан вашего рыболовного тура в Кемере. Готовы выйти в открытое море за отличным уловом? Расскажите, вы один планируете или большой компанией?";
      await sendTelegram(chatId, welcomeMessage);
      return res.status(200).send('OK');
    }

    // Текст строгой инструкции Капитана
    const systemPrompt = `Ты — Капитан нашей моторной яхты «Grey» в Кемере (fishing.flyzoom.ru). 
Отвечай гостю вежливо, кратко, уважительно, в гостеприимном морском стиле.
ПРАВИЛА:
1. Отвечай СТРОГО по нашей программе: выходим из порта Кемер Марина в открытое Средиземное море. Ловим дораду, сибаса, тунца, ставриду.
2. В туре ВКЛЮЧЕНО: трансфер из отеля и обратно, удочки, снасти, эхолот, а также завтрак и ОБЕД НА БОРТУ (жарим пойманную рыбу на гриле!). Бот подходит для всей семьи и детей.
3. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО называть цены в цифрах. Если спросят про стоимость — отвечай: "Для уточнения стоимости на ваши даты с вами свяжется менеджер в WhatsApp. Оставьте, пожалуйста, ваш номер телефона или ник?"
4. ЗАПРЕЩЕНО выдумывать рыбалку с берега, пирсов, другие страны (Испанию, реку Волгу) и запрещено посылать человека искать инфу на сайт. Твоя единственная цель — взять телефон гостя для WhatsApp.`;

    try {
      // Оптимальный формат запроса: разделяем системную инструкцию и вопрос пользователя
      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nВопрос от гостя: ${userText}` }] }
        ]
      });

      const botReply = result.response.text() || "Штиль на связи... Повторите вопрос, пожалуйста.";
      await sendTelegram(chatId, botReply);

    } catch (aiError) {
      console.error('КРИТИЧЕСКАЯ ОШИБКА GEMINI API:', aiError);
      // Если лимиты превышены, вежливо просим подождать
      await sendTelegram(chatId, "⏳ На море легкий штиль (обрабатываю много запросов). Пожалуйста, подождите пару секунд и повторите ваш вопрос Капитану!");
    }

    return res.status(200).send('OK');

  } catch (error) {
    console.error('Общая ошибка сервера:', error);
    return res.status(500).send('Internal Error');
  }
}

// Функция для отправки сообщений обратно в Telegram
async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_TOKEN || "8618014725:AAEM0d-T_sKi6nndj1f78DQb46Ts-WajUKk";
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}
