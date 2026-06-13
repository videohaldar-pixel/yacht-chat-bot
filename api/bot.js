import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

// Инициализируем Gemini API с правильным классом
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
// Используем актуальную модель gemini-1.5-flash (или gemini-pro)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export default async function handler(req, res) {
  // Нам подходят только POST запросы от Telegram
  if (req.method !== 'POST') {
    return res.status(200).send('Бот рыбалки работает!');
  }

  try {
    const { message } = req.body;

    if (!message || !message.text) {
      return res.status(200).send('No text message');
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // Если пользователь нажал /start
    if (userText === '/start') {
      const welcomeMessage = "Приветствуем вас! 🎣\nБот рыбалки готов помочь вам.";
      await sendTelegram(chatId, welcomeMessage);
      return res.status(200).send('OK');
    }

    // Отправляем запрос в нейросеть Gemini
    try {
      const aiResponse = await model.generateContent(userText);
      const botReply = aiResponse.response.text() || "Извините, не удалось сформулировать ответ.";
      await sendTelegram(chatId, botReply);
    } catch (aiError) {
      console.error('Ошибка Gemini:', aiError);
      await sendTelegram(chatId, "⏳ Извините, я получил слишком много сообщений одновременно. Пожалуйста, подождите пару секунд и повторите вопрос.");
    }

    return res.status(200).send('OK');

  } catch (error) {
    console.error('Общая ошибка:', error);
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
