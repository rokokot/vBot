// src/services/bookOperations.ts
import type { Book, BookCondition, Photo } from '../types/index';
import { bookApiService } from './api/bookApi';

export interface BookUpdateData {
  isbn?: string;
  title?: string;
  author?: string;
  publisher?: string;
  description?: string;
  condition?: BookCondition;
  customNotes?: string;
  photos?: Photo[];
  price?: number;
  isArchived?: boolean;
  updatedAt?: Date;
}

export interface BookCreateData {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  description: string;
  condition: BookCondition;
  customNotes: string;
  photos: Photo[];
  price: number;
  isArchived: boolean;
}

export interface BookValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BookBulkOperation {
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export class BookOperationsService {
  
  /**
   * Validate book data before saving
   */
  static validateBook(bookData: Partial<Book>): BookValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!bookData.title?.trim()) {
      errors.push('Title is required');
    }

    if (!bookData.author?.trim()) {
      errors.push('Author is required');
    }

    // Warnings for missing recommended fields
    if (!bookData.isbn?.trim()) {
      warnings.push('ISBN is recommended for better searchability');
    }

    if (!bookData.publisher?.trim()) {
      warnings.push('Publisher information helps with book identification');
    }

    if (!bookData.price || bookData.price <= 0) {
      warnings.push('Price should be set for selling purposes');
    }

    if (!bookData.photos || bookData.photos.length === 0) {
      warnings.push('Photos are highly recommended for Vinted listings');
    }

    // Validate ISBN format if provided
    if (bookData.isbn) {
      const cleanISBN = bookData.isbn.replace(/[^0-9X]/g, '');
      if (cleanISBN.length !== 10 && cleanISBN.length !== 13) {
        warnings.push('ISBN format may be invalid (should be 10 or 13 digits)');
      }
    }

