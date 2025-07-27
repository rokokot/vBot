import { useEffect, useState } from 'react';
import { Download, Copy, FileText, Share2 } from 'lucide-react';
import { useBookStore } from '../stores/bookStore';
import type { Book } from '../types/index';

const Export = () => {
  const { books, fetchBooks } = useBookStore();
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'vinted' | 'csv' | 'json'>('vinted');

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const activeBooks = books.filter(book => !book.isArchived);

  const mapToVintedCondition = (condition: string) => {
    const mapping = {
      'like-new': 'Very good',
      'very-good': 'Good',
      'good': 'Satisfactory',
      'fair': 'Satisfactory',
      'poor': 'Poor'
    };
    return mapping[condition as keyof typeof mapping] || 'Satisfactory';
  };

  const generateVintedDescription = (book: Book) => {
    const condition = book.condition.generatedDescription;
    const notes = book.customNotes ? `\n\nAdditional notes: ${book.customNotes}` : '';
    
    return `📚 ${book.title}
✍️ Author: ${book.author}
${book.publisher ? `🏢 Publisher: ${book.publisher}` : ''}
${book.isbn ? `📖 ISBN: ${book.isbn}` : ''}

📋 Condition: ${condition}

${book.description ? `📝 Description:\n${book.description}` : ''}${notes}

Perfect for book lovers! 📚✨
Fast shipping 📦 | Smoke-free home 🚭

#books #reading #literature #${book.author.toLowerCase().replace(/\s+/g, '')}`;
  };

  const generateVintedListing = (book: Book) => {
    return {
      title: `${book.title} - ${book.author}`.substring(0, 40), // Vinted title limit
      description: generateVintedDescription(book),
      price: book.price.toFixed(2),
      condition: mapToVintedCondition(book.condition.primary),
      category: "Books",
      subcategory: "Fiction", // Could be made dynamic
      brand: book.publisher || "Unbranded",
      tags: [
        "books",
        "reading",
        book.author.split(' ')[0].toLowerCase(),
        book.condition.primary.replace('-', '')
      ].join(', ')
    };
  };

  const exportToCSV = () => {
    const booksToExport = selectedBooks.length > 0 
      ? activeBooks.filter(book => selectedBooks.includes(book.id))
      : activeBooks;

    const headers = [
      'Title',
      'Author', 
      'Publisher',
      'ISBN',
      'Price (€)',
      'Condition',
      'Vinted Title',
      'Vinted Description',
      'Vinted Condition',
      'Category',
      'Tags'
    ];

    const rows = booksToExport.map(book => {
      const vintedListing = generateVintedListing(book);
      return [
        book.title,
        book.author,
        book.publisher,
        book.isbn,
        book.price.toFixed(2),
        book.condition.generatedDescription,
        vintedListing.title,
        vintedListing.description.replace(/\n/g, ' | '), // Replace newlines for CSV
        vintedListing.condition,
        vintedListing.category,
        vintedListing.tags
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vinted-books-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const copyVintedListings = () => {
    const booksToExport = selectedBooks.length > 0 
      ? activeBooks.filter(book => selectedBooks.includes(book.id))
      : activeBooks;

    const listings = booksToExport.map((book, index) => {
      const listing = generateVintedListing(book);
      return `LISTING ${index + 1}:
━━━━━━━━━━━━━━━━━━━━━━━━

TITLE: ${listing.title}

DESCRIPTION:
${listing.description}

PRICE: €${listing.price}
CONDITION: ${listing.condition}
CATEGORY: ${listing.category}
BRAND: ${listing.brand}

TAGS: ${listing.tags}

━━━━━━━━━━━━━━━━━━━━━━━━`;
    }).join('\n\n');

    navigator.clipboard.writeText(listings);
    alert(`Copied ${booksToExport.length} listing(s) to clipboard!`);
  };

  const exportToJSON = () => {
    const booksToExport = selectedBooks.length > 0 
      ? activeBooks.filter(book => selectedBooks.includes(book.id))
      : activeBooks;

    const exportData = {
      exportDate: new Date().toISOString(),
      totalBooks: booksToExport.length,
      books: booksToExport.map(book => ({
        ...book,
        vintedListing: generateVintedListing(book)
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `book-library-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const toggleBookSelection = (bookId: string) => {
    setSelectedBooks(prev => 
      prev.includes(bookId) 
        ? prev.filter(id => id !== bookId)
        : [...prev, bookId]
    );
  };

  const selectAll = () => {
    setSelectedBooks(activeBooks.map(book => book.id));
  };

  const clearSelection = () => {
    setSelectedBooks([]);
  };

  return (
    <div className="p-4 pb-20">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Export to Vinted</h1>
        <p className="text-gray-600">
          Export your books for easy listing on Vinted
        </p>
      </header>

      {/* Export Format Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Export Format
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'vinted', label: 'Vinted Ready', icon: Copy },
            { value: 'csv', label: 'CSV File', icon: FileText },
            { value: 'json', label: 'JSON Data', icon: Download }
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setExportFormat(value as any)}
              className={`p-3 border rounded-lg text-center transition-colors ${
                exportFormat === value
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Icon size={20} className="mx-auto mb-1" />
              <div className="text-sm">{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Book Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Select Books ({selectedBooks.length}/{activeBooks.length})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              Select All
            </button>
            {selectedBooks.length > 0 && (
              <button
                onClick={clearSelection}
                className="text-sm text-gray-600 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {activeBooks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No books available for export</p>
              <p className="text-sm">Add some books first!</p>
            </div>
          ) : (
            activeBooks.map(book => (
              <label
                key={book.id}
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedBooks.includes(book.id)}
                  onChange={() => toggleBookSelection(book.id)}
                  className="mr-3 text-teal-600 focus:ring-teal-500"
                />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{book.title}</h3>
                  <p className="text-sm text-gray-600">by {book.author}</p>
                  <p className="text-sm text-teal-600">€{book.price}</p>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Export Actions */}
      <div className="space-y-3">
        {exportFormat === 'vinted' && (
          <button
            onClick={copyVintedListings}
            disabled={selectedBooks.length === 0 && activeBooks.length === 0}
            className="w-full bg-teal-600 text-white py-3 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Copy className="mr-2" size={20} />
            Copy Vinted Listings
          </button>
        )}

        {exportFormat === 'csv' && (
          <button
            onClick={exportToCSV}
            disabled={selectedBooks.length === 0 && activeBooks.length === 0}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Download className="mr-2" size={20} />
            Download CSV
          </button>
        )}

        {exportFormat === 'json' && (
          <button
            onClick={exportToJSON}
            disabled={selectedBooks.length === 0 && activeBooks.length === 0}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Download className="mr-2" size={20} />
            Download JSON
          </button>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">How to use:</h3>
          <div className="text-sm text-blue-800 space-y-1">
            {exportFormat === 'vinted' && (
              <>
                <p>• Copy the formatted listings to your clipboard</p>
                <p>• Go to Vinted and click "Add Item"</p>
                <p>• Paste the title, description, and other details</p>
                <p>• Upload photos and publish!</p>
              </>
            )}
            {exportFormat === 'csv' && (
              <>
                <p>• Download the CSV file with all book data</p>
                <p>• Open in Excel or Google Sheets</p>
                <p>• Copy listings one by one to Vinted</p>
                <p>• Track your listing progress</p>
              </>
            )}
            {exportFormat === 'json' && (
              <>
                <p>• Download complete data backup</p>
                <p>• Import into other tools or databases</p>
                <p>• Use for automation or bulk operations</p>
                <p>• Developer-friendly format</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Export;