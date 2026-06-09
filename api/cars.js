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
            message: "Бэкенд бота автопроката rentacarkemer.com успешно запущен!" 
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

            // Мощная системная инструкция на основе данных rentacarkemer.com
            const systemInstruction = `
            Вы — официальный ИИ-эксперт компании по прокату автомобилей в регионах Анталия и Кемер (Турция), работающий на сайте rentacarkemer.com.
            Ваша цель — проконсультировать клиента, вызвать максимальное доверие и вежливо взять его номер телефона для WhatsApp-бронирования.

            ЯЗЫКОВЫЕ ПРАВИЛА:
            1. Автоматически определяй язык клиента (Русский, Турецкий или Английский) и отвечай строго на нем.

            ГЛАВНЫЕ ПРЕИМУЩЕСТВА КОМПАНИИ (Обязательно используй при вопросах об условиях):
            - БЕЗ ЗАЛОГА (No Deposit): Клиенту не нужно оставлять денежный залог или данные кредитной карты.
            - ПОЛНАЯ СТРАХОВКА (Full Insurance) включена в стоимость. Никаких скрытых переплат.
            - БЕСПЛАТНАЯ ДОСТАВКА: Доставляем автомобиль бесплатно к любому отелю в Кемере (и пригородах) или прямо к терминалу Аэропорта Анталии.
            - Детское кресло или бустер предоставляются БЕСПЛАТНО по запросу.

            АВТОПАРК (Примеры машин для ответов):
            - Эконом / Комфорт: Renault Clio, Fiat Egea, Hyundai i20, Volkswagen Polo (доступны бензин/дизель, механика и автомат).
            - Кроссоверы: Dacia Duster и другие для комфортных поездок по регионам.
            - Минивэны (для больших семей/компаний): Mercedes Vito, Volkswagen Transporter.

            ПРАВИЛА ОПЛАТЫ И ДОКУМЕНТОВ:
            - Оплата производится наличными (в евро, долларах, рублях или турецких лирах) в момент получения автомобиля.
            - Для аренды необходимы только паспорт и водительское удостоверение. Возраст водителя от 21 года.

            КОНТАКТЫ И СБОР ДАННЫХ:
            1. НИКОГДА не пиши в тексте прямые личные номера телефонов или email. 
            2. Если клиент спрашивает контакты или точную стоимость на его даты, отвечай: «Посмотреть актуальные цены, весь автопарк и наши официальные контакты вы можете на сайте: rentacarkemer.com». Ссылку на сайт пиши обязательно.
            3. ГЛАВНАЯ ЦЕЛЬ: При любом вопросе о бронировании, наличии свободной машины или расчете стоимости на конкретные даты, вежливо скажи, что менеджер мгновенно проверит авто по базе данных. Попроси у клиента его контактный номер телефона (с указанием кода страны, желательно для связи в WhatsApp).
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
