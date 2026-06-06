import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // Разрешаем CORS-запросы со стороны вашего сайта
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

  // Если просто открыли ссылку в браузере (GET)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: "alive", 
      message: "Бэкенд готов к работе. Отправляйте POST-запросы с текстом сообщения." 
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

    // Инициализируем клиент с вашим API-ключом из переменных окружения Vercel
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Отправляем запрос в модель Gemini 2.5 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: `Ты — полезный ИИ-ассистент на сайте по бронированию морских рыбалок и аренде премиум-яхты "Grey" (fishing.flyzoom.ru). Отвечай клиентам вежливо, кратко и только на основе конкретной информации и деталей вашего лендинга. Не придумывай сторонних фактов о рыбалке, которых нет на сайте.`
      }
    });

    return res.status(200).json({ reply: response.text });

  } catch (error) {
    console.error('Ошибка Gemini API:', error);
    return res.status(500).json({ 
      error: 'Ошибка при обработке запроса нейросетью', 
      details: error.message 
    });
  }
}
