import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  FileCheck2, 
  UploadCloud, 
  History, 
  SlidersHorizontal, 
  DownloadCloud, 
  Mic, 
  Search,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ShieldCheck
} from 'lucide-react';
import { UserRole, OrganizationSettings } from '../types';

interface HeaderProps {
  currentTab: 'dashboard' | 'upload' | 'validation' | 'export' | 'audit' | 'settings';
  setCurrentTab: (tab: 'dashboard' | 'upload' | 'validation' | 'export' | 'audit' | 'settings') => void;
  userRole: UserRole;
  setUserRole?: (role: UserRole) => void;
  pendingCount: number;
  settings: OrganizationSettings;
  onOpenVoiceModal: () => void;
  tallyConnected: boolean;
  selectedClient: string;
  setSelectedClient: (client: string) => void;
  darkMode?: boolean;
  onToggleTheme?: () => void;
  onSignOut?: () => void;
  currentUser?: { name: string; email: string; role?: UserRole } | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  userRole,
  setUserRole,
  pendingCount,
  settings,
  onOpenVoiceModal,
  tallyConnected,
  selectedClient,
  setSelectedClient,
  darkMode,
  onToggleTheme,
  onSignOut,
  currentUser,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleMeta = (role: UserRole) => {
    switch (role) {
      case 'CA':
        return {
          badge: 'CA',
          label: 'CA Signatory',
          title: 'Chartered Accountant (FCA)',
          badgeClass: 'bg-[#5F1915] text-white dark:bg-[#ffb4ab] dark:text-[#5F1915]',
          avatarBg: 'bg-[#5F1915] text-white dark:bg-[#7a221d]',
        };
      case 'Senior Accountant':
        return {
          badge: 'ACT',
          label: 'Accountant',
          title: 'Senior Accountant',
          badgeClass: 'bg-emerald-700 text-white dark:bg-emerald-500/30 dark:text-emerald-200',
          avatarBg: 'bg-emerald-700 text-white dark:bg-emerald-600',
        };
      case 'Firm Admin':
        return {
          badge: 'ADM',
          label: 'Firm Admin',
          title: 'Firm Administrator',
          badgeClass: 'bg-indigo-700 text-white dark:bg-indigo-500/30 dark:text-indigo-200',
          avatarBg: 'bg-indigo-700 text-white dark:bg-indigo-600',
        };
      case 'Junior Auditor':
        return {
          badge: 'AUD',
          label: 'Auditor',
          title: 'Junior Auditor',
          badgeClass: 'bg-amber-700 text-white dark:bg-amber-500/30 dark:text-amber-200',
          avatarBg: 'bg-amber-700 text-white dark:bg-amber-600',
        };
      case 'SME Owner':
        return {
          badge: 'SME',
          label: 'Business Owner',
          title: 'SME Business Owner',
          badgeClass: 'bg-purple-700 text-white dark:bg-purple-500/30 dark:text-purple-200',
          avatarBg: 'bg-purple-700 text-white dark:bg-purple-600',
        };
      case 'Other':
      default:
        return {
          badge: 'OTH',
          label: 'Other',
          title: 'Financial Consultant / Other',
          badgeClass: 'bg-slate-700 text-white dark:bg-slate-600 dark:text-slate-100',
          avatarBg: 'bg-slate-700 text-white dark:bg-slate-600',
        };
    }
  };

