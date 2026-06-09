export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({ status: "ok", message: "Cars API Работает!" });
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

            if (!userMessage || userMessage === '/start' || userMessage.trim() === '') {
                const welcomeText = 
                    "🇷🇺 Приветствуем! Я ИИ-помощник по прокату автомобилей в Анталии и Кемере (rentacarkemer.com).\n" +
                    "У нас: Аренда БЕЗ ЗАЛОГА, 100% полная страховка, бесплатная доставка к отелю или в аэропорт! Какое авто или класс машины (эконом, средний, премиум) вас интересует?\n\n" +
                    "🇹🇷 Merhaba! Antalya ve Kemer araç kiralama yapay zeka yardımcısıyım (rentacarkemer.com).\n" +
                    "Avantajlarımız: DEPOZİTOSUZ kiralama, %100 tam kasko, otele veya havalimanına ücretsiz teslimat! Nasıl или hangi sınıf bir araç istersiniz?\n\n" +
                    "🇬🇧 Hello! I am your AI assistant for car rentals in Antalya and Kemer (rentacarkemer.com).\n" +
                    "Our benefits: NO DEPOSIT rental, 100% full insurance, free delivery to your hotel or airport! What kind of car or car class are you looking for?";
                
                if (chatId) {
                    await sendToTelegram(chatId, welcomeText);
                }
                return res.status(200).send('OK');
            }

            // Наш новый умный сценарий для ведения диалога
            const systemInstruction = 
                "Вы — профессиональный ИИ-менеджер по бронированию компании rentacarkemer.com (Анталия и Кемер).\n" +
                "Твоя главная цель — собрать предварительные данные для брони и передать их менеджеру. Отвечай строго на языке пользователя.\n\n" +
                "ПРАВИЛА ВЕДЕНИЯ ДИАЛОГА:\n" +
                "1. Если пользователь только начал диалог, спроси: какую марку или класс автомобиля он ищет.\n" +
                "2. Как только он назвал авто/класс, вежливо уточни даты: 'На какие даты и сколько дней вам необходим автомобиль?'\n" +
                "3. Когда даты и машина понятны, скажи, что для точного расчета цены и проверки доступности нужен контактный номер телефона для WhatsApp.\n" +
                "4. Задавай по ОДНОМУ вопросу за раз, не вываливай всё сразу, веди диалог как живой человек.\n" +
                "5. ЦЕНЫ: Так как цены меняются в зависимости от сезона, пиши примерные ориентиры: Эконом-класс (от 30-40$ в сутки), Средний класс (от 45-60$ в сутки), Премиум и кроссоверы (от 70$+ в сутки). Напоминай, что точную цену под их даты сейчас рассчитает менеджер в WhatsApp.\n" +
                "6. КРИТИЧЕСКОЕ ПРАВИЛО: Как только клиент написал свой номер телефона ИЛИ подтвердил контакт (например, написал 'Да, актуален'), ТЫ ДОЛЖЕН СРАЗУ сказать: 'Большое спасибо! Передаю ваши данные (марку, даты) нашей команде. Менеджер уже связывается с вами в WhatsApp для завершения бронирования!'. После этого больше никаких вопросов про авто и телефон не задавай.\n\n" +
                "Наши главные плюсы: Аренда БЕЗ ЗАЛОГА (депозита), 100% полная страховка включена, бесплатная доставка авто в аэропорт Анталии и к отелям Кемера.";

            const apiKey = process.env.GEMINI_API_KEY;
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
                botReply = `Ошибка Gemini: ${errData.error?.message || 'Неизвестный сбой'}`;
            }

            if (chatId) {
                await sendToTelegram(chatId, botReply);
            }
            return res.status(200).send('OK');

        } catch (error) {
            if (req.body?.message?.chat?.id) {
                await sendToTelegram(req.body.message.chat.id, `Ошибка: ${error.message}`);
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
