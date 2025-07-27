import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader, Trash2, Archive, RotateCcw } from 'lucide-react';
import { useBookStore } from '../stores/bookStore';
import { bookApiService } from '../services/api/bookApi';
import PhotoUpload from '../components/common/PhotoUpload';
import type { Book, BookCondition, Photo } from '../types/index';

interface BookEditProps {
  book: Book;
  onBack: () => void;
  onSave: () => void;
}

const BookEdit = ({ book, onBack, onSave }: BookEditProps) => {
  const { updateBook, deleteBook, isLoading } = useBookStore();
  const [isLoadingBookInfo, setIsLoadingBookInfo] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>(book.photos || []);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [formData, setFormData] = useState({
    isbn: book.isbn || '',
    title: book.title || '',
    author: book.author || '',
    publisher: book.publisher || '',
    description: book.description || '',
    customNotes: book.customNotes || '',
    price: book.price || 0,
  });

  const [condition, setCondition] = useState<BookCondition>(book.condition || {
    primary: 'good',
    issues: [],
    customNotes: '',
    generatedDescription: 'Good condition',
  });

  // Track changes
  useEffect(() => {
    const hasFormChanges = 
      formData.isbn !== (book.isbn || '') ||
      formData.title !== (book.title || '') ||
      formData.author !== (book.author || '') ||
      formData.publisher !== (book.publisher || '') ||
      formData.description !== (book.description || '') ||
      formData.customNotes !== (book.customNotes || '') ||
      formData.price !== (book.price || 0);

    const hasPhotoChanges = photos.length !== (book.photos?.length || 0) ||
      photos.some((photo, index) => photo.id !== book.photos?.[index]?.id);

    const hasConditionChanges = JSON.stringify(condition) !== JSON.stringify(book.condition);

    setHasChanges(hasFormChanges || hasPhotoChanges || hasConditionChanges);
  }, [formData, photos, condition, book]);

  const handleISBNLookup = async () => {
    if (formData.isbn.length >= 10) {
      setIsLoadingBookInfo(true);
      try {
        const bookInfo = await bookApiService.getBookInfo(formData.isbn);
        
        if (bookInfo) {
          // Only update empty fields to preserve user edits
          setFormData(prev => ({
            isbn: bookInfo.isbn,
            title: prev.title || bookInfo.title,
            author: prev.author || bookInfo.author,
            publisher: prev.publisher || bookInfo.publisher,
            description: prev.description || bookInfo.description,
            customNotes: prev.customNotes,
            price: prev.price || 0,
          }));
        } else {
          alert('Book information not found for this ISBN.');
        }
      } catch (error) {
        console.error('Error fetching book info:', error);
        alert('Error fetching book information. Please check your connection.');
      } finally {
        setIsLoadingBookInfo(false);
      }
    }
  };

  const handleConditionChange = (field: keyof BookCondition, value: any) => {
    const newCondition = { ...condition, [field]: value };
    
    // Auto-generate description based on condition
    if (field === 'primary') {
      const descriptions: Record<string, string> = {
        'like-new': 'Like new condition',
        'very-good': 'Very good condition',
        'good': 'Good condition',
        'fair': 'Fair condition with some wear',
        'poor': 'Poor condition with significant wear'
      };
      newCondition.generatedDescription = descriptions[value] || 'Good condition';
    }
    
    setCondition(newCondition);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.author) return;

    try {
      await updateBook(book.id, {
        ...formData,
        condition,
        photos,
        updatedAt: new Date(),
      });
      
      onSave();
    } catch (error) {
      console.error('Failed to update book:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to permanently delete this book? This action cannot be undone.')) {
      try {
        await deleteBook(book.id);
        onBack();
      } catch (error) {
        console.error('Failed to delete book:', error);
        alert('Failed to delete book. Please try again.');
      }
    }
  };

  const handleArchive = async () => {
    const action = book.isArchived ? 'unarchive' : 'archive';
    if (window.confirm(`Are you sure you want to ${action} this book?`)) {
      try {
        await updateBook(book.id, {
          isArchived: !book.isArchived,
          updatedAt: new Date(),
        });
        onSave();
      } catch (error) {
        console.error(`Failed to ${action} book:`, error);
        alert(`Failed to ${action} book. Please try again.`);
      }
    }
  };

  const resetChanges = () => {
    if (window.confirm('Are you sure you want to discard all changes?')) {
      setFormData({
        isbn: book.isbn || '',
        title: book.title || '',
        author: book.author || '',
        publisher: book.publisher || '',
        description: book.description || '',
        customNotes: book.customNotes || '',
        price: book.price || 0,
      });
      setCondition(book.condition || {
        primary: 'good',
        issues: [],
        customNotes: '',
        generatedDescription: 'Good condition',
      });
      setPhotos(book.photos || []);
    }
  };

  return (
    <div className="p-4 pb-20">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit Book</h1>
            {hasChanges && (
              <p className="text-sm text-orange-600">You have unsaved changes</p>
            )}
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2">
          {hasChanges && (
            <button
              onClick={resetChanges}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
              title="Reset changes"
            >
              <RotateCcw size={20} />
            </button>
          )}
          <button
            onClick={handleArchive}
            className={`p-2 rounded-lg ${
              book.isArchived 
                ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-50' 
                : 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50'
            }`}
            title={book.isArchived ? 'Unarchive book' : 'Archive book'}
          >
            <Archive size={20} />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
            title="Delete book"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      {isLoadingBookInfo && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center">
          <Loader className="animate-spin mr-2" size={20} />
          <span className="text-blue-700">Fetching updated book information...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Book Information</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ISBN
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="978-0123456789"
              />
              <button
                type="button"
                onClick={handleISBNLookup}
                disabled={formData.isbn.length < 10 || isLoadingBookInfo}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoadingBookInfo ? <Loader className="animate-spin" size={16} /> : 'Update'}
              </button>
            </div>
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
              Publisher
            </label>
            <input
              type="text"
              value={formData.publisher}
              onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Publisher name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Book description"
              rows={4}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Notes
            </label>
            <textarea
              value={formData.customNotes}
              onChange={(e) => setFormData({ ...formData, customNotes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Additional notes about the book"
              rows={3}
            />
          </div>
        </div>

        {/* Condition Section */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Condition</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overall Condition
              </label>
              <select
                value={condition.primary}
                onChange={(e) => handleConditionChange('primary', e.target.value as BookCondition['primary'])}
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
                Condition Notes
              </label>
              <textarea
                value={condition.customNotes}
                onChange={(e) => handleConditionChange('customNotes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Specific details about the book's condition"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Photo Section */}
        <div className="border-t border-gray-200 pt-6">
          <PhotoUpload
            bookId={book.id}
            photos={photos}
            onPhotosChange={setPhotos}
            maxPhotos={5}
          />
        </div>

        {/* Status Information */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <p className="text-gray-600">{book.createdAt.toLocaleDateString()}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Last Updated:</span>
              <p className="text-gray-600">{book.updatedAt.toLocaleDateString()}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Status:</span>
              <p className={`font-medium ${book.isArchived ? 'text-yellow-600' : 'text-green-600'}`}>
                {book.isArchived ? 'Archived' : 'Active'}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Photos:</span>
              <p className="text-gray-600">{photos.length} image(s)</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 pt-6 flex gap-3">
          <button
            type="submit"
            disabled={isLoading || !formData.title || !formData.author || !hasChanges}
            className="flex-1 bg-teal-600 text-white py-3 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Save className="mr-2" size={20} />
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
          
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default BookEdit;