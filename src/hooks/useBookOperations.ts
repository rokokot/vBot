// src/hooks/useBookOperations.ts - Fixed version
import { useState, useCallback, useMemo } from 'react';
import { useBookStore } from '../stores/bookStore';
import type { Book } from '../types/index';

export interface BookCreateData {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  description: string;
  condition: Book['condition'];
  customNotes: string;
  photos: Book['photos'];
  price: number;
  isArchived: boolean;
}

export interface BookUpdateData {
  isbn?: string;
  title?: string;
  author?: string;
  publisher?: string;
  description?: string;
  condition?: Book['condition'];
  customNotes?: string;
  photos?: Book['photos'];
  price?: number;
  isArchived?: boolean;
  updatedAt?: Date;
}

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
      const validation = validateBook(bookData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Create complete book object
      const completeBook: Book = {
        ...bookData,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Add to store
      await store.addBook(bookData);
      
      return completeBook;
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
      const updatedBook = { ...existingBook, ...updates, updatedAt: new Date() };
      
      // Validate the updated book
      const validation = validateBook(updatedBook);
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
      const updates = { isArchived: archive, updatedAt: new Date() };
      
      // Process updates one by one to avoid conflicts
      for (const id of bookIds) {
        await store.updateBook(id, updates);
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
      // Process deletions one by one
      for (const id of bookIds) {
        await store.deleteBook(id);
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
      // Process updates one by one to avoid conflicts
      for (const id of bookIds) {
        const book = store.getBookById(id);
        if (!book) continue;

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

        const roundedPrice = Math.round(newPrice * 100) / 100; // Round to 2 decimal places
        await store.updateBook(id, { price: roundedPrice });
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
    // Filter books
    let filtered = books.filter(book => {
      // Search term (title, author, ISBN)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
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

    // Sort books
    return filtered.sort((a, b) => {
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

      return sortOrder === 'desc' ? -comparison : comparison;
    });
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

// Hook for book export operations
export interface UseBookDataReturn {
  exportBooks: (format: 'json' | 'csv' | 'vinted') => Promise<string>;
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
            const description = generateVintedDescription(book, {
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

  const generateVintedDescription = useCallback((
    book: Book, 
    options: { includeISBN?: boolean; useEmojis?: boolean; language?: 'en' | 'fr' | 'de' } = {}
  ): string => {
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
    generateVintedDescription,
    copyToClipboard,
  };
};