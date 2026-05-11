# AI Assistance Telegram Bot (Ollama + PowerShell)

Bot Telegram cerdas yang ditenagai oleh **Ollama (GPT-OSS)** dengan kemampuan untuk berinteraksi langsung dengan sistem operasi Windows melalui PowerShell. Bot ini dapat membuat file, menjalankan perintah terminal, dan mengirimkan file dari PC ke Telegram.

## 🚀 Fitur Utama

*   **Integrasi Ollama:** Menggunakan model LLM lokal (Local AI) untuk privasi dan kecepatan.
*   **PowerShell Integration:** Menjalankan perintah PowerShell langsung dari chat Telegram.
*   **File Management:** Membuat file baru (`CREATE_FILE`) dan mengirimkan file dari PC (`SEND_FILE`).
*   **Identity System:** AI akan mengenali nama dan peran yang kamu berikan saat setup awal.
*   **Secure:** Menggunakan environment variables (`.env`) untuk melindungi token bot.

## 🛠️ Prasyarat

Sebelum menjalankan bot, pastikan kamu sudah menginstal:
1.  [Node.js](https://nodejs.org/) (Versi 16 atau terbaru)
2.  [Ollama](https://ollama.com/) (Sudah terinstal model `gpt-oss:120b-cloud` atau sesuaikan di kode)
3.  Token Bot Telegram dari [@BotFather](https://t.me/botfather)

## 📦 Instalasi

1.  **Clone Repository:**
    ```bash
    git clone [https://github.com/rtegar1/aiassistance.git](https://github.com/rtegar1/aiassistance.git)
    cd aiassistance
    ```

2.  **Install Dependensi:**
    ```bash
    npm install
