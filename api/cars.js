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
            message: "Бэкенд автопроката rentacarkemer.com успешно работает!" 
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

            // Текстовое приветствие БЕЗ старых кнопок и меню
            if (!userMessage || userMessage === '/start') {
                const welcomeText = 
                    "🇷🇺 Приветствуем! Я ИИ-помощник по прокату автомобилей в Анталии и Кемере (rentacarkemer.com).\n" +
                    "У нас: Аренда БЕЗ ЗАЛОГА, 100% полная страховка, бесплатная доставка к отелю или в аэропорт! Какое авто вас интересует?\n\n" +
                    "🇹🇷 Merhaba! Antalya ve Kemer araç kiralama yapay zeka yardımcısıyım (rentacarkemer.com).\n" +
                    "Avantajlarımız: DEPOZİTOSUZ kiralama, %100 tam kasko, otele veya havalimanına ücretsiz teslimat! Nasıl bir araç istersiniz?\n\n" +
                    "🇬🇧 Hello! I am your AI assistant for car rentals in Antalya and Kemer (rentacarkemer.com).\n" +
                    "Our benefits: NO DEPOSIT rental, 100% full insurance, free delivery to your hotel or airport! What kind of car are you looking for?";
                
                if (isTelegram && chatId) {
                    await sendToTelegram(chatId, welcomeText);
                    return res.status(200).send('OK');
                }
                return res.status(200).json({ reply: welcomeText });
            }

            const systemInstruction = `
            Вы — официальный ИИ-эксперт компании по прокату автомобилей rentacarkemer.com (Анталия и Кемер).
            Ваша цель — консультировать клиента, вызывать доверие и мягко брать его номер телефона для связи через WhatsApp.

            ПРАВИЛА:
            1. Отвечай строго на языке пользователя (Русский, Турецкий, Английский).
            2. Преимущества: БЕЗ ЗАЛОГА, полная страховка включена, бесплатная доставка в аэропорт и к отелям Кемера. Детское кресло бесплатно.
            3. Если просят контакты или точные цены, отправляй на сайт: rentacarkemer.com.
            4. Если клиент подтверждает или оставляет телефон (например, пишет "Да актуален" или скидывает номер), вежливо поблагодари его и скажи, что менеджер уже связывается с ним в WhatsApp. Больше телефон НЕ проси!
            `;

            const apiKey = process.env.GEMINI_API_KEY;
            // Используем стабильный эндпоинт v1beta
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

            // Чтобы Gemini понимала, что это диалог, мы упаковываем сообщение в контекст беседы
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: userMessage }]
                        }
                    ],
                    systemInstruction: {
                        parts: [{ text: systemInstruction }]
                    }
                })
            });

            if (!geminiResponse.ok) {
                const errorData = await geminiResponse.json();
                throw new Error(errorData.error?.message || "Ошибка API Gemini");
            }

            const geminiData = await geminiResponse.json();
            const botReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Извините, возникла заминка. Попробуйте еще раз.";

            if (isTelegram && chatId) {
                await sendToTelegram(chatId, botReply);
                return res.status(200).send('OK');
            } else {
                return res.status(200).json({ reply: botReply });
            }

        } catch (error) {
            console.error("Ошибка:", error);
            // Если произошла ошибка, мы отправим её в телеграм, чтобы вы сразу её увидели
            if (req.body?.message?.chat?.id) {
                await sendToTelegram(req.body.message.chat.id, `Ошибка бэкенда: ${error.message}`);
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
        console.error("Ошибка отправки в TG:", e);
    }
}
