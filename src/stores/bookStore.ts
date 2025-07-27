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
}

export const useBookStore = create<BookStore>((set, get) => ({
  books: [],
  isLoading: false,
  error: null,

  fetchBooks: async () => {
    set({ isLoading: true, error: null });
    try {
      const books = await db.books.orderBy('createdAt').reverse().toArray();
      set({ books, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch books', isLoading: false });
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
      
      await db.books.add(book);
      set({ books: [book, ...get().books], isLoading: false });
    } catch (error) {
      set({ error: 'Failed to add book', isLoading: false });
    }
  },

  updateBook: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const updatedBook = {
        ...updates,
        updatedAt: new Date(),
      };
      
      await db.books.update(id, updatedBook);
      
      const books = get().books.map(book => 
        book.id === id ? { ...book, ...updatedBook } : book
      );
      
      set({ books, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to update book', isLoading: false });
    }
  },

  deleteBook: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await db.books.delete(id);
      
      const books = get().books.filter(book => book.id !== id);
      set({ books, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to delete book', isLoading: false });
    }
  },

  getBookById: (id) => {
    return get().books.find(book => book.id === id);
  },
}));