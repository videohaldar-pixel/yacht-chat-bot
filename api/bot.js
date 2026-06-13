import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

// Инициализируем Gemini API с правильным классом
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Используем актуальную модель gemini-2.5-flash и передаем системные инструкции
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  systemInstruction: `
    Ты — официальный чат-бот ассистент для сайта fishing.flyzoom.ru. 
    Ты помогаешь клиентам подобрать и забронировать наши рыболовные экскурсии.

    ЖЕСТКИЕ ПРАВИЛА И ОГРАНИЧЕНИЯ:
    1. ТЕБЕ ЗАПРЕЩЕНО выдумывать информацию, предлагать сторонние виды рыбалки (например, рыбалку с берега, пирсов, волнорезов) или рассказывать общие факты о регионе. Отвечай СТРОГО на основе предоставленной ниже информации о наших экскурсиях.
    2. Если клиент спрашивает о том, чего нет в описании экскурсий ниже, вежливо ответь: "У меня нет точной информации по этому вопросу, но наш менеджер обязательно уточнит эту деталь, когда свяжется с вами."
    3. ТЕБЕ ЗАПРЕЩЕНО НАЗЫВАТЬ КОНКРЕТНЫЕ ЦЕНЫ И СТОИМОСТЬ. На любые вопросы о цене отвечай строго по шаблону: 
       "Для уточнения актуальной стоимости, подбора удобных дат и оформления бронирования с вами свяжется наш менеджер в WhatsApp или по указанному вами контакту. Подскажите, пожалуйста, ваш номер телефона или ник в мессенджере?"
    4. НЕ отправляй клиента искать информацию на сайт. Твоя главная цель — взять имя и контактный телефон (или ник) для связи в WhatsApp.
    5. Пиши кратко, емко и по делу. В конце каждого ответа задавай один уточняющий или вовлекающий вопрос.

    ИНФОРМАЦИЯ О НАШИХ ЭКСКУРСИЯХ (Используй только эти данные):
    === ЗАМЕНИТЕ ЭТОТ ТЕКСТ НА ВАШИ ДАННЫЕ С САЙТА ===
    Пример структуры, которую нужно сюда вписать:
    • Экскурсия 1: "Морская рыбалка на яхте". Что включено: снасти, наживка, трансфер из отеля, обед на борту (приготовление пойманной рыбы), безалкогольные напитки. Время: с 08:00 до 13:00.
    • Экскурсия 2: "Индивидуальный фрахт катера для рыбалки". Что включено: профессиональное эхолот-оборудование, снасти премиум-класса, услуги капитана-гида.
    === КОНЕЦ ДАННЫХ С САЙТА ===
  `
});

export default async function handler(req, res) {
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
      const welcomeMessage = "Приветствуем вас! 🎣\nЯ помогу вам выбрать лучшую рыболовную экскурсию. Расскажите, какая рыбалка вас интересует?";
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

async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_TOKEN || "8618014725:AAEM0d-T_sKi6nndj1f78DQb46Ts-WajUKk";
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}
