import { useState, useEffect } from 'react';
import { type User } from 'firebase/auth';
import { initAuth, googleSignIn, logout, setAccessToken } from './lib/firebase';
import Navbar from './components/Navbar';
import ReportForm from './components/ReportForm';
import RecentReports from './components/RecentReports';
import { 
  Zap, 
  FileText, 
  Database, 
  FolderSync, 
  ShieldCheck, 
  Lock, 
  Loader2,
  CheckCircle,
  HelpCircle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Incremented on form success to auto-refresh the RecentReports component
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Listen for auth changes and try to automatically sign in if token was already saved in memory.
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        setIsInitializing(false);
      },
      () => {
        // If not already authenticated in-memory
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        setIsInitializing(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Authentication failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
  };

  const handleReportSuccess = () => {
    // Increment to trigger a reload of the RecentReports list automatically
    setRefreshTrigger((prev) => prev + 1);
  };

  // 1. Initial application loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="relative h-14 w-14 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-xs font-bold text-slate-400 tracking-wide uppercase">กำลังโหลดแอปพลิเคชัน...</p>
        </div>
      </div>
    );
  }

  // 2. Beautiful Authentication Required Landing Screen
  if (needsAuth || !user || !token) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 md:p-8">
        {/* Top spacer */}
        <div />

        {/* Main Card */}
        <div className="max-w-2xl w-full mx-auto bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden my-8">
          <div className="grid grid-cols-1 md:grid-cols-12">
            
            {/* Visual Panel */}
            <div className="md:col-span-5 bg-slate-950 p-8 text-white flex flex-col justify-between relative overflow-hidden min-h-[220px] md:min-h-auto border-r border-slate-800/80">
              {/* Abstract graphics */}
              <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-blue-500/15 blur-2xl" />
              <div className="absolute -left-10 -bottom-10 w-36 h-36 rounded-full bg-emerald-500/15 blur-2xl" />

              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 w-fit">
                <Zap className="h-5 w-5 text-blue-500 animate-pulse" />
                <span className="text-xs font-extrabold text-blue-400 uppercase tracking-widest">TX-System</span>
              </div>

              <div className="space-y-2.5 z-10 my-4">
                <h2 className="text-xl font-black leading-tight tracking-tight">ระบบตรวจสอบหม้อแปลงไฟฟ้า</h2>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  เชื่อมต่อตรงกับฐานข้อมูล Google Sheet เพื่อประสิทธิภาพการจัดส่งรายงานแบบไร้รอยต่อ
                </p>
              </div>

              <div className="text-[10px] text-slate-500 font-semibold flex items-center space-x-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>ความปลอดภัยมาตรฐานสากล</span>
              </div>
            </div>

            {/* Form/Login Panel */}
            <div className="md:col-span-7 p-8 flex flex-col justify-center">
              <h3 className="text-md font-bold text-white tracking-tight">เข้าสู่ระบบการทำงาน</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                แอปพลิเคชันนี้ใช้งานร่วมกับ Google Workspace และสิทธิ์ผู้ตรวจสอบความปลอดภัย กรุณายืนยันตัวตนด้วย Google Account ของคุณ
              </p>

              {/* Login Buttons */}
              <div className="mt-8">
                {isLoggingIn ? (
                  <button
                    disabled
                    className="w-full bg-slate-950 border border-slate-800 text-slate-400 font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center space-x-2 text-sm"
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span>กำลังเข้าสู่ระบบและสร้าง Token...</span>
                  </button>
                ) : (
                  <button
                    onClick={handleLogin}
                    id="btn-login-google"
                    className="w-full flex items-center justify-center bg-slate-950 hover:bg-slate-800 text-white font-bold py-3.5 px-4 border border-slate-800 rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.99] transition-all duration-150 text-sm cursor-pointer hover:border-slate-700"
                  >
                    <svg className="h-5 w-5 mr-3 shrink-0" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>ลงชื่อเข้าใช้งานด้วย Google</span>
                  </button>
                )}
              </div>

              {/* Sync Details */}
              <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">เป้าหมายซิงโครไนซ์ข้อมูล</p>
                
                <div className="flex items-start space-x-2.5 text-xs text-slate-300">
                  <Database className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-300">Google Sheets ID</p>
                    <p className="font-mono text-[10px] text-slate-500">1oPtmW48ulGsJ3MTa1vpVJHVbo4-o3rrq9IVb-LnaEIA</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5 text-xs text-slate-300">
                  <FolderSync className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-300">Google Drive Folder ID</p>
                    <p className="font-mono text-[10px] text-slate-500">137gSHDKjx_fgop_NTPZNdCGFZzOVOFUG</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer Credit */}
        <p className="text-center text-[10px] text-slate-500 font-semibold tracking-wide">
          © {new Date().getFullYear()} ระบบตรวจหม้อแปลงไฟฟ้า · รักษาความปลอดภัยด้วย Google OAuth
        </p>
      </div>
    );
  }

  // 3. Authenticated Dashboard Layout
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between">
      <div>
        <Navbar user={user} onLogout={handleLogout} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Form Section */}
            <div className="lg:col-span-5">
              <ReportForm 
                accessToken={token} 
                inspectorEmail={user.email || 'unknown@domain.com'} 
                onSuccess={handleReportSuccess} 
              />
            </div>

            {/* History Section */}
            <div className="lg:col-span-7">
              <RecentReports 
                accessToken={token} 
                refreshTrigger={refreshTrigger} 
              />
            </div>

          </div>
        </main>
      </div>

      <footer className="bg-slate-950 border-t border-slate-900 py-6 mt-12 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>ระบบรายงานผลการตรวจสอบหม้อแปลงไฟฟ้าอุตสาหกรรม</span>
          <div className="flex items-center space-x-4">
            <a 
              href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-blue-400 transition-colors"
            >
              Google Sheet
            </a>
            <a 
              href={`https://drive.google.com/drive/folders/${FOLDER_ID}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-blue-400 transition-colors"
            >
              Google Drive Folder
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Global scope constants needed for footer link access
const SPREADSHEET_ID = '1oPtmW48ulGsJ3MTa1vpVJHVbo4-o3rrq9IVb-LnaEIA';
const FOLDER_ID = '137gSHDKjx_fgop_NTPZNdCGFZzOVOFUG';
