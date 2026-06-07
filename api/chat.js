import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // Настройка CORS заголовков
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Заглушка, чтобы при переходе по ссылке в браузере не было ошибки 500
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: "working", 
      message: "Сервер онлайн. Пожалуйста, отправляйте POST-запросы." 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Разрешены только POST-запросы' });
  }

  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Сообщение пустое' });
    }

    // Подключение к Gemini через ваш ключ из настроек Vercel
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: "Ты — полезный ИИ-ассистент на сайте fishing.flyzoom.ru по бронированию морских рыбалок и аренде премиум-яхты 'Grey'."
      }
    });

    return res.status(200).json({ reply: response.text });

  } catch (error) {
    console.error('Ошибка:', error);
    return res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
}
