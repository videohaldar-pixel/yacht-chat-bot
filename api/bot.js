import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

// Инициализируем Gemini API с правильным классом
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Используем актуальную модель gemini-1.5-flash и передаем системные инструкции
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  systemInstruction: `
    Ты — профессиональный чат-бот ассистент для нашего рыболовного сайта (fishing.flyzoom.ru). 
    Твоя главная задача — консультировать клиентов по поводу рыбалки и экскурсий, но строго соблюдая следующие правила:

    КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
    1. ТЕБЕ ЗАПРЕЩЕНО НАЗЫВАТЬ КОНКРЕТНЫЕ ЦЕНЫ И СТОИМОСТЬ.
    2. Если клиент спрашивает про цены, стоимость, скидки или условия бронирования, ты ДОЛЖЕН ответить строго по этому шаблону:
       "Для уточнения актуальной стоимости, подбора удобных дат и оформления бронирования с вами свяжется наш менеджер в WhatsApp или по указанному вами контакту. Подскажите, пожалуйста, ваш номер телефона или ник в мессенджере?"
    3. НЕ отправляй клиента искать информацию самостоятельно на сайт. Твоя цель — мягко, но уверенно взять его контактные данные (имя, телефон или ник), чтобы менеджер связался с ним.
    4. Как только клиент проявляет интерес к рыбалке, экскурсии или датам, плавно предложи записать его данные: "Давайте я запишу ваши контакты, и наш менеджер свяжется с вами в течение 10 минут в WhatsApp для уточнения деталей?"
    5. Будь вежливым, пиши кратко и лаконично. Не пиши огромные тексты. В конце ответа старайся задавать один вовлекающий вопрос.
  `
});

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
      const welcomeMessage = "Приветствуем вас! 🎣\nБот рыбалки готов помочь вам. Расскажите, какая рыбалка или экскурсия вас интересует?";
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
