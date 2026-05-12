const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 2444;

const server = http.createServer((req, res) => {
    // index.html dosyasının yolunu belirle
    const filePath = path.join(__dirname, 'index.html');


    // Dosyayı oku
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end(`Sunucu Hatası: ${err.code}`);
        } else {
            // Başarılıysa içeriği HTML olarak gönder
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});