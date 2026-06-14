import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

// Инициализируем API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export default async function handler(req, res) {
  // Настройка CORS заголовков, чтобы сайт на Beget мог спокойно достучаться до Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Если браузер делает предварительный запрос OPTIONS — одобряем его
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(200).send('Бот Капитана яхты Grey работает!');
  }

  try {
    const body = req.body;
    let userText = "";
    let isTelegram = false;
    let chatId = null;

    // 1. ОПРЕДЕЛЯЕМ ИСТОЧНИК ЗАПРОСА
    if (body && body.message) {
      // Это запрос от Telegram
      isTelegram = true;
      userText = body.message.text;
      chatId = body.message.chat.id;

      // Защита от старых сообщений в Telegram
      const messageAge = Math.floor(Date.now() / 1000) - body.message.date;
      if (messageAge > 120) {
        return res.status(200).send('OK');
      }

      // Обработка команды /start для Telegram
      if (userText === '/start') {
        const welcome = "Приветствую на борту моторной яхты «Grey»! 🎣⚓\nЯ — Капитан вашего рыболовного тура. Готовы выйти в открытое море?\n\nWelcome aboard the motor yacht \"Grey\"! 🎣⚓\nReady to go out into the open sea?";
        await sendTelegram(chatId, welcome);
        return res.status(200).send('OK');
      }
    } else if (body && body.text) {
      // Это запрос от вашего сайта (виджета)
      userText = body.text;
    } else if (typeof body === 'string') {
      // Если сайт прислал просто текст
      userText = body;
    } else {
      return res.status(200).send('No text found');
    }

    if (!userText) {
      return res.status(200).send('Empty text');
    }

    // 2. ИНСТРУКЦИЯ КАПИТАНА ДЛЯ GEMINI
    const systemPrompt = `
      Ты — Капитан нашей моторной яхты «Grey» в Кемере (fishing.flyzoom.ru). 
      
      КРИТИЧЕСКОЕ П ПРАВИЛО ЯЗЫКА:
      Определи язык пользователя. Если пользователь пишет на русском — отвечай строго на русском. If the user writes in English — reply strictly in English. Eğer kullanıcı Türkçe yazıyorsa — kesinlikle Türkçe cevap ver.

      РУССКИЙ ИНСТРУКЦИЯ:
      1. Отвечай СТРОГО по нашей программе: выходим из порта Кемер Марина в открытое Средиземное море. Утренний тур (07:30 - 13:30), Вечерний тур (15:00 - 19:00). Ловим дораду, сибаса, тунца, ставриду.
      2. В туре ВКЛЮЧЕНО: трансфер из отеля и обратно, удочки, снасти, эхолот, легкий завтрак (чай, кофе, круассаны, сыр) или ужин из свежей рыбы, а также обед на борту (жарим пойманную рыбу на гриле!). Напитки безлимитные (Кола, Фанта, вода).
      3. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО называть цены в цифрах (на сайте написано "Цена договорная"). Если спросят про стоимость — отвечай: "Для уточнения стоимости на ваши даты с вами свяжется менеджер в WhatsApp. Оставьте, пожалуйста, ваш номер телефона или ник?"
      4. ЗАПРЕЩЕНО выдумывать рыбалку с берега и запрещено посылать человека искать инфу на сайт. Твоя единственная цель — взять телефон гостя для WhatsApp.

      ENGLISH INSTRUCTIONS:
      1. Answer STRICTLY according to our program: we leave Kemer Marina port into the open Mediterranean Sea. Morning tour (07:30 - 13:30), Evening tour (15:00 - 19:00). We catch sea bream, sea bass, tuna.
      2. INCLUDED in the tour: transfer from the hotel, fishing rods, tackle, fishfinder, light breakfast (tea, coffee, croissants, cheese) or fish dinner, and LUNCH ON BOARD (we grill the caught fish!). Unlimited drinks (Cola, Fanta, water).
      3. IT IS FORBIDDEN to name prices in numbers (it says "Agreement price"). If they ask about the cost, reply strictly: "To clarify the cost for your dates, our manager will contact you on WhatsApp. Could you please leave your phone number?"
      4. DO NOT invent shore fishing. Your only goal is to get the guest's phone number for WhatsApp.

      TÜRKÇE TALİMATLAR:
      1. KESİNLİKLE programımıza göre cevap ver: Kemer Marina limanından açık Akdeniz'e açılıyoruz. Sabah turu (07:30 - 13:30), Akşam turu (15:00 - 19:00). Çipura, levrek, ton balığı yakalıyoruz.
      2. TURA DAHİL OLANLAR: Otelden transfer, oltalar, takımlar, sonar, hafif kahvaltı veya taze balık akşam yemeği, ayrıca TEKNEDE ÖĞLE YEMEĞİ (yakalanan balıkları ızgarada pişiriyoruz!). Sınırsız içecekler (Kola, Fanta, su).
      3. RAKAM OLARAK FİYAT VERMEK YASAKTIR. Fiyat sorarlarsa kesinlikle şu şekilde cevap ver: "Tarihleriniz için fiyatı netleştirmek adına menajerimiz sizinle WhatsApp üzerinden iletişime geçecektir. Lütfen telefon numaranızı bırakabilir misiniz?"

      Стиль общения: вежливый, краткий, в гостеприимном морском стиле. Абзацы по 2 строчки.
    `;

    try {
      // Запрос к Gemini
      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nВопрос от гостя: "${userText}"` }] }
        ]
      });

      const botReply = result.response.text() || "Штиль на связи... Повторите вопрос.";

      // 3. ОТПРАВЛЯЕМ ОТВЕТ ТУДА, ОТКУДА ОН ПРИШЕЛ
      if (isTelegram) {
        await sendTelegram(chatId, botReply);
        return res.status(200).send('OK');
      } else {
        // Если запрос с сайта — возвращаем текст прямо в JSON ответе для виджета
        return res.status(200).json({ reply: botReply, text: botReply });
      }

    } catch (aiError) {
      console.error('КРИТИЧЕСКАЯ ОШИБКА GEMINI API:', aiError);
      const limitError = "⏳ Извините, Капитан временно занят швартовкой. Пожалуйста, повторите вопрос через пару секунд.";
      
      if (isTelegram) {
        await sendTelegram(chatId, limitError);
        return res.status(200).send('OK');
      } else {
        return res.status(200).json({ reply: limitError, text: limitError });
      }
    }

  } catch (error) {
    console.error('Общая ошибка сервера:', error);
    return res.status(500).send('Internal Error');
  }
}

// Функция для Telegram
async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_TOKEN || "8618014725:AAEM0d-T_sKi6nndj1f78DQb46Ts-WajUKk";
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}
