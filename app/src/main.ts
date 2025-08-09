import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });

  // CORS preciso per il tuo FE
  app.enableCors({
    origin: ['http://liquify.link:4201'],
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
    // credentials: true, // SOLO se usi cookie/withCredentials
    maxAge: 86400,
  });

  // Gestione preflight (OPTIONS) il più presto possibile
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Evita di parsare multipart con bodyParser: lo farà Multer
  app.use(express.json({ limit: '0' }));
  app.use(express.urlencoded({ extended: true, limit: '0' }));

  await app.listen(3005, '0.0.0.0');
}
bootstrap();
