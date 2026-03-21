'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface MyVehicle {
  id: string;
  plateNumber: string;
  carModel: string;
  color: string;
  registeredAt: string;
}

interface BlockingReport {
  id: string;
  blockedPlate: string;
  blockingPlate: string;
  timestamp: string;
  status: 'pending' | 'notified' | 'resolved';
}

const STORAGE_KEYS = {
  myVehicles: 'sokh-my-vehicles',
  blockingReports: 'sokh-my-blocking-reports',
  parkingVehicles: 'sokh-parking-vehicles',
};

const TOTAL_SPOTS = 30;

const COLORS = [
  'Цагаан', 'Хар', 'Мөнгөлөг', 'Саарал', 'Улаан', 'Цэнхэр', 'Хүрэн', 'Ногоон', 'Шар', 'Бусад',
];

export default function MobileParkingPage() {
  const params = useParams();
  const router = useRouter();
  const [myVehicles, setMyVehicles] = useState<MyVehicle[]>([]);
  const [blockingReports, setBlockingReports] = useState<BlockingReport[]>([]);
  const [allVehicles, setAllVehicles] = useState<{ plateNumber: string; parkingSpot: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showBlockingForm, setShowBlockingForm] = useState(false);
  const [showSpotMap, setShowSpotMap] = useState(false);
  const [form, setForm] = useState({ plateNumber: '', carModel: '', color: 'Цагаан' });
  const [selectedBlockedCar, setSelectedBlockedCar] = useState('');
  const [gateRequesting, setGateRequesting] = useState(false);

  const sokhId = params.id as string;

  useEffect(() => {
    const savedMyVehicles = localStorage.getItem(`${STORAGE_KEYS.myVehicles}-${sokhId}`);
    const savedReports = localStorage.getItem(`${STORAGE_KEYS.blockingReports}-${sokhId}`);
    const savedAllVehicles = localStorage.getItem(STORAGE_KEYS.parkingVehicles);

    if (savedMyVehicles) setMyVehicles(JSON.parse(savedMyVehicles));
    if (savedReports) setBlockingReports(JSON.parse(savedReports));
    if (savedAllVehicles) {
      const parsed = JSON.parse(savedAllVehicles);
      setAllVehicles(parsed.map((v: { plateNumber: string; parkingSpot: string }) => ({
        plateNumber: v.plateNumber,
        parkingSpot: v.parkingSpot,
      })));
    }
  }, [sokhId]);

  const saveMyVehicles = (v: MyVehicle[]) => {
    setMyVehicles(v);
    localStorage.setItem(`${STORAGE_KEYS.myVehicles}-${sokhId}`, JSON.stringify(v));
  };

  const saveReports = (r: BlockingReport[]) => {
    setBlockingReports(r);
    localStorage.setItem(`${STORAGE_KEYS.blockingReports}-${sokhId}`, JSON.stringify(r));
  };

  const registerVehicle = () => {
    if (!form.plateNumber) return;
    const newVehicle: MyVehicle = {
      id: Date.now().toString(),
      plateNumber: form.plateNumber,
      carModel: form.carModel,
      color: form.color,
      registeredAt: new Date().toISOString(),
    };
    saveMyVehicles([...myVehicles, newVehicle]);
    setForm({ plateNumber: '', carModel: '', color: 'Цагаан' });
    setShowForm(false);
  };

  const deleteVehicle = (id: string) => {
    if (!confirm('Машин устгах уу?')) return;
    saveMyVehicles(myVehicles.filter(v => v.id !== id));
  };

  const submitBlockingReport = () => {
    if (!selectedBlockedCar) return;

    const report: BlockingReport = {
      id: Date.now().toString(),
      blockedPlate: selectedBlockedCar,
      blockingPlate: '',
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    saveReports([report, ...blockingReports]);
    setSelectedBlockedCar('');
    setShowBlockingForm(false);
    alert('Мэдэгдэл амжилттай илгээгдлээ! СӨХ удирдлагад хүргэгдэх болно.');
  };

  const requestGateOpen = () => {
    if (myVehicles.length === 0) {
      alert('Эхлээд машинаа бүртгүүлнэ үү.');
      return;
    }
    setGateRequesting(true);
    setTimeout(() => {
      setGateRequesting(false);
      alert('Хаалт нээх хүсэлт илгээгдлээ! Бүртгэлтэй машин таних систем ажиллана.');
    }, 1500);
  };

  const occupiedSpots = allVehicles.filter(v => v.parkingSpot).map(v => v.parkingSpot);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${sokhId}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">🚗 Зогсоол</h1>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ========== MY VEHICLES ========== */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500">МИНИЙ МАШИН</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-xs text-blue-600 font-medium"
            >
              + Машин нэмэх
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Улсын дугаар</label>
                  <input
                    placeholder="жнь: 0123УБА"
                    value={form.plateNumber}
                    onChange={e => setForm({ ...form, plateNumber: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Машины загвар</label>
                  <input
                    placeholder="жнь: Toyota Prius"
                    value={form.carModel}
                    onChange={e => setForm({ ...form, carModel: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Өнгө</label>
                  <select
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {COLORS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-lg border text-sm"
                >
                  Цуцлах
                </button>
                <button
                  onClick={registerVehicle}
                  disabled={!form.plateNumber}
                  className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
                >
                  Бүртгэх
                </button>
              </div>
            </div>
          )}

          {myVehicles.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center shadow-sm">
              <p className="text-3xl mb-2">🚗</p>
              <p className="text-gray-400 text-sm">Бүртгэлтэй машин байхгүй</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-blue-600 text-sm font-medium"
              >
                Машин бүртгүүлэх
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {myVehicles.map(v => (
                <div key={v.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">🚗</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-blue-700">{v.plateNumber}</p>
                    <p className="text-xs text-gray-500">
                      {v.carModel && `${v.carModel} • `}{v.color}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteVehicle(v.id)}
                    className="text-red-400 text-xs hover:text-red-600"
                  >
                    Устгах
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========== GATE OPEN REQUEST ========== */}
        <button
          onClick={requestGateOpen}
          disabled={gateRequesting}
          className="w-full bg-green-600 text-white py-3.5 rounded-xl font-medium active:bg-green-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {gateRequesting ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>Хүсэлт илгээж байна...</span>
            </>
          ) : (
            <>
              <span>🚧</span>
              <span>Хаалт нээх хүсэлт</span>
            </>
          )}
        </button>

        {/* ========== BLOCKING REPORT ========== */}
        <div>
          <button
            onClick={() => setShowBlockingForm(!showBlockingForm)}
            className="w-full bg-red-50 border border-red-200 text-red-700 py-3.5 rounded-xl font-medium active:bg-red-100 transition flex items-center justify-center gap-2"
          >
            <span>🚫</span>
            <span>Машин хаагдсан мэдэгдэл</span>
          </button>

          {showBlockingForm && (
            <div className="bg-white rounded-xl p-4 shadow-sm mt-3">
              <h3 className="font-semibold text-sm mb-2 text-red-600">Машин хаагдсан мэдэгдэх</h3>
              <p className="text-xs text-gray-500 mb-3">
                Таны аль машин хаагдсан болохыг сонгоно уу. СӨХ удирдлагад мэдэгдэл илгээгдэнэ.
              </p>

              <div className="mb-3">
                <label className="text-xs text-gray-500 mb-1 block">Хаагдсан машин</label>
                {myVehicles.length > 0 ? (
                  <select
                    value={selectedBlockedCar}
                    onChange={e => setSelectedBlockedCar(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">-- Машин сонгох --</option>
                    {myVehicles.map(v => (
                      <option key={v.id} value={v.plateNumber}>
                        {v.plateNumber} ({v.carModel || v.color})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-red-500">Эхлээд машинаа бүртгүүлнэ үү.</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowBlockingForm(false)}
                  className="flex-1 py-2 rounded-lg border text-sm"
                >
                  Цуцлах
                </button>
                <button
                  onClick={submitBlockingReport}
                  disabled={!selectedBlockedCar}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50"
                >
                  📩 Мэдэгдэл илгээх
                </button>
              </div>
            </div>
          )}

          {/* Past reports */}
          {blockingReports.length > 0 && (
            <div className="mt-3 space-y-2">
              <h3 className="text-xs font-semibold text-gray-500">ӨМНӨХ МЭДЭГДЛҮҮД</h3>
              {blockingReports.map(report => (
                <div key={report.id} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{report.blockedPlate}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      report.status === 'resolved'
                        ? 'bg-green-100 text-green-700'
                        : report.status === 'notified'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {report.status === 'resolved' ? 'Шийдвэрлэсэн' :
                       report.status === 'notified' ? 'Мэдэгдсэн' : 'Хүлээгдэж буй'}
                    </span>
                  </div>
                  {report.blockingPlate && (
                    <p className="text-xs text-gray-500">Хаасан: {report.blockingPlate}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(report.timestamp).toLocaleString('mn-MN')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========== PARKING SPOT MAP ========== */}
        <div>
          <button
            onClick={() => setShowSpotMap(!showSpotMap)}
            className="w-full bg-white border py-3.5 rounded-xl font-medium text-gray-700 active:bg-gray-50 transition flex items-center justify-center gap-2"
          >
            <span>🅿️</span>
            <span>Зогсоолын зураг {showSpotMap ? '▲' : '▼'}</span>
          </button>

          {showSpotMap && (
            <div className="mt-3 bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                  <span className="text-xs text-gray-600">Сул</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                  <span className="text-xs text-gray-600">Эзэлсэн</span>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: TOTAL_SPOTS }, (_, i) => {
                  const spot = String(i + 1);
                  const isOccupied = occupiedSpots.includes(spot);
                  const vehicle = allVehicles.find(v => v.parkingSpot === spot);

                  return (
                    <div
                      key={spot}
                      className={`rounded-lg border p-2 text-center ${
                        isOccupied
                          ? 'bg-red-50 border-red-200'
                          : 'bg-green-50 border-green-200'
                      }`}
                    >
                      <div className="text-sm font-bold text-gray-700">{spot}</div>
                      {isOccupied ? (
                        <div className="text-[9px] text-red-500 truncate">🚗{vehicle?.plateNumber ? ` ${vehicle.plateNumber.substring(0, 4)}` : ''}</div>
                      ) : (
                        <div className="text-[9px] text-green-500">Сул</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <span className="text-xs text-gray-500">
                  Сул: {TOTAL_SPOTS - occupiedSpots.length} / {TOTAL_SPOTS}
                </span>
                <span className="text-xs text-gray-500">
                  Эзэлсэн: {occupiedSpots.length} / {TOTAL_SPOTS}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
