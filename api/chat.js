import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // Настройка CORS для работы с вашим сайтом
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Заглушка для обычного перехода по ссылке в браузере (GET)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: "alive", 
      message: "Бэкенд успешно работает на Node 20. Отправляйте POST-запросы." 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Разрешены только POST-запросы' });
  }

  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    // Инициализация Gemini через переменную окружения Vercel
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Запрос к модели 2.5 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: `Ты — ИИ-ассистент на сайте fishing.flyzoom.ru по бронированию морских рыбалок и аренде премиум-яхты "Grey". Отвечай вежливо, кратко и только на основе конкретной информации вашего лендинга.`
      }
    });

    return res.status(200).json({ reply: response.text });

  } catch (error) {
    console.error('Ошибка:', error);
    return res.status(500).json({ 
      error: 'Ошибка при обработке запроса нейросетью', 
      details: error.message 
    });
  }
}
