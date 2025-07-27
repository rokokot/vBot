export interface BookApiResult {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  description: string;
  publishedDate?: string;
  pageCount?: number;
  imageLinks?: {
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
  };
}

class BookApiService {
  private async fetchFromGoogleBooks(isbn: string): Promise<BookApiResult | null> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
      );
      
      if (!response.ok) throw new Error('API request failed');
      
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        return null;
      }
      
      const book = data.items[0].volumeInfo;
      
      return {
        isbn,
        title: book.title || '',
        author: book.authors ? book.authors.join(', ') : '',
        publisher: book.publisher || '',
        description: book.description || '',
        publishedDate: book.publishedDate,
        pageCount: book.pageCount,
        imageLinks: book.imageLinks
      };
    } catch (error) {
      console.error('Google Books API error:', error);
      return null;
    }
  }

  private async fetchFromOpenLibrary(isbn: string): Promise<BookApiResult | null> {
    try {
      const response = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
      );
      
      if (!response.ok) throw new Error('API request failed');
      
      const data = await response.json();
      const bookKey = `ISBN:${isbn}`;
      
      if (!data[bookKey]) {
        return null;
      }
      
      const book = data[bookKey];
      
      return {
        isbn,
        title: book.title || '',
        author: book.authors ? book.authors.map((a: any) => a.name).join(', ') : '',
        publisher: book.publishers ? book.publishers[0].name : '',
        description: book.description || '',
        publishedDate: book.publish_date,
        pageCount: book.number_of_pages
      };
    } catch (error) {
      console.error('OpenLibrary API error:', error);
      return null;
    }
  }

  async getBookInfo(isbn: string): Promise<BookApiResult | null> {
    // Clean the ISBN
    const cleanIsbn = isbn.replace(/[^0-9X]/g, '');
    
    // Try Google Books first
    let result = await this.fetchFromGoogleBooks(cleanIsbn);
    
    // Fallback to OpenLibrary if Google Books fails
    if (!result) {
      result = await this.fetchFromOpenLibrary(cleanIsbn);
    }
    
    return result;
  }
}

export const bookApiService = new BookApiService();