import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { fromBuffer } from 'pdf2pic';
import pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async splitPdfIntoPages(pdfBuffer: Buffer): Promise<Buffer[]> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();
      const splitPdfs: Buffer[] = [];

      for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);
        
        const pdfBytes = await newPdf.save();
        splitPdfs.push(Buffer.from(pdfBytes));
      }

      return splitPdfs;
    } catch (error) {
      throw new Error(`Failed to split PDF: ${error.message}`);
    }
  }

  async convertFirstPageToImage(pdfBuffer: Buffer): Promise<Buffer> {
    try {
      this.logger.log('Starting PDF to image conversion');
      
      const convert = fromBuffer(pdfBuffer, {
        density: 200,
        saveFilename: 'page',
        savePath: '/tmp',
        format: 'png',
        width: 2480,
        height: 3508
      });
      
      this.logger.log('Converting page 1 to image');
      const result = await convert(1, { responseType: 'buffer' });
      
      if (!result || !result.buffer) {
        this.logger.error('No buffer returned from pdf2pic conversion');
        throw new Error('Failed to generate image buffer from PDF');
      }
      
      this.logger.log(`Image conversion successful, buffer size: ${result.buffer.length}`);
      return result.buffer;
    } catch (error) {
      this.logger.error(`PDF to image conversion failed: ${error.message}`);
      throw new Error(`Failed to convert PDF to image: ${error.message}`);
    }
  }

  async extractTextFromPdf(pdfBuffer: Buffer): Promise<{ text: string[]; pageCount: number }> {
    try {
      this.logger.log('Starting PDF text extraction');
      
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();
      const pages: string[] = [];
      
      // Extract text from each page separately
      for (let i = 0; i < pageCount; i++) {
        // Create a new PDF with just this page
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
        singlePagePdf.addPage(copiedPage);
        
        const singlePageBytes = await singlePagePdf.save();
        const singlePageBuffer = Buffer.from(singlePageBytes);
        
        // Extract text from this single page
        const pageData = await pdfParse(singlePageBuffer);
        let textFromPdf = pageData.text
          .replace(/\n/g, '<NL>')  // Replace line breaks with <NL> marker
          .replace(/\s+/g, ' ')    // Replace multiple whitespace with single space
          .replace(/ <NL> /g, '<NL>') // Clean spaces around <NL>
          .replace(/<NL>+/g, '<NL>') // Replace multiple <NL> with single <NL>
          .trim();                 // Remove leading/trailing whitespace
        
        let finalText = textFromPdf;
        
        // Only use OCR if no text was extracted (page is likely an image)
        if (!textFromPdf || textFromPdf.length === 0) {
          try {
            this.logger.log(`Page ${i + 1} has no extractable text, trying OCR`);
            const convert = fromBuffer(singlePageBuffer, {
              density: 300,
              format: 'png',
              saveFilename: `temp_page_${i}`,
              savePath: '/tmp'
            });
            
            const imageResult = await convert(1, { responseType: 'buffer' });
            
            if (imageResult && imageResult.buffer) {
              const worker = await createWorker('eng');
              
              const { data: { text } } = await worker.recognize(imageResult.buffer);
              await worker.terminate();
              
              finalText = text
                .replace(/\n/g, '<NL>')
                .replace(/\s+/g, ' ')
                .replace(/ <NL> /g, '<NL>')
                .replace(/<NL>+/g, '<NL>')
                .trim();
              
              this.logger.log(`OCR completed for page ${i + 1}`);
            }
          } catch (ocrError) {
            this.logger.warn(`OCR failed for page ${i + 1}: ${ocrError.message}`);
          }
        }
        
        pages.push(finalText || '');
      }
      
      this.logger.log(`Text extraction completed for ${pageCount} pages`);
      
      return {
        text: pages,
        pageCount: pageCount,
      };
    } catch (error) {
      this.logger.error(`PDF text extraction failed: ${error.message}`);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }
}