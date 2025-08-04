import { Controller, Get, Post, Body, Render } from '@nestjs/common';
import { PdfIndexingService } from './pdf-indexing.service';

@Controller('indicizza-pdf')
export class PdfIndexingController {
  constructor(private readonly pdfIndexingService: PdfIndexingService) {}

  @Get()
  @Render('pdf-indexing/index')
  index() {
    return { 
      title: 'Indicizza PDF',
      message: 'Carica e indicizza i tuoi documenti PDF'
    };
  }

  @Post('upload')
  async uploadPdf(@Body() body: any) {
    return this.pdfIndexingService.indexPdf(body);
  }
}
