export type InspectionStatus = 'normal' | 'warning' | 'critical';

export interface InspectionReport {
  timestamp: string; // วันเวลาที่กรอก
  transformerId: string; // หมายเลขหม้อแปลง
  inspectionDate: string; // วันและเวลาตรวจสอบ
  status: InspectionStatus; // ผลการตรวจสอบ
  latitude: string; // พิกัดละติจูด
  longitude: string; // พิกัดลองจิจูด
  photoUrl: string; // ลิงก์รูปถ่ายใน Google Drive
  photoId?: string; // ID รูปใน Google Drive
  inspectorEmail: string; // อีเมลผู้กรอก
  details: string; // รายละเอียดอื่นๆ
}

export interface SheetRow {
  rowNum: number;
  report: InspectionReport;
}
