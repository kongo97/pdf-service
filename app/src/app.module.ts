import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LayoutModule } from './layout/layout.module';
import { PdfIndexingModule } from './pdf-indexing/pdf-indexing.module';

@Module({
  imports: [LayoutModule, PdfIndexingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
