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
            message: "Бэкенд умного автопроката rentacarkemer.com с памятью запущен!" 
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

            // Приветствие на 3 языках для rentacarkemer.com
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

            // Наша системная инструкция
            const systemInstruction = `
            Вы — официальный ИИ-эксперт компании по прокату автомобилей в регионах Анталия и Кемер (Турция), работающий на сайте rentacarkemer.com.
            Ваша цель — вести связный диалог с клиентом, помнить его предыдущие ответы, вызвать доверие и взять его номер телефона для бронирования.

            ЯЗЫКОВЫЕ ПРАВИЛА:
            1. Автоматически определяй язык клиента (Русский, Турецкий или Английский) и отвечай строго на нем.

            ГЛАВНЫЕ ПРЕИМУЩЕСТВА КОМПАНИИ:
            - БЕЗ ЗАЛОГА (No Deposit) и без кредитных карт.
            - ПОЛНАЯ СТРАХОВКА (Full Insurance) уже в стоимости.
            - БЕСПЛАТНАЯ ДОСТАВКА к любому отелю в Кемере или в Аэропорт Анталии.
            - Детское кресло или бустер — БЕСПЛАТНО по запросу.

            АВТОПАРК: Renault Clio, Fiat Egea, Hyundai i20, Volkswagen Polo, кроссоверы Dacia Duster, минивэны Mercedes Vito, VW Transporter.

            КОНТАКТЫ И СБОР ДАННЫХ (ОЧЕНЬ ВАЖНО):
            1. НИКОГДА не пиши в тексте прямые личные телефоны или email. Направляй за контактами на сайт rentacarkemer.com.
            2. Если клиент уже оставил или подтвердил свой номер телефона (например, написал "Да актуален" или скинул цифры), ОБЯЗАТЕЛЬНО поблагодари его и четко скажи, что менеджер уже принял заявку и свяжется с ним в WhatsApp в течение нескольких минут. Не проси телефон повторно, если он уже есть в истории диалога!
            3. Если телефона еще нет, вежливо попроси его для связи.
            `;

            const apiKey = process.env.GEMINI_API_KEY;
            
            // Используем v1beta для работы со встроенными сессиями чатов (поддерживает параметр chats)
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

            // Формируем запрос с учетом системной инструкции
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
                throw new Error(errorData.error?.message || "Ошибка Gemini");
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
    const token = process.env.TELEGRAM_TOKEN_CARS;
    if (!token) return;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text })
    });
}
