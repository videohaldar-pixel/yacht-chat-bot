export default async function handler(req, res) {
    // Настройка CORS для работы с вашим сайтом index.html
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Проверка статуса бэкенда в браузере
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

            // Определяем, откуда запрос: Telegram или сайт
            if (body && body.message && body.message.chat) {
                userMessage = body.message.text || "";
                chatId = body.message.chat.id;
                isTelegram = true;
            } else if (body && body.message) {
                userMessage = body.message;
            } else if (body && body.text) {
                userMessage = body.text;
            }

            // Если пустая команда или старт
            if (!userMessage || userMessage === '/start') {
                const welcomeText = "Привет! Я ИИ-помощник капитана премиум-яхты «Грей». Задайте мне любой вопрос про морскую рыбалку и прогулки в Анталии!";
                if (isTelegram && chatId) {
                    await sendToTelegram(chatId, welcomeText);
                    return res.status(200).send('OK');
                }
                return res.status(200).json({ reply: welcomeText });
            }

            // Жесткие инструкции (Промпт)
            const systemInstruction = `
            Вы — официальный ИИ-помощник на сайте морской рыбалки в Анталии на премиум-яхте 'Grey'.
            Отвечайте вежливо и увлекательно. Рассказывайте про утреннюю рыбалку, вечернюю и семейные прогулки.
            
            СТРОГИЕ ПРАВИЛА ДЛЯ КОНТАКТОВ:
            Если пользователь просит контакты, телефон, email или хочет забронировать напрямую, вы обязаны давать ТОЛЬКО эти данные:
            - Телефон / WhatsApp: +90 538 845 62 15
            - Email: fishing@flyzoom.ru
            - Сайт: fishing.flyzoom.ru
            
            НИКОГДА не выдумывайте другие номера телефонов (особенно российские +7), другие email-адреса или имена. Используйте только указанные выше контакты.
            `;

            // Прямой запрос к Gemini API без использования библиотек
            const apiKey = process.env.GEMINI_API_KEY;
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: userMessage }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] }
                })
            });

            if (!geminiResponse.ok) {
                const errorData = await geminiResponse.json();
                throw new Error(errorData.error?.message || "Ошибка при запросе к Gemini");
            }

            const geminiData = await geminiResponse.json();
            const botReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Извините, не удалось получить ответ.";

            // Возвращаем результат получателю
            if (isTelegram && chatId) {
                await sendToTelegram(chatId, botReply);
                return res.status(200).send('OK');
            } else {
                return res.status(200).json({ reply: botReply });
            }

        } catch (error) {
            console.error("Ошибка:", error);
            return res.status(500).json({ error: error.message });
        }
    }
}

// Отправка ответа в Telegram
async function sendToTelegram(chatId, text) {
    const token = process.env.TELEGRAM_TOKEN;
    if (!token) return;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text })
    });
}
