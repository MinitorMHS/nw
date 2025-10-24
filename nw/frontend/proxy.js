const form = document.getElementById('proxy-form');
const urlInput = document.getElementById('url-input');

form.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = urlInput.value;
    if (url) {
        // URL-safe base64 encoding
        const encodedUrl = btoa(url).replace(/\//g, '_').replace(/\+/g, '-');
        window.location.href = `/${encodedUrl}`;
    }
});
