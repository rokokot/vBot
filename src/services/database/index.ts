import Dexie, { type Table } from 'dexie';
import type { Book, Photo, ConditionTemplate } from '../../types/index.js';

export class BookDatabase extends Dexie {
  books!: Table<Book>;
  photos!: Table<Photo>;
  conditionTemplates!: Table<ConditionTemplate>;

  constructor() {
    super('BookListerDB');
    
    this.version(1).stores({
      books: '++id, isbn, title, author, createdAt, isArchived',
      photos: '++id, bookId, type, createdAt',
      conditionTemplates: '++id, name, userCreated, usageCount'
    });
  }
}

export const db = new BookDatabase();