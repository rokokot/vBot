// src/hooks/useBookOperations.ts
import { useState, useCallback, useMemo } from 'react';
import { useBookStore } from '../stores/bookStore';
import { BookOperationsService, type BookCreateData, type BookUpdateData } from '../services/bookOperations';
import type { Book } from '../types/index';

export interface UseBookOperationsReturn {
  // State
  isLoading: boolean;
  error: string | null;
  
  // Operations
  createBook: (bookData: BookCreateData) => Promise<Book>;
  updateBook: (id: string, updates: BookUpdateData) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  duplicateBook: (book: Book) => Promise<Book>;
  
  // Bulk operations
  bulkArchive: (bookIds: string[], archive: boolean) => Promise<void>;
  bulkDelete: (bookIds: string[]) => Promise<void>;
  bulkUpdatePrice: (bookIds: string[], priceAdjustment: number, type: 'add' | 'multiply' | 'set') => Promise<void>;
  
  // Validation
  validateBook: (bookData: Partial<Book>) => { isValid: boolean; errors: string[]; warnings: string[] };
  
  // Utility
  clearError: () => void;
}

export const useBookOperations = (): UseBookOperationsReturn => {
  const store = useBookStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    store.clearError?.();
  }, [store]);

  const createBook = useCallback(async (bookData: BookCreateData): Promise<Book> => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate the book data
      const validation = BookOperationsService.validateBook(bookData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Enrich with API data if possible
      const enrichedData = await BookOperationsService.enrichBookData(bookData);
      
      // Create complete book object
      const completeBookData = BookOperationsService.createCompleteBook(enrichedData as BookCreateData);
      
      // Add to store
      await store.addBook(completeBookData);
      
      return completeBookData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create book';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  const updateBook = useCallback(async (id: string, updates: BookUpdateData): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const existingBook = store.getBookById(id);
      if (!existingBook) {
        throw new Error('Book not found');
      }

      // Create updated book data
      const updatedBook = BookOperationsService.updateBookData(existingBook, updates);
      
      // Validate the updated book
      const validation = BookOperationsService.validateBook(updatedBook);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Update in store
      await store.updateBook(id, updates);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update book';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  const deleteBook = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await store.deleteBook(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete book';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  const duplicateBook = useCallback(async (book: Book): Promise<Book> => {
    setIsLoading(true);
    setError(null);

    try {
      const duplicateData: BookCreateData = {
        isbn: book.isbn,
        title: `${book.title} (Copy)`,
        author: book.author,
        publisher: book.publisher,
        description: book.description,
        condition: book.condition,
        customNotes: book.customNotes,
        photos: [], // Don't copy photos to avoid blob reference issues
        price: book.price,
        isArchived: false, // New duplicates should be active
      };

      return await createBook(duplicateData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate book';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [createBook]);

  const bulkArchive = useCallback(async (bookIds: string[], archive: boolean): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await BookOperationsService.bulkArchiveBooks(
        bookIds, 
        archive, 
        store.updateBook
      );

      if (result.failed > 0) {
        const errorMessages = result.errors.map(e => e.error).join(', ');
        throw new Error(`${result.failed} operations failed: ${errorMessages}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bulk archive operation failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  const bulkDelete = useCallback(async (bookIds: string[]): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await BookOperationsService.bulkDeleteBooks(
        bookIds,
        store.deleteBook
      );

      if (result.failed > 0) {
        const errorMessages = result.errors.map(e => e.error).join(', ');
        throw new Error(`${result.failed} deletions failed: ${errorMessages}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bulk delete operation failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  const bulkUpdatePrice = useCallback(async (
    bookIds: string[], 
    priceAdjustment: number, 
    type: 'add' | 'multiply' | 'set'
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const books = bookIds
        .map(id => store.getBookById(id))
        .filter((book): book is Book => book !== undefined);

      const updates = books.map(book => {
        let newPrice: number;
        
        switch (type) {
          case 'add':
            newPrice = Math.max(0, book.price + priceAdjustment);
            break;
          case 'multiply':
            newPrice = Math.max(0, book.price * priceAdjustment);
            break;
          case 'set':
            newPrice = Math.max(0, priceAdjustment);
            break;
          default:
            newPrice = book.price;
        }

        return { book, newPrice: Math.round(newPrice * 100) / 100 }; // Round to 2 decimal places
      });

      // Process updates one by one to avoid conflicts
      for (const { book, newPrice } of updates) {
        await store.updateBook(book.id, { price: newPrice });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bulk price update failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  const validateBook = useCallback((bookData: Partial<Book>) => {
    return BookOperationsService.validateBook(bookData);
  }, []);

  return {
    isLoading,
    error,
    createBook,
    updateBook,
    deleteBook,
    duplicateBook,
    bulkArchive,
    bulkDelete,
    bulkUpdatePrice,
    validateBook,
    clearError,
  };
};

// Hook for book filtering and searching
export interface UseBookFiltersReturn {
  filteredBooks: Book[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: {
    condition: string;
    priceMin: number | undefined;
    priceMax: number | undefined;
    isArchived: boolean | undefined;
    hasPhotos: boolean | undefined;
    hasISBN: boolean | undefined;
  };
  updateFilter: (key: string, value: any) => void;
  clearFilters: () => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  setSorting: (sortBy: string, order?: 'asc' | 'desc') => void;
  resultsCount: number;
}

export const useBookFilters = (books: Book[]): UseBookFiltersReturn => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'price' | 'createdAt' | 'updatedAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [filters, setFilters] = useState({
    condition: 'all',
    priceMin: undefined as number | undefined,
    priceMax: undefined as number | undefined,
    isArchived: undefined as boolean | undefined,
    hasPhotos: undefined as boolean | undefined,
    hasISBN: undefined as boolean | undefined,
  });

  const updateFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilters({
      condition: 'all',
      priceMin: undefined,
      priceMax: undefined,
      isArchived: undefined,
      hasPhotos: undefined,
      hasISBN: undefined,
    });
  }, []);

  const setSorting = useCallback((newSortBy: string, order: 'asc' | 'desc' = 'asc') => {
    setSortBy(newSortBy as any);
    setSortOrder(order);
  }, []);

  const filteredBooks = useMemo(() => {
    // First filter
    const filtered = BookOperationsService.filterBooks(books, {
      searchTerm: searchTerm || undefined,
      condition: filters.condition === 'all' ? undefined : filters.condition,
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      isArchived: filters.isArchived,
      hasPhotos: filters.hasPhotos,
      hasISBN: filters.hasISBN,
    });

    // Then sort
    return BookOperationsService.sortBooks(filtered, sortBy, sortOrder);
  }, [books, searchTerm, filters, sortBy, sortOrder]);

  return {
    filteredBooks,
    searchTerm,
    setSearchTerm,
    filters,
    updateFilter,
    clearFilters,
    sortBy,
    sortOrder,
    setSorting,
    resultsCount: filteredBooks.length,
  };
};

// Hook for book statistics
export interface BookStats {
  total: number;
  active: number;
  archived: number;
  totalValue: number;
  activeValue: number;
  averagePrice: number;
  conditionBreakdown: Record<string, number>;
  withPhotos: number;
  withISBN: number;
  publisherBreakdown: Record<string, number>;
  recentlyAdded: number; // Added in last 7 days
  recentlyUpdated: number; // Updated in last 7 days
}

export const useBookStats = (books: Book[]): BookStats => {
  return useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats: BookStats = {
      total: books.length,
      active: 0,
      archived: 0,
      totalValue: 0,
      activeValue: 0,
      averagePrice: 0,
      conditionBreakdown: {},
      withPhotos: 0,
      withISBN: 0,
      publisherBreakdown: {},
      recentlyAdded: 0,
      recentlyUpdated: 0,
    };

    books.forEach(book => {
      // Basic counts
      if (book.isArchived) {
        stats.archived++;
      } else {
        stats.active++;
        stats.activeValue += book.price;
      }

      stats.totalValue += book.price;

      // Condition breakdown
      const condition = book.condition.primary;
      stats.conditionBreakdown[condition] = (stats.conditionBreakdown[condition] || 0) + 1;

      // Features
      if (book.photos && book.photos.length > 0) {
        stats.withPhotos++;
      }

      if (book.isbn && book.isbn.trim()) {
        stats.withISBN++;
      }

      // Publisher breakdown
      if (book.publisher && book.publisher.trim()) {
        const publisher = book.publisher.trim();
        stats.publisherBreakdown[publisher] = (stats.publisherBreakdown[publisher] || 0) + 1;
      }

      // Recent activity
      if (book.createdAt >= oneWeekAgo) {
        stats.recentlyAdded++;
      }

      if (book.updatedAt >= oneWeekAgo && book.updatedAt > book.createdAt) {
        stats.recentlyUpdated++;
      }
    });

    stats.averagePrice = stats.active > 0 ? stats.activeValue / stats.active : 0;

    return stats;
  }, [books]);
};

// Hook for book export/import operations
export interface UseBookDataReturn {
  exportBooks: (format: 'json' | 'csv' | 'vinted') => Promise<string>;
  importBooks: (data: string, format: 'json') => Promise<{ imported: number; skipped: number; errors: string[] }>;
  generateVintedDescription: (book: Book, options?: { includeISBN?: boolean; useEmojis?: boolean; language?: 'en' | 'fr' | 'de' }) => string;
  copyToClipboard: (text: string) => Promise<boolean>;
}

export const useBookData = (): UseBookDataReturn => {
  const store = useBookStore();

  const exportBooks = useCallback(async (format: 'json' | 'csv' | 'vinted'): Promise<string> => {
    const books = store.books;

    switch (format) {
      case 'json':
        return JSON.stringify({
          exportDate: new Date().toISOString(),
          totalBooks: books.length,
          books: books
        }, null, 2);

      case 'csv':
        const headers = [
          'Title', 'Author', 'Publisher', 'ISBN', 'Price (€)', 
          'Condition', 'Description', 'Notes', 'Created', 'Archived'
        ];
        
        const rows = books.map(book => [
          book.title,
          book.author,
          book.publisher,
          book.isbn,
          book.price.toFixed(2),
          book.condition.primary,
          book.description.replace(/\n/g, ' | '),
          book.customNotes.replace(/\n/g, ' | '),
          book.createdAt.toLocaleDateString(),
          book.isArchived ? 'Yes' : 'No'
        ]);

        return [headers, ...rows]
          .map(row => row.map(field => `"${field}"`).join(','))
          .join('\n');

      case 'vinted':
        return books
          .filter(book => !book.isArchived)
          .map((book, index) => {
            const description = BookOperationsService.generateVintedDescription(book, {
              includeISBN: true,
              useEmojis: true,
              language: 'en'
            });
            
            return `BOOK ${index + 1}: ${book.title}\n${'='.repeat(50)}\n${description}\n\n`;
          })
          .join('');

      default:
        throw new Error('Unsupported export format');
    }
  }, [store.books]);

  const importBooks = useCallback(async (data: string, format: 'json') => {
    if (format === 'json') {
      try {
        const parsed = JSON.parse(data);
        const books = parsed.books || parsed; // Handle both wrapped and unwrapped formats

        if (!Array.isArray(books)) {
          throw new Error('Invalid format: expected array of books');
        }

        return await store.importBooks?.(books) || { imported: 0, skipped: 0, errors: ['Import not supported'] };
      } catch (error) {
        throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    throw new Error('Unsupported import format');
  }, [store]);

  const generateVintedDescription = useCallback((
    book: Book, 
    options: { includeISBN?: boolean; useEmojis?: boolean; language?: 'en' | 'fr' | 'de' } = {}
  ): string => {
    return BookOperationsService.generateVintedDescription(book, {
      includeISBN: true,
      useEmojis: true,
      language: 'en',
      ...options
    });
  }, []);

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, []);

  return {
    exportBooks,
    importBooks,
    generateVintedDescription,
    copyToClipboard,
  };
};