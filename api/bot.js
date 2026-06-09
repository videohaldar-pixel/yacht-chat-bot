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
        return res.status(200).json({ status: "ok", message: "Fishing API стабильная версия запущена!" });
    }

    if (req.method === 'POST') {
        // Сразу отвечаем Телеграму "OK", чтобы он не дублировал запросы при микро-задержках
        res.status(200).send('OK');

        try {
            const body = req.body || {};
            let userMessage = "";
            let chatId = null;

            if (body.message && body.message.chat) {
                userMessage = body.message.text || "";
                chatId = body.message.chat.id;
            }

            if (!chatId || !userMessage) return;

            // Если это старт диалога, очищаем старую историю и приветствуем на 3 языках
            if (userMessage === '/start' || userMessage.trim() === '') {
                sessions[chatId] = []; 

                const welcomeText = 
                    "🇷🇺 Приветствуем! Я ИИ-помощник по организации морской рыбалки и яхт-экскурсий в Кемере.\n" +
                    "Предлагаем незабываемый отдых на нашей комфортабельной яхте «Gray»! Что вас больше интересует: утренняя рыбалка или аренда яхты для отдыха?\n\n" +
                    "🇹🇷 Merhaba! Kemer deniz balıkçılığı ve yat turları yapay zeka yardımcısıyım.\n" +
                    "Konforlu yatımız 'Gray' ile unutulmaz bir tatil sunuyoruz! Hangisiyle daha çok ilgilenirsiniz: sabah balık avı mı yoksa dinlenmek için yat kiralama mı?\n\n" +
                    "🇬🇧 Hello! I am your AI assistant for sea fishing and yacht excursions in Kemer.\n" +
                    "We offer an unforgettable vacation on our comfortable yacht \"Gray\"! What are you more interested in: morning fishing or renting a yacht for leisure?";
                
                await sendToTelegram(chatId, welcomeText);
                return;
            }

            if (!sessions[chatId]) {
                sessions[chatId] = [];
            }

            // Добавляем сообщение в историю
            sessions[chatId].push({ role: "user", parts: [{ text: userMessage }] });
            if (sessions[chatId].length > 6) { 
                sessions[chatId].shift(); // Держим легкий контекст
            }

            // Наш жесткий сценарий продаж для рыбалки БЕЗ ССЫЛОК
            const systemInstruction = 
                "Вы — профессиональный ИИ-менеджер по бронированию морских экскурсий и рыбалки в Кемере (Турция).\n" +
                "Твоя единственная цель — узнать у клиента тип отдыха (рыбалка или просто аренда яхты), количество человек, желаемую дату и взять контактный номер телефона для WhatsApp. Отвечай строго на языке пользователя.\n\n" +
                "ПРАВИЛА И СЦЕНАРИЙ:\n" +
                "1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО давать ссылки на сайты (например, fishing.flyzoom.ru) или писать их текстовые адреса. Клиент должен забронировать всё прямо здесь.\n" +
                "2. Задавай по ОДНОМУ вопросу за раз. Будь вежливым, создавай атмосферу классного отдыха на море.\n" +
                "3. Шаг 1: Уточни, нужна рыбалка (групповая/индивидуальная) или просто прогулка на яхте. Наша главная яхта называется «Gray».\n" +
                "4. Шаг 2: Узнай количество человек (взрослые и дети) и желаемую дату.\n" +
                "5. Шаг 3: Вежливо попроси номер телефона, чтобы менеджер скинул свободные часы и зафиксировал бронь.\n" +
                "6. ЦЕНЫ: Если спрашивают стоимость, пиши примерную вилку (Рыбалка от 40-50$ с человека, аренда всей яхты под компанию — от 70-100$ в час в зависимости от программы). Пиши, что в стоимость включены снасти, наживка, а также обед/завтрак от капитана на борту. Уточняй, что точный расчет сделает менеджер.\n" +
                "7. КРИТИЧЕСКОЕ ПРАВИЛО: Как только в сообщении клиента появляется номер телефона (или фраза подтверждения 'Да, актуален'), ты ДОЛЖЕН СРАЗУ ответить текстом: 'Большое спасибо! Предварительные данные по вашей морской прогулке приняты. Передаю заявку капитану. Наш менеджер уже связывается с вами в WhatsApp в течение пары минут для подтверждения!'. После этого больше никаких вопросов не задавай.";

            const apiKey = process.env.GEMINI_API_KEY;
            // Используем стабильную 1.5-flash
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: sessions[chatId],
                    systemInstruction: { parts: [{ text: systemInstruction }] }
                })
            });

            let botReply = "";
            if (geminiResponse.ok) {
                const geminiData = await geminiResponse.json();
                botReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Извините, возникла заминка. Попробуйте еще раз.";
                sessions[chatId].push({ role: "model", parts: [{ text: botReply }] });
            } else {
                botReply = "⏳ Извините, я получил слишком много сообщений одновременно. Пожалуйста, подождите пару секунд и повторите ваш последний вопрос — я обязательно отвечу!";
            }

            await sendToTelegram(chatId, botReply);

        } catch (error) {
            console.error("Global Error Fishing:", error);
        }
    }
}

async function sendToTelegram(chatId, text) {
    // ВАЖНО: Используется токен именно для рыбалки (убедитесь, что эта переменная создана в Vercel!)
    const token = process.env.TELEGRAM_TOKEN; 
    if (!token) return;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text })
        });
    } catch (e) {}
}proverka test