    // Validate price range
    if (bookData.price && (bookData.price < 0.01 || bookData.price > 9999)) {
      errors.push('Price should be between €0.01 and €9999');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Enrich book data with API information
   */
  static async enrichBookData(bookData: Partial<BookCreateData>): Promise<Partial<BookCreateData>> {
    if (!bookData.isbn) {
      return bookData;
    }

    try {
      const apiData = await bookApiService.getBookInfo(bookData.isbn);
      
      if (apiData) {
        return {
          ...bookData,
          // Only override empty fields
          title: bookData.title || apiData.title,
          author: bookData.author || apiData.author,
          publisher: bookData.publisher || apiData.publisher,
          description: bookData.description || apiData.description,
        };
      }
    } catch (error) {
      console.warn('Failed to enrich book data from API:', error);
    }

    return bookData;
  }

  /**
   * Generate a complete book object with defaults
   */
  static createCompleteBook(bookData: BookCreateData): Book {
    const now = new Date();
    
    return {
      id: crypto.randomUUID(),
      isbn: bookData.isbn.trim(),
      title: bookData.title.trim(),
      author: bookData.author.trim(),
      publisher: bookData.publisher.trim(),
      description: bookData.description.trim(),
      condition: bookData.condition || {
        primary: 'good',
        issues: [],
        customNotes: '',
        generatedDescription: 'Good condition',
      },
      customNotes: bookData.customNotes.trim(),
      photos: bookData.photos || [],
      price: bookData.price || 0,
      isArchived: bookData.isArchived || false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Update book with validation
   */
  static updateBookData(existingBook: Book, updates: BookUpdateData): Book {
    const updatedBook: Book = {
      ...existingBook,
      ...updates,
      updatedAt: new Date(),
    };

    // Ensure we don't lose required fields
    if (!updatedBook.title?.trim()) {
      updatedBook.title = existingBook.title;
    }
    
    if (!updatedBook.author?.trim()) {
      updatedBook.author = existingBook.author;
    }

    return updatedBook;
  }

  /**
   * Generate Vinted-optimized description
   */
  static generateVintedDescription(book: Book, options: {
    includeISBN?: boolean;
    useEmojis?: boolean;
    language?: 'en' | 'fr' | 'de';
  } = {}): string {
    const { includeISBN = true, useEmojis = true, language = 'en' } = options;
    
    const texts = {
      en: {
        by: 'by',
        published: 'Published by',
        isbn: 'ISBN',
        condition: 'Condition',
        notes: 'Notes',
        perfect: 'Perfect for book lovers!',
        shipping: 'Fast shipping',
        smoke: 'Smoke-free home'
      },
      fr: {
        by: 'par',
        published: 'Éditions',
        isbn: 'ISBN',
        condition: 'État',
        notes: 'Notes',
        perfect: 'Parfait pour les amoureux de lecture!',
        shipping: 'Envoi rapide',
        smoke: 'Maison non-fumeur'
      },
      de: {
        by: 'von',
        published: 'Verlag',
        isbn: 'ISBN',
        condition: 'Zustand',
        notes: 'Notizen',
        perfect: 'Perfekt für Buchliebhaber!',
        shipping: 'Schneller Versand',
        smoke: 'Nichtraucherhaushalt'
      }
    };

    const t = texts[language];
    let description = '';

    // Title and author
    if (useEmojis) {
      description += `📚 ${book.title}\n`;
      description += `✍️ ${t.by} ${book.author}\n`;
      if (book.publisher) description += `🏢 ${t.published} ${book.publisher}\n`;
      if (includeISBN && book.isbn) description += `📖 ${t.isbn}: ${book.isbn}\n`;
    } else {
      description += `${book.title}\n`;
      description += `${t.by} ${book.author}\n`;
      if (book.publisher) description += `${t.published} ${book.publisher}\n`;
      if (includeISBN && book.isbn) description += `${t.isbn}: ${book.isbn}\n`;
    }

    description += '\n';

    // Condition
    if (book.condition) {
      const conditionText = book.condition.generatedDescription || book.condition.primary;
      description += useEmojis ? `📋 ${t.condition}: ${conditionText}\n` : `${t.condition}: ${conditionText}\n`;
    }

    // Description
    if (book.description) {
      description += `\n${book.description}\n`;
    }

    // Custom notes
    if (book.customNotes) {
      description += `\n${t.notes}: ${book.customNotes}\n`;
    }

    // Footer
    description += useEmojis ? 
      `\n📚 ${t.perfect}\n📦 ${t.shipping} | 🚭 ${t.smoke}` : 
      `\n${t.perfect}\n${t.shipping} | ${t.smoke}`;

    return description;
  }

  /**
   * Bulk update books
   */
  static async bulkUpdateBooks(
    books: Book[], 
    updates: BookUpdateData,
    updateFn: (id: string, updates: BookUpdateData) => Promise<void>
  ): Promise<BookBulkOperation> {
    const result: BookBulkOperation = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const book of books) {
      try {
        await updateFn(book.id, updates);
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: book.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return result;
  }

  /**
   * Archive/Unarchive books in bulk
   */
  static async bulkArchiveBooks(
    bookIds: string[], 
    archive: boolean,
    updateFn: (id: string, updates: BookUpdateData) => Promise<void>
  ): Promise<BookBulkOperation> {
    const updates: BookUpdateData = { isArchived: archive };
    const books = bookIds.map(id => ({ id } as Book));
    
    return this.bulkUpdateBooks(books, updates, updateFn);
  }

  /**
   * Delete books in bulk
   */
  static async bulkDeleteBooks(
    bookIds: string[],
    deleteFn: (id: string) => Promise<void>
  ): Promise<BookBulkOperation> {
    const result: BookBulkOperation = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const bookId of bookIds) {
      try {
        await deleteFn(bookId);
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: bookId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return result;
  }

  /**
   * Search and filter books
   */
  static filterBooks(books: Book[], filters: {
    searchTerm?: string;
    condition?: string;
    priceMin?: number;
    priceMax?: number;
    isArchived?: boolean;
    hasPhotos?: boolean;
    hasISBN?: boolean;
  }): Book[] {
    return books.filter(book => {
      // Search term (title, author, ISBN)
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchesSearch = 
          book.title.toLowerCase().includes(term) ||
          book.author.toLowerCase().includes(term) ||
          (book.isbn && book.isbn.includes(term)) ||
          (book.publisher && book.publisher.toLowerCase().includes(term));
        
        if (!matchesSearch) return false;
      }

      // Condition filter
      if (filters.condition && filters.condition !== 'all') {
        if (book.condition.primary !== filters.condition) return false;
      }

      // Price range
      if (filters.priceMin !== undefined && book.price < filters.priceMin) return false;
      if (filters.priceMax !== undefined && book.price > filters.priceMax) return false;

      // Archive status
      if (filters.isArchived !== undefined && book.isArchived !== filters.isArchived) return false;

      // Has photos
      if (filters.hasPhotos !== undefined) {
        const hasPhotos = book.photos && book.photos.length > 0;
        if (hasPhotos !== filters.hasPhotos) return false;
      }

      // Has ISBN
      if (filters.hasISBN !== undefined) {
        const hasISBN = book.isbn && book.isbn.trim().length > 0;
        if (hasISBN !== filters.hasISBN) return false;
      }

      return true;
    });
  }

  /**
   * Sort books by various criteria
   */
  static sortBooks(books: Book[], sortBy: 'title' | 'author' | 'price' | 'createdAt' | 'updatedAt', order: 'asc' | 'desc' = 'asc'): Book[] {
    return [...books].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'author':
          comparison = a.author.localeCompare(b.author);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        default:
          return 0;
      }

      return order === 'desc' ? -comparison : comparison;
    });
  }
}