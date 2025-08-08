import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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

  async splitPdfIntoImages(pdfBuffer: Buffer): Promise<Buffer[]> {
    try {
      this.logger.log('Starting PDF to images conversion');
      
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();
      
      this.logger.log(`Converting ${pageCount} pages in parallel`);

      // Create all single page PDFs first
      const singlePagePromises = Array.from({ length: pageCount }, async (_, i) => {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);
        
        const singlePageBytes = await newPdf.save();
        return { pageIndex: i, buffer: Buffer.from(singlePageBytes) };
      });

      const singlePages = await Promise.all(singlePagePromises);

      // Convert all pages to images in parallel
      const imageConversionPromises = singlePages.map(async ({ pageIndex, buffer }) => {
        const convert = fromBuffer(buffer, {
          density: 200,
          saveFilename: `page_${pageIndex + 1}`,
          savePath: '/tmp',
          format: 'png',
          width: 2480,
          height: 3508
        });
        
        const result = await convert(1, { responseType: 'buffer' });
        
        if (!result || !result.buffer) {
          this.logger.error(`Failed to convert page ${pageIndex + 1} to image`);
          throw new Error(`Failed to generate image buffer for page ${pageIndex + 1}`);
        }
        
        this.logger.log(`Page ${pageIndex + 1} converted successfully`);
        return result.buffer;
      });

      const imageBuffers = await Promise.all(imageConversionPromises);

      this.logger.log(`PDF split into ${pageCount} images completed`);
      return imageBuffers;
    } catch (error) {
      this.logger.error(`PDF to images conversion failed: ${error.message}`);
      throw new Error(`Failed to split PDF into images: ${error.message}`);
    }
  }

  async createIndexPdf(entries: { title: string; source: string; pageNumber?: number }[]): Promise<Buffer> {
    try {
      this.logger.log(`Creating index PDF with ${entries.length} entries`);
      
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      let currentPage = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
      const { width, height } = currentPage.getSize();
      const marginTop = 55; // Aumentato per ridurre voci per pagina
      const marginLeft = 50; 
      const marginRight = 50; 
      const marginBottom = 35; // Aumentato per ridurre voci per pagina
      const lineHeight = 12; // Aumentato per più spazio tra le righe
      const titleFontSize = 8.2; // Leggermente più grande
      const sourceFontSize = 6.8; // Un po' più piccola come richiesto
      const headerFontSize = 16; 
      const pageNumberFontSize = 8.2;
      
      let y = height - marginTop;
      let pageNumber = 1;

      // Draw centered header "Indice"
      const headerText = 'Indice';
      const headerWidth = font.widthOfTextAtSize(headerText, headerFontSize);
      currentPage.drawText(headerText, {
        x: (width - headerWidth) / 2, // Center the header
        y: y,
        size: headerFontSize,
        font,
        color: rgb(0, 0, 0),
      });

      y -= 32; // Spazio aumentato dopo header

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        // Check if we need a new page - calibrato per esattamente 20 voci per pagina
        if (y < marginBottom + 45) {
          // Add page number at bottom
          this.addPageNumber(currentPage, font, pageNumber, width, marginBottom);
          
          currentPage = pdfDoc.addPage([595.28, 841.89]);
          pageNumber++;
          y = height - marginTop;
        }

        // Calculate available width for title (leaving space for page number)
        const pageNumText = entry.pageNumber ? entry.pageNumber.toString() : (i + 5).toString();
        const pageNumWidth = font.widthOfTextAtSize(pageNumText, pageNumberFontSize);
        const maxTitleWidth = width - marginLeft - marginRight - pageNumWidth - 20; // Spazio maggiore per allineamento perfetto

        // Wrap title text to fit in available space
        const titleLines = this.wrapTextToWidth(entry.title, maxTitleWidth, font, titleFontSize);
        
        // Draw title lines
        let titleStartY = y;
        for (let lineIndex = 0; lineIndex < titleLines.length; lineIndex++) {
          currentPage.drawText(titleLines[lineIndex], {
            x: marginLeft,
            y: y,
            size: titleFontSize,
            font,
            color: rgb(0, 0, 0),
          });
          
          if (lineIndex < titleLines.length - 1) {
            y -= lineHeight * 0.85; // Line spacing bilanciato per titoli multipli
          }
        }

        // Draw page number aligned perfectly to the right margin with baseline alignment
        currentPage.drawText(pageNumText, {
          x: width - marginRight - pageNumWidth, // Allineamento preciso al margine destro
          y: titleStartY, // Perfettamente allineato con la baseline del titolo
          size: pageNumberFontSize,
          font,
          color: rgb(0, 0, 0),
        });

        y -= lineHeight * 0.6; // Gap bilanciato prima della fonte

        // Draw source in gray, no indent to match original
        const sourceLines = this.wrapTextToWidth(entry.source, maxTitleWidth, font, sourceFontSize);
        for (let lineIndex = 0; lineIndex < sourceLines.length; lineIndex++) {
          currentPage.drawText(sourceLines[lineIndex], {
            x: marginLeft, // No indent like in the original
            y: y,
            size: sourceFontSize,
            font,
            color: rgb(0.3, 0.3, 0.3), // Slightly darker gray
          });
          
          if (lineIndex < sourceLines.length - 1) {
            y -= lineHeight * 0.65;
          }
        }

        y -= lineHeight * 1.5; // Gap aumentato ulteriormente tra i capitoli
      }

      // Add page number to the last page
      this.addPageNumber(currentPage, font, pageNumber, width, marginBottom);

      const pdfBytes = await pdfDoc.save();
      this.logger.log('Index PDF created successfully');
      
      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error(`Index PDF creation failed: ${error.message}`);
      throw new Error(`Failed to create index PDF: ${error.message}`);
    }
  }

  private addPageNumber(page: any, font: any, pageNumber: number, pageWidth: number, marginBottom: number) {
    // Draw horizontal line at bottom like in the original
    const lineY = marginBottom + 15; // Posizione della linea come nell'originale
    page.drawLine({
      start: { x: 50, y: lineY }, // Da margine sinistro
      end: { x: pageWidth - 50, y: lineY }, // A margine destro
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });

    // Draw page number below the line, aligned to the right like in original
    const pageText = `P. ${pageNumber}`;
    const pageTextWidth = font.widthOfTextAtSize(pageText, 8);
    page.drawText(pageText, {
      x: pageWidth - 50 - pageTextWidth, // Allineato al margine destro
      y: marginBottom, // Sotto la linea
      size: 8,
      font,
      color: rgb(0, 0, 0),
    });
  }

  private wrapTextToWidth(text: string, maxWidth: number, font: any, fontSize: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = font.widthOfTextAtSize(testLine, fontSize);
      
      if (textWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is too long for the line, just add it anyway
          lines.push(word);
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.length > 0 ? lines : [''];
  }

  private wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
    return this.wrapTextToWidth(text, maxWidth, font, fontSize);
  }
}