require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os'); // Digunakan untuk mendeteksi OS

// Mengambil token dari environment variable
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error("ERROR: TELEGRAM_BOT_TOKEN tidak ditemukan di file .env");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Gunakan path.join agar penulisan path aman di Windows (\) maupun Linux/Mac (/)
const AI_FILE = path.join(__dirname, 'identify.json'); 
const USER_FILE = path.join(__dirname, 'user.json');

let setupState = { step: 0, aiData: {}, userData: {} };

// Deteksi OS dan Shell
const isWindows = os.platform() === 'win32';
const currentOS = isWindows ? "Windows" : os.platform() === 'darwin' ? "macOS" : "Linux";
const defaultShell = isWindows ? 'powershell.exe' : '/bin/bash';

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userText = msg.text;

    if (!userText) return;

    // Cek file konfigurasi, jika tidak ada masuk ke mode setup
    if (!fs.existsSync(AI_FILE) || !fs.existsSync(USER_FILE)) {
        handleFullSetup(chatId, userText);
        return;
    }

    const ai = JSON.parse(fs.readFileSync(AI_FILE, 'utf8'));
    const user = JSON.parse(fs.readFileSync(USER_FILE, 'utf8'));

    // Prompt dinamis berdasarkan OS
    const systemPrompt = `Nama kamu ${ai.nama}. Tipe ${ai.tipe}. Kamu bicara dengan ${user.panggilan}.
    LINGKUNGAN SAAT INI: ${currentOS} (Terminal: ${defaultShell})
    KEMAMPUAN:
    - Buat file: [CREATE_FILE: nama.ext | isi]
    - Perintah Terminal: [RUN_CMD: perintah]
    - Kirim file ke user: [SEND_FILE: nama_file.ext]
    Gunakan [SEND_FILE: ...] jika user minta file dari sistem. Gunakan perintah yang sesuai dengan ${currentOS}.`;

    try {
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'gpt-oss:120b-cloud',
            prompt: `${systemPrompt}\n\nUser (${user.panggilan}): ${userText}\nAI:`,
            stream: false
        });

        let aiReply = response.data.response;

        // --- FITUR: KIRIM FILE ---
        if (aiReply.includes('[SEND_FILE:')) {
            const matchSend = aiReply.match(/\[SEND_FILE:\s*(.*?)\]/);
            if (matchSend) {
                const fileName = matchSend[1].trim();
                const filePath = path.resolve(__dirname, fileName);

                if (fs.existsSync(filePath)) {
                    bot.sendDocument(chatId, filePath, { caption: `Ini file yang kamu minta, ${user.panggilan}.` });
                    aiReply = aiReply.replace(matchSend[0], "📤 *Mengirim file...*");
                } else {
                    aiReply = aiReply.replace(matchSend[0], `❌ File \`${fileName}\` tidak ditemukan.`);
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

        // --- FITUR: EKSEKUSI PERINTAH (CMD/BASH) ---
        if (aiReply.includes('[RUN_CMD:')) {
            const matchCmd = aiReply.match(/\[RUN_CMD:\s*(.*?)\]/);
            if (matchCmd) {
                const command = matchCmd[1].trim();
                
                exec(command, { shell: defaultShell }, (err, stdout, stderr) => {
                    let res = `💻 **Terminal Output (${currentOS}):**\n${stdout ? `\`\`\`\n${stdout}\n\`\`\`` : "✅ Selesai (Tanpa output)."}`;
                    if (err) res = `❌ **Error:**\n\`\`\`\n${stderr || err.message}\n\`\`\``;
                    bot.sendMessage(chatId, res, { parse_mode: 'Markdown' });
                });
                
                aiReply = aiReply.replace(matchCmd[0], `⏳ *Menjalankan perintah di ${currentOS}...*`);
            }
        }

        bot.sendMessage(chatId, aiReply, { parse_mode: 'Markdown' });

    } catch (err) {
        bot.sendMessage(chatId, '❌ Gagal menghubungi Ollama. Pastikan Ollama jalan di localhost:11434');
    }
});

function handleFullSetup(chatId, text) {
    switch (setupState.step) {
        case 0:
            bot.sendMessage(chatId, "Halo! Saya butuh setting awal.\n\nSiapa **Nama AI** saya?");
            setupState.step = 1; break;
        case 1:
            setupState.aiData.nama = text;
            bot.sendMessage(chatId, `Nama saya ${text}. Apa **Tipe/Peran** saya? (Contoh: Asisten Pribadi)`);
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
            bot.sendMessage(chatId, `✅ Setup selesai, ${text}! Sekarang saya siap bekerja di **${currentOS}**.`);
            setupState.step = 0; break;
    }
}