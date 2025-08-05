import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PdfService } from './pdf.service';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('split')
  @UseInterceptors(FileInterceptor('pdf'))
  async splitPdf(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    try {
      const imageBuffer = await this.pdfService.convertFirstPageToImage(file.buffer);
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'attachment; filename=page-1.png');
      res.send(imageBuffer);
    } catch (error) {
      throw new BadRequestException(`Error processing PDF: ${error.message}`);
    }
  }

  @Post('split-all')
  @UseInterceptors(FileInterceptor('pdf'))
  async splitPdfAllPages(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ pages: string[]; count: number }> {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    try {
      const splitPdfs = await this.pdfService.splitPdfIntoPages(file.buffer);
      
      // Convert to base64 for JSON response
      const pages = splitPdfs.map((pdf, index) => ({
        pageNumber: index + 1,
        pdfData: pdf.toString('base64'),
      }));

      return {
        pages: pages.map(p => p.pdfData),
        count: splitPdfs.length,
      };
    } catch (error) {
      throw new BadRequestException(`Error processing PDF: ${error.message}`);
    }
  }

  @Post('extract-text')
  @UseInterceptors(FileInterceptor('pdf'))
  async extractText(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ pages: { pageNumber: number; text: string }[]; pageCount: number }> {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    try {
      const extractedText = await this.pdfService.extractTextFromPdf(file.buffer);
      
      const pages = extractedText.text.map((text, index) => ({
        pageNumber: index + 1,
        text: text,
      }));

      return {
        pages: pages,
        pageCount: extractedText.pageCount,
      };
    } catch (error) {
      throw new BadRequestException(`Error extracting text from PDF: ${error.message}`);
    }
  }
}