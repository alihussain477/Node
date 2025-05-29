const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = 3000;

// Serve HTML UI
app.get('/', (_, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Automation</title>
    <style>
        body { font-family: Arial; background: #111; color: white; text-align: center; padding: 30px; }
        .box { background: #222; padding: 20px; border-radius: 10px; width: 500px; margin: auto; }
        input, button, textarea { padding: 10px; margin: 10px; width: 90%; border-radius: 5px; border: none; }
        button { background: lime; color: black; cursor: pointer; }
    </style>
</head>
<body>
    <h1>📲 WhatsApp Baileys Web UI</h1>
    <div class="box">
        <form action="/pair" method="post">
            <input name="number" placeholder="Enter Your WhatsApp Number" required>
            <button type="submit">Generate QR</button>
        </form>
        <br><br>
        <form action="/send" method="post" enctype="multipart/form-data">
            <input name="number" placeholder="Your WhatsApp Number (Same)" required><br>
            <input name="target" placeholder="Target Number with Country Code" required><br>
            <input name="delay" placeholder="Delay in seconds" required><br>
            <input type="file" name="msgfile" required><br>
            <button type="submit">Send Messages</button>
        </form>
    </div>
</body>
</html>
    `);
});

// Handle QR Pairing
app.post('/pair', express.urlencoded({ extended: true }), async (req, res) => {
    const number = req.body.number;
    const authPath = `./auth/${number}`;
    fs.mkdirSync(authPath, { recursive: true });

    const { state, saveState } = useSingleFileAuthState(`${authPath}/auth.json`);
    const sock = makeWASocket({ auth: state });

    sock.ev.on('creds.update', saveState);
    sock.ev.on('connection.update', (update) => {
        if (update.qr) {
            console.log(`🔑 QR for ${number}:`, update.qr);
        }
    });

    res.send(`<h2 style="color:lime;">QR Code generated in terminal for ${number}. Please scan it!</h2>`);
});

// Handle Message Sending
app.post('/send', upload.single('msgfile'), express.urlencoded({ extended: true }), async (req, res) => {
    const { number, target, delay } = req.body;
    const authPath = `./auth/${number}`;
    const msgPath = req.file.path;

    if (!fs.existsSync(`${authPath}/auth.json`)) {
        return res.send(`<h2 style="color:red;">No session found. Please pair first.</h2>`);
    }

    const { state, saveState } = useSingleFileAuthState(`${authPath}/auth.json`);
    const sock = makeWASocket({ auth: state });

    sock.ev.on('creds.update', saveState);

    const lines = fs.readFileSync(msgPath, 'utf-8').split('\n').filter(Boolean);
    for (let line of lines) {
        await sock.sendMessage(`${target}@s.whatsapp.net`, { text: line.trim() });
        console.log(`✅ Sent: ${line}`);
        await new Promise(res => setTimeout(res, delay * 1000));
    }

    res.send(`<h2 style="color:lime;">Messages sent to ${target}</h2>`);
});

// Start Server
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
