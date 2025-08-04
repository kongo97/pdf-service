import { Injectable } from '@nestjs/common';

@Injectable()
export class LayoutService {
  getNavbarComponent(): string {
    return `
      <nav class="bg-blue-600 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <h1 class="text-xl font-bold">PDF Service</h1>
              </div>
              <div class="hidden md:block ml-10">
                <div class="flex items-baseline space-x-4">
                  <a href="#" class="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Dashboard</a>
                  <a href="#" class="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Documents</a>
                  <a href="#" class="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Settings</a>
                </div>
              </div>
            </div>
            <div class="flex items-center">
              <button class="md:hidden p-2 rounded-md hover:bg-blue-700" id="mobile-menu-button">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>
    `;
  }

  getSidebarComponent(): string {
    return `
      <aside class="bg-gray-800 text-white w-64 min-h-screen p-4">
        <div class="mb-8">
          <h2 class="text-lg font-semibold mb-4">Menu</h2>
        </div>
        <nav class="space-y-2">
          <a href="#" class="flex items-center px-4 py-2 text-sm rounded-lg hover:bg-gray-700 transition-colors">
            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2H10a2 2 0 01-2-2V5z"></path>
            </svg>
            Generate PDF
          </a>
          <a href="/indicizza-pdf" class="flex items-center px-4 py-2 text-sm rounded-lg hover:bg-gray-700 transition-colors">
            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            Indicizza PDF
          </a>
          <a href="#" class="flex items-center px-4 py-2 text-sm rounded-lg hover:bg-gray-700 transition-colors">
            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Documents
          </a>
          <a href="#" class="flex items-center px-4 py-2 text-sm rounded-lg hover:bg-gray-700 transition-colors">
            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            Settings
          </a>
          <a href="#" class="flex items-center px-4 py-2 text-sm rounded-lg hover:bg-gray-700 transition-colors">
            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Help
          </a>
        </nav>
      </aside>
    `;
  }

  getMainLayout(content: string = ''): string {
    const navbar = this.getNavbarComponent();
    const sidebar = this.getSidebarComponent();
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PDF Service</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      </head>
      <body class="bg-gray-100">
        ${navbar}
        <div class="flex">
          ${sidebar}
          <main class="flex-1 p-6">
            <div class="max-w-7xl mx-auto">
              ${content || `
                <div class="bg-white rounded-lg shadow p-6">
                  <h1 class="text-2xl font-bold text-gray-900 mb-4">Welcome to PDF Service</h1>
                  <p class="text-gray-600">This is your main content area. You can replace this with your application content.</p>
                </div>
              `}
            </div>
          </main>
        </div>
        <script>
          // Mobile menu toggle
          var mobileMenuButton = document.getElementById('mobile-menu-button');
          if (mobileMenuButton) {
            mobileMenuButton.addEventListener('click', function() {
              console.log('Mobile menu clicked');
            });
          }
        </script>
      </body>
      </html>
    `;
  }
}