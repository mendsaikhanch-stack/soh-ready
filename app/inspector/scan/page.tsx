'use client';

import { useState, useRef, useEffect } from 'react';

export default function InspectorScan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const startScan = async () => {
    setError('');
    setResult('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);

        // BarcodeDetector API (Chrome/Android)
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
          const interval = setInterval(async () => {
            if (!videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                setResult(barcodes[0].rawValue);
                clearInterval(interval);
                stopScan();
              }
            } catch {}
          }, 500);
        }
      }
    } catch {
      setError('Камерт хандах боломжгүй');
    }
  };

  const stopScan = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  useEffect(() => { return () => stopScan(); }, []);

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-bold mb-4">📷 QR / Баркод скан</h2>

      <div className="bg-white rounded-xl border overflow-hidden mb-4">
        {scanning ? (
          <div className="relative">
            <video ref={videoRef} className="w-full h-64 object-cover" playsInline />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-white/50 rounded-xl" />
            </div>
            <button onClick={stopScan}
              className="absolute top-2 right-2 bg-black/50 text-white px-3 py-1 rounded-lg text-sm">
              Зогсоох
            </button>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-5xl mb-3">📷</p>
            <p className="text-gray-500 text-sm mb-4">Тоолуурын QR код эсвэл баркод уншуулна уу</p>
            <button onClick={startScan}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium active:bg-indigo-700">
              Скан эхлэх
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-4">{error}</div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-700 mb-1">Уншигдлаа!</p>
          <p className="text-sm text-gray-700 break-all">{result}</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => { setResult(''); startScan(); }}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">
              Дахин скан
            </button>
            <button onClick={() => navigator.clipboard?.writeText(result)}
              className="flex-1 py-2 bg-gray-100 rounded-xl text-sm font-medium">
              Хуулах
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 bg-gray-50 rounded-xl p-4">
        <p className="text-xs text-gray-500 text-center">
          Тоолуур дээрх QR код уншуулахад серийн дугаар автоматаар бүртгэгдэнэ.
          Зөвхөн Chrome/Android дээр BarcodeDetector API дэмждэг.
        </p>
      </div>
    </div>
  );
}
