const backendUrlInput = document.getElementById('backend-url-input');
const urlInput = document.getElementById('url-input');
const proxyButton = document.getElementById('proxy-button');
const proxyContainer = document.getElementById('proxy-container');

proxyButton.addEventListener('click', () => {
    const backendUrl = backendUrlInput.value;
    const url = urlInput.value;
    if (backendUrl && url) {
        // Clear previous content
        proxyContainer.innerHTML = '';

        // Create a sandboxed iframe
        const iframe = document.createElement('iframe');
        iframe.sandbox = 'allow-forms allow-scripts allow-same-origin';
        iframe.src = `${backendUrl}?url=${encodeURIComponent(url)}`;
        iframe.style.width = '100%';
        iframe.style.height = '100vh';
        iframe.style.border = 'none';

        proxyContainer.appendChild(iframe);
    }
});
