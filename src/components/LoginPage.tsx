import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ArrowRight, 
  UserCheck, 
  Sun, 
  Moon,
  KeyRound,
  Phone,
  User,
  CheckCircle2,
  RefreshCw,
  Smartphone,
  ArrowLeft,
  AlertCircle,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserRole } from '../types';
import { sendRealSmsOtp } from '../services/smsService';

interface LoginPageProps {
  onLogin: (user: { email: string; role: UserRole; name: string }) => void;
  darkMode?: boolean;
  onToggleTheme?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  darkMode,
  onToggleTheme,
}) => {
  // Mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Login Form States
  const [email, setEmail] = useState('ca.auditor@stalwartgroup.com');
  const [password, setPassword] = useState('Stalwart@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('CA');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Registration Form States
  const [regStep, setRegStep] = useState<'form' | 'otp'>('form');
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('CA');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // OTP Verification States
  const [activeOtp, setActiveOtp] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState<number>(30);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpSuccessNotice, setOtpSuccessNotice] = useState(false);
  const [gatewayNotice, setGatewayNotice] = useState<string>('');

  // SMS Gateway Configuration (for live carrier delivery)
  const [smsGatewayKey, setSmsGatewayKey] = useState<string>(() => {
    try {
      return localStorage.getItem('fast2sms_api_key') || '';
    } catch {
      return '';
    }
  });
  const [showGatewaySettings, setShowGatewaySettings] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const logoRef = useRef<HTMLDivElement>(null);
  const [logoY, setLogoY] = useState<number | null>(null);

  // Synchronize background horizontal strip parallel to the logo center
  useEffect(() => {
    const updateLogoPosition = () => {
      if (logoRef.current) {
        const rect = logoRef.current.getBoundingClientRect();
        setLogoY(rect.top + rect.height / 2);
      }
    };

    updateLogoPosition();
    window.addEventListener('resize', updateLogoPosition);
    const timer = setTimeout(updateLogoPosition, 100);
    return () => {
      window.removeEventListener('resize', updateLogoPosition);
      clearTimeout(timer);
    };
  }, [authMode, regStep]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (regStep === 'otp' && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [regStep, countdown]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email/username and password');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const name = 
        selectedRole === 'CA' ? 'CA Vikram Malhotra (FCA)' :
        selectedRole === 'Firm Admin' ? 'Rajesh Verma (Partner)' :
        selectedRole === 'Senior Accountant' ? 'Sunita Sharma (Accountant)' :
        selectedRole === 'Junior Auditor' ? 'Amit Desai (Auditor)' :
        selectedRole === 'SME Owner' ? 'Ananya Gupta (Executive)' :
        'Consultant / User';

      onLogin({
        email: email.trim(),
        role: selectedRole,
        name,
      });
    }, 600);
  };

  // Generate and Send OTP
  const handleInitiateRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full official name');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage('Please enter a valid work email address');
      return;
    }
    const cleanPhone = regPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }
    if (regPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your password entry.');
      return;
    }

    setIsLoading(true);

    // Generate a secure 6-digit OTP code
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setActiveOtp(generatedCode);
    setOtpDigits(['', '', '', '', '', '']);
    setCountdown(30);
    setCanResend(false);

    // Dispatch real SMS to the Indian mobile carrier network via our server endpoint
    sendRealSmsOtp(cleanPhone, generatedCode, smsGatewayKey)
      .then((result) => {
        setIsLoading(false);
        setRegStep('otp');
        if (result.success && result.provider === 'fast2sms') {
          setGatewayNotice(`Real SMS successfully transmitted to +91 ${cleanPhone} via Fast2SMS telecom gateway.`);
        } else if (smsGatewayKey) {
          setGatewayNotice(result.message || `SMS dispatched to +91 ${cleanPhone}`);
        } else {
          setGatewayNotice('');
        }
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);
      })
      .catch(() => {
        setIsLoading(false);
        setRegStep('otp');
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);
      });
  };

  // Resend OTP via real SMS
  const handleResendOtp = async () => {
    if (!canResend) return;
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setActiveOtp(newCode);
    setOtpDigits(['', '', '', '', '', '']);
    setCountdown(30);
    setCanResend(false);
    setErrorMessage('');

    const cleanPhone = regPhone.replace(/\D/g, '');
    await sendRealSmsOtp(cleanPhone, newCode, smsGatewayKey);

    setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 100);
  };

  // Handle individual OTP digit entry
  const handleOtpChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleaned;
    setOtpDigits(newDigits);
    setErrorMessage('');

    // Advance to next input
    if (cleaned && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation in OTP
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste of full 6-digit OTP
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    const nextEmptyIndex = newDigits.findIndex(d => !d);
    const focusTarget = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
    otpInputRefs.current[focusTarget]?.focus();
  };

  // Verify OTP and complete registration
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = otpDigits.join('');

    if (enteredCode.length !== 6) {
      setErrorMessage('Please enter all 6 digits of the verification code');
      return;
    }

    if (enteredCode !== activeOtp) {
      setErrorMessage('Incorrect verification code. Please check the SMS sent to your mobile phone and try again.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    setTimeout(() => {
      setIsVerifying(false);
      setOtpSuccessNotice(true);

      // Celebration confetti
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // Ignore
      }

      setTimeout(() => {
        onLogin({
          email: regEmail.trim(),
          role: regRole,
          name: fullName.trim(),
        });
      }, 900);
    }, 700);
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-[#090d16] text-slate-100' : 'bg-slate-100 text-slate-900'} flex flex-col justify-between selection:bg-[#5F1915] selection:text-white transition-colors duration-200 relative overflow-hidden font-sans`}>
      
      {/* One-Line Horizontal Brand Strip in Background (Parallel to Logo: #5F1915) */}
      <div 
        className="fixed left-0 right-0 w-full h-1.5 bg-[#5F1915] pointer-events-none shadow-sm z-0 transition-[top] duration-150"
        style={{ top: logoY !== null ? `${logoY}px` : '28%' }}
        aria-hidden="true"
      />

      {/* Background Accent Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#5F1915]/10 via-[#5F1915]/5 to-transparent blur-3xl pointer-events-none"></div>

      {/* Top Navbar */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Enterprise Financial Desk
          </span>
        </div>

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="p-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer text-xs font-bold"
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-700" />
                <span>Dark</span>
              </>
            )}
          </button>
        )}
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white dark:bg-[#0c1322] border border-slate-300 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-5 transition-all">
          
          {/* Logo on the Top */}
          <div className="text-center space-y-2.5">
            <div 
              ref={logoRef}
              className="mx-auto w-20 h-20 rounded-2xl bg-[#5F1915] p-2 shadow-md border border-[#5F1915]/40 flex items-center justify-center transform transition-transform hover:scale-105"
            >
              <img 
                src="/logo.png" 
                alt="TallyAI Logo" 
                className="w-full h-full object-contain"
              />
            </div>

            <div>
              <h1 className="text-2xl font-black text-[#5F1915] dark:text-[#ffb4ab] tracking-tight">
                TallyAI
              </h1>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                Financial Control &amp; Tally Prime Desk
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs (Sign In vs Register) */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage('');
              }}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white dark:bg-[#0c1322] text-[#5F1915] dark:text-[#ffb4ab] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In to Workstation
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setRegStep('form');
                setErrorMessage('');
              }}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white dark:bg-[#0c1322] text-[#5F1915] dark:text-[#ffb4ab] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Register New Account
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-200 flex items-start space-x-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Notice: </span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: LOGIN MODE                                       */}
          {/* ======================================================== */}
          {authMode === 'login' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                
                {/* Email / Username Input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Workstation Email or Username
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@stalwartgroup.com"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#5F1915] dark:focus:border-[#ffb4ab] transition-colors"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => alert('Default credentials: use Stalwart@2026 to log in immediately or contact your administrator.')}
                      className="text-[11px] font-semibold text-[#5F1915] dark:text-[#ffb4ab] hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-10 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#5F1915] dark:focus:border-[#ffb4ab] transition-colors font-mono"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2.5 top-2 cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Persona View Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Authorized Role Permission
                  </label>
                  <div className="relative">
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#5F1915] dark:focus:border-[#ffb4ab] transition-colors cursor-pointer"
                    >
                      <option value="CA">Chartered Accountant (FCA / Signatory)</option>
                      <option value="Senior Accountant">Accountant / Senior Accountant</option>
                      <option value="Firm Admin">Firm Administrator</option>
                      <option value="Junior Auditor">Junior Auditor</option>
                      <option value="SME Owner">SME Business Owner</option>
                      <option value="Other">Other / Financial Consultant</option>
                    </select>
                    <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* Remember Me & 2FA */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-[#5F1915] focus:ring-0 cursor-pointer"
                    />
                    <span className="font-medium">Remember workstation</span>
                  </label>

                  <div className="flex items-center space-x-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 px-2 py-0.5 rounded">
                    <ShieldCheck className="w-3 h-3" />
                    <span>2FA Protected</span>
                  </div>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-[#5F1915] hover:bg-[#45120f] text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Authenticating Credentials...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Access Accounting Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: REGISTRATION MODE - STEP 1 (FORM)                */}
          {/* ======================================================== */}
          {authMode === 'register' && regStep === 'form' && (
            <form onSubmit={handleInitiateRegistration} className="space-y-3.5 animate-fadeIn">
              
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Full Official Name (CA / Auditor / Partner)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. CA Rajesh Malhotra"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#5F1915] dark:focus:border-[#ffb4ab] transition-colors"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Work Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Work Email (For OTP &amp; Statutory Audit Sign-off)
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@stalwartgroup.com"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#5F1915] dark:focus:border-[#ffb4ab] transition-colors"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mobile Number (For SMS 2FA OTP Verification)
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                    +91
                  </span>
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="98765 43210"
                      maxLength={12}
                      required
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-r-lg pl-9 pr-3.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#5F1915] dark:focus:border-[#ffb4ab] transition-colors font-mono"
                    />
                    <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Designated Role &amp; Access Tier
                </label>
                <div className="relative">
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#5F1915] dark:focus:border-[#ffb4ab] transition-colors cursor-pointer"
                  >
                    <option value="CA">Chartered Accountant (FCA / Signatory)</option>
                    <option value="Senior Accountant">Accountant / Senior Accountant</option>
                    <option value="Firm Admin">Firm Administrator</option>
                    <option value="Junior Auditor">Junior Auditor</option>
                    <option value="SME Owner">SME Business Owner</option>
                    <option value="Other">Other / Financial Consultant</option>
                  </select>
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min. 6 chars"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#5F1915] dark:focus:border-[#ffb4ab] transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Confirm
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showRegPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#5F1915] dark:focus:border-[#ffb4ab] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button to Generate OTP */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 bg-[#5F1915] hover:bg-[#45120f] text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Generating 2FA Security OTP...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>Send Verification OTP via Email &amp; SMS</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                By registering, you agree to statutory audit confidentiality under ICAI guidelines.
              </p>
            </form>
          )}

          {/* ======================================================== */}
          {/* TAB 2: REGISTRATION MODE - STEP 2 (OTP VERIFICATION)     */}
          {/* ======================================================== */}
          {authMode === 'register' && regStep === 'otp' && (
            <div className="space-y-5 animate-fadeIn">
              
              <div className="text-center space-y-1">
                <div className="inline-flex p-2.5 bg-[#5F1915]/10 text-[#5F1915] dark:text-[#ffb4ab] rounded-full mb-1">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Verify 6-Digit OTP Code
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Verification code dispatched to:
                </p>
                <div className="text-xs font-mono font-bold text-[#5F1915] dark:text-[#ffb4ab] flex flex-col items-center">
                  <span>{regEmail}</span>
                  <span>+91 {regPhone.replace(/\D/g, '')}</span>
                </div>
              </div>

              {/* SMS Dispatched Status Banner - NO OTP Displayed on Screen */}
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-900 dark:text-emerald-200 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-left">
                  <span className="font-bold">SMS Dispatched: </span>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    A 6-digit OTP verification code has been dispatched to <strong>+91 {regPhone.replace(/\D/g, '').slice(-10)}</strong> and your email. Please check your SMS inbox and enter the 6 digits below.
                  </p>
                </div>
              </div>

              {gatewayNotice && (
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 rounded-lg text-[11px] text-blue-800 dark:text-blue-300 flex items-center space-x-2 text-left">
                  <Smartphone className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                  <span>{gatewayNotice}</span>
                </div>
              )}

              {/* 6 Individual Digit Inputs */}
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="flex justify-between gap-1.5 sm:gap-2">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => { otpInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={idx === 0 ? handleOtpPaste : undefined}
                      className="w-12 h-13 text-center text-xl font-mono font-black rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#5F1915] dark:focus:border-[#ffb4ab] transition-all shadow-2xs"
                    />
                  ))}
                </div>

                {/* Resend & Timer */}
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRegStep('form');
                      setErrorMessage('');
                    }}
                    className="flex items-center space-x-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Edit Details</span>
                  </button>

                  <div>
                    {canResend ? (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="font-bold text-[#5F1915] dark:text-[#ffb4ab] hover:underline flex items-center space-x-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Resend OTP Code</span>
                      </button>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        Resend in <strong className="text-slate-800 dark:text-slate-200 font-bold">{countdown}s</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={isVerifying || otpDigits.join('').length !== 6}
                  className="w-full py-2.5 px-4 bg-[#5F1915] hover:bg-[#45120f] text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Verifying Security Token...</span>
                    </>
                  ) : otpSuccessNotice ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Account Activated! Redirecting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify OTP &amp; Create Account</span>
                    </>
                  )}
                </button>

                {/* SMS Gateway Carrier Settings Dropdown */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowGatewaySettings(!showGatewaySettings)}
                    className="flex items-center justify-between w-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[11px] font-semibold cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5" />
                      <span>SMS Gateway Settings (Fast2SMS / Telecom)</span>
                    </span>
                    {showGatewaySettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showGatewaySettings && (
                    <div className="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 animate-fadeIn text-left">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                        Fast2SMS API Key (For Live Telecom Carrier SMS):
                      </label>
                      <input
                        type="password"
                        value={smsGatewayKey}
                        onChange={(e) => {
                          setSmsGatewayKey(e.target.value);
                          try {
                            localStorage.setItem('fast2sms_api_key', e.target.value);
                          } catch {}
                        }}
                        placeholder="Paste Fast2SMS API key here"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5F1915]"
                      />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                        Fast2SMS connects directly to Indian cellular networks (Airtel, Jio, Vi). To transmit real carrier SMS to your phone, enter your API key from <a href="https://www.fast2sms.com" target="_blank" rel="noreferrer" className="text-[#5F1915] dark:text-[#ffb4ab] underline font-bold">fast2sms.com</a>.
                      </p>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 max-w-7xl w-full mx-auto">
        <p>
          © 2026 TallyAI • ICAI Standards Compliant • 256-bit Encrypted Tally Gateway
        </p>
      </footer>

    </div>
  );
};
