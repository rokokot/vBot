// src/components/common/ImageTransfer.tsx
import React, { useState } from 'react';
import { Download, Upload, Eye, Share2, CheckCircle, AlertCircle, Info, X, ExternalLink } from 'lucide-react';
import { useBookStore } from '../../stores/bookStore';
import type { Book } from '../../types/index';

interface ImageTransferProps {
  book: Book;
  onClose?: () => void;
  compact?: boolean;
}

const ImageTransfer: React.FC<ImageTransferProps> = ({ book, onClose, compact = false }) => {
  const { transferImages, transferStatus, transferResult, clearTransferResult } = useBookStore();
  const [selectedMethod, setSelectedMethod] = useState<'extension' | 'download' | 'preview'>('download');

  const hasPhotos = book.photos && book.photos.length > 0;

  const transferMethods = [
    {
      id: 'download' as const,
      name: 'Smart Transfer',
      description: 'Download images for manual upload (most reliable)',
      icon: <Download size={20} />,
      recommended: true,
      available: true
    },
    {
      id: 'extension' as const,
      name: 'Extension Auto-Upload',
      description: 'Direct upload via Chrome extension',
      icon: <Upload size={20} />,
      recommended: false,
      available: typeof window !== 'undefined' && 'chrome' in window
    },
    {
      id: 'preview' as const,
      name: 'Preview & Save',
      description: 'Open images in new tab',
      icon: <Eye size={20} />,
      recommended: false,
      available: true
    }
  ];

  const handleTransfer = async () => {
    await transferImages(book.id, selectedMethod);
  };

  const StatusIcon = () => {
    switch (transferStatus) {
      case 'processing':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>;
      case 'success':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'error':
        return <AlertCircle className="text-red-600" size={20} />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (transferStatus) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'processing':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  if (!hasPhotos) {
    return (
      <div className="text-center p-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Eye size={24} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Photos Available</h3>
        <p className="text-gray-600 mb-4">
          Add photos to this book first before transferring to Vinted.
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Close
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Transfer {book.photos.length} photo{book.photos.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => transferImages(book.id, 'download')}
              disabled={transferStatus === 'processing'}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
            >
              <Download size={14} className="inline mr-1" />
              Download
            </button>
            <button
              onClick={() => transferImages(book.id, 'download')}
              disabled={transferStatus === 'processing'}
              className="px-3 py-1 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200 disabled:opacity-50"
            >
              <Share2 size={14} className="inline mr-1" />
              Smart Transfer
            </button>
          </div>
        </div>

        {transferResult && (
          <div className={`p-3 rounded-lg border ${getStatusColor()}`}>
            <div className="flex items-start gap-2">
              <StatusIcon />
              <div className="flex-1">
                <p className="text-sm">{transferResult.message}</p>
                {transferResult.instructions && (
                  <ul className="mt-2 text-xs space-y-1">
                    {transferResult.instructions.map((instruction, index) => (
                      <li key={index}>• {instruction}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                onClick={clearTransferResult}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Transfer Images to Vinted</h2>
          <p className="text-gray-600">
            {book.title} - {book.author}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Photo Count */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-700">Ready to transfer:</span>
            <p className="text-lg font-semibold text-gray-900">
              {book.photos.length} photo{book.photos.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-1">
            {book.photos.slice(0, 5).map((photo, index) => (
              <div
                key={photo.id}
                className="w-10 h-10 bg-blue-100 rounded border flex items-center justify-center text-xs font-medium"
                title={photo.type}
              >
                {photo.type.charAt(0).toUpperCase()}
              </div>
            ))}
            {book.photos.length > 5 && (
              <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center text-xs">
                +{book.photos.length - 5}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Method Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Choose Transfer Method</h3>
        
        <div className="grid gap-3">
          {transferMethods.filter(method => method.available).map((method) => (
            <div
              key={method.id}
              className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                selectedMethod === method.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => method.available && setSelectedMethod(method.id)}
            >
              {method.recommended && (
                <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  Recommended
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  selectedMethod === method.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {method.icon}
                </div>
                
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{method.name}</h4>
                  <p className="text-sm text-gray-600">{method.description}</p>
                </div>
                
                <input
                  type="radio"
                  name="transferMethod"
                  value={method.id}
                  checked={selectedMethod === method.id}
                  onChange={() => setSelectedMethod(method.id)}
                  className="text-blue-600 focus:ring-blue-500"
                  disabled={!method.available}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transfer Button */}
      <div className="text-center">
        <button
          onClick={handleTransfer}
          disabled={transferStatus === 'processing'}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
        >
          <StatusIcon />
          {transferStatus === 'processing' ? 'Transferring...' : 'Start Transfer'}
        </button>
      </div>

      {/* Transfer Result */}
      {transferResult && (
        <div className={`rounded-lg p-4 border ${getStatusColor()}`}>
          <div className="flex items-start gap-2">
            <StatusIcon />
            <div className="flex-1">
              <p className="font-medium">{transferResult.message}</p>
              
              {transferResult.instructions && (
                <div className="mt-3">
                  <h4 className="font-medium mb-2">Next Steps:</h4>
                  <ol className="text-sm space-y-1">
                    {transferResult.instructions.map((instruction, instructionIndex) => (
                      <li key={instructionIndex} className="flex items-start gap-2">
                        <span className="font-medium text-sm">{instructionIndex + 1}.</span>
                        <span className="text-sm">{instruction}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {transferResult.success && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => window.open('https://vinted.com/items/new', '_blank')}
                    className="px-4 py-2 bg-white border border-current rounded-lg hover:bg-opacity-10 flex items-center gap-2 text-sm"
                  >
                    <ExternalLink size={16} />
                    Open Vinted
                  </button>
                  <button
                    onClick={clearTransferResult}
                    className="px-4 py-2 bg-white border border-current rounded-lg hover:bg-opacity-10 text-sm"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="text-blue-600 mt-0.5" size={20} />
          <div>
            <h4 className="font-medium text-blue-900 mb-2">💡 Tips for Best Results</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Use the Smart Transfer for the easiest experience</li>
              <li>• Make sure images are under 10MB each</li>
              <li>• Upload photos in order: front cover, back cover, spine, damage</li>
              <li>• Have good lighting and clear, focused images</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageTransfer;