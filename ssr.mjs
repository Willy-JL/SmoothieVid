import express from 'express';
import { handler as ssrHandler } from './dist/server/entry.mjs';

const app = express();
app.set('base', '/smoothievid');

app.use((_, res, next) => {
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    res.header('Cross-Origin-Resource-Policy', 'same-origin');
    res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });
  
app.use(express.static('dist/client/'));
app.use(ssrHandler);

app.listen(3000);
