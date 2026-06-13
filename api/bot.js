import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

// Инициализируем API. Ключ берется из переменных Vercel
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export default async function handler(req, res) {
  // Бот отвечает только на POST-запросы от Telegram
  if (req.method !== 'POST') {
    return res.status(200).send('Бот Капитана яхты Grey активен!');
  }

  try {
    const { message } = req.body;

    if (!message || !message.text) {
      return res.status(200).send('No text message');
    }

    // ЗАЩИТА ОТ ПЕРЕГРУЗА: Игнорируем сообщения старше 2 минут
    const messageAge = Math.floor(Date.now() / 1000) - message.date;
    if (messageAge > 120) {
      console.log(`Пропущено старое сообщение от чата ${message.chat.id}`);
      return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // Команда перезапуска /start
    if (userText === '/start') {
      const welcomeMessage = "Приветствую на борту моторной яхты «Grey»! 🎣⚓\nЯ — Капитан вашего рыболовного тура в Кемере. Готовы выйти в открытое море за отличным уловом? Расскажите, вы один планируете или большой компанией?\n\n---\n\nWelcome aboard the motor yacht \"Grey\"! 🎣⚓\nI am the Captain of your fishing tour in Kemer. Ready to go out into the open sea for a great catch? Tell me, are you planning alone or with a big company?\n\n---\n\n\"Grey\" motorlu yatına hoş geldiniz! 🎣⚓\nKemer'deki balık tutma turunuzun Kaptanıyım. Harika bir av için açık denize çıkmaya hazır mısınız? Söyleyin bana, tek başınıza mı yoksa büyük bir grupla mı planlıyorsunuz?";
      await sendTelegram(chatId, welcomeMessage);
      return res.status(200).send('OK');
    }

    // Мультиязычная инструкция Капитана для Gemini
    const systemPrompt = `
      Ты — Капитан нашей моторной яхты «Grey» в Кемере (fishing.flyzoom.ru). 
      
      КРИТИЧЕСКОЕ ПРАВИЛО ЯЗЫКА:
      Определи язык пользователя. Если пользователь пишет на русском — отвечай строго на русском. If the user writes in English — reply strictly in English. Eğer kullanıcı Türkçe yazıyorsa — kesinlikle Türkçe cevap ver.

      РУССКИЙ ИНСТРУКЦИЯ:
      1. Отвечай СТРОГО по нашей программе: выходим из порта Кемер Марина в открытое Средиземное море. Ловим дораду, сибаса, тунца, ставриду.
      2. В туре ВКЛЮЧЕНО: трансфер из отеля и обратно, удочки, снасти, эхолот, завтрак и ОБЕД НА БОРТУ (жарим пойманную рыбу на гриле!). Подходит для всей семьи и детей.
      3. ЗАПРЕЩЕНО называть цены в цифрах. Если спросят про стоимость — отвечай: "Для уточнения стоимости на ваши даты с вами свяжется менеджер в WhatsApp. Оставьте, пожалуйста, ваш номер телефона или ник?"
      4. ЗАПРЕЩЕНО выдумывать рыбалку с берега и запрещено посылать человека искать инфу на сайт. Твоя единственная цель — взять телефон гостя для WhatsApp.

      ENGLISH INSTRUCTIONS:
      1. Answer STRICTLY according to our program: we leave Kemer Marina port into the open Mediterranean Sea. We catch sea bream (dorada), sea bass (sibas), tuna, horse mackerel.
      2. INCLUDED in the tour: transfer from the hotel and back, fishing rods, tackle, fishfinder, breakfast, and LUNCH ON BOARD (we grill the caught fish!). Great for the whole family and kids.
      3. IT IS FORBIDDEN to name prices in numbers. If they ask about the cost, reply strictly: "To clarify the cost for your dates, our manager will contact you on WhatsApp. Could you please leave your phone number or nickname?"
      4. DO NOT invent shore fishing and DO NOT send people to look for information on the website. Your only goal is to get the guest's phone number for WhatsApp.

      TÜRKÇE TALİMATLAR:
      1. KESİNLİKLE programımıza göre cevap ver: Kemer Marina limanından açık Akdeniz'e açılıyoruz. Çipura (dorada), levrek (sibas), ton balığı, istavrit yakalıyoruz.
      2. TURA DAHİL OLANLAR: Otelden gidiş-dönüş transfer, oltalar, takımlar, sonar (balık bulucu), kahvaltı ve TEKNEDE ÖĞLE YEMEĞİ (yakalanan balıkları ızgarada pişiriyoruz!). Tüm aile ve çocuklar için uygundur.
      3. RAKAM OLARAK FİYAT VERMEK YASAKTIR. Fiyat sorarlarsa kesinlikle şu şekilde cevap ver: "Tarihleriniz için güncel fiyatı netleştirmek adına menajerimiz sizinle WhatsApp üzerinden iletişime geçecektir. Lütfen telefon numaranızı veya kullanıcı adınızı bırakabilir misiniz?"
      4. Kıyıdan balık tutmayı uydurma ve insanları web sitesinde bilgi aramaya gönderme. Tek amacınız WhatsApp için misafirin telefon numarasını almaktır.

      Стиль общения: вежливый, краткий, уважительный, в гостеприимном морском стиле.
    `;

    try {
      // Отправляем структурированный запрос
      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nВопрос от гостя / Guest question / Misafir sorusu: "${userText}"` }] }
        ]
      });

      const botReply = result.response.text() || "Штиль на связи... / Calm on the line... / Hat kesildi...";
      await sendTelegram(chatId, botReply);

    } catch (aiError) {
      console.error('КРИТИЧЕСКАЯ ОШИБКА GEMINI API:', aiError);
      await sendTelegram(chatId, "⏳ Извините, море слегка штормит (лимит запросов). Пожалуйста, повторите вопрос Капитану через пару секунд.\n\n⏳ Sorry, the sea is a bit rough (rate limit). Please repeat your question to the Captain in a couple of seconds.\n\n⏳ Üzgünüz, deniz biraz dalgalı (istek sınırı). Lütfen sorunuzu birkaç saniye sonra Kaptan'a tekrarlayın.");
    }

    return res.status(200).send('OK');

  } catch (error) {
    console.error('Общая ошибка сервера:', error);
    return res.status(500).send('Internal Error');
  }
}

// Функция для отправки сообщений обратно в Telegram
async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_TOKEN || "8618014725:AAEM0d-T_sKi6nndj1f78DQb46Ts-WajUKk";
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}
