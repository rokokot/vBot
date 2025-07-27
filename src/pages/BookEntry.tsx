import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader, Search, Keyboard, ScanLine } from 'lucide-react';
import { useBookStore } from '../stores/bookStore';
import { bookApiService } from '../services/api/bookApi';
import PhotoUpload from '../components/common/PhotoUpload';
import BarcodeScanner from '../components/common/BarcodeScanner';
import type { BookCondition, Photo } from '../types/index';

interface BookEntryProps {
  onBack: () => void;
}

const BookEntry = ({ onBack }: BookEntryProps) => {
  const { addBook, isLoading } = useBookStore();
  const [isLoadingBookInfo, setIsLoadingBookInfo] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  
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

  // Check device capabilities
  useEffect(() => {
    const checkCapabilities = async () => {
      // Check if mobile device
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);

      // Check if camera is available
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoInput = devices.some(device => device.kind === 'videoinput');
        setHasCamera(hasVideoInput && (window.location.protocol === 'https:' || window.location.hostname === 'localhost'));
      } catch (error) {
        setHasCamera(false);
      }
    };

    checkCapabilities();
  }, []);

  const handleBarcodeDetected = async (code: string) => {
    setShowScanner(false);
    await fetchBookInfo(code);
  };

  const handleManualISBNSubmit = async () => {
    if (formData.isbn.length >= 10) {
      await fetchBookInfo(formData.isbn);
    }
  };

  const handleTitleSearch = async () => {
    if (formData.title.length >= 3) {
      setIsLoadingBookInfo(true);
      try {
        const response = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(formData.title)}&maxResults=5`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.items && data.items.length > 0) {
            const book = data.items[0].volumeInfo;
            setFormData(prev => ({
              ...prev,
              title: book.title || prev.title,
              author: book.authors ? book.authors.join(', ') : prev.author,
              publisher: book.publisher || prev.publisher,
              description: book.description || prev.description,
              isbn: book.industryIdentifiers?.[0]?.identifier || prev.isbn
            }));
          } else {
            alert('No books found with that title. Try a different search term.');
          }
        }
      } catch (error) {
        console.error('Title search error:', error);
        alert('Search failed. Please check your connection.');
      } finally {
        setIsLoadingBookInfo(false);
      }
    }
  };

  const fetchBookInfo = async (isbn: string) => {
    setIsLoadingBookInfo(true);
    
    try {
      const bookInfo = await bookApiService.getBookInfo(isbn);
      
      if (bookInfo) {
        setFormData(prev => ({
          ...prev,
          isbn: bookInfo.isbn,
          title: bookInfo.title,
          author: bookInfo.author,
          publisher: bookInfo.publisher,
          description: bookInfo.description,
        }));
      } else {
        setFormData(prev => ({ ...prev, isbn }));
        alert('Book information not found. Please fill in details manually.');
      }
    } catch (error) {
      console.error('Error fetching book info:', error);
      setFormData(prev => ({ ...prev, isbn }));
      alert('Error fetching book information. Please check your connection.');
    } finally {
      setIsLoadingBookInfo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.author) return;

    try {
      await addBook({
        ...formData,
        condition,
        photos,
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
      setPhotos([]);
      
      onBack();
    } catch (error) {
      console.error('Failed to add book:', error);
    }
  };

  if (showScanner) {
    return (
      <BarcodeScanner
        onDetected={handleBarcodeDetected}
        onClose={() => setShowScanner(false)}
      />
    );
  }

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

      {/* Quick Input Methods */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Add</h2>
        <div className="grid gap-3">
          {/* Scanner Option - Only show if supported */}
          {hasCamera && (
            <div className="p-4 border-2 border-gray-300 rounded-lg">
              <div className="flex items-start">
                <ScanLine className="mr-3 text-teal-600 mt-1" size={24} />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-2">Scan Barcode</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {isMobile ? 'Use your camera to scan the ISBN barcode' : 'Scan with webcam (works best on mobile)'}
                  </p>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                  >
                    Start Scanner
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manual ISBN Entry */}
          <div className="p-4 border-2 border-gray-300 rounded-lg">
            <div className="flex items-start">
              <Keyboard className="mr-3 text-blue-600 mt-1" size={24} />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-2">Enter ISBN</h3>
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
                    onClick={handleManualISBNSubmit}
                    disabled={formData.isbn.length < 10 || isLoadingBookInfo}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isLoadingBookInfo ? <Loader className="animate-spin" size={16} /> : 'Lookup'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Title Search */}
          <div className="p-4 border-2 border-gray-300 rounded-lg">
            <div className="flex items-start">
              <Search className="mr-3 text-green-600 mt-1" size={24} />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-2">Search by Title</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Book title..."
                  />
                  <button
                    type="button"
                    onClick={handleTitleSearch}
                    disabled={formData.title.length < 3 || isLoadingBookInfo}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isLoadingBookInfo ? <Loader className="animate-spin" size={16} /> : 'Search'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  When ISBN is unknown or not available
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Device Compatibility Notice */}
      {!hasCamera && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="font-medium text-amber-900 mb-1">Scanner Not Available</h3>
          <p className="text-sm text-amber-800">
            {window.location.protocol !== 'https:' && window.location.hostname !== 'localhost'
              ? 'Camera access requires HTTPS. Use manual entry or title search instead.'
              : 'No camera detected. Use manual entry or title search instead.'
            }
          </p>
        </div>
      )}

      {isLoadingBookInfo && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center">
          <Loader className="animate-spin mr-2" size={20} />
          <span className="text-blue-700">Fetching book information...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Book Information</h3>
          
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
              rows={3}
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
              rows={2}
            />
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="border-t border-gray-200 pt-6">
          <PhotoUpload
            photos={photos}
            onPhotosChange={setPhotos}
            maxPhotos={5}
          />
        </div>

        {/* Submit Button */}
        <div className="border-t border-gray-200 pt-6">
          <button
            type="submit"
            disabled={isLoading || !formData.title || !formData.author || isLoadingBookInfo}
            className="w-full bg-teal-600 text-white py-3 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Save className="mr-2" size={20} />
            {isLoading ? 'Saving...' : 'Save Book'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BookEntry;