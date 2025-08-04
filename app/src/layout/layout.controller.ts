import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LayoutService } from './layout.service';
import { PdfIndexingService } from '../pdf-indexing/pdf-indexing.service';

@Controller()
export class LayoutController {
  constructor(
    private readonly layoutService: LayoutService,
    private readonly pdfIndexingService: PdfIndexingService,
  ) {}

  @Get()
  getLayout(@Res() res: Response) {
    const html = this.layoutService.getMainLayout();
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('dashboard')
  getDashboard(@Res() res: Response) {
    const dashboardContent = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center">
            <div class="p-2 bg-blue-100 rounded-lg">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <div class="ml-4">
              <h2 class="text-lg font-semibold text-gray-900">Total PDFs</h2>
              <p class="text-2xl font-bold text-blue-600">1,234</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center">
            <div class="p-2 bg-green-100 rounded-lg">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
              </svg>
            </div>
            <div class="ml-4">
              <h2 class="text-lg font-semibold text-gray-900">Generated Today</h2>
              <p class="text-2xl font-bold text-green-600">56</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center">
            <div class="p-2 bg-yellow-100 rounded-lg">
              <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-4">
              <h2 class="text-lg font-semibold text-gray-900">Processing</h2>
              <p class="text-2xl font-bold text-yellow-600">12</p>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        <div class="space-y-4">
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center">
              <div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <span class="text-gray-900">PDF Report Generated</span>
            </div>
            <span class="text-sm text-gray-500">2 minutes ago</span>
          </div>
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center">
              <div class="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <span class="text-gray-900">Document Processed</span>
            </div>
            <span class="text-sm text-gray-500">5 minutes ago</span>
          </div>
        </div>
      </div>
    `;
    
    const html = this.layoutService.getMainLayout(dashboardContent);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('indicizza-pdf')
  getIndicizzaPdf(@Res() res: Response) {
    const indicizzaContent = `
      <div class="max-w-7xl mx-auto">
        <h1 class="text-3xl font-bold text-gray-900 mb-8">Indicizza PDF</h1>
        
        ${this.pdfIndexingService.getUploadComponent()}
        
        ${this.pdfIndexingService.getPageSelectorComponent()}
        
        ${this.pdfIndexingService.getRemainingPagesViewerComponent()}
        
        ${this.pdfIndexingService.getChapterViewerComponent()}
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          ${this.pdfIndexingService.getIndexingOptionsComponent()}
          ${this.pdfIndexingService.getStatsComponent()}
        </div>
      </div>
      
      ${this.pdfIndexingService.getLoadingOverlayComponent()}
      ${this.pdfIndexingService.getDisabledStateComponent()}
      ${this.pdfIndexingService.getPdfViewerScript()}
    `;
    
    const html = this.layoutService.getMainLayout(indicizzaContent);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}