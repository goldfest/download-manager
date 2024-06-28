document.addEventListener('DOMContentLoaded', () => {
    const keywordInput = document.getElementById('keyword');
    const searchButton = document.getElementById('search');
    const clearStorageButton = document.getElementById('clear-storage');
    const urlList = document.getElementById('url-list');
    const downloadedList = document.getElementById('downloaded-list');
    const downloadStatus = document.getElementById('download-status');
    const downloadUrl = document.getElementById('download-url');
    const downloadSize = document.getElementById('download-size');
    const downloadProgress = document.getElementById('download-progress');
    const downloadProgressBar = document.getElementById('download-progress-bar');
    const downloadThreads = document.getElementById('download-threads');
    const ws = new WebSocket('ws://localhost:3000');

    searchButton.addEventListener('click', () => {
        const keyword = keywordInput.value.trim();
        if (keyword) {
            ws.send(JSON.stringify({ type: 'keyword', keyword }));
        }
    });

    clearStorageButton.addEventListener('click', () => {
        localStorage.clear();
        updateDownloadedList();
        ws.send(JSON.stringify({ type: 'clear-downloads' }));
    });

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(data); // Для отладки
        if (data.type === 'urls') {
            urlList.innerHTML = '';
            data.urls.forEach(url => {
                const li = document.createElement('li');
                li.className = 'list-group-item download-item';
                li.innerHTML = `
                    <span>${url}</span>
                    <div>
                        <button class="btn btn-primary">Скачать</button>
                    </div>
                `;
                li.querySelector('.btn-primary').addEventListener('click', (event) => {
                    event.stopPropagation();
                    downloadContent(url);
                });
                urlList.appendChild(li);
            });
        } else if (data.type === 'progress') {
            downloadUrl.textContent = `URL: ${data.url}`;
            downloadSize.textContent = `Размер: ${data.downloadedSize} / ${data.contentSize} байт`;
            downloadProgressBar.style.width = `${(data.downloadedSize / data.contentSize * 100).toFixed(2)}%`;
            downloadThreads.textContent = `Потоки: ${data.threads}`;
        } else if (data.type === 'complete') {
            alert(data.message);
            saveToLocalStorage(data.url, data.filePath);
            downloadStatus.style.display = 'none'; // Скрываем статус загрузки
        } else if (data.type === 'error') {
            alert(data.message);
        }
    };

    function downloadContent(url) {
        const content = localStorage.getItem('downloadedContent') || '[]';
        const contentArray = JSON.parse(content);

        if (contentArray.some(item => item.url === url)) {
            alert('Файл уже скачан');
            return;
        }

        ws.send(JSON.stringify({ type: 'download', url }));
        downloadStatus.style.display = 'block';  // Показываем статус загрузки
    }

    function saveToLocalStorage(url, filePath) {
        const content = localStorage.getItem('downloadedContent') || '[]';
        const contentArray = JSON.parse(content);
        contentArray.push({ url, filePath });
        localStorage.setItem('downloadedContent', JSON.stringify(contentArray));
        updateDownloadedList();
    }

    function updateDownloadedList() {
        const content = localStorage.getItem('downloadedContent') || '[]';
        const contentArray = JSON.parse(content);
        downloadedList.innerHTML = '';
        contentArray.forEach(item => {
            const li = document.createElement('li');
            li.className = 'list-group-item download-item';
            li.innerHTML = `
                <span>${item.url}</span>
                <div class="col-3 mb-1">
                    <button class="btn btn-success mb-1">Открыть</button>
                    <button class="btn btn-danger mb-1">Удалить</button>
                </div>
            `;
            li.querySelector('.btn-success').addEventListener('click', (event) => {
                event.stopPropagation();
                openContent(item.filePath);
            });
            li.querySelector('.btn-danger').addEventListener('click', (event) => {
                event.stopPropagation();
                deleteContent(item.url, item.filePath);
            });
            downloadedList.appendChild(li);
        });
    }

    function openContent(filePath) {
        const win = window.open();
        win.document.write(`<iframe src="${filePath}" frameborder="0" style="border:0; width:100%; height:100%;" allowfullscreen></iframe>`);
    }

    function deleteContent(url, filePath) {
        ws.send(JSON.stringify({ type: 'delete', url, filePath }));
        const content = localStorage.getItem('downloadedContent') || '[]';
        const contentArray = JSON.parse(content);
        const updatedContentArray = contentArray.filter(item => item.url !== url);
        localStorage.setItem('downloadedContent', JSON.stringify(updatedContentArray));
        updateDownloadedList();
    }

    updateDownloadedList();
});
