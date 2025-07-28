// src/extension/ExtensionPopup.tsx
import { useState, useEffect } from 'react';
import { Search, Plus, Settings, BookOpen, Copy, Trash2 } from 'lucide-react';
import { useBookStore } from '../stores/bookStore';
import { bookApiService } from '../services/api/bookApi';
import type { Book } from '../types/index';

const ExtensionPopup = () => {
  const { books, fetchBooks, addBook, deleteBook, isLoading } = useBookStore();
  const [currentTab, setCurrentTab] = useState<'library' | 'add' | 'settings'>('library');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isOnVintedPage, setIsOnVintedPage] = useState(false);
  const [isLoadingBookInfo, setIsLoadingBookInfo] = useState(false);

  const [formData, setFormData] = useState({
    isbn: '',
    title: '',
    author: '',
    publisher: '',
    description: '',
    customNotes: '',
    price: 0,
  });

  const [settings, setSettings] = useState({
    autoFillTitle: true,
    autoFillDescription: true,
    includeISBN: true,
    useEmojis: true,
  });

  useEffect(() => {
    fetchBooks();
    checkVintedPage();
    loadSettings();
  }, [fetchBooks]);

  const checkVintedPage = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        setIsOnVintedPage(tab.url?.includes('vinted.com/items/new') || false);
      } catch (error) {
        console.error('Error checking Vinted page:', error);
      }
    }
  };

  const loadSettings = async () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get(['settings']);
        if (result.settings) {
          setSettings(result.settings);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  };

  const saveSettings = async () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        await chrome.storage.local.set({ settings });
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    }
  };

  const filteredBooks = books.filter(book => 
    book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (book.isbn && book.isbn.includes(searchTerm))
  );

  const handleISBNLookup = async () => {
    if (formData.isbn.length >= 10) {
      setIsLoadingBookInfo(true);
      try {
        const bookInfo = await bookApiService.getBookInfo(formData.isbn);
        
        if (bookInfo) {
          setFormData(prev => ({
            ...prev,
            title: bookInfo.title,
            author: bookInfo.author,
            publisher: bookInfo.publisher,
            description: bookInfo.description,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.author) return;

    try {
      await addBook({
        ...formData,
        condition: {
          primary: 'good',
          issues: [],
          customNotes: '',
          generatedDescription: 'Good condition',
        },
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
      
      setCurrentTab('library');
    } catch (error) {
      console.error('Failed to add book:', error);
    }
  };

  const handleAutofill = async (book: Book) => {
    if (!isOnVintedPage) {
      alert('Please navigate to the Vinted listing page first');
      return;
    }

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        await chrome.tabs.sendMessage(tab.id!, {
          action: 'autofill',
          book: book,
          settings: settings
        });

        setSelectedBook(book);
        alert('Book details filled in Vinted form!');
      }
    } catch (error) {
      console.error('Autofill error:', error);
      alert('Failed to autofill. Make sure you\'re on a Vinted listing page.');
    }
  };

  const handleCopyDescription = async (book: Book) => {
    const description = generateVintedDescription(book);
    
    try {
      await navigator.clipboard.writeText(description);
      alert('Description copied to clipboard!');
    } catch (error) {
      console.error('Copy error:', error);
      alert('Failed to copy description');
    }
  };

  const generateVintedDescription = (book: Book) => {
    const emoji = settings.useEmojis;
    const includeISBN = settings.includeISBN && book.isbn;
    
    let description = '';
    
    if (emoji) {
      description += `📚 ${book.title}\n`;
      description += `✍️ by ${book.author}\n`;
      if (book.publisher) description += `🏢 ${book.publisher}\n`;
      if (includeISBN) description += `📖 ISBN: ${book.isbn}\n`;
    } else {
      description += `${book.title}\n`;
      description += `by ${book.author}\n`;
      if (book.publisher) description += `Publisher: ${book.publisher}\n`;
      if (includeISBN) description += `ISBN: ${book.isbn}\n`;
    }
    
    description += '\n';
    
    if (book.condition) {
      const conditionText = book.condition.primary.replace('-', ' ');
      description += emoji ? `📋 Condition: ${conditionText}\n` : `Condition: ${conditionText}\n`;
    }
    
    if (book.description) {
      description += `\n${book.description}\n`;
    }
    
    if (book.customNotes) {
      description += `\nNotes: ${book.customNotes}\n`;
    }
    
    description += emoji ? '\n📚 Perfect for book lovers!\n📦 Fast shipping | 🚭 Smoke-free home' : '\nPerfect for book lovers!\nFast shipping | Smoke-free home';
    
    return description;
  };

  const handleDeleteBook = async (bookId: string) => {
    if (window.confirm('Are you sure you want to delete this book?')) {
      await deleteBook(bookId);
    }
  };

  return (
    <div className="w-96 h-[600px] bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={20} />
            <span className="font-semibold">Book Lister</span>
          </div>
          <button
            onClick={fetchBooks}
            className="p-1 hover:bg-white/20 rounded"
            title="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="flex bg-gray-100 border-b">
        {[
          { id: 'library', label: 'Library', icon: BookOpen },
          { id: 'add', label: 'Add Book', icon: Plus },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCurrentTab(id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors ${
              currentTab === id
                ? 'bg-white text-sky-600 border-b-2 border-sky-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {currentTab === 'library' && (
          <div className="p-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search books..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-sky-600">{books.length}</div>
                <div className="text-xs text-sky-700">Books</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-600">
                  €{books.reduce((sum, book) => sum + (book.price || 0), 0).toFixed(2)}
                </div>
                <div className="text-xs text-green-700">Value</div>
              </div>
            </div>

            {/* Vinted Status */}
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              isOnVintedPage ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isOnVintedPage ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm">
                {isOnVintedPage ? 'Ready to autofill Vinted' : 'Not on Vinted listing page'}
              </span>
            </div>

            {/* Book List */}
            <div className="space-y-2">
              {filteredBooks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
                  <p>No books found</p>
                  <p className="text-sm">Add your first book to get started</p>
                </div>
              ) : (
                filteredBooks.map((book) => (
                  <div
                    key={book.id}
                    className={`bg-white border rounded-lg p-3 transition-all ${
                      selectedBook?.id === book.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-sky-300'
                    }`}
                  >
                    <div className="mb-2">
                      <h3 className="font-medium text-gray-900 text-sm leading-tight">{book.title}</h3>
                      <p className="text-xs text-gray-600">by {book.author}</p>
                      <p className="text-xs text-sky-600 font-medium">€{book.price}</p>
                    </div>
                    
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAutofill(book)}
                        disabled={!isOnVintedPage}
                        className="flex-1 px-2 py-1 bg-sky-600 text-white rounded text-xs hover:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Use on Vinted
                      </button>
                      <button
                        onClick={() => handleCopyDescription(book)}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                        title="Copy description"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteBook(book.id)}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                        title="Delete book"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {currentTab === 'add' && (
          <div className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ISBN (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.isbn}
                    onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="978-0123456789"
                  />
                  <button
                    type="button"
                    onClick={handleISBNLookup}
                    disabled={formData.isbn.length < 10 || isLoadingBookInfo}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 text-sm"
                  >
                    {isLoadingBookInfo ? '...' : 'Lookup'}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Publisher name"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Additional notes"
                  rows={3}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !formData.title || !formData.author}
                className="w-full bg-sky-600 text-white py-2 px-4 rounded-lg hover:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Adding...' : 'Add Book'}
              </button>
            </form>
          </div>
        )}

        {currentTab === 'settings' && (
          <div className="p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Autofill Settings</h3>
            
            <div className="space-y-3">
              {Object.entries(settings).map(([key, value]) => (
                <label key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => {
                      const newSettings = { ...settings, [key]: e.target.checked };
                      setSettings(newSettings);
                      saveSettings();
                    }}
                    className="text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-sm text-gray-700">
                    {key === 'autoFillTitle' && 'Auto-fill title'}
                    {key === 'autoFillDescription' && 'Auto-fill description'}
                    {key === 'includeISBN' && 'Include ISBN in description'}
                    {key === 'useEmojis' && 'Use emojis in descriptions'}
                  </span>
                </label>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Total books: {books.length}
              </p>
              <p className="text-sm text-gray-600">
                Total value: €{books.reduce((sum, book) => sum + (book.price || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ExtensionPopup;