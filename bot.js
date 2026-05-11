require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Mengambil token dari environment variable
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error("ERROR: TELEGRAM_BOT_TOKEN tidak ditemukan di file .env");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const AI_FILE = './identify.md';
const USER_FILE = './user.md';

let setupState = { step: 0, aiData: {}, userData: {} };

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userText = msg.text;

    if (!userText) return;

    if (!fs.existsSync(AI_FILE) || !fs.existsSync(USER_FILE)) {
        handleFullSetup(chatId, userText);
        return;
    }

    const ai = JSON.parse(fs.readFileSync(AI_FILE, 'utf8'));
    const user = JSON.parse(fs.readFileSync(USER_FILE, 'utf8'));

    // Update Prompt untuk memberi tahu AI bahwa ia menggunakan PowerShell
    const systemPrompt = `Nama kamu ${ai.nama}. Tipe ${ai.tipe}. Kamu bicara dengan ${user.panggilan}.
    KEMAMPUAN WINDOWS 11 (POWERSHELL):
    - Buat file: [CREATE_FILE: nama.ext | isi]
    - Perintah PowerShell: [RUN_CMD: perintah]
    - Kirim file ke user: [SEND_FILE: nama_file.ext]
    Gunakan [SEND_FILE: ...] jika user minta dikirimkan file yang ada di PC.`;

    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'gpt-oss:120b-cloud',
            prompt: `${systemPrompt}\n\nUser (${user.panggilan}): ${userText}\nAI:`,
            stream: false
        });

        let aiReply = response.data.response;

        // --- FITUR: KIRIM FILE DARI PC KE TELEGRAM ---
        if (aiReply.includes('[SEND_FILE:')) {
            const matchSend = aiReply.match(/\[SEND_FILE:\s*(.*?)\]/);
            if (matchSend) {
                const fileName = matchSend[1].trim();
                const filePath = path.join(__dirname, fileName);

                if (fs.existsSync(filePath)) {
                    bot.sendDocument(chatId, filePath, { caption: `Ini file yang kamu minta, ${user.panggilan}.` });
                    aiReply = aiReply.replace(matchSend[0], "📤 *Mengirim file...*");
                } else {
                    aiReply = aiReply.replace(matchSend[0], `❌ File \`${fileName}\` tidak ditemukan di PC.`);
                }
            }
        }

        // --- FITUR: BUAT FILE ---
        if (aiReply.includes('[CREATE_FILE:')) {
            const match = aiReply.match(/\[CREATE_FILE:\s*(.*?)\s*\|\s*([\s\S]*?)\]/);
            if (match) {
                const targetPath = path.join(__dirname, match[1].trim());
                fs.writeFileSync(targetPath, match[2].trim());
                aiReply = `✅ File \`${match[1]}\` berhasil dibuat.\n\n` + aiReply.replace(match[0], "");
            }
        }

        // --- FITUR: EKSEKUSI POWERSHELL ---
        if (aiReply.includes('[RUN_CMD:')) {
            const matchCmd = aiReply.match(/\[RUN_CMD:\s*(.*?)\]/);
            if (matchCmd) {
                const command = matchCmd[1].trim();
                
                // Menjalankan perintah lewat powershell.exe
                exec(command, { shell: 'powershell.exe' }, (err, stdout, stderr) => {
                    let res = `🟦 **PowerShell Output:**\n${stdout ? `\`\`\`\n${stdout}\n\`\`\`` : "✅ Perintah selesai tanpa output."}`;
                    if (err) res = `❌ **PowerShell Error:**\n\`\`\`\n${stderr || err.message}\n\`\`\``;
                    bot.sendMessage(chatId, res, { parse_mode: 'Markdown' });
                });
                
                aiReply = aiReply.replace(matchCmd[0], "⏳ *Menjalankan perintah PowerShell...*");
            }
        }

        bot.sendMessage(chatId, aiReply, { parse_mode: 'Markdown' });

    } catch (err) {
        bot.sendMessage(chatId, '❌ Gagal menghubungi Ollama.');
    }
});

function handleFullSetup(chatId, text) {
    switch (setupState.step) {
        case 0:
            bot.sendMessage(chatId, "Halo! Saya butuh setting awal.\n\nSiapa **Nama AI** saya?");
            setupState.step = 1; break;
        case 1:
            setupState.aiData.nama = text;
            bot.sendMessage(chatId, `Nama saya ${text}. Apa **Tipe/Peran** saya?`);
            setupState.step = 2; break;
        case 2:
            setupState.aiData.tipe = text;
            bot.sendMessage(chatId, "Siapa **Nama Asli** Anda?");
            setupState.step = 3; break;
        case 3:
            setupState.userData.nama_asli = text;
            bot.sendMessage(chatId, "Saya harus memanggil Anda dengan sebutan apa?");
            setupState.step = 4; break;
        case 4:
            setupState.userData.panggilan = text;
            fs.writeFileSync(AI_FILE, JSON.stringify(setupState.aiData, null, 2));
            fs.writeFileSync(USER_FILE, JSON.stringify(setupState.userData, null, 2));
            bot.sendMessage(chatId, `✅ Setup selesai, ${text}!`);
            setupState.step = 0; break;
    }
}