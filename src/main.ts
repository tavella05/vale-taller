import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import router from './routes';

const app = express();

app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/media', express.static(path.join(process.cwd(), 'media')));

app.use('/api', router);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
});

export default app;
