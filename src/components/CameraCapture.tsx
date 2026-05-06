import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, Check, Plus } from '@phosphor-icons/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { compressToWebP } from '@/lib/imageUtils';

interface CameraCaptureProps {
  onCapture: (imageData: string | string[]) => void;
  onCancel: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const rawData = canvas.toDataURL('image/jpeg', 0.95);
        // Compress to WebP (max 1280px, quality 0.75) before storing
        compressToWebP(rawData, 1280, 0.75).then((compressed) => {
          setCapturedImage(compressed);
        }).catch(() => {
          // Fall back to original JPEG capture if compression fails
          setCapturedImage(rawData);
        });
      }
    }
  };

  const confirmCapture = () => {
    if (capturedImage) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const allImages = [...capturedImages, capturedImage];
      onCapture(allImages.length === 1 ? allImages[0] : allImages);
    }
  };

  const addAnotherPhoto = () => {
    if (capturedImage) {
      setCapturedImages((prev) => [...prev, capturedImage]);
      setCapturedImage(null);
    }
  };

  const retake = () => {
    setCapturedImage(null);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={onCancel} variant="outline">
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex-1 relative">
        {!capturedImage ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 border-2 border-white/30 m-8 rounded-lg" />
            </div>
            {capturedImages.length > 0 && (
              <div className="absolute top-4 left-4 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                {capturedImages.length} foto{capturedImages.length !== 1 ? 's' : ''} adicionada{capturedImages.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        ) : (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
        )}
      </div>

      <div className="flex items-center justify-center gap-4 p-6 bg-black">
        {!capturedImage ? (
          <>
            <Button onClick={onCancel} variant="outline" size="lg" className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
            <Button
              onClick={capturePhoto}
              size="lg"
              className="w-20 h-20 rounded-full bg-white hover:bg-white/90"
            >
              <Camera className="w-8 h-8 text-black" />
            </Button>
          </>
        ) : (
          <>
            <Button onClick={retake} variant="outline" size="lg" className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
            <Button
              onClick={addAnotherPhoto}
              size="lg"
              variant="outline"
              className="rounded-full border-white/40 text-white"
            >
              <Plus className="w-5 h-5" />
              <span className="ml-2">Outra foto</span>
            </Button>
            <Button
              onClick={confirmCapture}
              size="lg"
              className="rounded-full bg-accent hover:bg-accent/90"
            >
              <Check className="w-6 h-6" />
              <span className="ml-2">Confirmar</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
