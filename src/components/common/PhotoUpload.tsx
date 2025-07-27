import { useState, useRef } from 'react';
import { Camera, Upload, X, Trash2 } from 'lucide-react';
import type { Photo } from '../../types/index';

interface PhotoUploadProps {
  bookId?: string;
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
  maxPhotos?: number;
}

const PhotoUpload = ({ bookId, photos, onPhotosChange, maxPhotos = 5 }: PhotoUploadProps) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const photoTypes = [
    { value: 'front', label: 'Front Cover', color: 'bg-blue-100 text-blue-800' },
    { value: 'back', label: 'Back Cover', color: 'bg-green-100 text-green-800' },
    { value: 'spine', label: 'Spine', color: 'bg-purple-100 text-purple-800' },
    { value: 'damage', label: 'Damage/Wear', color: 'bg-red-100 text-red-800' },
    { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800' }
  ] as const;

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsCapturing(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Camera access denied or not available');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            addPhoto(blob, 'camera-capture.jpg');
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        addPhoto(file, file.name);
      });
    }
  };

  const addPhoto = (blob: Blob, filename: string) => {
    if (photos.length >= maxPhotos) {
      alert(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    const photo: Photo = {
      id: crypto.randomUUID(),
      bookId: bookId || '',
      type: 'other',
      blob,
      filename,
      createdAt: new Date()
    };

    onPhotosChange([...photos, photo]);
  };

  const updatePhotoType = (photoId: string, type: Photo['type']) => {
    const updatedPhotos = photos.map(photo =>
      photo.id === photoId ? { ...photo, type } : photo
    );
    onPhotosChange(updatedPhotos);
  };

  const removePhoto = (photoId: string) => {
    const updatedPhotos = photos.filter(photo => photo.id !== photoId);
    onPhotosChange(updatedPhotos);
  };

  const getPhotoUrl = (photo: Photo) => {
    return URL.createObjectURL(photo.blob);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Photos ({photos.length}/{maxPhotos})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={photos.length >= maxPhotos}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
          >
            <Upload size={16} className="mr-1" />
            Upload
          </button>
          
          {navigator.mediaDevices && (
            <button
              onClick={isCapturing ? stopCamera : startCamera}
              disabled={photos.length >= maxPhotos && !isCapturing}
              className={`flex items-center px-3 py-2 rounded-lg text-sm ${
                isCapturing 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300'
              }`}
            >
              <Camera size={16} className="mr-1" />
              {isCapturing ? 'Stop' : 'Camera'}
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Camera View */}
      {isCapturing && (
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-64 object-cover"
          />
          <button
            onClick={capturePhoto}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-black px-6 py-2 rounded-full hover:bg-gray-100"
          >
            📸 Capture
          </button>
          <button
            onClick={stopCamera}
            className="absolute top-4 right-4 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
          >
            <X size={20} />
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={getPhotoUrl(photo)}
                alt={`Book photo - ${photo.type}`}
                className="w-full h-32 object-cover rounded-lg border border-gray-300"
              />
              
              {/* Photo Type Selector */}
              <div className="absolute top-2 left-2">
                <select
                  value={photo.type}
                  onChange={(e) => updatePhotoType(photo.id, e.target.value as Photo['type'])}
                  className="text-xs px-2 py-1 bg-white border border-gray-300 rounded"
                >
                  {photoTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remove Button */}
              <button
                onClick={() => removePhoto(photo.id)}
                className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>

              {/* Photo Type Badge */}
              <div className="absolute bottom-2 left-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  photoTypes.find(t => t.value === photo.type)?.color || 'bg-gray-100 text-gray-800'
                }`}>
                  {photoTypes.find(t => t.value === photo.type)?.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="font-medium text-blue-900 mb-2">📸 Photo Tips for Vinted</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Take photos in good lighting (natural light is best)</li>
          <li>• Include front cover, back cover, and spine</li>
          <li>• Show any damage or wear clearly</li>
          <li>• Keep photos sharp and well-focused</li>
          <li>• Use a clean, uncluttered background</li>
        </ul>
      </div>
    </div>
  );
};

export default PhotoUpload;