export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({ 
            status: "ready", 
            message: "Бэкенд мультиязычного бота успешно запущен!" 
        });
    }

    if (req.method === 'POST') {
        try {
            const body = req.body;
            let userMessage = "";
            let chatId = null;
            let isTelegram = false;

            if (body && body.message && body.message.chat) {
                userMessage = body.message.text || "";
                chatId = body.message.chat.id;
                isTelegram = true;
            } else if (body && body.message) {
                userMessage = body.message;
            } else if (body && body.text) {
                userMessage = body.text;
            }

            // Красивое приветствие, разделенное по абзацам на 3 языках
            if (!userMessage || userMessage === '/start') {
                const welcomeText = 
                    "🇷🇺 Привет! Я ИИ-помощник капитана премиум-яхты «Грей». Задайте мне любой вопрос про морскую рыбалку и прогулки в Анталии!\n\n" +
                    "🇹🇷 Merhaba! Premium yat 'Grey' kaptanının yapay zeka yardımcısıyım. Antalya'da deniz balıkçılığı ve tekne turları hakkında bana her şeyi sorabilirsiniz!\n\n" +
                    "🇬🇧 Hello! I am the AI assistant to the captain of the premium yacht 'Grey'. Ask me anything about sea fishing and boat trips in Antalya!";
                
                if (isTelegram && chatId) {
                    await sendToTelegram(chatId, welcomeText);
                    return res.status(200).send('OK');
                }
                return res.status(200).json({ reply: welcomeText });
            }

            // Настройка системной инструкции ИИ
            const systemInstruction = `
            Вы — официальный ИИ-помощник на сайте морской рыбалки в Анталии на премиум-яхте "Grey".

            ЯЗЫКОВЫЕ ПРАВИЛА:
            1. Автоматически определи, на каком языке пишет пользователь (Русский, Английский или Турецкий).
            2. Отвечай строго на языке пользователя. Всю информацию о прогулках, ценах и яхте переводи на его язык.

            ПРАВИЛА ДЛЯ КОНТАКТОВ:
            1. НИКОГДА не пиши в тексте ответов прямые номера телефонов или email-адреса.
            2. Если пользователь просит контакты, телефон или хочет забронировать, строго отвечайте на его языке: «Все официальные контакты, цены и подробную информацию вы можете посмотреть на нашем сайте: fishing.flyzoom.ru». Ссылку на сайт пишите обязательно в любом случае.

            ГЛАВНАЯ ЦЕЛЬ (СБОР ДАННЫХ):
            В процессе диалога или при ответе на вопросы о бронировании, свободных датах и ценах обязательно вежливо попросите у клиента его контактный номер телефона для обратной связи, связи по WhatsApp и уточнения деталей поездки капитаном.
            `;

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
