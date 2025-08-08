import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  Body,
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

  @Post('split-images')
  @UseInterceptors(FileInterceptor('pdf'))
  async splitPdfToImages(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ images: string[]; count: number }> {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    try {
      const imageBuffers = await this.pdfService.splitPdfIntoImages(file.buffer);
      
      // Convert to base64 for JSON response
      const images = imageBuffers.map(buffer => buffer.toString('base64'));

      return {
        images: images,
        count: imageBuffers.length,
      };
    } catch (error) {
      throw new BadRequestException(`Error converting PDF to images: ${error.message}`);
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

  @Post('create-index')
  async createIndex(
    @Body() body: { entries: { title: string; source: string; pageNumber?: number }[] },
    @Res() res: Response,
  ) {
    if (!body.entries || !Array.isArray(body.entries)) {
      throw new BadRequestException('Entries array is required');
    }

    if (body.entries.length === 0) {
      throw new BadRequestException('At least one entry is required');
    }

    // Validate entries structure
    for (const entry of body.entries) {
      if (!entry.title || !entry.source) {
        throw new BadRequestException('Each entry must have both title and source');
      }
    }

    try {
      const pdfBuffer = await this.pdfService.createIndexPdf(body.entries);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=indice_generato.pdf');
      res.send(pdfBuffer);
    } catch (error) {
      throw new BadRequestException(`Error creating index PDF: ${error.message}`);
    }
  }
}