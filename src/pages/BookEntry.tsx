import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useBookStore } from '../stores/bookStore';
import type { BookCondition } from '../types/index';

interface BookEntryProps {
  onBack: () => void;
}

const BookEntry = ({ onBack }: BookEntryProps) => {
  const { addBook, isLoading } = useBookStore();
  
  const [formData, setFormData] = useState({
    isbn: '',
    title: '',
    author: '',
    publisher: '',
    description: '',
    customNotes: '',
    price: 0,
  });

  const [condition] = useState<BookCondition>({
    primary: 'good',
    issues: [],
    customNotes: '',
    generatedDescription: 'Good condition',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.author) return;

    try {
      await addBook({
        ...formData,
        condition,
        photos: [],
        isArchived: false,
      });
      
      // Reset form
      setFormData({
        isbn: '',
        title: '',
        author: '',
        publisher: '',
        description: '',
        customNotes: '',
        price: 0,
      });
      
      onBack();
    } catch (error) {
      console.error('Failed to add book:', error);
    }
  };

  return (
    <div className="p-4 pb-20">
      <header className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="mr-4 p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Add New Book</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Book title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Author *
          </label>
          <input
            type="text"
            required
            value={formData.author}
            onChange={(e) => setFormData({ ...formData, author: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Author name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price (€)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="0.00"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !formData.title || !formData.author}
          className="w-full bg-teal-600 text-white py-3 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <Save className="mr-2" size={20} />
          {isLoading ? 'Saving...' : 'Save Book'}
        </button>
      </form>
    </div>
  );
};

export default BookEntry;