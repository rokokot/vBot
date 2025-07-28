// src/stores/bookStore.ts
import { create } from 'zustand';
import type { Book } from '../types/index';
import { db } from '../services/database/index';

interface BookStore {
  books: Book[];
  isLoading: boolean;
  error: string | null;
  
  fetchBooks: () => Promise<void>;
  addBook: (book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateBook: (id: string, updates: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  getBookById: (id: string) => Book | undefined;
  clearError: () => void;
  
  // Extension-specific methods
  syncWithExtension: () => Promise<void>;
  exportBooks: () => Promise<Book[]>;
  importBooks: (books: Book[]) => Promise<void>;
}

// Check if running in Chrome extension context
const isExtensionContext = (): boolean => {
  return !!(
    typeof chrome !== 'undefined' && 
    chrome.runtime && 
    chrome.runtime.id &&
    chrome.storage
  );
};

// Storage abstraction layer
class BookStorage {
  static async getBooks(): Promise<Book[]> {
    if (isExtensionContext()) {
      try {
        const result = await chrome.storage.local.get(['books']);
        return result.books || [];
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
        await chrome.storage.local.set({ books });
      } catch (error) {
        console.error('Chrome storage save error:', error);
        throw new Error('Failed to save to Chrome storage');
      }
    } else {
      // For IndexedDB, we handle individual operations
      throw new Error('Use individual book operations for IndexedDB');
    }
  }

  static async addBook(book: Book): Promise<void> {
    if (isExtensionContext()) {
      const books = await this.getBooks();
      const updatedBooks = [book, ...books];
      await this.saveBooks(updatedBooks);
    } else {
      await db.books.add(book);
    }
  }

  static async updateBook(id: string, updates: Partial<Book>): Promise<void> {
    if (isExtensionContext()) {
      const books = await this.getBooks();
      const updatedBooks = books.map(book => 
        book.id === id ? { ...book, ...updates } : book
      );
      await this.saveBooks(updatedBooks);
    } else {
      await db.books.update(id, updates);
    }
  }

  static async deleteBook(id: string): Promise<void> {
    if (isExtensionContext()) {
      const books = await this.getBooks();
      const updatedBooks = books.filter(book => book.id !== id);
      await this.saveBooks(updatedBooks);
    } else {
      await db.books.delete(id);
    }
  }
}

export const useBookStore = create<BookStore>((set, get) => ({
  books: [],
  isLoading: false,
  error: null,

  clearError: () => {
    set({ error: null });
  },

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
      
      await BookStorage.addBook(book);
      
      // Update local state
      const currentBooks = get().books;
      set({ 
        books: [book, ...currentBooks], 
        isLoading: false 
      });
      
      // Sync with extension if in web context
      if (!isExtensionContext()) {
        get().syncWithExtension();
      }
      
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
      const updatedData = {
        ...updates,
        updatedAt: new Date(),
      };
      
      await BookStorage.updateBook(id, updatedData);
      
      // Update local state
      const books = get().books.map(book => 
        book.id === id ? { ...book, ...updatedData } : book
      );
      
      set({ books, isLoading: false });
      
      // Sync with extension if in web context
      if (!isExtensionContext()) {
        get().syncWithExtension();
      }
      
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
      await BookStorage.deleteBook(id);
      
      // Update local state
      const books = get().books.filter(book => book.id !== id);
      set({ books, isLoading: false });
      
      // Sync with extension if in web context
      if (!isExtensionContext()) {
        get().syncWithExtension();
      }
      
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

  // Extension sync methods
  syncWithExtension: async () => {
    if (isExtensionContext()) return; // Don't sync if we're already in extension
    
    try {
      // This would be used to sync web app data with extension
      // Implementation depends on your sync strategy
      console.log('Syncing with extension...');
    } catch (error) {
      console.error('Extension sync error:', error);
    }
  },

  exportBooks: async () => {
    try {
      return get().books;
    } catch (error) {
      console.error('Export books error:', error);
      throw new Error('Failed to export books');
    }
  },

  importBooks: async (importedBooks: Book[]) => {
    set({ isLoading: true, error: null });
    try {
      // Validate imported books
      const validBooks = importedBooks.filter(book => 
        book.id && book.title && book.author && book.createdAt && book.updatedAt
      );

      if (validBooks.length !== importedBooks.length) {
        console.warn(`${importedBooks.length - validBooks.length} invalid books were filtered out`);
      }

      // Merge with existing books, avoiding duplicates
      const existingBooks = get().books;
      const existingIds = new Set(existingBooks.map(book => book.id));
      
      const newBooks = validBooks.filter(book => !existingIds.has(book.id));
      const mergedBooks = [...newBooks, ...existingBooks];

      // Save to storage
      if (isExtensionContext()) {
        await BookStorage.saveBooks(mergedBooks);
      } else {
        // For IndexedDB, add each book individually
        for (const book of newBooks) {
          await db.books.add(book);
        }
      }

      set({ books: mergedBooks, isLoading: false });
      
      return {
        imported: newBooks.length,
        skipped: validBooks.length - newBooks.length,
        invalid: importedBooks.length - validBooks.length
      };
      
    } catch (error) {
      console.error('Import books error:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to import books', 
        isLoading: false 
      });
      throw error;
    }
  },
}));

// Helper hook for extension-specific functionality
export const useExtensionStore = () => {
  const store = useBookStore();
  
  return {
    ...store,
    isExtension: isExtensionContext(),
    
    // Extension-specific methods
    clearAllData: async () => {
      if (isExtensionContext()) {
        await chrome.storage.local.clear();
        store.fetchBooks();
      } else {
        await db.delete();
        await db.open();
        store.fetchBooks();
      }
    },
    
    getStorageInfo: async () => {
      if (isExtensionContext()) {
        const result = await chrome.storage.local.get(null);
        const size = JSON.stringify(result).length;
        return {
          type: 'chrome',
          itemCount: Object.keys(result).length,
          sizeEstimate: `${Math.round(size / 1024)} KB`
        };
      } else {
        const books = await db.books.count();
        return {
          type: 'indexeddb',
          itemCount: books,
          sizeEstimate: 'Unknown'
        };
      }
    }
  };
};