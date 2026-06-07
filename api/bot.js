import { GoogleGenAI } from '@google/genai';

// Инициализируем Gemini API через переменную окружения Vercel
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
    // Разрешаем запросы с вашего сайта (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Простая проверка, что бэкенд жив
    if (req.method === 'GET') {
        return res.status(200).json({ 
            status: "ready", 
            message: "Бэкенд морской рыбалки успешно запущен и настроен!" 
        });
    }

    if (req.method === 'POST') {
        try {
            const body = req.body;
            let userMessage = "";
            let chatId = null;
            let isTelegram = false;

            // 1. Проверяем, откуда пришел запрос — из Telegram или с сайта
            if (body && body.message && body.message.chat) {
                // Это запрос от Telegram
                userMessage = body.message.text || "";
                chatId = body.message.chat.id;
                isTelegram = true;
            } else if (body && body.message) {
                // Это запрос с вашего HTML-сайта
                userMessage = body.message;
            } else if (body && body.text) {
                // Резервный вариант под старый формат сайта
                userMessage = body.text;
            }

            // Если сообщение пустое (например, юзер прислал стикер или команду /start)
            if (!userMessage || userMessage === '/start') {
                const welcomeText = "Привет! Я ИИ-помощник капитана яхты «Грей». Задайте мне любой вопрос про морскую рыбалку в Анталии!";
                if (isTelegram && chatId) {
                    await sendToTelegram(chatId, welcomeText);
                    return res.status(200).send('OK');
                }
                return res.status(200).json({ reply: welcomeText });
            }

            // 2. Настройка жестких инструкций для Gemini (Промпт)
            const systemInstruction = `
            Вы — официальный ИИ-помощник на сайте морской рыбалки в Анталии на премиум-яхте 'Grey'.
            Отвечайте дружелюбно, вежливо и увлекательно. Рассказывайте про утреннюю рыбалку (крупная рыба), вечернюю (красивый закат) и семейные прогулки.
            
            СТРОГИЕ ПРАВИЛА ДЛЯ КОНТАКТОВ:
            Если пользователь просит контакты, телефон, email или хочет забронировать напрямую, вы обязаны выдавать ТОЛЬКО эти данные:
            - Телефон / WhatsApp: +90 538 845 62 15
            - Email: fishing@flyzoom.ru
            - Сайт: fishing.flyzoom.ru
            
            НИКОГДА не выдумывайте другие номера телефонов (особенно российские +7), другие email-адреса или имена. Используйте только указанные выше контакты.
            `;

            // 3. Запрос к Gemini (используем стабильную и быструю модель 2.5-flash)
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: userMessage,
                config: {
                    systemInstruction: systemInstruction
                }
            });

            const botReply = response.text || "Извините, не смог сформулировать ответ.";

            // 4. Отправляем ответ обратно
            if (isTelegram && chatId) {
                // Отправляем в чат Telegram
                await sendToTelegram(chatId, botReply);
                return res.status(200).send('OK');
            } else {
                // Отвечаем вашему сайту index.html
                return res.status(200).json({ reply: botReply });
            }

        } catch (error) {
            console.error("Ошибка обработки:", error);
            return res.status(500).json({ error: error.message });
        }
    }
}

// Функция для отправки сообщений в Telegram API
async function sendToTelegram(chatId, text) {
    const token = process.env.TELEGRAM_TOKEN;
    if (!token) {
        console.error("TELEGRAM_TOKEN не задан в переменных Vercel!");
        return;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text
        })
    });
}
