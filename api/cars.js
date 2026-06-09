// Временное хранилище истории диалогов прямо в памяти сервера Vercel
const sessions = {};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({ status: "ok", message: "Cars API с памятью запущено!" });
    }

    if (req.method === 'POST') {
        try {
            const body = req.body || {};
            let userMessage = "";
            let chatId = null;

            if (body.message && body.message.chat) {
                userMessage = body.message.text || "";
                chatId = body.message.chat.id;
            }

            // Если это старт диалога или пустой запрос, очищаем старую сессию и приветствуем
            if (!userMessage || userMessage === '/start' || userMessage.trim() === '') {
                if (chatId) {
                    sessions[chatId] = []; // Сброс истории для этого пользователя
                }

                const welcomeText = 
                    "🇷🇺 Приветствуем! Я ИИ-помощник по прокату автомобилей в Анталии и Кемере.\n" +
                    "У нас: Аренда БЕЗ ЗАЛОГА, 100% полная страховка, бесплатная доставка к отелю или в аэропорт! Какое авто или класс машины (эконом, средний, премиум) вас интересует?\n\n" +
                    "🇹🇷 Merhaba! Antalya ve Kemer araç kiralama yapay zeka yardımcısıyım.\n" +
                    "Avantajlarımız: DEPOZİTOSUZ kiralama, %100 tam kasko, otele veya havalimanına ücretsiz teslimat! Nasıl veya hangi sınıf bir araç istersiniz?\n\n" +
                    "🇬🇧 Hello! I am your AI assistant for car rentals in Antalya and Kemer.\n" +
                    "Our benefits: NO DEPOSIT rental, 100% full insurance, free delivery to your hotel or airport! What kind of car or car class are you looking for?";
                
                if (chatId) {
                    await sendToTelegram(chatId, welcomeText);
                }
                return res.status(200).send('OK');
            }

            // Инициализируем историю, если пользователя еще нет в памяти
            if (chatId && !sessions[chatId]) {
                sessions[chatId] = [];
            }

            // Добавляем текущее сообщение пользователя в историю
            if (chatId) {
                sessions[chatId].push({ role: "user", parts: [{ text: userMessage }] });
                
                // Ограничиваем историю последними 10 сообщениями, чтобы не перегружать контекст
                if (sessions[chatId].length > 10) {
                    sessions[chatId].shift();
                }
            }

            // Жесткая системная инструкция для менеджера продаж БЕЗ УПОМИНАНИЯ ССЫЛОК
            const systemInstruction = 
                "Вы — профессиональный ИИ-менеджер по бронированию автомобилей в Анталии и Кемере.\n" +
                "Твоя единственная цель — узнать у клиента марку машины, даты/срок аренды и взять контактный номер телефона для WhatsApp. Отвечай строго на языке пользователя.\n\n" +
                "ПРАВИЛА И СЦЕНАРИЙ:\n" +
                "1. ЗАПРЕЩЕНО давать ссылки на какие-либо сайты или писать адреса сайтов (типа rentacarkemer.com). Клиент должен забронировать всё прямо здесь, в чате.\n" +
                "2. Задавай по ОДНОМУ вопросу за раз. Не вываливай все вопросы сразу.\n" +
                "3. Шаг 1: Узнай класс авто или марку. Шаг 2: Узнай даты и количество дней. Шаг 3: Вежливо попроси номер телефона для связи.\n" +
                "4. Если спрашивают цену, пиши примерную вилку: Эконом от 30-40$ в сутки, Средний класс от 45-60$ в сутки, Кроссоверы и Минивэны от 70$. Добавь, что точную стоимость под их даты рассчитает менеджер.\n" +
                "5. КРИТИЧЕСКОЕ ПРАВИЛО: Как только в сообщении клиента появляется номер телефона (или фраза подтверждения типа 'Да, актуален'), ты ДОЛЖЕН СРАЗУ ответить текстом: 'Большое спасибо! Предварительные данные приняты. Передаю вашу заявку нашей команде. Наш менеджер уже связывается с вами в WhatsApp в течение пары минут!'. После этого больше никаких вопросов не задавай.";

            const apiKey = process.env.GEMINI_API_KEY;
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

            // Передаем в Gemini накопленную историю переписки конкретного пользователя + системную инструкцию
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: chatId ? sessions[chatId] : [{ role: "user", parts: [{ text: userMessage }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] }
                })
            });

            let botReply = "Извините, возникла заминка. Попробуйте еще раз.";
            if (geminiResponse.ok) {
                const geminiData = await geminiResponse.json();
                botReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || botReply;
                
                // Сохраняем ответ бота в историю, чтобы на следующем шаге он его помнил
                if (chatId) {
                    sessions[chatId].push({ role: "model", parts: [{ text: botReply }] });
                }
            } else {
                const errData = await geminiResponse.json().catch(() => ({}));
                botReply = `Ошибка Gemini: ${errData.error?.message || 'Неизвестный сбой'}`;
            }

            if (chatId) {
                await sendToTelegram(chatId, botReply);
            }
            return res.status(200).send('OK');

        } catch (error) {
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
    } catch (e) {}
}
