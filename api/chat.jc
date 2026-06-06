import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // Настройка заголовков CORS для работы с вашим фронтендом
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    // Инициализация Gemini через ваш ключ из переменных окружения Vercel
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Жесткие инструкции: бот знает ОСОБЕННОСТИ только вашего лендинга fishing.flyzoom.ru
    const systemInstruction = `
      Ты — официальный AI-ассистент на сайте fishing.flyzoom.ru, представляющий премиум-яхту "Grey" (Грей).
      Твоя главная задача — помогать клиентам бронировать морскую рыбалку и индивидуальные туры на яхте.
      
      СТРОГИЕ ПРАВИЛА ОТВЕТОВ:
      1. Отвечай СТРОГО на основе информации, представленной на лендинге https://fishing.flyzoom.ru.
      2. Не придумывай сторонние цены, маршруты или услуги, которых нет на сайте.
      3. Если клиент спрашивает общие вопросы о рыбалке или других судах, вежливо переводи разговор на премиум-яхту "Grey" и возможности отдыха на ней.
      4. Будь вежливым, гостеприимным и профессиональным. Твой тон должен соответствовать премиальному уровню отдыха.
      5. В конце ответа, если это уместно, предлагай забронировать тур или оставить контакты для связи с менеджером.
    `;

    // Вызов модели gemini-2.5-flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    const replyText = response.text || 'Извините, не удалось сформировать ответ.';
    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error('Ошибка Gemini API:', error);
    return res.status(500).json({ 
      error: 'Ошибка при обработке запроса сервером чата.',
      details: error.message 
    });
  }
}
