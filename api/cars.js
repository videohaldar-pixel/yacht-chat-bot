export default async function handler(req, res) {
    // Включаем CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({ status: "ok", message: "Cars API Работает из корня!" });
    }

    if (req.method === 'POST') {
        try {
            // Проверяем формат входящих данных (парсим строку в JSON, если Vercel не сделал этого сам)
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            let userMessage = "";
            let chatId = null;

            // Извлекаем данные из Telegram
            if (body.message && body.message.chat) {
                userMessage = body.message.text || "";
                chatId = body.message.chat.id;
            } else if (body.text) {
                userMessage = body.text;
            }

            // Проверка на команду /start
            if (!userMessage || userMessage === '/start' || userMessage.trim() === '') {
                const welcomeText = 
                    "🇷🇺 Приветствуем! Я ИИ-помощник по прокату автомобилей в Анталии и Кемере (rentacarkemer.com).\n" +
                    "У нас: Аренда БЕЗ ЗАЛОГА, 100% полная страховка, бесплатная доставка к отелю или в аэропорт! Какое авто вас интересует?\n\n" +
                    "🇹🇷 Merhaba! Antalya ve Kemer araç kiralama yapay zeka yardımcısıyım (rentacarkemer.com).\n" +
                    "Avantajlarımız: DEPOZİTOSUZ kiralama, %100 tam kasko, otele veya havalimanına ücretsiz teslimat! Nasıl bir araç istersiniz?\n\n" +
                    "🇬🇧 Hello! I am your AI assistant for car rentals in Antalya and Kemer (rentacarkemer.com).\n" +
                    "Our benefits: NO DEPOSIT rental, 100% full insurance, free delivery to your hotel or airport! What kind of car are you looking for?";
                
                if (chatId) {
                    await sendToTelegram(chatId, welcomeText);
                }
                return res.status(200).send('OK');
            }

            // Базовая системная инструкция для Gemini
            const systemInstruction = "Вы — официальный ИИ-эксперт компании по прокату автомобилей rentacarkemer.com (Анталия и Кемер). Отвечай строго на языке пользователя (Русский, Турецкий, Английский). Преимущества: БЕЗ ЗАЛОГА, полная страховка включена, бесплатная доставка в аэропорт и к отелям Кемера. Если клиент подтверждает или оставляет телефон (пишет 'Да актуален' или дает номер), вежливо поблагодари его и скажи, что менеджер уже связывается в WhatsApp. Больше телефон НЕ проси! Если просят контакты или цены, отправляй на сайт rentacarkemer.com.";

            const apiKey = process.env.GEMINI_API_KEY;
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

            // Отправляем запрос в Gemini
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: userMessage }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] }
                })
            });

            let botReply = "Извините, возникла заминка. Попробуйте еще раз.";
            if (geminiResponse.ok) {
                const geminiData = await geminiResponse.json();
                botReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || botReply;
            } else {
                const errData = await geminiResponse.json().catch(() => ({}));
                console.error("Gemini Error:", errData);
                botReply = `Ошибка Gemini API: ${errData.error?.message || 'Неизвестный сбой'}`;
            }

            if (chatId) {
                await sendToTelegram(chatId, botReply);
            }
            return res.status(200).send('OK');

        } catch (error) {
            console.error("Global Error:", error);
            if (req.body?.message?.chat?.id) {
                await sendToTelegram(req.body.message.chat.id, `Критическая ошибка бэкенда: ${error.message}`);
            }
            return res.status(500).json({ error: error.message });
        }
    }
}

async function sendToTelegram(chatId, text) {
    const token = process.env.TELEGRAM_TOKEN_CARS;
    if (!token) return;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text })
        });
    } catch (e) {
        console.error("TG Send Error:", e);
    }
}
  