  const roleMeta = getRoleMeta(userRole);
  const clients = [
    settings.companyName || 'Primary Enterprise Books',
  ];

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-[#0c1322] border-b border-slate-200 dark:border-slate-800 shadow-sm font-sans transition-colors">
      {/* Main Identity Header */}
      <div className="bg-white dark:bg-[#0c1322] px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3 cursor-pointer shrink-0" onClick={() => setCurrentTab('dashboard')}>
            <div className="w-12 h-12 rounded-lg overflow-hidden shadow-sm border border-[#5F1915]/30 bg-[#5F1915] p-1 flex items-center justify-center shrink-0">
              <img 
                src="/logo.png" 
                alt="Stalwart Group Logo" 
                className="w-full h-full object-contain"
              />
            </div>

            <div>
              <span className="text-2xl font-black text-[#5F1915] dark:text-[#ffb4ab] tracking-tight">
                TallyAI
              </span>
            </div>
          </div>

          {/* Expanded Search Bar (Extends horizontally to fill the empty space) */}
          <div className="flex-1 w-full max-w-2xl mx-2 md:mx-6">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search ledger head, voucher number, party name, GSTIN..."
                className="w-full pl-4 pr-11 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#5F1915] dark:focus:border-[#ffb4ab] text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-2xs transition-colors"
              />
              <button className="absolute right-0 top-0 bottom-0 px-3.5 bg-[#5F1915] hover:bg-[#491310] text-white rounded-r-lg flex items-center justify-center transition-colors">
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Side: Active Client Selector & Persona & Theme Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">

            {/* Client Company Card */}
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md p-2 flex items-center space-x-2.5 shadow-2xs">
              <Building2 className="w-5 h-5 text-[#5F1915] dark:text-[#ffb4ab] shrink-0" />
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Active Client Entity (Alt+F3)
                </span>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="bg-transparent font-bold text-xs text-[#5F1915] dark:text-[#ffb4ab] focus:outline-none cursor-pointer max-w-[180px] truncate"
                >
                  {clients.map(c => (
                    <option key={c} value={c} className="dark:bg-slate-800 dark:text-slate-100">{c}</option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                  GSTIN: {settings.gstin || 'Not Configured'}
                </div>
              </div>
            </div>

            {/* Dark / Light Mode Toggle Button */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle theme mode"
                className="p-2 h-[42px] px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer"
              >
                {darkMode ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] font-bold text-slate-200 hidden sm:inline">Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-700" />
                    <span className="text-[11px] font-bold text-slate-700 hidden sm:inline">Dark</span>
                  </>
                )}
              </button>
            )}

            {/* User Credential Button with Dropdown & Logout */}
            {onSignOut && (
              <div className="relative" ref={userMenuRef}>
                <div className="flex items-center bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-md shadow-2xs">
                  
                  {/* Credential Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    title={`Logged in as ${currentUser?.name || userRole}. Click to view credentials.`}
                    aria-label="User credentials and account options"
                    className="p-1.5 pl-2 pr-2.5 h-[42px] hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors flex items-center space-x-2 text-left cursor-pointer rounded-l-md"
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] tracking-wider shadow-xs ${roleMeta.avatarBg}`}>
                      {roleMeta.badge}
                    </div>
                    
                    <div className="text-left hidden sm:block">
                      <div className="flex items-center space-x-1.5 leading-tight">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate max-w-[95px]">
                          {currentUser?.name ? currentUser.name.split(' ')[0] : 'User'}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-2xs ${roleMeta.badgeClass}`}>
                          {roleMeta.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[125px] leading-tight">
                        {currentUser?.email || 'Authenticated'}
                      </div>
                    </div>

                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Vertical Separator */}
                  <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700" />

                  {/* Direct Logout Icon Button */}
                  <button
                    type="button"
                    onClick={onSignOut}
                    title="Logout of workstation"
                    aria-label="Logout"
                    className="p-2 h-[42px] px-2.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-r-md transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="sr-only">Logout</span>
                  </button>
                </div>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-4 space-y-3.5 animate-fadeIn">
                    
                    {/* Header: User Credentials */}
                    <div className="flex items-start space-x-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm tracking-wide shadow-sm shrink-0 ${roleMeta.avatarBg}`}>
                        {roleMeta.badge}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {currentUser?.name || 'Authorized Accounting User'}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          {currentUser?.email || 'workstation@stalwartgroup.com'}
                        </p>
                        <div className="mt-1 flex items-center space-x-1">
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${roleMeta.badgeClass}`}>
                            {roleMeta.title}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Assigned Credential Info (Fixed from Login) */}
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Assigned Workstation Credential
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {roleMeta.title}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                          Fixed & Verified
                        </span>
                      </div>
                    </div>

                    {/* Security Badge */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center space-x-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-semibold">2FA Session Active</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-80">Port 9000</span>
                    </div>

                    {/* Full Logout Button inside Dropdown */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out of Accounting Workstation</span>
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Official Institutional Navigation Bar */}
      <div className="bg-[#5F1915] text-white px-4 border-t border-[#45120f] shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          <nav className="flex items-center overflow-x-auto text-xs font-semibold">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`flex items-center space-x-1.5 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentTab === 'dashboard'
                  ? 'border-amber-400 bg-[#45120f] text-amber-300'
                  : 'border-transparent text-slate-100 hover:bg-[#491310] hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Executive Dashboard</span>
            </button>

            <button
              onClick={() => setCurrentTab('upload')}
              className={`flex items-center space-x-1.5 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentTab === 'upload'
                  ? 'border-amber-400 bg-[#45120f] text-amber-300'
                  : 'border-transparent text-slate-100 hover:bg-[#491310] hover:text-white'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Batch Ingestion Queue</span>
            </button>

            <button
              onClick={() => setCurrentTab('validation')}
              className={`relative flex items-center space-x-1.5 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentTab === 'validation'
                  ? 'border-amber-400 bg-[#45120f] text-amber-300'
                  : 'border-transparent text-slate-100 hover:bg-[#491310] hover:text-white'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>CA Validation Desk</span>
              {pendingCount > 0 && (
                <span className="ml-1 bg-amber-400 text-[#5F1915] text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('export')}
              className={`flex items-center space-x-1.5 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentTab === 'export'
                  ? 'border-amber-400 bg-[#45120f] text-amber-300'
                  : 'border-transparent text-slate-100 hover:bg-[#491310] hover:text-white'
              }`}
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Tally Export &amp; Bridge</span>
            </button>

            <button
              onClick={() => setCurrentTab('audit')}
              className={`flex items-center space-x-1.5 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentTab === 'audit'
                  ? 'border-amber-400 bg-[#45120f] text-amber-300'
                  : 'border-transparent text-slate-100 hover:bg-[#491310] hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Statutory Audit Trail</span>
            </button>

            <button
              onClick={() => setCurrentTab('settings')}
              className={`flex items-center space-x-1.5 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentTab === 'settings'
                  ? 'border-amber-400 bg-[#45120f] text-amber-300'
                  : 'border-transparent text-slate-100 hover:bg-[#491310] hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Master Configuration</span>
            </button>
          </nav>

          {/* Quick CTA */}
          <div className="flex items-center space-x-2 py-1.5 shrink-0">
            <button
              onClick={onOpenVoiceModal}
              title="Record Voice Note (Alt+V)"
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#45120f] hover:bg-[#380e0c] text-white rounded text-xs font-semibold shadow-2xs border border-white/10 cursor-pointer transition-colors"
            >
              <Mic className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Voice Note (Alt+V)</span>
              <span className="sm:hidden">Voice</span>
            </button>

            <button
              onClick={() => setCurrentTab('upload')}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-[#5F1915] font-bold rounded text-xs shadow-2xs cursor-pointer transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import Invoices</span>
              <span className="sm:hidden">Import</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
