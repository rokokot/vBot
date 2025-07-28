// src/services/importExport.ts
import type { Book } from '../types/index';
import { BookOperationsService } from './bookOperations';

export interface ImportResult {
  imported: number;
  skipped: number;
  invalid: number;
  errors: string[];
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'vinted' | 'excel';
  includeArchived?: boolean;
  selectedOnly?: boolean;
  selectedBooks?: Book[];
  vintedOptions?: {
    includeISBN?: boolean;
    useEmojis?: boolean;
    language?: 'en' | 'fr' | 'de';
  };
}

export class ImportExportService {
  
  /**
   * Export books to various formats
   */
  static async exportBooks(books: Book[], options: ExportOptions): Promise<string | Blob> {
    let booksToExport = books;

    // Filter books based on options
    if (options.selectedOnly && options.selectedBooks) {
      const selectedIds = new Set(options.selectedBooks.map(b => b.id));
      booksToExport = books.filter(book => selectedIds.has(book.id));
    }

    if (!options.includeArchived) {
      booksToExport = booksToExport.filter(book => !book.isArchived);
    }

    switch (options.format) {
      case 'json':
        return this.exportToJSON(booksToExport);
      
      case 'csv':
        return this.exportToCSV(booksToExport);
      
      case 'vinted':
        return this.exportToVinted(booksToExport, options.vintedOptions);
      
      case 'excel':
        return await this.exportToExcel(booksToExport);
      
      default:
        throw new Error('Unsupported export format');
    }
  }

