import { Module } from '@nestjs/common';
import { LayoutController } from './layout.controller';
import { LayoutService } from './layout.service';
import { PdfIndexingModule } from '../pdf-indexing/pdf-indexing.module';

@Module({
  imports: [PdfIndexingModule],
  controllers: [LayoutController],
  providers: [LayoutService],
  exports: [LayoutService],
})
export class LayoutModule {}
