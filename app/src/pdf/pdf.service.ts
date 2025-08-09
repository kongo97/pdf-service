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

  async createIndexWithPdf(
    originalPdfBuffer: Buffer, 
    entries: { title: string; source: string; pageNumber: number }[],
    fromPage?: number,
    toPage?: number
  ): Promise<Buffer> {
    try {
      this.logger.log(`Creating index PDF with ${entries.length} entries and merging with original PDF`);
      
      // Load original PDF
      const originalPdf = await PDFDocument.load(originalPdfBuffer);
      const originalPageCount = originalPdf.getPageCount();
      
      // Validate page range
      const actualFromPage = fromPage || 1;
      const actualToPage = toPage || originalPageCount;
      
      if (actualFromPage < 1 || actualFromPage > originalPageCount) {
        throw new Error(`From page ${actualFromPage} is out of range (1-${originalPageCount})`);
      }
      
      if (actualToPage < actualFromPage || actualToPage > originalPageCount) {
        throw new Error(`To page ${actualToPage} is invalid (must be >= ${actualFromPage} and <= ${originalPageCount})`);
      }

      // Create index PDF
      const indexPdf = await PDFDocument.create();
      const font = await indexPdf.embedFont(StandardFonts.Helvetica);
      
      let currentPage = indexPdf.addPage([595.28, 841.89]); // A4 portrait
      const { width, height } = currentPage.getSize();
      const marginTop = 45; // Reduced to fit more content
      const marginLeft = 50; 
      const marginRight = 50; 
      const marginBottom = 30; // Reduced to fit more content
      const lineHeight = 10; // Reduced line height for tighter spacing
      const titleFontSize = 8.2;
      const sourceFontSize = 6.8;
      const headerFontSize = 16; 
      const pageNumberFontSize = 8.2;
      
      let y = height - marginTop;
      let indexPageNumber = 1;

      // Draw centered header "Indice"
      const headerText = 'Indice';
      const headerWidth = font.widthOfTextAtSize(headerText, headerFontSize);
      currentPage.drawText(headerText, {
        x: (width - headerWidth) / 2,
        y: y,
        size: headerFontSize,
        font,
        color: rgb(0, 0, 0),
      });

      // Calculate how many pages the index should occupy (same as removed range)
      const targetIndexPages = actualToPage - actualFromPage + 1;
      
      // Divide entries evenly across all pages
      const entriesPerPage = Math.ceil(entries.length / targetIndexPages);
      
      this.logger.log(`Index will occupy ${targetIndexPages} pages with ${entriesPerPage} entries per page (${entries.length} total entries)`);

      // Calculate vertical centering for first page
      const entriesFirstPage = Math.min(entriesPerPage, entries.length);
      const totalContentHeight = entriesFirstPage * (lineHeight * 3); // Estimated height per entry
      const availableContentHeight = height - marginTop - marginBottom - 25 - 45; // Space minus header and page number
      const extraSpace = Math.max(0, availableContentHeight - totalContentHeight);
      const startY = height - marginTop - 25 - (extraSpace / 2); // Center vertically
      
      y = startY;

      // First pass: create all index content without links
      const linkData: Array<{
        page: any;
        entry: { title: string; source: string; pageNumber: number };
        titleLine: string;
        rect: { x: number; y: number; width: number; height: number };
      }> = [];

      let currentEntryOnPage = 0;
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        // Move to next page when we reach entriesPerPage (except on last page)
        if (currentEntryOnPage >= entriesPerPage && indexPageNumber < targetIndexPages) {
          this.addPageNumber(currentPage, font, indexPageNumber, width, marginBottom);
          
          currentPage = indexPdf.addPage([595.28, 841.89]);
          indexPageNumber++;
          
          // Calculate entries for this page
          const remainingEntries = entries.length - i;
          const remainingPages = targetIndexPages - indexPageNumber + 1;
          const entriesThisPage = Math.ceil(remainingEntries / remainingPages);
          
          // Calculate vertical centering for this page
          const totalContentHeight = entriesThisPage * (lineHeight * 3); // Estimated height per entry
          const availableContentHeight = height - marginTop - marginBottom - 25 - 45; // Space minus header and page number
          const extraSpace = Math.max(0, availableContentHeight - totalContentHeight);
          const startY = height - marginTop - 25 - (extraSpace / 2); // Center vertically
          
          y = startY;
          currentEntryOnPage = 0;
        }

        // Calculate available width for title
        const pageNumText = entry.pageNumber.toString();
        const pageNumWidth = font.widthOfTextAtSize(pageNumText, pageNumberFontSize);
        const maxTitleWidth = width - marginLeft - marginRight - pageNumWidth - 20;

        // Wrap title text
        const titleLines = this.wrapTextToWidth(entry.title, maxTitleWidth, font, titleFontSize);
        
        // Draw title lines and store link data for later
        let titleStartY = y;
        for (let lineIndex = 0; lineIndex < titleLines.length; lineIndex++) {
          // Draw text
          currentPage.drawText(titleLines[lineIndex], {
            x: marginLeft,
            y: y,
            size: titleFontSize,
            font,
            color: rgb(0, 0, 0),
          });

          // Store link data for the first line of title (we'll add links later)
          if (lineIndex === 0) {
            const titleWidth = font.widthOfTextAtSize(titleLines[lineIndex], titleFontSize);
            linkData.push({
              page: currentPage,
              entry: entry,
              titleLine: titleLines[lineIndex],
              rect: {
                x: marginLeft,
                y: y,
                width: titleWidth,
                height: titleFontSize
              }
            });
          }
          
          if (lineIndex < titleLines.length - 1) {
            y -= lineHeight * 0.85;
          }
        }

        // Draw page number
        currentPage.drawText(pageNumText, {
          x: width - marginRight - pageNumWidth,
          y: titleStartY,
          size: pageNumberFontSize,
          font,
          color: rgb(0, 0, 0),
        });

        y -= lineHeight * 0.6;

        // Draw source
        const sourceLines = this.wrapTextToWidth(entry.source, maxTitleWidth, font, sourceFontSize);
        for (let lineIndex = 0; lineIndex < sourceLines.length; lineIndex++) {
          currentPage.drawText(sourceLines[lineIndex], {
            x: marginLeft,
            y: y,
            size: sourceFontSize,
            font,
            color: rgb(0.3, 0.3, 0.3),
          });
          
          if (lineIndex < sourceLines.length - 1) {
            y -= lineHeight * 0.65;
          }
        }

        // Use consistent spacing between entries
        currentEntryOnPage++;
        y -= lineHeight * 1.5; // Fixed spacing between entries
      }

      // Fill remaining pages if we have fewer entries than target pages
      while (indexPageNumber < targetIndexPages) {
        this.addPageNumber(currentPage, font, indexPageNumber, width, marginBottom);
        currentPage = indexPdf.addPage([595.28, 841.89]);
        indexPageNumber++;
      }

      // Add page number to the last index page
      this.addPageNumber(currentPage, font, indexPageNumber, width, marginBottom);

      // Now add all the links with correct page calculations
      // The pageNumber in entries refers to content pages, but we need to add (from-1) for cover pages
      for (const linkInfo of linkData) {
        const displayPageNumber = linkInfo.entry.pageNumber; // Page number shown in index (correct as is)
        const targetPageInFinalPdf = displayPageNumber + (actualFromPage - 1); // Add cover pages offset for link destination
        
        const linkAnnotation = indexPdf.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [linkInfo.rect.x, linkInfo.rect.y - 2, linkInfo.rect.x + linkInfo.rect.width, linkInfo.rect.y + linkInfo.rect.height],
          Dest: [targetPageInFinalPdf - 1, 'XYZ', null, null, null], // 0-indexed for destination
          Border: [0, 0, 0], // No border
        });
        const linkRef = indexPdf.context.register(linkAnnotation);
        linkInfo.page.node.addAnnot(linkRef);
      }

      // Create final PDF by removing the specified range and inserting the index
      const finalPdf = await PDFDocument.create();
      
      // 1. Copy pages BEFORE the from-to range from original PDF
      if (actualFromPage > 1) {
        const beforeRangeIndices = Array.from(
          { length: actualFromPage - 1 }, 
          (_, i) => i
        );
        const copiedBeforePages = await finalPdf.copyPages(originalPdf, beforeRangeIndices);
        copiedBeforePages.forEach(page => finalPdf.addPage(page));
        this.logger.log(`Added ${beforeRangeIndices.length} pages before the removed range`);
      }
      
      // 2. Insert the new index pages (replacing the removed range)
      const indexPageIndices = Array.from({ length: indexPdf.getPageCount() }, (_, i) => i);
      const copiedIndexPages = await finalPdf.copyPages(indexPdf, indexPageIndices);
      copiedIndexPages.forEach(page => finalPdf.addPage(page));
      this.logger.log(`Added ${indexPageIndices.length} index pages to replace range ${actualFromPage}-${actualToPage}`);
      
      // 3. Copy pages AFTER the from-to range from original PDF
      if (actualToPage < originalPageCount) {
        const afterRangeIndices = Array.from(
          { length: originalPageCount - actualToPage }, 
          (_, i) => actualToPage + i
        );
        const copiedAfterPages = await finalPdf.copyPages(originalPdf, afterRangeIndices);
        copiedAfterPages.forEach(page => finalPdf.addPage(page));
        this.logger.log(`Added ${afterRangeIndices.length} pages after the removed range`);
      }

      const finalPageCount = finalPdf.getPageCount();
      const beforePages = actualFromPage > 1 ? actualFromPage - 1 : 0;
      const afterPages = actualToPage < originalPageCount ? originalPageCount - actualToPage : 0;
      const indexPages = targetIndexPages; // Always equals the removed pages
      const removedPages = actualToPage - actualFromPage + 1;
      
      this.logger.log(`Final PDF created with ${finalPageCount} pages: ${beforePages} before + ${indexPages} index (exactly replacing ${removedPages} removed pages) + ${afterPages} after`);

      const pdfBytes = await finalPdf.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error(`Index PDF with original content creation failed: ${error.message}`);
      throw new Error(`Failed to create index PDF with original content: ${error.message}`);
    }
  }

  async numberPages(pdfBuffer: Buffer, skipPages: number = 4): Promise<Buffer> {
    try {
      this.logger.log(`Starting page numbering, skipping first ${skipPages} pages`);
      
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pageCount = pdfDoc.getPageCount();
      
      // Settings
      const rightMargin = 20;
      const bottomOffset = 12;
      const fontSize = 9;
      
      for (let i = 0; i < pageCount; i++) {
        if (i < skipPages) {
          continue; // Skip first pages
        }
        
        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();
        const displayedNumber = i - skipPages + 1; // Numbering starts from 1
        
        // Add new page number first
        const pageNumberText = `P. ${displayedNumber}`;
        const textWidth = font.widthOfTextAtSize(pageNumberText, fontSize);
        const textHeight = fontSize;
        
        // Calculate exact position for new page number
        const newNumberX = width - rightMargin - textWidth;
        const newNumberY = bottomOffset;
        
        // Remove existing "P. <number>" text in the bottom right area
        // Draw a white rectangle that covers only the area BELOW the bottom line
        const cleanupRect = {
          x: width - 120, // Wider cleanup area
          y: 0,           // Start from very bottom
          width: 120,
          height: 18      // Small height to cover only the area below the line
        };
        
        // Draw white rectangle to cover existing page numbers
        page.drawRectangle({
          x: cleanupRect.x,
          y: cleanupRect.y,
          width: cleanupRect.width,
          height: cleanupRect.height,
          color: rgb(1, 1, 1), // White color
        });
        
        // Add new page number on top of the cleaned area
        page.drawText(pageNumberText, {
          x: newNumberX,
          y: newNumberY,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0), // Black color
        });
      }
      
      // Save the modified PDF
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: false, // For better compression
      });
      
      this.logger.log('Page numbering completed successfully');
      return Buffer.from(pdfBytes);

    } catch (error) {
      this.logger.error(`Page numbering failed: ${error.message}`);
      throw new Error(`Failed to number pages: ${error.message}`);
    }
  }
}