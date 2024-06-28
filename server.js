const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const port = 3000;

const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

// Хранение ключевых слов и соответствующих URL
const keywords = {
    'рататуй': [
        'https://www.learningcontainer.com/wp-content/uploads/2020/04/sample-text-file.txt',
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    ],
    'sample': [
        'https://www.gutenberg.org/files/2600/2600-0.txt',
        'https://s2.best-wallpaper.net/wallpaper/2560x1440/1307/Canada-Yoho-lake-forest-mountains-trees-reflection_2560x1440.jpg',
        'https://people.sc.fsu.edu/~jburkardt/data/csv/hw_200.csv',
        'https://www.learningcontainer.com/wp-content/uploads/2020/07/Sample-JPEG-Image-file.jpg',
        'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4'
    ]
};

app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(downloadDir));

// Создание HTTP сервера
const server = app.listen(port, () => {
    console.log(`HTTP сервер запущен на http://localhost:${port}`);
});

// Создание WebSocket сервера
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'keyword') {
            const urls = keywords[data.keyword];
            if (urls) {
                ws.send(JSON.stringify({ type: 'urls', urls }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Ключевое слово не найдено' }));
            }
        } else if (data.type === 'download') {
            downloadContent(ws, data.url);
        } else if (data.type === 'delete') {
            deleteContent(data.url, data.filePath, ws);
        } else if (data.type === 'clear-downloads') {
            clearDownloads(ws);
        }
    });
});

function downloadContent(ws, url) {
    const numThreads = 4;  // Количество потоков
    let downloadedSize = 0;
    let contentSize = 0;

    axios.get(url, {
        responseType: 'stream'
    }).then(response => {
        contentSize = parseInt(response.headers['content-length']);
        const filePath = path.join(downloadDir, path.basename(url));
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        response.data.on('data', chunk => {
            downloadedSize += chunk.length;
            ws.send(JSON.stringify({
                type: 'progress',
                url,
                downloadedSize,
                contentSize,
                threads: numThreads
            }));
        });

        writer.on('finish', () => {
            ws.send(JSON.stringify({ type: 'complete', message: 'Загрузка завершена', url, filePath: `/downloads/${path.basename(filePath)}` }));
        });

        writer.on('error', err => {
            ws.send(JSON.stringify({ type: 'error', message: `Ошибка загрузки: ${err.message}` }));
        });
    }).catch(err => {
        ws.send(JSON.stringify({ type: 'error', message: `Ошибка запроса: ${err.message}` }));
    });
}

function deleteContent(url, filePath, ws) {
    const fullFilePath = path.join(__dirname, filePath);
    fs.unlink(fullFilePath, (err) => {
        if (err) {
            ws.send(JSON.stringify({ type: 'error', message: `Ошибка удаления: ${err.message}` }));
        } else {
            ws.send(JSON.stringify({ type: 'delete-complete', message: 'Файл удален', url }));
        }
    });
}

function clearDownloads(ws) {
    fs.readdir(downloadDir, (err, files) => {
        if (err) {
            ws.send(JSON.stringify({ type: 'error', message: `Ошибка чтения директории: ${err.message}` }));
            return;
        }

        files.forEach(file => {
            const filePath = path.join(downloadDir, file);
            fs.unlink(filePath, (err) => {
                if (err) {
                    ws.send(JSON.stringify({ type: 'error', message: `Ошибка удаления файла: ${err.message}` }));
                }
            });
        });

        ws.send(JSON.stringify({ type: 'clear-complete', message: 'Все файлы удалены' }));
    });
}
