import { create } from 'zustand';
import type { Book } from '../types/index';
import { db } from '../services/database/index';

interface BookStore {
  books: Book[];
  isLoading: boolean;
  error: string | null;
  
  fetchBooks: () => Promise<void>;
  addBook: (book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
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
}));