'use client';

interface Props {
  version?: string;
  effectiveDate?: string;
  updatedAt?: string;
}

export default function MetaBlock({ version = '1.0', effectiveDate, updatedAt }: Props) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 space-y-1">
      <div className="flex justify-between">
        <span className="text-gray-500">Хувилбар</span>
        <span className="font-medium">{version}</span>
      </div>
      {effectiveDate && (
        <div className="flex justify-between">
          <span className="text-gray-500">Хүчин төгөлдөр огноо</span>
          <span className="font-medium">{effectiveDate}</span>
        </div>
      )}
      {updatedAt && (
        <div className="flex justify-between">
          <span className="text-gray-500">Сүүлд шинэчилсэн</span>
          <span className="font-medium">{updatedAt}</span>
        </div>
      )}
    </div>
  );
}
