import { useEffect, useRef, useState } from 'react';
import { X, Camera, RotateCw } from 'lucide-react';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

const BarcodeScanner = ({ onDetected, onClose }: BarcodeScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startCamera = async () => {
    try {
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setError(null);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Camera access denied or not available. Please allow camera access and try again.');
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleManualInput = () => {
    const code = prompt('📚 Enter the ISBN from your book:');
    if (code && code.trim()) {
      onDetected(code.trim());
    }
  };

  useEffect(() => {
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black text-white">
        <h2 className="text-lg font-semibold">Scan Book Barcode</h2>
        <div className="flex items-center gap-2">
          {/* Camera Switch */}
          <button
            onClick={switchCamera}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600"
            title="Switch Camera"
          >
            <RotateCw size={20} />
          </button>
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      {/* Scanner View */}
      <div className="flex-1 relative">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-white p-4">
            <Camera size={64} className="mb-4 opacity-50" />
            <p className="text-center mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={startCamera}
                className="block w-full px-6 py-2 bg-teal-600 rounded-lg hover:bg-teal-700"
              >
                Retry Camera
              </button>
              <button
                onClick={handleManualInput}
                className="block w-full px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Enter ISBN Manually
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Scanning Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative">
                {/* Scanning Rectangle */}
                <div className="border-2 border-teal-400 w-64 h-32 rounded-lg bg-black bg-opacity-20"></div>
                
                {/* Corner Markers */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                
                {/* Scanning Animation */}
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                  <div 
                    className="w-full h-0.5 bg-teal-400 shadow-lg animate-pulse"
                    style={{ 
                      boxShadow: '0 0 10px #14b8a6',
                      animation: 'scanLine 2s ease-in-out infinite'
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Scanning Status */}
            <div className="absolute top-20 left-0 right-0 text-center">
              <div className="bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg mx-4">
                <p className="text-sm">
                  📖 Position ISBN barcode in the frame
                </p>
                <p className="text-xs opacity-75">
                  Manual entry available below
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="p-4 bg-black text-white">
        <div className="text-center space-y-3">
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleManualInput}
              className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center"
            >
              <span className="mr-2">⌨️</span>
              Enter ISBN Manually
            </button>
          </div>
          <p className="text-xs text-gray-400">
            📱 For best results: Use good lighting and hold steady
          </p>
          <p className="text-xs text-gray-400">
            💡 Tip: Look for the barcode on the back cover
          </p>
        </div>
      </div>

      {/* CSS Animation */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes scanLine {
            0% { transform: translateY(-100%); }
            50% { transform: translateY(100%); }
            100% { transform: translateY(-100%); }
          }
        `
      }} />
    </div>
  );
};

export default BarcodeScanner;