  /**
   * Export to JSON format
   */
  private static exportToJSON(books: Book[]): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      totalBooks: books.length,
      books: books.map(book => ({
        ...book,
        // Convert dates to ISO strings for serialization
        createdAt: book.createdAt.toISOString(),
        updatedAt: book.updatedAt.toISOString(),
        // Convert photo blobs to base64 for portability
        photos: book.photos?.map(photo => ({
          ...photo,
          createdAt: photo.createdAt.toISOString(),
          blob: undefined, // Remove blob for size
          hasBlob: true, // Indicate blob existed
        })) || []
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export to CSV format
   */
  private static exportToCSV(books: Book[]): string {
    const headers = [
      'ID',
      'Title',
      'Author',
      'Publisher',
      'ISBN',
      'Price (€)',
      'Condition',
      'Condition Notes',
      'Description',
      'Custom Notes',
      'Photo Count',
      'Created Date',
      'Updated Date',
      'Archived',
      'Vinted Description'
    ];

    const rows = books.map(book => [
      book.id,
      book.title,
      book.author,
      book.publisher || '',
      book.isbn || '',
      book.price.toFixed(2),
      book.condition.primary,
      book.condition.customNotes || '',
      this.escapeCSVField(book.description),
      this.escapeCSVField(book.customNotes),
      (book.photos?.length || 0).toString(),
      book.createdAt.toLocaleDateString(),
      book.updatedAt.toLocaleDateString(),
      book.isArchived ? 'Yes' : 'No',
      this.escapeCSVField(BookOperationsService.generateVintedDescription(book, {
        includeISBN: true,
        useEmojis: true,
        language: 'en'
      }))
    ]);

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }

  /**
   * Export to Vinted-ready format
   */
  private static exportToVinted(books: Book[], options: ExportOptions['vintedOptions'] = {}): string {
    const { includeISBN = true, useEmojis = true, language = 'en' } = options;

    return books
      .filter(book => !book.isArchived)
      .map((book, index) => {
        const description = BookOperationsService.generateVintedDescription(book, {
          includeISBN,
          useEmojis,
          language
        });
        
        const separator = '='.repeat(60);
        
        return `LISTING ${index + 1}: ${book.title}
${separator}

TITLE: ${book.title} - ${book.author}

DESCRIPTION:
${description}

PRICE: €${book.price.toFixed(2)}
CONDITION: ${this.mapToVintedCondition(book.condition.primary)}
CATEGORY: Books
BRAND: ${book.publisher || 'Unbranded'}

TAGS: books, reading, literature, ${book.author.toLowerCase().replace(/\s+/g, '')}, ${book.condition.primary.replace('-', '')}

${separator}`;
      })
      .join('\n\n');
  }

  /**
   * Export to Excel format (returns Blob)
   */
  private static async exportToExcel(books: Book[]): Promise<Blob> {
    // This would require a library like SheetJS
    // For now, return CSV as Excel-compatible format
    const csvData = this.exportToCSV(books);
    return new Blob([csvData], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  }

  /**
   * Import books from various formats
   */
  static async importBooks(data: string | File, format: 'json' | 'csv'): Promise<ImportResult> {
    let content: string;

    if (data instanceof File) {
      content = await this.readFileAsText(data);
    } else {
      content = data;
    }

    switch (format) {
      case 'json':
        return this.importFromJSON(content);
      
      case 'csv':
        return this.importFromCSV(content);
      
      default:
        throw new Error('Unsupported import format');
    }
  }

  /**
   * Import from JSON format
   */
  private static importFromJSON(content: string): ImportResult {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      invalid: 0,
      errors: []
    };

    try {
      const parsed = JSON.parse(content);
      const books = parsed.books || parsed; // Handle both wrapped and unwrapped formats

      if (!Array.isArray(books)) {
        throw new Error('Invalid format: expected array of books');
      }

      for (const bookData of books) {
        try {
          const book = this.validateAndNormalizeBook(bookData);
          
          if (book) {
            // Check if book already exists (by ID or ISBN+Title combination)
            const isDuplicate = this.isDuplicateBook(book, books);
            
            if (isDuplicate) {
              result.skipped++;
            } else {
              result.imported++;
              // Book would be added to store here
            }
          } else {
            result.invalid++;
          }
        } catch (error) {
          result.invalid++;
          result.errors.push(`Book validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Import from CSV format
   */
  private static importFromCSV(content: string): ImportResult {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      invalid: 0,
      errors: []
    };

    try {
      const lines = content.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV must have at least a header row and one data row');
      }

      const headers = this.parseCSVLine(lines[0]);
      const requiredHeaders = ['title', 'author'];
      
      // Check for required headers
      const missingHeaders = requiredHeaders.filter(header => 
        !headers.some(h => h.toLowerCase().includes(header))
      );
      
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      // Map headers to indices
      const headerMap = this.createHeaderMap(headers);

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCSVLine(lines[i]);
          const bookData = this.csvRowToBook(values, headerMap);
          
          const book = this.validateAndNormalizeBook(bookData);
          
          if (book) {
            result.imported++;
          } else {
            result.invalid++;
          }
        } catch (error) {
          result.invalid++;
          result.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Validate and normalize book data from import
   */
  private static validateAndNormalizeBook(bookData: any): Book | null {
    // Required fields validation
    if (!bookData.title || typeof bookData.title !== 'string' || !bookData.title.trim()) {
      return null;
    }

    if (!bookData.author || typeof bookData.author !== 'string' || !bookData.author.trim()) {
      return null;
    }

    // Create normalized book object
    const now = new Date();
    const book: Book = {
      id: bookData.id || crypto.randomUUID(),
      title: bookData.title.trim(),
      author: bookData.author.trim(),
      publisher: (bookData.publisher || '').trim(),
      isbn: (bookData.isbn || '').trim(),
      description: (bookData.description || '').trim(),
      customNotes: (bookData.customNotes || '').trim(),
      price: this.parsePrice(bookData.price),
      condition: this.normalizeCondition(bookData.condition),
      photos: [], // Photos would need special handling for imports
      isArchived: this.parseBoolean(bookData.isArchived),
      createdAt: this.parseDate(bookData.createdAt) || now,
      updatedAt: this.parseDate(bookData.updatedAt) || now,
    };

    return book;
  }

  /**
   * Helper methods for data parsing and validation
   */
  private static parsePrice(value: any): number {
    if (typeof value === 'number') return Math.max(0, value);
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    return 0;
  }

  private static parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === 'yes' || lower === '1';
    }
    return false;
  }

  private static parseDate(value: any): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && value.trim()) {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  private static normalizeCondition(conditionData: any): Book['condition'] {
    const defaultCondition = {
      primary: 'good' as const,
      issues: [],
      customNotes: '',
      generatedDescription: 'Good condition'
    };

    if (typeof conditionData === 'string') {
      const primary = this.mapConditionString(conditionData);
      return {
        ...defaultCondition,
        primary,
        generatedDescription: this.generateConditionDescription(primary)
      };
    }

    if (typeof conditionData === 'object' && conditionData) {
      return {
        primary: this.mapConditionString(conditionData.primary) || 'good',
        issues: Array.isArray(conditionData.issues) ? conditionData.issues : [],
        customNotes: (conditionData.customNotes || '').trim(),
        generatedDescription: conditionData.generatedDescription || this.generateConditionDescription(conditionData.primary)
      };
    }

    return defaultCondition;
  }

  private static mapConditionString(condition: string): Book['condition']['primary'] {
    if (!condition || typeof condition !== 'string') return 'good';
    
    const lower = condition.toLowerCase().trim();
    const mapping: Record<string, Book['condition']['primary']> = {
      'like-new': 'like-new',
      'likenew': 'like-new',
      'like new': 'like-new',
      'brand new': 'like-new',
      'very-good': 'very-good',
      'verygood': 'very-good',
      'very good': 'very-good',
      'excellent': 'very-good',
      'good': 'good',
      'fine': 'good',
      'fair': 'fair',
      'acceptable': 'fair',
      'poor': 'poor',
      'bad': 'poor'
    };

    return mapping[lower] || 'good';
  }

  private static generateConditionDescription(primary: string): string {
    const descriptions: Record<string, string> = {
      'like-new': 'Like new condition',
      'very-good': 'Very good condition',
      'good': 'Good condition',
      'fair': 'Fair condition with some wear',
      'poor': 'Poor condition with significant wear'
    };
    return descriptions[primary] || 'Good condition';
  }

  /**
   * CSV parsing utilities
   */
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    result.push(current.trim());
    return result;
  }

  private static createHeaderMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      
      // Map common variations
      const mappings: Record<string, string> = {
        'title': 'title',
        'booktitle': 'title',
        'name': 'title',
        'author': 'author',
        'authorname': 'author',
        'writer': 'author',
        'publisher': 'publisher',
        'publishername': 'publisher',
        'isbn': 'isbn',
        'isbn10': 'isbn',
        'isbn13': 'isbn',
        'price': 'price',
        'cost': 'price',
        'amount': 'price',
        'condition': 'condition',
        'state': 'condition',
        'quality': 'condition',
        'description': 'description',
        'summary': 'description',
        'notes': 'customNotes',
        'customnotes': 'customNotes',
        'comments': 'customNotes',
        'archived': 'isArchived',
        'active': 'isArchived',
        'created': 'createdAt',
        'createddate': 'createdAt',
        'dateadded': 'createdAt',
        'updated': 'updatedAt',
        'updateddate': 'updatedAt',
        'modified': 'updatedAt'
      };

      const mapped = mappings[normalized];
      if (mapped) {
        map[mapped] = index;
      }
    });

    return map;
  }

  private static csvRowToBook(values: string[], headerMap: Record<string, number>): any {
    const bookData: any = {};

    Object.entries(headerMap).forEach(([field, index]) => {
      if (index < values.length) {
        bookData[field] = values[index];
      }
    });

    return bookData;
  }

  /**
   * Utility methods
   */
  private static escapeCSVField(text: string): string {
    if (!text) return '';
    // Replace newlines with pipe separator and escape quotes
    return text.replace(/\n/g, ' | ').replace(/"/g, '""');
  }

  private static mapToVintedCondition(condition: string): string {
    const mapping: Record<string, string> = {
      'like-new': 'Brand new with tags',
      'very-good': 'Very good',
      'good': 'Good',
      'fair': 'Satisfactory',
      'poor': 'Poor'
    };
    return mapping[condition] || 'Good';
  }

  private static isDuplicateBook(book: Book, existingBooks: Book[]): boolean {
    return existingBooks.some(existing => 
      existing.id === book.id || 
      (existing.isbn && book.isbn && existing.isbn === book.isbn && existing.title === book.title)
    );
  }

  private static readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Template generation for CSV imports
   */
  static generateCSVTemplate(): string {
    const headers = [
      'Title*',
      'Author*',
      'Publisher',
      'ISBN',
      'Price',
      'Condition',
      'Description',
      'Notes',
      'Archived'
    ];

    const sampleRow = [
      'The Great Gatsby',
      'F. Scott Fitzgerald',
      'Scribner',
      '9780743273565',
      '12.99',
      'good',
      'Classic American novel about the Jazz Age',
      'Some highlighting on pages 45-50',
      'false'
    ];

    return [headers, sampleRow]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }

  /**
   * Data validation for exports
   */
  static validateExportData(books: Book[]): { valid: Book[]; invalid: Array<{ book: Book; errors: string[] }> } {
    const valid: Book[] = [];
    const invalid: Array<{ book: Book; errors: string[] }> = [];

    books.forEach(book => {
      const errors: string[] = [];

      if (!book.title?.trim()) errors.push('Title is required');
      if (!book.author?.trim()) errors.push('Author is required');
      if (book.price < 0) errors.push('Price cannot be negative');
      if (!book.condition?.primary) errors.push('Condition is required');

      if (errors.length === 0) {
        valid.push(book);
      } else {
        invalid.push({ book, errors });
      }
    });

    return { valid, invalid };
  }

  /**
   * Generate export filename with timestamp
   */
  static generateFileName(format: string, prefix: string = 'books'): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `${prefix}-export-${timestamp}.${format}`;
  }

  /**
   * Estimate export file size
   */
  static estimateExportSize(books: Book[], format: 'json' | 'csv'): { size: number; unit: string } {
    let estimatedSize = 0;

    if (format === 'json') {
      // Rough estimation: JSON overhead + data
      estimatedSize = books.reduce((acc, book) => {
        return acc + 
          (book.title?.length || 0) + 
          (book.author?.length || 0) + 
          (book.description?.length || 0) + 
          (book.customNotes?.length || 0) + 
          200; // JSON overhead per book
      }, 0);
    } else if (format === 'csv') {
      // Rough estimation: CSV row length
      estimatedSize = books.length * 500; // Estimated 500 chars per row
    }

    if (estimatedSize < 1024) {
      return { size: estimatedSize, unit: 'bytes' };
    } else if (estimatedSize < 1024 * 1024) {
      return { size: Math.round(estimatedSize / 1024), unit: 'KB' };
    } else {
      return { size: Math.round(estimatedSize / (1024 * 1024)), unit: 'MB' };
    }
  }
}