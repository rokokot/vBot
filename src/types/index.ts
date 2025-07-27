// Basic book types to get started
export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  description: string;
  condition: BookCondition;
  customNotes: string;
  photos: Photo[];
  price: number;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean; // Add this field
}

export interface BookCondition {
  primary: 'like-new' | 'very-good' | 'good' | 'fair' | 'poor';
  issues: string[];
  customNotes: string;
  generatedDescription: string;
}

export interface Photo {
  id: string;
  bookId: string;
  type: 'front' | 'back' | 'spine' | 'damage' | 'other';
  blob: Blob;
  filename: string;
  createdAt: Date;
}

// Add this new interface
export interface ConditionTemplate {
  id: string;
  name: string;
  primary: 'like-new' | 'very-good' | 'good' | 'fair' | 'poor';
  issues: string[];
  description: string;
  userCreated: boolean;
  usageCount: number;
  createdAt: Date;
}