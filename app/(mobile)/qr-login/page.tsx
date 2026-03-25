'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function QRLoginPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        scanQR();
      }
    } catch {
      setError('Камер ашиглах боломжгүй. Код гараар оруулна уу.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const scanQR = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const check = () => {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(check);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // BarcodeDetector API (Chrome/Edge/Safari)
      if ('BarcodeDetector' in window) {
        // @ts-ignore
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        detector.detect(canvas).then((barcodes: any[]) => {
          if (barcodes.length > 0) {
            handleQRResult(barcodes[0].rawValue);
            return;
          }
          requestAnimationFrame(check);
        }).catch(() => requestAnimationFrame(check));
      } else {
        // BarcodeDetector байхгүй бол manual input ашиглана
        setError('QR scanner дэмжихгүй байна. Код гараар оруулна уу.');
        setScanning(false);
      }
    };
    requestAnimationFrame(check);
  };

  const handleQRResult = (value: string) => {
    stopCamera();
    setScanning(false);

    // QR value: "sokh:123" эсвэл URL "/sokh/123" эсвэл зүгээр тоо
    let sokhId = '';
    if (value.startsWith('sokh:')) {
      sokhId = value.split(':')[1];
    } else if (value.includes('/sokh/')) {
      sokhId = value.split('/sokh/')[1]?.split('/')[0] || '';
    } else if (/^\d+$/.test(value.trim())) {
      sokhId = value.trim();
    }

    if (sokhId) {
      router.replace(`/sokh/${sokhId}`);
    } else {
      setError(`Буруу QR код: ${value}`);
    }
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    handleQRResult(code);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-4 py-4">
        <button onClick={() => { stopCamera(); router.back(); }} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">QR кодоор нэвтрэх</h1>
      </div>

      <div className="px-4 py-6">
        <p className="text-sm text-gray-500 text-center mb-4">
          СӨХ-ийн QR код руу камераа чиглүүлнэ үү
        </p>

        {/* Camera view */}
        <div className="relative bg-black rounded-2xl overflow-hidden aspect-square mb-4">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-white/60 rounded-2xl" />
            </div>
          )}
          {!scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <p className="text-white text-sm">Камер ачаалж байна...</p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {/* Гараар оруулах */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-gray-400 text-center mb-3">ГАРААР ОРУУЛАХ</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              placeholder="СӨХ код (жнь: 1)"
              className="flex-1 border rounded-xl px-4 py-3 text-sm bg-white"
            />
            <button
              onClick={handleManualSubmit}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium"
            >
              Нэвтрэх
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
