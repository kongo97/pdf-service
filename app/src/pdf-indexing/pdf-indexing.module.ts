import { Module } from '@nestjs/common';
import { PdfIndexingController } from './pdf-indexing.controller';
import { PdfIndexingService } from './pdf-indexing.service';

@Module({
  controllers: [PdfIndexingController],
  providers: [PdfIndexingService],
  exports: [PdfIndexingService],
})
export class PdfIndexingModule {}
