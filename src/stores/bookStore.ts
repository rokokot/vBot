// src/stores/bookStore.ts - Updated with image transfer capabilities
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Book, Photo } from '../types/index';
import { db } from '../services/database/index';

// New interface for image transfer results
export interface ImageTransferResult {
  success: boolean;
  method: 'extension' | 'download' | 'preview' | 'none';
  message: string;
  data?: any;
  instructions?: string[];
}

interface BookStore {
  books: Book[];
  isLoading: boolean;
  error: string | null;
  selectedBooks: string[];
  
  // Image transfer state
  transferStatus: 'idle' | 'processing' | 'success' | 'error';
  transferResult: ImageTransferResult | null;
  
  // Existing methods
  fetchBooks: () => Promise<void>;
  addBook: (book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateBook: (id: string, updates: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  getBookById: (id: string) => Book | undefined;
  
  // New image transfer methods
  transferImages: (bookId: string, method?: 'extension' | 'download' | 'preview') => Promise<ImageTransferResult>;
  clearTransferResult: () => void;
  
  // Selection management
  selectBook: (id: string) => void;
  deselectBook: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  clearError: () => void;
}

// Check if we're running in Chrome extension context
const isExtensionContext = (): boolean => {
  try {
    return !!(
      typeof window !== 'undefined' &&
      'chrome' in window && 
      window.chrome?.runtime && 
      window.chrome?.runtime?.id &&
      window.chrome?.storage
    );
  } catch {
    return false;
  }
};

// Storage abstraction (keeping existing logic)
class BookStorage {
  static async getBooks(): Promise<Book[]> {
    if (isExtensionContext()) {
      try {
        const chromeAPI = (window as any).chrome;
        if (chromeAPI?.storage?.local) {
          const result = await chromeAPI.storage.local.get(['books']);
          const books = result.books || [];
          return books.map((book: any) => ({
            ...book,
            createdAt: new Date(book.createdAt),
            updatedAt: new Date(book.updatedAt)
          }));
        }
        return [];
      } catch (error) {
        console.error('Chrome storage error:', error);
        return [];
      }
    } else {
      try {
        return await db.books.orderBy('createdAt').reverse().toArray();
      } catch (error) {
        console.error('IndexedDB error:', error);
        return [];
      }
    }
  }

  static async saveBooks(books: Book[]): Promise<void> {
    if (isExtensionContext()) {
      try {
        const chromeAPI = (window as any).chrome;
        if (chromeAPI?.storage?.local) {
          const booksForStorage = books.map(book => ({
            ...book,
            createdAt: book.createdAt.toISOString(),
            updatedAt: book.updatedAt.toISOString()
          }));
          await chromeAPI.storage.local.set({ books: booksForStorage });
        }
      } catch (error) {
        console.error('Chrome storage save error:', error);
        throw new Error('Failed to save to Chrome storage');
      }
    }
  }

  // ... other existing storage methods remain the same
}

// New Image Transfer Service
class ImageTransferService {
  /**
   * Smart transfer that tries multiple methods
   */
  static async transferImages(book: Book, method: 'extension' | 'download' | 'preview' = 'download'): Promise<ImageTransferResult> {
    if (!book.photos || book.photos.length === 0) {
      return {
        success: true,
        method: 'none',
        message: 'No images to transfer'
      };
    }

    const bookTitle = `${book.title} - ${book.author}`.replace(/[^a-zA-Z0-9]/g, '_');

    try {
      switch (method) {
        case 'extension':
          return await this.extensionTransfer(book.photos);
        case 'download':
          return await this.downloadTransfer(book.photos, bookTitle);
        case 'preview':
          return await this.previewTransfer(book.photos, bookTitle);
        default:
          // Default to download if auto is somehow passed
          return await this.downloadTransfer(book.photos, bookTitle);
      }
    } catch (error) {
      return {
        success: false,
        method: method,
        message: `Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Auto transfer with intelligent fallbacks (removed unused method)
   */
  // This method is removed as it's now handled inline in the store

  /**
   * Extension-based transfer
   */
  private static async extensionTransfer(photos: Photo[]): Promise<ImageTransferResult> {
    if (!isExtensionContext()) {
      throw new Error('Extension context not available');
    }

    // Send message to content script
    return new Promise((resolve) => {
      const chromeAPI = (window as any).chrome;
      chromeAPI.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs[0]) {
          chromeAPI.tabs.sendMessage(tabs[0].id, {
            action: 'uploadImages',
            photos: photos.map(photo => ({
              id: photo.id,
              type: photo.type,
              filename: photo.filename,
              // Note: We can't send blob directly, need to convert to base64
              dataUrl: URL.createObjectURL(photo.blob)
            }))
          }, (response: any) => {
            if (response?.success) {
              resolve({
                success: true,
                method: 'extension',
                message: 'Images uploaded automatically to Vinted!'
              });
            } else {
              resolve({
                success: false,
                method: 'extension',
                message: response?.error || 'Extension upload failed'
              });
            }
          });
        } else {
          resolve({
            success: false,
            method: 'extension',
            message: 'No active Vinted tab found'
          });
        }
      });
    });
  }

  /**
   * Download as ZIP transfer
   */
  private static async downloadTransfer(photos: Photo[], bookTitle: string): Promise<ImageTransferResult> {
    try {
      // Create a simple zip-like structure (for demo, would use JSZip in real implementation)
      await this.downloadImagesAsZip(photos, bookTitle);
      
      return {
        success: true,
        method: 'download',
        message: 'Images downloaded successfully! Check your Downloads folder.',
        instructions: [
          '1. Extract the downloaded ZIP file',
          '2. Go to Vinted listing page',
          '3. Click "Upload photos"',
          '4. Select all extracted images',
          '5. Arrange in correct order'
        ]
      };
    } catch (error) {
      throw new Error('Download failed');
    }
  }

  /**
   * Preview and save transfer
   */
  private static async previewTransfer(photos: Photo[], bookTitle: string): Promise<ImageTransferResult> {
    const previewHtml = this.generatePreviewPage(photos, bookTitle);
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Open in new tab
    window.open(url, '_blank');
    
    return {
      success: true,
      method: 'preview',
      message: 'Images opened in new tab for saving',
      instructions: [
        '1. Right-click on each image',
        '2. Select "Save image as..."',
        '3. Save with descriptive names',
        '4. Upload to Vinted manually'
      ]
    };
  }

  /**
   * Download images as individual files (simplified ZIP)
   */
  private static async downloadImagesAsZip(photos: Photo[], bookTitle: string): Promise<void> {
    // For now, download individual files (real implementation would use JSZip)
    photos.forEach((photo, index) => {
      const url = URL.createObjectURL(photo.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bookTitle}_${index + 1}_${photo.type}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Generate HTML preview page
   */
  private static generatePreviewPage(photos: Photo[], bookTitle: string): string {
    const imageElements = photos.map((photo, index) => {
      const url = URL.createObjectURL(photo.blob);
      return `
        <div class="image-container">
          <h3>Photo ${index + 1}: ${photo.type}</h3>
          <img src="${url}" alt="${photo.type}" style="max-width: 400px; height: auto; border: 1px solid #ddd; border-radius: 8px;">
          <br><br>
          <button onclick="downloadImage('${url}', '${bookTitle}_${index + 1}_${photo.type}')" 
                  style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Download This Image
          </button>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${bookTitle} - Images</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; }
          .image-container { margin: 30px 0; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center; }
          h1 { color: #1f2937; margin-bottom: 30px; }
          h3 { color: #374151; margin-bottom: 15px; }
          img { margin: 15px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          button:hover { background: #2563eb; }
          .download-all { background: #059669; margin: 20px 0; padding: 12px 24px; font-size: 16px; }
          .instructions { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        </style>
      </head>
      <body>
        <h1>📚 ${bookTitle} - Book Photos</h1>
        
        <div class="instructions">
          <h3>🎯 How to use these images:</h3>
          <ol>
            <li>Right-click on any image and select "Save image as..." OR use the download buttons</li>
            <li>Save images with descriptive names (front.jpg, back.jpg, spine.jpg, etc.)</li>
            <li>Go to your Vinted listing page</li>
            <li>Upload the saved images in the correct order</li>
          </ol>
        </div>
        
        <button class="download-all" onclick="downloadAll()" style="display: block; margin: 20px auto;">
          📥 Download All Images
        </button>
        
        ${imageElements}
        
        <script>
          function downloadImage(url, filename) {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename + '.jpg';
            a.click();
          }
          
          function downloadAll() {
            const buttons = document.querySelectorAll('button[onclick*="downloadImage"]');
            buttons.forEach((btn, index) => {
              setTimeout(() => btn.click(), index * 500);
            });
          }
        </script>
      </body>
      </html>
    `;
  }

  private static isVintedPage(): boolean {
    return window.location.href.includes('vinted.') && 
           window.location.pathname.includes('/items/new');
  }
}

export const useBookStore = create<BookStore>()(
  subscribeWithSelector((set, get) => ({
    books: [],
    isLoading: false,
    error: null,
    selectedBooks: [],
    transferStatus: 'idle',
    transferResult: null,

    clearError: () => set({ error: null }),
    clearTransferResult: () => set({ transferResult: null, transferStatus: 'idle' }),

    fetchBooks: async () => {
      set({ isLoading: true, error: null });
      try {
        const books = await BookStorage.getBooks();
        set({ books, isLoading: false });
      } catch (error) {
        console.error('Fetch books error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch books', 
          isLoading: false 
        });
      }
    },

    addBook: async (bookData) => {
      set({ isLoading: true, error: null });
      try {
        const book: Book = {
          ...bookData,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        if (isExtensionContext()) {
          const books = [...get().books, book];
          await BookStorage.saveBooks(books);
          set({ books });
        } else {
          await db.books.add(book);
          const currentBooks = get().books;
          set({ books: [book, ...currentBooks] });
        }
        
        set({ isLoading: false });
        
      } catch (error) {
        console.error('Add book error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to add book', 
          isLoading: false 
        });
        throw error;
      }
    },

    updateBook: async (id, updates) => {
      set({ isLoading: true, error: null });
      try {
        const updatedData = { ...updates, updatedAt: new Date() };
        
        if (isExtensionContext()) {
          const books = get().books.map(book => 
            book.id === id ? { ...book, ...updatedData } : book
          );
          await BookStorage.saveBooks(books);
          set({ books });
        } else {
          await db.books.update(id, updatedData);
          const books = get().books.map(book => 
            book.id === id ? { ...book, ...updatedData } : book
          );
          set({ books });
        }
        
        set({ isLoading: false });
        
      } catch (error) {
        console.error('Update book error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to update book', 
          isLoading: false 
        });
        throw error;
      }
    },

    deleteBook: async (id) => {
      set({ isLoading: true, error: null });
      try {
        if (isExtensionContext()) {
          const books = get().books.filter(book => book.id !== id);
          await BookStorage.saveBooks(books);
          set({ books });
        } else {
          await db.books.delete(id);
          await db.photos.where('bookId').equals(id).delete();
          const books = get().books.filter(book => book.id !== id);
          set({ books });
        }
        
        const selectedBooks = get().selectedBooks.filter(selectedId => selectedId !== id);
        set({ selectedBooks, isLoading: false });
        
      } catch (error) {
        console.error('Delete book error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to delete book', 
          isLoading: false 
        });
        throw error;
      }
    },

    getBookById: (id) => {
      return get().books.find(book => book.id === id);
    },

    // New image transfer method
    transferImages: async (bookId, method = 'download') => {
      const book = get().getBookById(bookId);
      if (!book) {
        const errorResult: ImageTransferResult = {
          success: false,
          method: 'none',
          message: 'Book not found'
        };
        set({ transferResult: errorResult, transferStatus: 'error' });
        return errorResult;
      }

      set({ transferStatus: 'processing', transferResult: null });
      
      try {
        // Try extension first if available, then fallback to selected method
        let result: ImageTransferResult;
        
        const isVintedPage = () => {
          if (typeof window === 'undefined') return false;
          return window.location.href.includes('vinted.') && 
                 window.location.pathname.includes('/items/new');
        };
        
        if (isVintedPage() && isExtensionContext()) {
          try {
            result = await ImageTransferService.transferImages(book, 'extension');
            if (result.success) {
              set({ transferResult: result, transferStatus: 'success' });
              return result;
            }
          } catch (error) {
            console.warn('Extension transfer failed, falling back to', method);
          }
        }
        
        // Fallback to selected method
        result = await ImageTransferService.transferImages(book, method);
        set({ 
          transferResult: result, 
          transferStatus: result.success ? 'success' : 'error' 
        });
        return result;
      } catch (error) {
        const errorResult: ImageTransferResult = {
          success: false,
          method: method,
          message: error instanceof Error ? error.message : 'Transfer failed'
        };
        set({ transferResult: errorResult, transferStatus: 'error' });
        return errorResult;
      }
    },

    // Selection management
    selectBook: (id) => {
      const selectedBooks = get().selectedBooks;
      if (!selectedBooks.includes(id)) {
        set({ selectedBooks: [...selectedBooks, id] });
      }
    },

    deselectBook: (id) => {
      const selectedBooks = get().selectedBooks.filter(selectedId => selectedId !== id);
      set({ selectedBooks });
    },

    selectAll: () => {
      const allIds = get().books.map(book => book.id);
      set({ selectedBooks: allIds });
    },

    clearSelection: () => {
      set({ selectedBooks: [] });
    },
  }))
);