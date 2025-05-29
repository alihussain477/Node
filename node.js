// sender.js
import makeWASocket, { useSingleFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import * as fs from 'fs'
import * as path from 'path'

const args = process.argv.slice(2)
const mode = args[0]
const number = args[1]
const authDir = `./auth/${number}`

if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })
const { state, saveState } = useSingleFileAuthState(`${authDir}/auth.json`)

async function startSocket() {
    const sock = makeWASocket({ auth: state })
    sock.ev.on('creds.update', saveState)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) console.log(`🔑 Scan QR for ${number}:`, qr)

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            if (shouldReconnect) startSocket()
        }
    })

    return sock
}

if (mode === 'pair') {
    await startSocket()
}

if (mode === 'send') {
    const target = args[2]
    const delay = parseInt(args[3])
    const filePath = args[4]
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)

    const sock = await startSocket()
    for (const line of lines) {
        await sock.sendMessage(`${target}@s.whatsapp.net`, { text: line.trim() })
        console.log(`✅ Sent: ${line}`)
        await new Promise(res => setTimeout(res, delay * 1000))
    }
    process.exit(0)
}
