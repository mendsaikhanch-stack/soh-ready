'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import Image from 'next/image';

interface LogoUploadProps {
  currentUrl: string | null;
  sokhId: number;
  onUploaded: (url: string) => void;
}

export default function LogoUpload({ currentUrl, sokhId, onUploaded }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Файлын хэмжээ 2MB-с бага байх ёстой');
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setError('PNG, JPG, WebP, SVG формат зөвшөөрнө');
      return;
    }

    setError('');
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `sokh-${sokhId}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError('Зураг хуулахад алдаа гарлаа: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(path);

    setPreview(publicUrl);
    onUploaded(publicUrl);
    setUploading(false);
  };

  const handleRemove = () => {
    setPreview(null);
    onUploaded('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div
          className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 cursor-pointer hover:border-blue-400 transition"
          onClick={() => inputRef.current?.click()}
        >
          {preview ? (
            <Image
              src={preview}
              alt="Logo"
              width={80}
              height={80}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center">
              <span className="text-2xl text-gray-300">+</span>
              <p className="text-[10px] text-gray-400">Лого</p>
            </div>
          )}
        </div>

        <div className="flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleUpload}
            className="hidden"
          />
          <div className="flex gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {uploading ? 'Хуулж байна...' : preview ? 'Солих' : 'Лого оруулах'}
            </button>
            {preview && (
              <button
                onClick={handleRemove}
                className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition"
              >
                Устгах
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP, SVG. Max 2MB</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 mt-2">{error}</p>
      )}
    </div>
  );
}
