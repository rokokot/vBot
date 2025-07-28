// src/pages/Library.tsx - Clean version without errors
import { useEffect, useState } from 'react';
import { Search, Filter, Edit, Trash2, Archive, Copy, Plus, Share2 } from 'lucide-react';
import { useBookStore } from '../stores/bookStore';
import BookEdit from './BookEdit';
import ImageTransfer from '../components/common/ImageTransfer';
import type { Book } from '../types/index';

const Library = () => {
  const { books, fetchBooks, deleteBook, updateBook } = useBookStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [transferringBook, setTransferringBook] = useState<Book | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCondition, setFilterCondition] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const filteredBooks = books.filter(book => {
    const matchesSearch = 
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.isbn.includes(searchTerm);
    
    const matchesCondition = 
      filterCondition === 'all' || 
      book.condition.primary === filterCondition;

    const matchesArchiveFilter = showArchived ? book.isArchived : !book.isArchived;

    return matchesSearch && matchesCondition && matchesArchiveFilter;
  });

  const handleDeleteBook = async (bookId: string) => {
    if (window.confirm('Are you sure you want to delete this book?')) {
      await deleteBook(bookId);
    }
  };

  const handleArchiveBook = async (book: Book) => {
    await updateBook(book.id, { ...book, isArchived: !book.isArchived });
  };

  const handleEditBook = (book: Book) => {
    setEditingBook(book);
    setSelectedBook(null);
    setTransferringBook(null);
  };

  const handleTransferImages = (book: Book) => {
    setTransferringBook(book);
    setSelectedBook(null);
    setEditingBook(null);
  };

  const handleEditSave = () => {
    setEditingBook(null);
    fetchBooks();
  };

  const generateVintedDescription = (book: Book) => {
    const condition = book.condition.generatedDescription;
    const notes = book.customNotes ? `\n\nAdditional notes: ${book.customNotes}` : '';
    
    return `📚 ${book.title}
by ${book.author}
${book.publisher ? `Published by ${book.publisher}` : ''}

Condition: ${condition}
${book.description ? `\nDescription: ${book.description}` : ''}${notes}

#books #reading #literature`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // If editing a book, show the edit component
  if (editingBook) {
    return (
      <BookEdit
        book={editingBook}
        onBack={() => setEditingBook(null)}
        onSave={handleEditSave}
      />
    );
  }

  // If transferring images, show the transfer component
  if (transferringBook) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <ImageTransfer
          book={transferringBook}
          onClose={() => setTransferringBook(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">My Library</h1>
        
        {/* Search and Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search books..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter size={16} className="mr-2" />
              Filters
            </button>
            
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center px-3 py-2 rounded-lg border ${
                showArchived 
                  ? 'border-yellow-300 bg-yellow-50 text-yellow-700' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Archive size={16} className="mr-2" />
              {showArchived ? 'Archived' : 'Active'}
            </button>
          </div>
          
          {showFilters && (
            <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Condition
              </label>
              <select
                value={filterCondition}
                onChange={(e) => setFilterCondition(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Conditions</option>
                <option value="like-new">Like New</option>
                <option value="very-good">Very Good</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          )}
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
          <h3 className="font-semibold text-teal-900">
            {showArchived ? 'Archived' : 'Active'} Books
          </h3>
          <p className="text-2xl font-bold text-teal-900">{filteredBooks.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <h3 className="font-semibold text-green-900">Total Value</h3>
          <p className="text-2xl font-bold text-green-900">
            €{filteredBooks.reduce((sum, book) => sum + book.price, 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Book List */}
      <div className="space-y-3">
        {filteredBooks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No books found</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-2 text-teal-600 hover:text-teal-700"
              >
                Clear search
              </button>
            )}
            {showArchived && (
              <button
                onClick={() => setShowArchived(false)}
                className="mt-2 text-teal-600 hover:text-teal-700 block mx-auto"
              >
                View active books
              </button>
            )}
          </div>
        ) : (
          filteredBooks.map((book) => (
            <div
              key={book.id}
              className={`bg-white border rounded-lg p-4 ${
                book.isArchived ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{book.title}</h3>
                      <p className="text-sm text-gray-600">by {book.author}</p>
                      {book.publisher && (
                        <p className="text-xs text-gray-500">{book.publisher}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {book.photos && book.photos.length > 0 && (
                        <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          📸 {book.photos.length}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-teal-600">€{book.price}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {book.condition.primary.replace('-', ' ')}
                  </p>
                  {book.isArchived && (
                    <p className="text-xs text-yellow-600 font-medium">Archived</p>
                  )}
                </div>
              </div>
              
              {book.isbn && (
                <p className="text-xs text-gray-500 mb-2">ISBN: {book.isbn}</p>
              )}
              
              <div className="flex gap-2 flex-wrap">
                {/* Priority action: Transfer Images (if photos exist) */}
                {book.photos && book.photos.length > 0 && (
                  <button
                    onClick={() => handleTransferImages(book)}
                    className="flex items-center px-3 py-1 text-xs bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 font-medium"
                  >
                    <Share2 size={14} className="mr-1" />
                    Transfer to Vinted ({book.photos.length})
                  </button>
                )}
                
                <button
                  onClick={() => copyToClipboard(generateVintedDescription(book))}
                  className="flex items-center px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  <Copy size={14} className="mr-1" />
                  Copy Description
                </button>
                
                <button
                  onClick={() => setSelectedBook(book)}
                  className="flex items-center px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <Plus size={14} className="mr-1" />
                  View
                </button>

                <button
                  onClick={() => handleEditBook(book)}
                  className="flex items-center px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                >
                  <Edit size={14} className="mr-1" />
                  Edit
                </button>
                
                <button
                  onClick={() => handleArchiveBook(book)}
                  className={`flex items-center px-3 py-1 text-xs rounded-lg ${
                    book.isArchived
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  }`}
                >
                  <Archive size={14} className="mr-1" />
                  {book.isArchived ? 'Unarchive' : 'Archive'}
                </button>
                
                <button
                  onClick={() => handleDeleteBook(book.id)}
                  className="flex items-center px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                >
                  <Trash2 size={14} className="mr-1" />
                  Delete
                </button>
              </div>

              {/* Compact Image Transfer for books with photos */}
              {book.photos && book.photos.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <ImageTransfer book={book} compact={true} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Book Details Modal */}
      {selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{selectedBook.title}</h2>
            
            {/* Photos Preview */}
            {selectedBook.photos && selectedBook.photos.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">Photos ({selectedBook.photos.length})</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedBook.photos.slice(0, 4).map((photo) => (
                    <img
                      key={photo.id}
                      src={URL.createObjectURL(photo.blob)}
                      alt={`Book photo - ${photo.type}`}
                      className="w-full h-20 object-cover rounded border"
                    />
                  ))}
                </div>
                {selectedBook.photos.length > 4 && (
                  <p className="text-xs text-gray-500 mt-1">
                    +{selectedBook.photos.length - 4} more photos
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Author:</span> {selectedBook.author}
              </div>
              {selectedBook.publisher && (
                <div>
                  <span className="font-medium">Publisher:</span> {selectedBook.publisher}
                </div>
              )}
              {selectedBook.isbn && (
                <div>
                  <span className="font-medium">ISBN:</span> {selectedBook.isbn}
                </div>
              )}
              <div>
                <span className="font-medium">Price:</span> €{selectedBook.price}
              </div>
              <div>
                <span className="font-medium">Condition:</span> {selectedBook.condition.generatedDescription}
              </div>
              {selectedBook.condition.customNotes && (
                <div>
                  <span className="font-medium">Condition Notes:</span>
                  <p className="mt-1">{selectedBook.condition.customNotes}</p>
                </div>
              )}
              {selectedBook.description && (
                <div>
                  <span className="font-medium">Description:</span>
                  <p className="mt-1">{selectedBook.description}</p>
                </div>
              )}
              {selectedBook.customNotes && (
                <div>
                  <span className="font-medium">Notes:</span>
                  <p className="mt-1">{selectedBook.customNotes}</p>
                </div>
              )}
              <div>
                <span className="font-medium">Status:</span>
                <span className={`ml-1 font-medium ${
                  selectedBook.isArchived ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {selectedBook.isArchived ? 'Archived' : 'Active'}
                </span>
              </div>
              <div>
                <span className="font-medium">Added:</span> {selectedBook.createdAt.toLocaleDateString()}
              </div>
            </div>
            
            <div className="mt-6 flex gap-2">
              {selectedBook.photos && selectedBook.photos.length > 0 && (
                <button
                  onClick={() => handleTransferImages(selectedBook)}
                  className="flex-1 bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700"
                >
                  Transfer to Vinted
                </button>
              )}
              <button
                onClick={() => handleEditBook(selectedBook)}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
              >
                Edit Book
              </button>
              <button
                onClick={() => copyToClipboard(generateVintedDescription(selectedBook))}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                Copy Description
              </button>
              <button
                onClick={() => setSelectedBook(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;