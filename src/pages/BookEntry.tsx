import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useBookStore } from '@stores/bookStore';
import { BookCondition } from '@types/index';

const BookEntry = ({ onBack }: { onBack: () => void }) => {
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

  const [condition, setCondition] = useState<BookCondition>({
    primary: 'good' as const,
    issues: [],
    customNotes: '',
    generatedDescription: 'Good condition',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      
      onBack(); // Go back to home
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
            ISBN
          </label>
          <input
            type="text"
            value={formData.isbn}
            onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="978-0123456789"
          />
        </div>

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
            Condition
          </label>
          <select
            value={condition.primary}
            onChange={(e) => setCondition({
              ...condition,
              primary: e.target.value as BookCondition['primary'],
              generatedDescription: `${e.target.value.replace('-', ' ')} condition`
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="like-new">Like New</option>
            <option value="very-good">Very Good</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.customNotes}
            onChange={(e) => setFormData({ ...formData, customNotes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Additional notes about the book..."
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