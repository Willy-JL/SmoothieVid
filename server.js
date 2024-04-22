const express = require('express');

const app = express();
const port = process.env.PORT || 3000

app.use((_, res, next) => {
    // Required config for SharedArrayBuffer, which is necessary for ffmpeg.wasm
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    res.header('Cross-Origin-Resource-Policy', 'same-origin');
    res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}...`);
});
