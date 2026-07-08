import React, { useState, useEffect, useRef } from 'react';
import { type InspectionReport, type InspectionStatus } from '../types';
import { uploadPhotoToDrive, appendInspectionReport } from '../lib/googleApi';
import { 
  Camera, 
  MapPin, 
  Calendar, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Loader2, 
  Info, 
  User, 
  HelpCircle,
  Hash,
  Activity,
  FileCheck2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReportFormProps {
  accessToken: string;
  inspectorEmail: string;
  onSuccess: () => void;
}

export default function ReportForm({ accessToken, inspectorEmail, onSuccess }: ReportFormProps) {
  // Form fields
  const [transformerId, setTransformerId] = useState('');
  const [inspectionDate, setInspectionDate] = useState('');
  const [status, setStatus] = useState<InspectionStatus>('normal');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [details, setDetails] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Sub-checklists for transformer inspection
  const [hasOilLeak, setHasOilLeak] = useState(false);
  const [highTemp, setHighTemp] = useState(false);
  const [abnormalNoise, setAbnormalNoise] = useState(false);
  const [rustCorrosion, setRustCorrosion] = useState(false);

  // UI States
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSuccess, setLocationSuccess] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Submission States
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<number>(0); // 1: upload photo, 2: set permissions, 3: write to sheets, 4: complete
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set default inspection date/time on mount
  useEffect(() => {
    const now = new Date();
    // Format to YYYY-MM-DDTHH:MM for datetime-local input
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setInspectionDate(`${year}-${month}-${day}T${hours}:${minutes}`);
  }, []);

  // Request location
  const detectLocation = () => {
    setIsGettingLocation(true);
    setLocationError(null);
    setLocationSuccess(false);

    if (!navigator.geolocation) {
      setLocationError('เบราว์เซอร์ของคุณไม่รองรับการระบุพิกัด GPS');
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setIsGettingLocation(false);
        setLocationSuccess(true);
        // Toast-like notification
        setTimeout(() => setLocationSuccess(false), 3000);
      },
      (error) => {
        console.error('GPS Detection Error:', error);
        let errorText = 'ไม่สามารถดึงข้อมูลตำแหน่งปัจจุบันได้';
        if (error.code === error.PERMISSION_DENIED) {
          errorText = 'การเข้าถึงตำแหน่งพิกัดถูกปฏิเสธ (กรุณาอนุญาตสิทธิ์หรือระบุด้วยตนเอง)';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorText = 'ไม่สามารถติดต่อสัญญาณดาวเทียมหรือบริการระบุพิกัดได้';
        } else if (error.code === error.TIMEOUT) {
          errorText = 'การดึงข้อมูลตำแหน่งหมดเวลา';
        }
        setLocationError(errorText);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }
    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 10MB');
      return;
    }
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit trigger - validate and show confirmation
  const triggerSubmitCheck = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!transformerId.trim()) {
      setErrorMsg('กรุณากรอกหมายเลขหม้อแปลง');
      return;
    }
    if (!inspectionDate) {
      setErrorMsg('กรุณาระบุวันและเวลาที่ตรวจสอบ');
      return;
    }
    if (!latitude.trim() || !longitude.trim()) {
      setErrorMsg('กรุณาระบุพิกัดตำแหน่ง (ละติจูดและลองจิจูด)');
      return;
    }
    if (!photo) {
      setErrorMsg('กรุณาแนบรูปถ่ายหน้างานจริงเพื่อความโปร่งใสและยืนยันการตรวจสอบ');
      return;
    }

    setIsConfirming(true);
  };

  // Actual upload and spreadsheet write operation
  const executeSubmission = async () => {
    setIsConfirming(false);
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Step 1: Uploading site photo to Google Drive
      setSubmitStep(1);
      const uploadRes = await uploadPhotoToDrive(photo!, accessToken);

      // Step 2: Shared permissions already set inside uploadPhotoToDrive, set state step
      setSubmitStep(2);

      // Assemble final report details based on sub-checklist items
      let compositeDetails = details.trim();
      const checklistItems: string[] = [];
      if (hasOilLeak) checklistItems.push('คราบน้ำมันซึม');
      if (highTemp) checklistItems.push('ความร้อนสูงผิดปกติ');
      if (abnormalNoise) checklistItems.push('มีเสียงครางผิดปกติ');
      if (rustCorrosion) checklistItems.push('พบคราบสนิม/ผุกร่อน');

      if (checklistItems.length > 0) {
        const checklistStr = `[พบสิ่งผิดปกติ: ${checklistItems.join(', ')}]`;
        compositeDetails = compositeDetails ? `${checklistStr} - ${compositeDetails}` : checklistStr;
      } else {
        compositeDetails = compositeDetails ? `[สภาพภายนอกปกติ] - ${compositeDetails}` : '[สภาพภายนอกปกติ]';
      }

      const now = new Date();
      // Format Thai timezone-friendly date format
      const formattedTimestamp = now.toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const formattedInspectDate = new Date(inspectionDate).toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      const report: InspectionReport = {
        timestamp: formattedTimestamp,
        transformerId: transformerId.trim().toUpperCase(),
        inspectionDate: formattedInspectDate,
        status: status,
        latitude: latitude.trim(),
        longitude: longitude.trim(),
        photoUrl: uploadRes.webViewLink,
        photoId: uploadRes.id,
        details: compositeDetails,
        inspectorEmail: inspectorEmail
      };

      // Step 3: Writing to Google Sheet
      setSubmitStep(3);
      await appendInspectionReport(report, accessToken);

      // Step 4: Complete
      setSubmitStep(4);
      setIsSubmitting(false);
      setShowSuccess(true);
      onSuccess();

      // Reset form fields
      setTransformerId('');
      setDetails('');
      setPhoto(null);
      setPhotoPreview(null);
      setHasOilLeak(false);
      setHighTemp(false);
      setAbnormalNoise(false);
      setRustCorrosion(false);
      detectLocation(); // Auto refresh coordinates for next report
    } catch (err: any) {
      console.error('Submission failed:', err);
      setErrorMsg(`เกิดข้อผิดพลาดในการบันทึกรายงาน: ${err.message || err}`);
      setIsSubmitting(false);
    }
  };

  const getStatusBgColor = (s: InspectionStatus) => {
    switch (s) {
      case 'normal': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'warning': return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'critical': return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
    }
  };

  const getStatusDotColor = (s: InspectionStatus) => {
    switch (s) {
      case 'normal': return 'bg-emerald-500';
      case 'warning': return 'bg-amber-500';
      case 'critical': return 'bg-rose-500 animate-ping';
    }
  };

  const getStatusTextTh = (s: InspectionStatus) => {
    switch (s) {
      case 'normal': return 'ปกติ (Normal)';
      case 'warning': return 'ผิดปกติเล็กน้อย (Warning)';
      case 'critical': return 'ชำรุดร้ายแรง/อันตราย (Critical)';
    }
  };

  return (
    <div className="bg-slate-900/50 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden text-slate-200">
      {/* Form Header */}
      <div className="bg-slate-950 px-6 py-5 text-white flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-md font-extrabold tracking-tight">กรอกผลการตรวจสอบหม้อแปลง</h2>
            <p className="text-xs text-slate-400">ระบุรายละเอียด พิกัด และแนบภาพถ่ายเพื่อรายงานผลลงระบบ</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center space-x-1 text-xs text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
          <User className="h-3.5 w-3.5 text-blue-400" />
          <span className="truncate max-w-[120px] font-mono">{inspectorEmail}</span>
        </div>
      </div>

      <div className="p-6">
        {errorMsg && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/30 text-rose-200 px-4 py-3 rounded-2xl text-sm flex items-start space-x-2.5 animate-fadeIn">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold">ไม่สามารถดำเนินการได้</p>
              <p className="text-xs text-rose-300 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        <form onSubmit={triggerSubmitCheck} className="space-y-6">
          {/* 1. Transformer ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                <Hash className="h-4 w-4 text-blue-400" />
                <span>หมายเลขหม้อแปลง <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="text"
                value={transformerId}
                onChange={(e) => setTransformerId(e.target.value)}
                placeholder="เช่น TX-90412, TR-1002"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-slate-800 focus:border-blue-500 font-semibold uppercase tracking-wider transition-all duration-200 shadow-xs"
                required
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="text-[10px] text-slate-500 font-medium self-center">ด่วนแนะนำ:</span>
                {['TX-01', 'TX-02', 'TX-03', 'TX-04'].map((suggestedId) => (
                  <button
                    type="button"
                    key={suggestedId}
                    onClick={() => setTransformerId(suggestedId)}
                    className="text-[10px] bg-slate-800 hover:bg-blue-900/50 hover:text-blue-200 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                  >
                    {suggestedId}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Date and Time */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                <Calendar className="h-4 w-4 text-blue-400" />
                <span>วันและเวลาตรวจสอบ <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="datetime-local"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-slate-800 focus:border-blue-500 font-medium transition-all duration-200 shadow-xs"
                required
              />
            </div>
          </div>

          {/* 3. Inspection Result Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2.5 flex items-center space-x-1.5">
              <Activity className="h-4 w-4 text-blue-400" />
              <span>ผลการตรวจสอบโดยรวม <span className="text-rose-400">*</span></span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: 'normal', label: 'ปกติ', desc: 'ทุกจุดสมบูรณ์ดี', color: 'emerald', border: 'hover:border-emerald-500' },
                { value: 'warning', label: 'เฝ้าระวัง / ผิดปกติเล็กน้อย', desc: 'พบสิ่งพึงเฝ้าระวัง', color: 'amber', border: 'hover:border-amber-500' },
                { value: 'critical', label: 'ชำรุด / เป็นอันตราย', desc: 'ต้องการซ่อมแซมด่วน', color: 'rose', border: 'hover:border-rose-500' }
              ].map((opt) => {
                const isSelected = status === opt.value;
                const activeClasses = 
                  opt.value === 'normal' ? 'bg-emerald-500/10 border-emerald-500/55 text-emerald-300 ring-2 ring-emerald-500/20' :
                  opt.value === 'warning' ? 'bg-amber-500/10 border-amber-500/55 text-amber-300 ring-2 ring-amber-500/20' :
                  'bg-rose-500/10 border-rose-500/55 text-rose-300 ring-2 ring-rose-500/20';

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value as InspectionStatus)}
                    className={`text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                      isSelected ? activeClasses : 'bg-slate-900/40 border-slate-700 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-sm">{opt.label}</span>
                      <div className={`h-2.5 w-2.5 rounded-full ${
                        opt.value === 'normal' ? 'bg-emerald-500' :
                        opt.value === 'warning' ? 'bg-amber-500' :
                        'bg-rose-500 animate-pulse'
                      }`} />
                    </div>
                    <span className="text-xs text-slate-400 mt-1 font-medium">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checklist Quick Indicators */}
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Info className="h-3.5 w-3.5 text-blue-400" />
              <span>ดัชนีชี้วัดความผิดปกติทางกายภาพ (คลิกเลือกที่พบ)</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { state: hasOilLeak, setState: setHasOilLeak, label: 'มีน้ำมันซึม' },
                { state: highTemp, setState: setHighTemp, label: 'ตัวถังร้อนจัด' },
                { state: abnormalNoise, setState: setAbnormalNoise, label: 'เสียงครางผิดปกติ' },
                { state: rustCorrosion, setState: setRustCorrosion, label: 'พบคราบสนิมรุนแรง' },
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => item.setState(!item.state)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                    item.state
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-200 shadow-inner'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Geolocation Coordinates */}
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3.5 gap-2">
              <div className="flex items-center space-x-1.5">
                <MapPin className="h-4.5 w-4.5 text-blue-500 animate-bounce" />
                <span className="text-sm font-bold text-slate-300">พิกัดตำแหน่ง <span className="text-rose-400">*</span></span>
              </div>
              <button
                type="button"
                onClick={detectLocation}
                disabled={isGettingLocation}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-md shadow-blue-500/20 border border-blue-500/30"
              >
                {isGettingLocation ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                ) : (
                  <MapPin className="h-3.5 w-3.5" />
                )}
                <span>{isGettingLocation ? 'กำลังตรวจจับ...' : 'ระบุตำแหน่งอัตโนมัติ'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ละติจูด (Latitude)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="เช่น 13.756312"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ลองจิจูด (Longitude)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="เช่น 100.501764"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>
            </div>

            {locationError && (
              <p className="text-[11px] text-rose-300 mt-2 flex items-center space-x-1 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                <AlertTriangle className="h-3 w-3 shrink-0 text-rose-400" />
                <span>{locationError}</span>
              </p>
            )}

            {locationSuccess && (
              <p className="text-[11px] text-emerald-300 mt-2 flex items-center space-x-1 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 animate-fadeIn">
                <CheckCircle className="h-3 w-3 shrink-0 text-emerald-400" />
                <span>อัปเดตพิกัดตำแหน่งจาก GPS จริงสำเร็จแล้ว</span>
              </p>
            )}
          </div>

          {/* 5. Photo Upload */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
              <Camera className="h-4 w-4 text-blue-400" />
              <span>แนบรูปถ่ายหน้างานจริง <span className="text-rose-400">*</span></span>
            </label>

            {!photoPreview ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[180px] ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-950/20 scale-[0.99]'
                    : 'border-slate-700 bg-slate-950/40 hover:bg-slate-800/80 hover:border-blue-500'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment" // trigger phone camera directly
                  className="hidden"
                />
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-full mb-3 shadow-inner">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-slate-200">ลากและวางรูปภาพที่นี่ หรือคลิกเพื่อค้นหา</p>
                <p className="text-xs text-slate-400 mt-1">รองรับกล้องถ่ายภาพมือถือโดยตรง จำกัดขนาดไม่เกิน 10MB</p>
              </div>
            ) : (
              <div className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-md bg-slate-950 group min-h-[180px] flex items-center justify-center">
                <img
                  src={photoPreview}
                  alt="Inspection preview"
                  className="max-h-[240px] w-auto object-contain rounded-2xl"
                />
                <div className="absolute top-3 right-3 flex space-x-1.5">
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-1.5 bg-slate-900/80 hover:bg-red-600 text-white rounded-full backdrop-blur-xs transition-colors cursor-pointer"
                    title="ลบรูปภาพ"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="absolute bottom-3 left-3 bg-slate-900/85 text-white px-2.5 py-1 rounded-full text-[10px] font-medium backdrop-blur-xs">
                  {photo?.name} ({((photo?.size || 0) / (1024 * 1024)).toFixed(2)} MB)
                </div>
              </div>
            )}
          </div>

          {/* 6. Details / Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">รายละเอียดและหมายเหตุเพิ่มเติม</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="ระบุปัญหาทางกายภาพที่สังเกตเห็น เช่น มีเสียงครางแผ่วเบา หรือระดับน้ำมันลดลงเล็กน้อย (หากมี)"
              rows={3}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-slate-800 focus:border-blue-500 text-sm transition-all duration-200 shadow-xs"
            />
          </div>

          {/* Form Submit Button */}
          <button
            type="submit"
            id="btn-submit-report"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all duration-150 text-md cursor-pointer flex items-center justify-center space-x-2"
          >
            <span>ส่งรายงานการตรวจสอบ</span>
          </button>
        </form>
      </div>

      {/* CONFIRMATION OVERLAY */}
      <AnimatePresence>
        {isConfirming && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-800"
            >
              <div className="p-6">
                <div className="flex items-center space-x-3 text-blue-400 mb-4 bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20">
                  <HelpCircle className="h-6 w-6 shrink-0" />
                  <h3 className="text-md font-bold text-blue-200">ยืนยันการจัดเก็บรายงาน</h3>
                </div>

                <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                  กรุณาตรวจสอบความถูกต้องของรายงาน รายงานนี้จะถูกบันทึกไปยัง Google Sheets และอัปโหลดภาพประกอบไปยัง Google Drive โดยระบุตัวตนของคุณ:
                </p>

                <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-2.5 text-xs text-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-400">หมายเลขหม้อแปลง:</span>
                    <span className="font-bold text-white tracking-wider uppercase">{transformerId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">วันเวลาตรวจ:</span>
                    <span className="font-semibold text-white">
                      {new Date(inspectionDate).toLocaleString('th-TH')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">ผลการตรวจ:</span>
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${getStatusBgColor(status)}`}>
                      {getStatusTextTh(status)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">พิกัด GPS:</span>
                    <span className="font-mono text-white">{latitude}, {longitude}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ผู้รายงาน:</span>
                    <span className="font-semibold text-white truncate max-w-[180px]">{inspectorEmail}</span>
                  </div>
                  {photo && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">ภาพแนบ:</span>
                      <span className="font-semibold text-white">{photo.name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800/80 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-sm transition-all cursor-pointer"
                >
                  แก้ไขเพิ่มเติม
                </button>
                <button
                  type="button"
                  onClick={executeSubmission}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-blue-500/15"
                >
                  ยืนยันบันทึกผล
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUBMIT PROGRESS OVERLAY */}
      <AnimatePresence>
        {isSubmitting && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-800 text-white"
            >
              <div className="relative h-16 w-16 mx-auto mb-5">
                <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
              </div>

              <h3 className="text-md font-bold text-white mb-1">กำลังบันทึกข้อมูล...</h3>
              <p className="text-xs text-slate-400 mb-6">โปรดอย่าปิดหน้าต่างนี้ ระบบกำลังดำเนินงานร่วมกับ Google API</p>

              {/* Progress Steps Indicators */}
              <div className="space-y-3.5 text-left text-xs bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                    submitStep > 1 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : submitStep === 1 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse' 
                        : 'bg-slate-800 text-slate-600 border border-slate-700/50'
                  }`}>
                    {submitStep > 1 ? '✓' : '1'}
                  </div>
                  <span className={`font-semibold ${submitStep === 1 ? 'text-blue-400' : submitStep > 1 ? 'text-slate-500 line-through' : 'text-slate-400'}`}>
                    อัปโหลดรูปถ่ายขึ้น Google Drive
                  </span>
                </div>

                <div className="flex items-center space-x-2.5">
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                    submitStep > 2 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : submitStep === 2 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse' 
                        : 'bg-slate-800 text-slate-600 border border-slate-700/50'
                  }`}>
                    {submitStep > 2 ? '✓' : '2'}
                  </div>
                  <span className={`font-semibold ${submitStep === 2 ? 'text-blue-400' : submitStep > 2 ? 'text-slate-500 line-through' : 'text-slate-400'}`}>
                    ตั้งค่าความปลอดภัยของรูปภาพ
                  </span>
                </div>

                <div className="flex items-center space-x-2.5">
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                    submitStep > 3 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : submitStep === 3 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse' 
                        : 'bg-slate-800 text-slate-600 border border-slate-700/50'
                  }`}>
                    {submitStep > 3 ? '✓' : '3'}
                  </div>
                  <span className={`font-semibold ${submitStep === 3 ? 'text-blue-400' : submitStep > 3 ? 'text-slate-500 line-through' : 'text-slate-400'}`}>
                    เขียนแถวข้อมูลใหม่ลง Google Sheets
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUCCESS POPUP */}
      <AnimatePresence>
        {showSuccess && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl text-white"
            >
              <div className="h-16 w-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-lg">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h3 className="text-lg font-bold text-white">บันทึกรายงานสำเร็จ</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed px-2">
                ข้อมูลการตรวจสอบหม้อแปลงไฟฟ้าถูกบันทึกลงใน Google Sheet และอัปโหลดไฟล์รูปภาพลง Google Drive เรียบร้อยแล้ว
              </p>
              <button
                type="button"
                onClick={() => setShowSuccess(false)}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl text-sm shadow-md cursor-pointer transition-colors border border-blue-500/30"
              >
                ตกลง
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
