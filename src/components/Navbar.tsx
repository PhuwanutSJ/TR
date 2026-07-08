import { useState } from 'react';
import { type User } from 'firebase/auth';
import { logout } from '../lib/firebase';
import { LogOut, CheckCircle, Database, Zap, User as UserIcon, Share2, Check } from 'lucide-react';

interface NavbarProps {
  user: User;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const [copied, setCopied] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      onLogout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'TRANSFORMER INSPECTION PORTAL',
      text: '⚡️ [ระบบรายงานผลหม้อแปลงไฟฟ้าดิจิทัล] ร่วมเข้าใช้งานระบบและตรวจสอบหม้อแปลงไฟฟ้า พร้อมซิงก์ข้อมูลลง Google Sheets & Drive ได้ทันที!',
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text}\n🔗 ลิงก์ระบบ: ${shareData.url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    }
  };

  const getInitials = () => {
    if (user.displayName) {
      return user.displayName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    }
    return user.email?.substring(0, 2).toUpperCase() || 'TX';
  };

  return (
    <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-900 sticky top-0 z-50 shadow-lg shadow-slate-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center">
              <Zap className="h-5 w-5 animate-pulse text-blue-100" />
            </div>
            <div>
              <h1 className="text-md sm:text-lg font-black text-white tracking-tight leading-none">
                TRANSFORMER <span className="text-blue-500 font-light underline decoration-blue-500/30 underline-offset-4">INSPECTION</span>
              </h1>
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-1 block">
                Portal · ระบบรายงานผลหม้อแปลง
              </span>
            </div>
          </div>

          {/* User Info & Connection Badge */}
          <div className="flex items-center space-x-4">
            {/* Connection Badge */}
            <div className="hidden md:flex items-center space-x-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 px-3 py-1.5 text-xs font-mono">
              <Database className="h-3.5 w-3.5" />
              <span>SHEET SYNC: ONLINE</span>
              <CheckCircle className="h-3.5 w-3.5" />
            </div>

            {/* Profile Menu */}
            <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="h-9 w-9 rounded-full border border-slate-700 shadow-inner"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold shadow-inner">
                  {getInitials()}
                </div>
              )}
              
              <div className="hidden lg:block text-left">
                <p className="text-sm font-bold text-slate-200 leading-none">
                  {user.displayName || 'ผู้ตรวจสอบ'}
                </p>
                <p className="text-[10px] font-mono text-slate-400 leading-none mt-1">
                  {user.email}
                </p>
              </div>

              {/* Share Button */}
              <button
                onClick={handleShare}
                id="btn-share-app"
                className={`p-2 rounded-xl transition-all duration-200 flex items-center space-x-1.5 cursor-pointer ${
                  copied 
                    ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                    : 'text-blue-400 hover:text-blue-300 hover:bg-slate-900 border border-transparent'
                }`}
                title={copied ? 'คัดลอกลิงก์แล้ว!' : 'แชร์ระบบให้เพื่อน'}
              >
                {copied ? (
                  <>
                    <Check className="h-5 w-5 animate-bounce" />
                    <span className="text-xs font-bold hidden sm:inline">คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-5 w-5" />
                    <span className="text-xs font-bold hidden sm:inline">แชร์ระบบ</span>
                  </>
                )}
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                id="btn-logout"
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-xl transition-all duration-200 cursor-pointer"
                title="ออกจากระบบ"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
