import { useState, useEffect } from 'react';
import { type InspectionReport, type InspectionStatus } from '../types';
import { fetchRecentReports, SPREADSHEET_ID, FOLDER_ID } from '../lib/googleApi';
import { 
  RefreshCw, 
  Search, 
  ExternalLink, 
  Eye, 
  MapPin, 
  Copy, 
  Check, 
  Filter, 
  AlertTriangle, 
  Calendar, 
  User,
  Database,
  Grid,
  Loader2,
  Share2
} from 'lucide-react';

interface RecentReportsProps {
  accessToken: string;
  refreshTrigger: number;
}

export default function RecentReports({ accessToken, refreshTrigger }: RecentReportsProps) {
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [reportCopiedIndex, setReportCopiedIndex] = useState<number | null>(null);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchRecentReports(accessToken);
      setReports(fetched);
    } catch (err: any) {
      console.error('Failed to load reports:', err);
      setError('ไม่สามารถดึงข้อมูลรายงานล่าสุดได้จาก Google Sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [accessToken, refreshTrigger]);

  const copyCoordinates = (lat: string, lng: string, idx: number) => {
    const text = `${lat}, ${lng}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const shareReport = async (report: InspectionReport, index: number) => {
    const statusText = report.status === 'normal' 
      ? '🟢 ปกติ' 
      : report.status === 'warning' 
        ? '🟡 เฝ้าระวัง' 
        : '🔴 ชำรุดร้ายแรง';

    const shareText = `⚡️ [รายงานตรวจหม้อแปลงไฟฟ้า]
📝 หมายเลข: ${report.transformerId.toUpperCase()}
📊 สถานะ: ${statusText}
📅 วันเวลาตรวจ: ${report.inspectionDate}
🔍 รายละเอียด: ${report.details || 'ไม่มี'}
📍 พิกัด GPS: ${report.latitude}, ${report.longitude}
👤 ผู้รายงาน: ${report.inspectorEmail}
${report.photoUrl ? `🖼️ รูปภาพประกอบ: ${report.photoUrl}` : ''}
🔗 เข้าระบบ: ${window.location.origin}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `รายงานตรวจหม้อแปลง: ${report.transformerId.toUpperCase()}`,
          text: shareText,
        });
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setReportCopiedIndex(index);
        setTimeout(() => setReportCopiedIndex(null), 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    }
  };

  const getStatusBadge = (s: InspectionStatus) => {
    switch (s) {
      case 'normal':
        return (
          <span className="inline-flex items-center space-x-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>ปกติ</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center space-x-1.5 bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-500/20">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>เฝ้าระวัง</span>
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center space-x-1.5 bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-500/20">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            <span>ชำรุดร้ายแรง</span>
          </span>
        );
      default:
        return null;
    }
  };

  // Search & Filter computation
  const filteredReports = reports.filter((report) => {
    const matchesSearch = report.transformerId.toLowerCase().includes(search.toLowerCase()) ||
                          report.details.toLowerCase().includes(search.toLowerCase()) ||
                          report.inspectorEmail.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-slate-900/50 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden h-full flex flex-col text-slate-200">
      {/* Header section */}
      <div className="px-6 py-5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
            <Grid className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-md font-extrabold tracking-tight">รายงานการตรวจสอบล่าสุด</h2>
            <p className="text-xs text-slate-400">ประวัติการบันทึกข้อมูลเรียลไทม์จาก Google Sheets</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={loadReports}
            disabled={loading}
            className="p-2 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800/80 disabled:opacity-50 rounded-xl transition-all cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
          
          <a
            href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800/80 rounded-xl transition-all flex items-center space-x-1.5 text-xs font-semibold"
          >
            <Database className="h-4 w-4 text-emerald-400" />
            <span className="hidden sm:inline">เปิดแผ่นงานจริง</span>
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Control Filters */}
      <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="ค้นหา หมายเลข, รายละเอียด หรือผู้รายงาน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-800/60 border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-white placeholder-slate-500 font-medium"
          />
        </div>

        {/* Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all" className="bg-slate-900 text-white">ผลการตรวจทั้งหมด</option>
            <option value="normal" className="bg-slate-900 text-white">ปกติ (Normal)</option>
            <option value="warning" className="bg-slate-900 text-white">ผิดปกติเล็กน้อย (Warning)</option>
            <option value="critical" className="bg-slate-900 text-white">ชำรุดร้ายแรง (Critical)</option>
          </select>
        </div>
      </div>

      {/* Reports List/Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[550px]">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto" />
            <p className="text-xs font-bold text-slate-400">กำลังดาวน์โหลดแถวข้อมูลจาก Google Sheet...</p>
          </div>
        ) : error ? (
          <div className="py-12 px-4 text-center max-w-sm mx-auto space-y-3">
            <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto" />
            <p className="text-xs font-bold text-slate-200">{error}</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              กรุณาเชื่อมต่อบัญชีที่มีสิทธิ์อ่านและเขียน Google Sheet ID: <code className="font-mono bg-slate-950 p-1.5 rounded text-[10px] text-rose-300 border border-slate-800">{SPREADSHEET_ID}</code>
            </p>
            <button
              onClick={loadReports}
              className="mt-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-2">
            <div className="h-12 w-12 bg-slate-950/60 rounded-full flex items-center justify-center mx-auto text-slate-500 border border-slate-800">
              <Search className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-slate-400">ไม่พบบันทึกที่ตรงกับเงื่อนไข</p>
            <p className="text-[10px] text-slate-500">กรุณาลองเปลี่ยนคำค้นหาหรือส่งบันทึกรายงานใหม่</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredReports.map((report, idx) => (
              <div 
                key={idx}
                className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 hover:shadow-lg hover:border-slate-700 transition-all duration-200 flex flex-col md:flex-row md:items-start justify-between gap-4 shadow-sm"
              >
                {/* Details column */}
                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-blue-400 text-sm tracking-wider uppercase bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
                      {report.transformerId}
                    </span>
                    {getStatusBadge(report.status)}
                    
                    <span className="text-[10px] text-slate-500 font-semibold flex items-center space-x-1.5 ml-auto sm:ml-0">
                      <Calendar className="h-3.5 w-3.5 text-slate-500" />
                      <span>{report.inspectionDate}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {report.details}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-medium">
                    {/* Coordinates */}
                    <button
                      onClick={() => copyCoordinates(report.latitude, report.longitude, idx)}
                      className="inline-flex items-center space-x-1.5 hover:text-blue-300 bg-slate-900 hover:bg-slate-800 px-2 py-1 rounded-md border border-slate-800 font-mono transition-all cursor-pointer text-slate-400"
                      title="คัดลอกพิกัด"
                    >
                      <MapPin className="h-3 w-3 text-rose-500 animate-pulse" />
                      <span>{report.latitude}, {report.longitude}</span>
                      {copiedIndex === idx ? (
                        <Check className="h-3 w-3 text-emerald-400 animate-bounce" />
                      ) : (
                        <Copy className="h-2.5 w-2.5" />
                      )}
                    </button>

                    {/* Reporter */}
                    <div className="inline-flex items-center space-x-1 text-slate-500 truncate max-w-[150px] sm:max-w-none">
                      <User className="h-3 w-3" />
                      <span>ผู้ตรวจ: {report.inspectorEmail}</span>
                    </div>
                  </div>
                </div>

                {/* Media/Action column */}
                <div className="shrink-0 flex items-center gap-3 sm:self-center md:self-start">
                  {/* Share Report Button */}
                  <button
                    onClick={() => shareReport(report, idx)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                      reportCopiedIndex === idx
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 animate-pulse'
                        : 'text-slate-400 bg-slate-900 border-slate-800 hover:text-white hover:bg-slate-800'
                    }`}
                    title={reportCopiedIndex === idx ? 'คัดลอกข้อมูลรายงานแล้ว!' : 'แชร์ผลการตรวจนี้ให้เพื่อน'}
                  >
                    {reportCopiedIndex === idx ? (
                      <Check className="h-4.5 w-4.5" />
                    ) : (
                      <Share2 className="h-4.5 w-4.5" />
                    )}
                  </button>

                  {report.photoUrl ? (
                    <a
                      href={report.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative h-16 w-16 md:h-18 md:w-18 rounded-xl overflow-hidden border border-slate-800 shadow-sm flex items-center justify-center bg-slate-950 cursor-pointer"
                    >
                      {/* Drive file icon default placeholder */}
                      <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/50 transition-colors duration-150 flex items-center justify-center z-10">
                        <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                      </div>
                      
                      {/* Generates image element */}
                      <img
                        src={report.photoUrl}
                        alt="Photo thumbnail"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          // Fallback to stylized drive placeholder if drive image cannot display directly in frame
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      
                      {/* Fallback label */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-950/40 p-1 text-center border border-blue-500/20">
                        <Database className="h-4.5 w-4.5 text-blue-400" />
                        <span className="text-[8px] font-bold text-blue-300 mt-1">เปิดดูรูป</span>
                      </div>
                    </a>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">ไม่มีรูปภาพ</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer statistics counter */}
      <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-850/80 flex items-center justify-between text-xs text-slate-400 font-semibold">
        <span>รายการบันทึกผลทั้งหมด: <strong className="text-white">{filteredReports.length}</strong> แถว</span>
        <span>โฟลเดอร์ภาพ ID: <strong className="text-blue-400 font-mono text-[10px]">{FOLDER_ID.substring(0, 6)}...</strong></span>
      </div>
    </div>
  );
}
