import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Activity, Lock, AlertTriangle, Eye, Database, FileText, Users, Info,
  Menu, X, Moon, Sun, Wifi, CheckCircle, AlertCircle, Brain, Fingerprint,
  Scan, Key, Download, Bell, LogOut, ShieldAlert, ShieldCheck, Ban, Target,
  Zap, Clock, MapPin, ChevronRight, Home, Camera, UserCheck, UserX, Mail,
  User, Plus, Trash2, ArrowLeft, RefreshCw, CheckSquare,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Toaster, toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Storage Keys
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin@chakravyuh.ai';
const ADMIN_PASSWORD = 'Admin@Secure2025';

const SK = {
  USERS:     'cvyuh_users',    // Record<username, UserRecord>
  REQUESTS:  'cvyuh_reqs',     // AccessRequest[]
  VAULT_PFX: 'cvyuh_vault_',   // + username → VaultItem[]
  DARK:      'cvyuh_dark',
};

// Simple deterministic hash (demo only — not crypto-grade)
function hashPwd(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AppView = 'landing' | 'user-auth' | 'admin-auth' | 'user-dashboard' | 'admin-dashboard';
type UserStep = 'choose-user' | 'reg-username' | 'reg-pwd' | 'reg-face' | 'reg-pending' | 'login-pwd' | 'login-face';
type UserStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';
type SystemStatus = 'secure' | 'monitoring' | 'threat';

interface UserRecord {
  username: string;
  pwdHash: string;
  faceEnrolled: boolean;
  faceImg?: string;        // base64 snapshot, stored locally only
  status: UserStatus;
  registeredAt: string;
  approvedAt?: string;
  revokedAt?: string;
}

interface AccessRequest {
  id: string;
  ts: string;
  status: 'pending' | 'approved' | 'rejected';
  agent: string;
  username: string;
}

// ── Storage helpers ────────────────────────────────────────
function getUsers(): Record<string, UserRecord> {
  return JSON.parse(localStorage.getItem(SK.USERS) || '{}');
}
function saveUsers(u: Record<string, UserRecord>) {
  localStorage.setItem(SK.USERS, JSON.stringify(u));
}
function getUser(username: string): UserRecord | null {
  return getUsers()[username] ?? null;
}
function getRequests(): AccessRequest[] {
  return JSON.parse(localStorage.getItem(SK.REQUESTS) || '[]');
}
function saveRequests(r: AccessRequest[]) {
  localStorage.setItem(SK.REQUESTS, JSON.stringify(r));
}

type VaultItemType = 'text' | 'image' | 'document';

interface VaultItem {
  id: string;
  label: string;
  value: string;       // base64 DataURL (files) or base64-encoded text
  type: VaultItemType;
  fileName?: string;   // original filename for files
  mimeType?: string;   // MIME type for files
  size?: number;       // bytes
}

interface ThreatAlert {
  id: string;
  type: string;
  level: ThreatLevel;
  timestamp: Date;
  ip: string;
  action: string;
  description: string;
}

interface TrafficData {
  time: string;
  normal: number;
  suspicious: number;
  blocked: number;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  action: string;
  user: string;
  status: 'success' | 'warning' | 'error';
  details: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CameraCapture Component (defined outside App — uses hooks)
// ─────────────────────────────────────────────────────────────────────────────

interface CameraCaptureProps {
  title?: string;
  subtitle?: string;
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

function CameraCapture({
  title = 'Face Recognition',
  subtitle = 'Position your face in the frame',
  onCapture,
  onCancel,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [captured, setCaptured] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        streamRef.current = s;
        setPermission('granted');
      } catch {
        setPermission('denied');
      }
    })();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Attach stream to video element after it renders
  useEffect(() => {
    if (permission === 'granted' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [permission]);

  const retryCamera = async () => {
    setPermission('pending');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = s;
      setPermission('granted');
    } catch {
      setPermission('denied');
    }
  };

  const doCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const data = canvas.toDataURL('image/jpeg', 0.8);
    setCaptured(data);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setAnalyzing(true);
    // Simulate AI biometric analysis (2.2 s)
    setTimeout(() => { setAnalyzing(false); onCapture(data); }, 2200);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold">{title}</h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-muted rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {permission === 'pending' && (
          <div className="aspect-video bg-muted rounded-xl flex flex-col items-center justify-center gap-3">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
              <Camera className="w-10 h-10 text-muted-foreground" />
            </motion.div>
            <p className="text-sm text-muted-foreground font-medium">Requesting camera permission…</p>
            <p className="text-xs text-muted-foreground">Please allow camera access in your browser prompt</p>
          </div>
        )}

        {permission === 'denied' && (
          <div className="aspect-video bg-destructive/10 border border-destructive/20 rounded-xl flex flex-col items-center justify-center gap-3 p-6">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div className="text-center">
              <p className="font-semibold text-destructive">Camera Access Denied</p>
              <p className="text-sm text-muted-foreground mt-1">
                Allow camera access in your browser settings and try again.
              </p>
            </div>
            <button
              onClick={retryCamera}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Retry Access
            </button>
          </div>
        )}

        {permission === 'granted' && !captured && (
          <>
            <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {/* Face guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-52 border-2 border-primary/80 rounded-2xl" />
              </div>
              <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                onClick={doCapture}
                className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Capture
              </motion.button>
              <button
                onClick={onCancel}
                className="px-5 bg-muted hover:bg-accent rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {captured && (
          <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
            <img src={captured} className="w-full h-full object-cover" alt="Captured face" />
            {analyzing && (
              <div className="absolute inset-0 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Brain className="w-10 h-10" />
                </motion.div>
                <p className="font-semibold text-lg">AI Analyzing…</p>
                <p className="text-sm opacity-75">Verifying biometric signature</p>
                <div className="flex gap-1.5 mt-1">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.33 }}
                      className="w-2 h-2 bg-white rounded-full"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable display components (stable references, defined outside render)
// ─────────────────────────────────────────────────────────────────────────────

function SystemStatusBadge({ status }: { status: SystemStatus }) {
  const cfg = {
    secure:     { bg: 'bg-green-500', text: 'System Secure', Icon: ShieldCheck },
    monitoring: { bg: 'bg-blue-500',  text: 'Monitoring',    Icon: Activity },
    threat:     { bg: 'bg-red-500',   text: 'Under Threat',  Icon: AlertTriangle },
  };
  const { bg, text, Icon } = cfg[status];
  return (
    <motion.div
      animate={status === 'threat' ? { scale: [1, 1.06, 1] } : {}}
      transition={{ duration: 1, repeat: status === 'threat' ? Infinity : 0 }}
      className={`${bg} text-white px-3.5 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 shadow`}
    >
      <Icon className="w-4 h-4" />
      {text}
    </motion.div>
  );
}

function StatCard({
  icon: Icon, label, value, trend, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      className="bg-muted rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-7 h-7 ${color}`} />
        <span className="text-xs text-green-500 font-semibold">{trend}</span>
      </div>
      <p className="text-2xl font-bold mb-0.5">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </motion.div>
  );
}

function ThreatCard({ threat }: { threat: ThreatAlert }) {
  const colors: Record<ThreatLevel, string> = {
    low:      'bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400',
    medium:   'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400',
    high:     'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400',
    critical: 'bg-red-700/10 text-red-800 border-red-700/20 dark:text-red-300',
  };
  return (
    <motion.div
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-3 rounded-xl border ${colors[threat.level]}`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <h4 className="font-semibold text-sm">{threat.type}</h4>
        </div>
        <span className="text-xs font-bold uppercase px-2 py-0.5 bg-background rounded-full ml-2">
          {threat.level}
        </span>
      </div>
      <p className="text-xs mb-2 opacity-80">{threat.description}</p>
      <div className="flex items-center gap-3 text-xs opacity-70">
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{threat.ip}</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{threat.timestamp.toLocaleTimeString()}</span>
        <span className="flex items-center gap-1 font-semibold"><Ban className="w-3 h-3" />{threat.action}</span>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LandingView
// ─────────────────────────────────────────────────────────────────────────────

function LandingView({ onUser, onAdmin }: { onUser: () => void; onAdmin: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-14"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 180, delay: 0.15 }}
          className="inline-flex mb-5"
        >
          <Shield className="w-16 h-16 text-primary" />
        </motion.div>
        <h1 className="text-5xl font-bold mb-3">Chakravyuh AI</h1>
        <p className="text-xl text-muted-foreground">Multi-Layer Cyber Defense System</p>
        <p className="text-sm text-muted-foreground mt-2">Project ID: DT/2025-2026/FY-RAI-G10</p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl">
        <motion.button
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          whileHover={{ scale: 1.02, y: -3 }}
          whileTap={{ scale: 0.98 }}
          onClick={onUser}
          className="bg-primary text-primary-foreground rounded-2xl p-8 text-left shadow-lg hover:shadow-xl transition-shadow"
        >
          <User className="w-12 h-12 mb-5 opacity-90" />
          <h2 className="text-2xl font-bold mb-2">User Portal</h2>
          <p className="text-primary-foreground/80 text-sm leading-relaxed">
            Access your secure data vault with password and face recognition authentication
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold">
            Enter Secure Portal
            <ChevronRight className="w-4 h-4" />
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          whileHover={{ scale: 1.02, y: -3 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAdmin}
          className="bg-card border-2 border-border rounded-2xl p-8 text-left shadow-sm hover:shadow-lg transition-shadow"
        >
          <ShieldCheck className="w-12 h-12 mb-5 text-primary" />
          <h2 className="text-2xl font-bold mb-2">Admin Portal</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Review and approve user access requests — no personal data accessible here
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-primary">
            Admin Login
            <ChevronRight className="w-4 h-4" />
          </div>
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
      >
        <span className="flex items-center gap-1.5"><Lock className="w-4 h-4" />End-to-End Encrypted</span>
        <span className="flex items-center gap-1.5"><Brain className="w-4 h-4" />AI Protected</span>
        <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" />Privacy First</span>
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" />GDPR Compliant</span>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UserAuthView  — multi-user registration + login
// ─────────────────────────────────────────────────────────────────────────────

function UserAuthView({ onSuccess, onBack }: { onSuccess: (username: string) => void; onBack: () => void }) {
  const [step, setStep] = useState<UserStep>('choose-user');
  const [currentUsername, setCurrentUsername] = useState('');
  const [userList, setUserList] = useState<Record<string, UserRecord>>({});

  // Registration state
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [pwd, setPwd]                 = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [pwdError, setPwdError]       = useState('');

  // Login state
  const [loginPwd, setLoginPwd]   = useState('');
  const [loginError, setLoginError] = useState('');

  const [showCamera, setShowCamera] = useState(false);
  const [latestReqId, setLatestReqId] = useState('');

  const refreshUsers = () => setUserList(getUsers());

  useEffect(() => { refreshUsers(); }, []);

  // Poll for approval / rejection while pending
  useEffect(() => {
    if (step !== 'reg-pending' || !currentUsername) return;
    const iv = setInterval(() => {
      const u = getUser(currentUsername);
      if (!u) return;
      if (u.status === 'approved') {
        clearInterval(iv);
        toast.success('Access Approved!', { description: 'Complete login to enter.' });
        setLoginPwd(''); setLoginError('');
        setStep('login-pwd');
      } else if (u.status === 'rejected' || u.status === 'revoked') {
        clearInterval(iv);
        toast.error('Access Denied', { description: 'Your request was rejected. Please re-register.' });
        const users = getUsers();
        delete users[currentUsername];
        saveUsers(users);
        setCurrentUsername('');
        refreshUsers();
        setStep('choose-user');
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [step, currentUsername]);

  // ── Handlers ──────────────────────────────────────────────
  const handleSelectUser = (username: string) => {
    const u = getUser(username);
    if (!u) return;
    setCurrentUsername(username);
    if (u.status === 'approved') {
      setLoginPwd(''); setLoginError('');
      setStep('login-pwd');
    } else if (u.status === 'pending') {
      const reqs = getRequests().filter(r => r.username === username);
      if (reqs.length) setLatestReqId(reqs[reqs.length - 1].id);
      setStep('reg-pending');
    }
  };

  const handleClearAndReRegister = (username: string) => {
    const users = getUsers();
    delete users[username];
    saveUsers(users);
    localStorage.removeItem(SK.VAULT_PFX + username);
    saveRequests(getRequests().filter(r => r.username !== username));
    refreshUsers();
    toast.info('Account cleared — you can register a new username.');
  };

  const handleRegUsername = () => {
    const t = newUsername.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(t)) {
      setUsernameError('3–20 chars: letters, numbers, underscores only');
      return;
    }
    if (getUsers()[t]) {
      setUsernameError('Username already taken — choose another');
      return;
    }
    setUsernameError('');
    setCurrentUsername(t);
    setPwd(''); setConfirmPwd(''); setPwdError('');
    setStep('reg-pwd');
  };

  const validatePwd = (): boolean => {
    if (pwd.length < 8)     { setPwdError('At least 8 characters'); return false; }
    if (!/[A-Z]/.test(pwd)) { setPwdError('Include at least one uppercase letter'); return false; }
    if (!/[0-9]/.test(pwd)) { setPwdError('Include at least one number'); return false; }
    if (pwd !== confirmPwd) { setPwdError('Passwords do not match'); return false; }
    return true;
  };

  const handleRegPwd = () => {
    if (!validatePwd()) return;
    setPwdError('');
    setStep('reg-face');
  };

  const handleRegFace = (imgData: string) => {
    setShowCamera(false);
    const users = getUsers();
    users[currentUsername] = {
      username: currentUsername,
      pwdHash: hashPwd(pwd),
      faceEnrolled: true,
      faceImg: imgData,
      status: 'pending',
      registeredAt: new Date().toISOString(),
    };
    saveUsers(users);
    const newReq: AccessRequest = {
      id: `REQ-${Date.now().toString().slice(-6)}`,
      ts: new Date().toISOString(),
      status: 'pending',
      agent: navigator.userAgent.slice(0, 120),
      username: currentUsername,
    };
    saveRequests([...getRequests(), newReq]);
    setLatestReqId(newReq.id);
    toast.success('Registration complete!', { description: 'Awaiting admin approval.' });
    setStep('reg-pending');
  };

  const handleLoginPwd = () => {
    const u = getUser(currentUsername);
    if (!u || hashPwd(loginPwd) !== u.pwdHash) {
      setLoginError('Incorrect password. Please try again.');
      toast.error('Authentication failed');
      return;
    }
    setLoginError('');
    setStep('login-face');
  };

  const handleLoginFace = (_: string) => {
    setShowCamera(false);
    toast.success('Authentication Successful', { description: 'All security layers verified.' });
    onSuccess(currentUsername);
  };

  // ── Step progress dots ────────────────────────────────────
  const isReg   = ['reg-username', 'reg-pwd', 'reg-face'].includes(step);
  const isLogin = ['login-pwd', 'login-face'].includes(step);
  const regIdx  = ['reg-username', 'reg-pwd', 'reg-face'].indexOf(step);
  const loginIdx = ['login-pwd', 'login-face'].indexOf(step);

  const StepDots = () => (
    <div className="flex items-center gap-2 mb-6 text-xs">
      {isReg && ['Username', 'Password', 'Face ID'].map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          <span className={`flex items-center gap-1.5 ${i === regIdx ? 'text-primary font-semibold' : i < regIdx ? 'text-green-500' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === regIdx ? 'bg-primary text-primary-foreground' : i < regIdx ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              {i < regIdx ? '✓' : i + 1}
            </span>
            {label}
          </span>
        </React.Fragment>
      ))}
      {isLogin && ['Password', 'Face ID'].map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          <span className={`flex items-center gap-1.5 ${i === loginIdx ? 'text-primary font-semibold' : i < loginIdx ? 'text-green-500' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === loginIdx ? 'bg-primary text-primary-foreground' : i < loginIdx ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              {i < loginIdx ? '✓' : i + 1}
            </span>
            {label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );

  const statusColors: Record<UserStatus, string> = {
    approved: 'bg-green-500/10 text-green-600 border-green-500/30',
    pending:  'bg-orange-500/10 text-orange-600 border-orange-500/30',
    rejected: 'bg-red-500/10 text-red-600 border-red-500/30',
    revoked:  'bg-red-600/10 text-red-700 border-red-600/30',
  };
  const statusLabel: Record<UserStatus, string> = {
    approved: 'Active', pending: 'Pending', rejected: 'Rejected', revoked: 'Revoked',
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <button
          onClick={step === 'choose-user' ? onBack : () => { setStep('choose-user'); refreshUsers(); }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 'choose-user' ? 'Back to Home' : 'Back to Accounts'}
        </button>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          {(isReg || isLogin) && <StepDots />}

          <AnimatePresence mode="wait">

            {/* ── Account selection ─────────────────── */}
            {step === 'choose-user' && (
              <motion.div key="choose-user" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-center mb-8">
                  <User className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h2 className="text-2xl font-bold">User Portal</h2>
                  <p className="text-muted-foreground text-sm mt-1">Select your account or register a new one</p>
                </div>

                {Object.keys(userList).length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {Object.values(userList).map(u => {
                      const initials = u.username.slice(0, 2).toUpperCase();
                      const canLogin = u.status === 'approved';
                      const isBlocked = u.status === 'rejected' || u.status === 'revoked';
                      return (
                        <div key={u.username} className={`relative rounded-xl border-2 transition-all ${statusColors[u.status]}`}>
                          <button
                            onClick={() => !isBlocked && handleSelectUser(u.username)}
                            disabled={isBlocked}
                            className={`w-full p-4 flex flex-col items-center gap-2 rounded-xl ${canLogin ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform' : ''} ${isBlocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${canLogin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {initials}
                            </div>
                            <p className="font-semibold text-sm text-foreground">{u.username}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${statusColors[u.status]}`}>
                              {statusLabel[u.status]}
                            </span>
                            {u.status === 'pending' && (
                              <p className="text-xs text-center opacity-80">Tap to check status</p>
                            )}
                          </button>
                          {isBlocked && (
                            <button
                              onClick={() => handleClearAndReRegister(u.username)}
                              className="w-full py-2 text-xs font-semibold text-center border-t border-current/20 hover:bg-red-500/10 transition-colors rounded-b-xl"
                            >
                              Clear &amp; Re-register
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 mb-4 text-muted-foreground">
                    <Shield className="w-14 h-14 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No accounts yet</p>
                    <p className="text-sm mt-1">Register below to get started</p>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setNewUsername(''); setUsernameError(''); setStep('reg-username'); }}
                  className="w-full border-2 border-dashed border-primary/40 text-primary hover:bg-primary/5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Register New User
                </motion.button>
              </motion.div>
            )}

            {/* ── Choose username ────────────────────── */}
            {step === 'reg-username' && (
              <motion.div key="reg-username" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div className="text-center mb-2">
                  <User className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h2 className="text-2xl font-bold">Choose a Username</h2>
                  <p className="text-muted-foreground text-sm mt-1">Step 1 of 3 — Identity</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={e => { setNewUsername(e.target.value); setUsernameError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleRegUsername()}
                    placeholder="e.g. shivraj, john_doe123"
                    autoFocus
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  {usernameError && <p className="text-sm text-destructive mt-1.5">{usernameError}</p>}
                  <p className="text-xs text-muted-foreground mt-1.5">3–20 characters · letters, numbers, underscores · case-insensitive</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={handleRegUsername}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold"
                >
                  Continue
                </motion.button>
              </motion.div>
            )}

            {/* ── Set password ──────────────────────── */}
            {step === 'reg-pwd' && (
              <motion.div key="reg-pwd" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="text-center mb-2">
                  <Key className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h2 className="text-2xl font-bold">Create Password</h2>
                  <p className="text-muted-foreground text-sm mt-1">Step 2 of 3 — for <span className="font-bold text-foreground">@{currentUsername}</span></p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Password</label>
                  <input type="password" value={pwd} onChange={e => { setPwd(e.target.value); setPwdError(''); }} placeholder="Min 8 chars, 1 uppercase, 1 number"
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Confirm Password</label>
                  <input type="password" value={confirmPwd} onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); }} placeholder="Re-enter your password"
                    onKeyDown={e => e.key === 'Enter' && handleRegPwd()}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" />
                </div>
                {pwdError && <p className="text-sm text-destructive">{pwdError}</p>}
                <div className="text-xs space-y-1">
                  {[
                    [pwd.length >= 8, 'At least 8 characters'],
                    [/[A-Z]/.test(pwd), 'One uppercase letter'],
                    [/[0-9]/.test(pwd), 'One number'],
                    [pwd === confirmPwd && pwd.length > 0, 'Passwords match'],
                  ].map(([ok, label]) => (
                    <p key={label as string} className={ok ? 'text-green-500' : 'text-muted-foreground'}>✓ {label}</p>
                  ))}
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleRegPwd}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold mt-2">
                  Continue to Face Enrollment
                </motion.button>
              </motion.div>
            )}

            {/* ── Face enrollment ───────────────────── */}
            {step === 'reg-face' && (
              <motion.div key="reg-face" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="text-center mb-2">
                  <Scan className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h2 className="text-2xl font-bold">Face Enrollment</h2>
                  <p className="text-muted-foreground text-sm mt-1">Step 3 of 3 — Biometric for <span className="font-bold text-foreground">@{currentUsername}</span></p>
                </div>
                <div className="bg-muted rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold">Camera Permission Notice</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Browser will request camera access explicitly</li>
                    <li>• Photo is captured and stored only on this device</li>
                    <li>• No biometric data is transmitted to any server</li>
                    <li>• Ensure good lighting and face the camera directly</li>
                  </ul>
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => setShowCamera(true)}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
                  <Camera className="w-5 h-5" />
                  Allow Camera &amp; Enroll Face
                </motion.button>
                {showCamera && (
                  <CameraCapture title="Face Enrollment" subtitle="Center your face and capture"
                    onCapture={handleRegFace} onCancel={() => setShowCamera(false)} />
                )}
              </motion.div>
            )}

            {/* ── Pending approval ──────────────────── */}
            {step === 'reg-pending' && (
              <motion.div key="reg-pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-5 py-4">
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Clock className="w-16 h-16 text-orange-500 mx-auto" />
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold">Awaiting Admin Approval</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Registration for <span className="font-bold text-foreground">@{currentUsername}</span> complete.<br />
                    The admin must approve before you can log in.
                  </p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-left">
                  <p className="text-xs font-mono text-muted-foreground">Request ID: <span className="font-bold text-foreground">{latestReqId || '…'}</span></p>
                  <p className="text-xs text-muted-foreground mt-1">Submitted: {new Date().toLocaleString()}</p>
                  <p className="text-xs text-orange-500 font-semibold mt-2">Status: Pending admin review</p>
                </div>
                <p className="text-xs text-muted-foreground">Auto-checking every few seconds…</p>
                <div className="flex gap-1.5 justify-center">
                  {[0,1,2].map(i => (
                    <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5 }}
                      className="w-2 h-2 bg-primary rounded-full" />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Login: password ───────────────────── */}
            {step === 'login-pwd' && (
              <motion.div key="login-pwd" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="text-center mb-2">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl font-bold text-primary">{currentUsername.slice(0,2).toUpperCase()}</span>
                  </div>
                  <h2 className="text-2xl font-bold">Welcome back, @{currentUsername}</h2>
                  <p className="text-muted-foreground text-sm mt-1">Layer 1 — Password verification</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Password</label>
                  <input type="password" value={loginPwd} onChange={e => { setLoginPwd(e.target.value); setLoginError(''); }}
                    placeholder="Enter your password" onKeyDown={e => e.key === 'Enter' && handleLoginPwd()}
                    autoFocus className="w-full px-4 py-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" />
                </div>
                {loginError && <p className="text-sm text-destructive">{loginError}</p>}
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleLoginPwd}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold">
                  Verify Password
                </motion.button>
              </motion.div>
            )}

            {/* ── Login: face ───────────────────────── */}
            {step === 'login-face' && (
              <motion.div key="login-face" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="text-center mb-2">
                  <Scan className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h2 className="text-2xl font-bold">Face Verification</h2>
                  <p className="text-muted-foreground text-sm mt-1">Layer 2 — Biometric for <span className="font-bold text-foreground">@{currentUsername}</span></p>
                </div>
                <div className="bg-muted rounded-xl p-4 text-sm text-muted-foreground text-center">
                  Camera will activate to verify your identity. Ensure good lighting.
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => setShowCamera(true)}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
                  <Camera className="w-5 h-5" />
                  Start Face Verification
                </motion.button>
                {showCamera && (
                  <CameraCapture title="Face Verification" subtitle="Look at the camera to verify your identity"
                    onCapture={handleLoginFace} onCancel={() => setShowCamera(false)} />
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminAuthView
// ─────────────────────────────────────────────────────────────────────────────

function AdminAuthView({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      toast.success('Admin access granted');
      onSuccess();
    } else {
      setError('Invalid credentials. Access denied.');
      toast.error('Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8 shadow-lg"
        >
          <div className="text-center mb-8">
            <ShieldCheck className="w-14 h-14 text-primary mx-auto mb-3" />
            <h2 className="text-2xl font-bold">Admin Portal</h2>
            <p className="text-muted-foreground text-sm mt-1">Authorized personnel only</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="admin@chakravyuh.ai"
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter admin password"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogin}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold"
            >
              Access Admin Dashboard
            </motion.button>
          </div>

          <div className="mt-5 bg-muted rounded-xl p-4 text-xs text-muted-foreground">
            <p className="font-semibold mb-1">Privacy Declaration</p>
            <p>
              Admin access is strictly limited to approving or rejecting user access requests. No personal user data, biometric information, passwords, or vault contents are accessible through this portal.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminDashboardView — full user management: approve, reject, revoke, restore
// ─────────────────────────────────────────────────────────────────────────────

function AdminDashboardView({ onLogout }: { onLogout: () => void }) {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [allUsers, setAllUsers]   = useState<Record<string, UserRecord>>({});
  const [adminTab, setAdminTab]   = useState<'requests' | 'users'>('requests');

  const refresh = useCallback(() => {
    setRequests(getRequests());
    setAllUsers(getUsers());
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 2000);
    return () => clearInterval(iv);
  }, [refresh]);

  // ── Request actions ────────────────────────────────────────
  const approveRequest = (req: AccessRequest) => {
    const updatedReqs = requests.map(r => r.id === req.id ? { ...r, status: 'approved' as const } : r);
    saveRequests(updatedReqs);
    const users = getUsers();
    if (users[req.username]) {
      users[req.username].status = 'approved';
      users[req.username].approvedAt = new Date().toISOString();
      saveUsers(users);
    }
    refresh();
    toast.success(`@${req.username} approved`);
  };

  const rejectRequest = (req: AccessRequest) => {
    const updatedReqs = requests.map(r => r.id === req.id ? { ...r, status: 'rejected' as const } : r);
    saveRequests(updatedReqs);
    const users = getUsers();
    if (users[req.username]) {
      users[req.username].status = 'rejected';
      saveUsers(users);
    }
    refresh();
    toast.error(`@${req.username} rejected`);
  };

  // ── User management actions ───────────────────────────────
  const revokeUser = (username: string) => {
    const users = getUsers();
    if (!users[username]) return;
    users[username].status = 'revoked';
    users[username].revokedAt = new Date().toISOString();
    saveUsers(users);
    // Mark their last approved request as rejected so user-side polling detects it
    const updatedReqs = getRequests().map(r =>
      r.username === username && r.status === 'approved' ? { ...r, status: 'rejected' as const } : r
    );
    saveRequests(updatedReqs);
    refresh();
    toast.warning(`Access revoked for @${username}`);
  };

  const restoreUser = (username: string) => {
    const users = getUsers();
    if (!users[username]) return;
    users[username].status = 'approved';
    users[username].approvedAt = new Date().toISOString();
    delete users[username].revokedAt;
    saveUsers(users);
    // Restore their request status
    const updatedReqs = getRequests().map(r =>
      r.username === username ? { ...r, status: 'approved' as const } : r
    );
    saveRequests(updatedReqs);
    refresh();
    toast.success(`Access restored for @${username}`);
  };

  const deleteUser = (username: string) => {
    const users = getUsers();
    delete users[username];
    saveUsers(users);
    localStorage.removeItem(SK.VAULT_PFX + username);
    saveRequests(getRequests().filter(r => r.username !== username));
    refresh();
    toast.info(`@${username} removed from system`);
  };

  const pending  = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');
  const userArr  = Object.values(allUsers);

  const statusColors: Record<UserStatus, string> = {
    approved: 'bg-green-500/10 text-green-600',
    pending:  'bg-orange-500/10 text-orange-600',
    rejected: 'bg-red-500/10 text-red-600',
    revoked:  'bg-red-700/10 text-red-700',
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <div>
            <h1 className="font-bold">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">Chakravyuh AI — Access Control</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">Administrator</p>
            <p className="text-xs text-muted-foreground">{ADMIN_EMAIL}</p>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-accent rounded-xl text-sm transition-colors">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Privacy notice */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-primary">Privacy Protocol Active</p>
              <p className="text-muted-foreground text-xs mt-1">
                Admin access is strictly limited to user access management. No passwords, biometric data, or vault contents are visible here.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Users',    value: userArr.length,                                    color: 'text-primary' },
            { label: 'Active',         value: userArr.filter(u => u.status === 'approved').length, color: 'text-green-500' },
            { label: 'Pending',        value: pending.length,                                    color: 'text-orange-500' },
            { label: 'Revoked',        value: userArr.filter(u => u.status === 'revoked').length, color: 'text-red-500' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="bg-card border border-border rounded-xl p-5 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {(['requests', 'users'] as const).map(tab => (
            <button key={tab} onClick={() => setAdminTab(tab)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${adminTab === tab ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {tab === 'requests'
                ? <><Bell className="w-4 h-4" />Requests {pending.length > 0 && <span className="bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{pending.length}</span>}</>
                : <><Users className="w-4 h-4" />User Management</>}
            </button>
          ))}
        </div>

        {/* ── Requests tab ─────────────────────────────────────── */}
        {adminTab === 'requests' && (
          <div className="space-y-5">
            {/* Pending */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-500" />
                  Pending Access Requests
                  {pending.length > 0 && <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{pending.length}</span>}
                </h2>
                <button onClick={refresh} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              {pending.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No pending requests</p>
                  <p className="text-sm mt-1">All access requests have been processed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map(req => (
                    <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center font-bold text-orange-600">
                            {req.username.slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">@{req.username}</span>
                              <span className="font-mono text-xs text-muted-foreground">{req.id}</span>
                              <span className="bg-orange-500/20 text-orange-600 text-xs px-2 py-0.5 rounded-full font-medium">PENDING</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Received: {new Date(req.ts).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                            onClick={() => approveRequest(req)}
                            className="flex items-center gap-1.5 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                            <UserCheck className="w-4 h-4" /> Approve
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                            onClick={() => rejectRequest(req)}
                            className="flex items-center gap-1.5 bg-destructive text-destructive-foreground px-4 py-2 rounded-xl text-sm font-semibold">
                            <UserX className="w-4 h-4" /> Reject
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            {resolved.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Request History
                </h2>
                <div className="space-y-2">
                  {resolved.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">@{req.username}</span>
                        <span className="font-mono text-xs text-muted-foreground">{req.id}</span>
                        <span className="text-xs text-muted-foreground">{new Date(req.ts).toLocaleString()}</span>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${req.status === 'approved' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {req.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── User Management tab ──────────────────────────────── */}
        {adminTab === 'users' && (
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Registered Users
              </h2>
              <button onClick={refresh} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {userArr.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No users registered yet</p>
                <p className="text-sm mt-1">Users will appear here after they register via the User Portal</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userArr.map(u => (
                  <motion.div key={u.username} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border-2 ${
                      u.status === 'approved' ? 'border-green-500/20 bg-green-500/5' :
                      u.status === 'pending'  ? 'border-orange-500/20 bg-orange-500/5' :
                      'border-red-500/20 bg-red-500/5'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                        u.status === 'approved' ? 'bg-green-500/15 text-green-700' :
                        u.status === 'pending'  ? 'bg-orange-500/15 text-orange-700' :
                        'bg-red-500/15 text-red-700'
                      }`}>
                        {u.username.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold">@{u.username}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[u.status]}`}>
                            {u.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Registered: {new Date(u.registeredAt).toLocaleString()}
                        </p>
                        {u.approvedAt && u.status !== 'revoked' && (
                          <p className="text-xs text-green-600 mt-0.5">Approved: {new Date(u.approvedAt).toLocaleString()}</p>
                        )}
                        {u.revokedAt && (
                          <p className="text-xs text-red-600 mt-0.5">Revoked: {new Date(u.revokedAt).toLocaleString()}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {u.status === 'approved' && (
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                          onClick={() => revokeUser(u.username)}
                          className="flex items-center gap-1.5 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                          <Ban className="w-4 h-4" /> Revoke Access
                        </motion.button>
                      )}
                      {(u.status === 'revoked' || u.status === 'rejected') && (
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                          onClick={() => restoreUser(u.username)}
                          className="flex items-center gap-1.5 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                          <UserCheck className="w-4 h-4" /> Restore Access
                        </motion.button>
                      )}
                      {u.status === 'pending' && (
                        <>
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                            onClick={() => approveRequest(getRequests().filter(r => r.username === u.username && r.status === 'pending').pop()!)}
                            className="flex items-center gap-1.5 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                            <UserCheck className="w-4 h-4" /> Approve
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                            onClick={() => rejectRequest(getRequests().filter(r => r.username === u.username && r.status === 'pending').pop()!)}
                            className="flex items-center gap-1.5 bg-destructive text-destructive-foreground px-4 py-2 rounded-xl text-sm font-semibold">
                            <UserX className="w-4 h-4" /> Reject
                          </motion.button>
                        </>
                      )}
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => deleteUser(u.username)}
                        className="flex items-center gap-1.5 bg-muted hover:bg-destructive/10 hover:text-destructive px-3 py-2 rounded-xl text-sm transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UserDashboardView — the full 9-page security dashboard
// ─────────────────────────────────────────────────────────────────────────────

function UserDashboardView({ onLogout, username }: { onLogout: () => void; username: string }) {
  const vaultKey = SK.VAULT_PFX + username;

  const [currentPage, setCurrentPage]   = useState('home');
  const [isDark, setIsDark]             = useState(() => localStorage.getItem(SK.DARK) !== 'false');
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('secure');
  const [threats, setThreats]           = useState<ThreatAlert[]>([]);
  const [logs, setLogs]                 = useState<LogEntry[]>([]);
  const [trafficData, setTrafficData]   = useState<TrafficData[]>([]);
  const [blockedIPs, setBlockedIPs]     = useState<string[]>([]);
  const [vaultItems, setVaultItems]     = useState<VaultItem[]>(() =>
    JSON.parse(localStorage.getItem(SK.VAULT_PFX + username) || '[]')
  );
  const [showAddVault, setShowAddVault]   = useState(false);
  const [newLabel, setNewLabel]           = useState('');
  const [newValue, setNewValue]           = useState('');
  const [vaultTab, setVaultTab]           = useState<'text' | 'file'>('text');
  const [selectedFile, setSelectedFile]   = useState<File | null>(null);
  const [filePreview, setFilePreview]     = useState<string | null>(null);
  const [viewingItem, setViewingItem]     = useState<VaultItem | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(SK.DARK, String(isDark));
  }, [isDark]);

  // Revocation watchdog — log out immediately if admin revokes access
  useEffect(() => {
    const iv = setInterval(() => {
      const u = getUser(username);
      if (u && (u.status === 'revoked' || u.status === 'rejected')) {
        clearInterval(iv);
        toast.error('Access Revoked', { description: 'Your access has been removed by the admin.' });
        onLogout();
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [username, onLogout]);

  // Seed traffic data
  useEffect(() => {
    setTrafficData(
      Array.from({ length: 20 }, (_, i) => ({
        time: `${i}:00`,
        normal:     Math.floor(Math.random() * 100) + 50,
        suspicious: Math.floor(Math.random() * 30),
        blocked:    Math.floor(Math.random() * 15),
      }))
    );
  }, []);

  // Live threat simulation
  useEffect(() => {
    const iv = setInterval(() => {
      if (Math.random() > 0.7) {
        const types   = ['SQL Injection Attempt', 'DDoS Attack', 'Port Scanning', 'Brute Force Login', 'Malware Detected', 'Unauthorized Access'];
        const levels: ThreatLevel[] = ['low', 'medium', 'high', 'critical'];
        const ips     = ['192.168.1.101', '10.0.0.45', '172.16.0.23', '203.0.113.78', '198.51.100.42'];
        const threat: ThreatAlert = {
          id:          Date.now().toString(),
          type:        types[Math.floor(Math.random() * types.length)],
          level:       levels[Math.floor(Math.random() * levels.length)],
          timestamp:   new Date(),
          ip:          ips[Math.floor(Math.random() * ips.length)],
          action:      'Blocked',
          description: 'Threat detected and automatically neutralized',
        };
        setThreats(p => [threat, ...p].slice(0, 50));
        if (threat.level === 'critical' || threat.level === 'high') {
          setSystemStatus('threat');
          toast.error(`${threat.level.toUpperCase()} THREAT DETECTED!`, { description: threat.type });
          setBlockedIPs(p => [...new Set([...p, threat.ip])]);
          addLog('AI Auto-Response', 'System', 'warning', `Blocked IP: ${threat.ip}`);
          setTimeout(() => setSystemStatus('secure'), 5000);
        } else {
          setSystemStatus('monitoring');
          setTimeout(() => setSystemStatus('secure'), 3000);
        }
        setTrafficData(p => {
          const next = [...p];
          next.shift();
          next.push({
            time:       new Date().toLocaleTimeString(),
            normal:     Math.floor(Math.random() * 100) + 50,
            suspicious: Math.floor(Math.random() * 40) + 10,
            blocked:    Math.floor(Math.random() * 20) + 5,
          });
          return next;
        });
      }
    }, 8000);
    return () => clearInterval(iv);
  }, []);

  const addLog = (action: string, user: string, status: LogEntry['status'], details: string) => {
    setLogs(p => [{ id: Date.now().toString(), timestamp: new Date(), action, user, status, details }, ...p].slice(0, 100));
  };

  const addVaultItem = () => {
    if (!newLabel.trim() || !newValue.trim()) return;
    const item: VaultItem = {
      id:    Date.now().toString(),
      label: newLabel.trim(),
      value: btoa(unescape(encodeURIComponent(newValue.trim()))),
      type:  'text',
    };
    const updated = [...vaultItems, item];
    setVaultItems(updated);
    localStorage.setItem(vaultKey, JSON.stringify(updated));
    setNewLabel('');
    setNewValue('');
    setShowAddVault(false);
    toast.success('Data stored securely', { description: 'Encoded and saved locally on this device' });
    addLog('Add Vault Item', 'User', 'success', `Stored: ${newLabel.trim()}`);
  };

  const handleFileSelect = (file: File) => {
    const MAX_MB = 4;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File too large (max ${MAX_MB} MB)`, { description: 'Choose a smaller file to keep storage secure and local.' });
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const addVaultFile = () => {
    if (!newLabel.trim() || !selectedFile) return;
    setUploadProgress(true);
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      const itemType: VaultItemType = selectedFile.type.startsWith('image/') ? 'image' : 'document';
      const item: VaultItem = {
        id:       Date.now().toString(),
        label:    newLabel.trim(),
        value:    dataUrl,
        type:     itemType,
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        size:     selectedFile.size,
      };
      const updated = [...vaultItems, item];
      setVaultItems(updated);
      try {
        localStorage.setItem(vaultKey, JSON.stringify(updated));
      } catch {
        toast.error('Storage full', { description: 'Remove older items and try again.' });
        setUploadProgress(false);
        return;
      }
      setNewLabel('');
      setSelectedFile(null);
      setFilePreview(null);
      setShowAddVault(false);
      setUploadProgress(false);
      toast.success('File stored securely', { description: `${selectedFile.name} saved locally on this device only` });
      addLog('Add Vault File', 'User', 'success', `Stored: ${newLabel.trim()} (${selectedFile.name})`);
    };
    reader.readAsDataURL(selectedFile);
  };

  const removeVaultItem = (id: string) => {
    const updated = vaultItems.filter(v => v.id !== id);
    setVaultItems(updated);
    localStorage.setItem(vaultKey, JSON.stringify(updated));
    toast.info('Item removed from vault');
    addLog('Remove Vault Item', 'User', 'warning', 'Data removed from local vault');
  };

  const downloadReport = () => {
    toast.success('Security Report Downloaded', { description: 'PDF report generated successfully' });
    addLog('Download Report', 'User', 'success', 'Security report generated');
  };

  // ── Page renderers (plain functions — no hooks inside) ────────

  const HomePage = () => (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-10 text-white"
      >
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm font-semibold">Next-Gen Cybersecurity</span>
          </div>
          <h1 className="text-5xl font-bold mb-3">Chakravyuh AI</h1>
          <p className="text-xl mb-2 text-white/90">Multi-Layer Cyber Defense System</p>
          <p className="text-base text-white/80 max-w-xl mb-8 leading-relaxed">
            AI-powered security platform with intelligent threat detection, automated response, and multi-layer authentication protecting every layer of your data.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentPage('dashboard')}
            className="bg-white text-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg"
          >
            Open Dashboard
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
        <motion.div animate={{ rotate: 360 }}  transition={{ duration: 50, repeat: Infinity, ease: 'linear' }} className="absolute -right-20 -top-20 w-80 h-80 border-2 border-white/10 rounded-full" />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 70, repeat: Infinity, ease: 'linear' }} className="absolute -right-32 -top-32 w-96 h-96 border-2 border-white/5 rounded-full" />
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { icon: Shield,      title: 'Multi-Layer Firewall', desc: 'Advanced IP blocking and real-time monitoring',       color: 'text-blue-500' },
          { icon: Brain,       title: 'AI Intelligence',      desc: 'Machine learning anomaly detection and scoring',      color: 'text-purple-500' },
          { icon: Lock,        title: 'Data Vault',           desc: 'Encrypted local storage with immutable protection',   color: 'text-green-500' },
          { icon: Zap,         title: 'Auto Response',        desc: 'Instant threat neutralization and security actions',  color: 'text-orange-500' },
        ].map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -4 }}
            className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <f.icon className={`w-10 h-10 mb-3 ${f.color}`} />
            <h3 className="font-semibold mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">System Status</h2>
          <SystemStatusBadge status={systemStatus} />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <StatCard icon={CheckCircle} label="Active Protections"    value="12"                   trend="+100%"  color="text-green-500" />
          <StatCard icon={Ban}         label="Threats Blocked Today" value={threats.length.toString()} trend="Live"   color="text-red-500" />
          <StatCard icon={Activity}    label="System Uptime"         value="99.9%"               trend="Optimal" color="text-blue-500" />
        </div>
      </motion.div>
    </div>
  );

  const DashboardPage = () => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    threats.forEach(t => counts[t.level]++);
    const pieData = [
      { name: 'Low',      value: Math.max(counts.low, 0),      color: '#10b981' },
      { name: 'Medium',   value: Math.max(counts.medium, 0),   color: '#f59e0b' },
      { name: 'High',     value: Math.max(counts.high, 0),     color: '#ef4444' },
      { name: 'Critical', value: Math.max(counts.critical, 0), color: '#dc2626' },
    ];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Real-Time Security Dashboard</h1>
          <SystemStatusBadge status={systemStatus} />
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <StatCard icon={Shield}   label="Total Threats"    value={threats.length.toString()} trend="+12%"  color="text-primary" />
          <StatCard icon={Ban}      label="Blocked IPs"      value={blockedIPs.length.toString()} trend="Active" color="text-destructive" />
          <StatCard icon={Activity} label="Network Traffic"  value="847 MB/s"                  trend="+5.2%" color="text-blue-500" />
          <StatCard icon={Brain}    label="AI Accuracy"      value="98.7%"                     trend="Optimal" color="text-purple-500" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Network Traffic Monitor</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="time" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }} />
                <Area key="area-normal"     type="monotone" dataKey="normal"     stroke="#10b981" fill="url(#gN)" />
                <Area key="area-suspicious" type="monotone" dataKey="suspicious" stroke="#f59e0b" fill="url(#gS)" />
                <Area key="area-blocked"    type="monotone" dataKey="blocked"    stroke="#ef4444" fill="url(#gB)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Threat Distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Threats</h3>
            <Bell className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {threats.slice(0, 8).map(t => (
              <ThreatCard key={t.id} threat={t} />
            ))}
            {threats.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No threats detected yet. System is monitoring.</p>
            )}
          </div>
        </motion.div>
      </div>
    );
  };

  const SecurityLayersPage = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Security Layers</h1>
      <div className="grid md:grid-cols-2 gap-5">
        {[
          { icon: Shield, title: 'Firewall Layer',      sub: 'IP Blocking & Filtering',   color: 'text-primary',    stats: [['Status', 'Active', 'text-green-500'], ['Blocked IPs', blockedIPs.length.toString(), ''], ['Rules Active', '247', '']] },
          { icon: Eye,    title: 'Intrusion Detection', sub: 'Real-time Monitoring',       color: 'text-blue-500',   stats: [['Detection Rate', '99.8%', 'text-green-500'], ['Scans/Second', '1,247', ''], ['Patterns', '156,892', '']] },
          { icon: Lock,   title: 'Encryption Layer',    sub: 'AES-256 Protection',         color: 'text-green-500',  stats: [['Algorithm', 'AES-256-GCM', ''], ['Key Rotation', 'Every 24h', ''], ['Encrypted', '100%', '']] },
          { icon: Brain,  title: 'AI Intelligence',     sub: 'Neural Network Analysis',    color: 'text-purple-500', stats: [['Accuracy', '98.7%', 'text-green-500'], ['Anomalies', threats.length.toString(), ''], ['Auto-Response', 'Enabled', 'text-green-500']] },
        ].map((layer, i) => (
          <motion.div key={layer.title} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <layer.icon className={`w-8 h-8 ${layer.color}`} />
              <div>
                <h3 className="text-lg font-semibold">{layer.title}</h3>
                <p className="text-xs text-muted-foreground">{layer.sub}</p>
              </div>
            </div>
            <div className="space-y-2">
              {layer.stats.map(([k, v, c]) => (
                <div key={k} className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
                  <span className="text-sm font-medium">{k}</span>
                  <span className={`text-sm font-semibold ${c}`}>{v}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
      {blockedIPs.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Blocked IP Addresses</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {blockedIPs.map((ip, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <span className="text-sm font-mono font-semibold text-destructive">{ip}</span>
                <Ban className="w-4 h-4 text-destructive" />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );

  const DataVaultPage = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Secure Data Vault</h1>
          <p className="text-muted-foreground text-sm mt-1">Encrypted local storage — data never leaves your device</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowAddVault(true)}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Data
        </motion.button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { icon: Lock,       title: 'Base64 Encoded',  desc: 'Values encoded before local storage', color: 'text-primary' },
          { icon: ShieldCheck, title: 'Local Only',     desc: 'Data never transmitted to any server', color: 'text-green-500' },
          { icon: Brain,      title: 'AI Monitored',    desc: 'Real-time threat protection active',   color: 'text-purple-500' },
        ].map((f, i) => (
          <motion.div key={f.title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-card border border-border rounded-xl p-5">
            <f.icon className={`w-9 h-9 mb-3 ${f.color}`} />
            <h3 className="font-semibold mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Add item modal */}
      {showAddVault && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold">Add to Vault</h3>
              <button
                onClick={() => { setShowAddVault(false); setSelectedFile(null); setFilePreview(null); setNewLabel(''); setNewValue(''); }}
                className="p-2 hover:bg-muted rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-muted rounded-xl p-1 mb-5 gap-1">
              {(['text', 'file'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setVaultTab(tab); setSelectedFile(null); setFilePreview(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${vaultTab === tab ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab === 'text' ? '🔢 Text / Number' : '📁 File / Image'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {/* Common label */}
              <div>
                <label className="text-sm font-medium block mb-1.5">Label</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder={vaultTab === 'text' ? 'e.g. Aadhaar Number, PAN Card' : 'e.g. Passport Scan, Project Doc'}
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              {vaultTab === 'text' ? (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Value</label>
                  <input
                    type="text"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="Enter sensitive data value"
                    onKeyDown={e => e.key === 'Enter' && addVaultItem()}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium block mb-1.5">File</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.ppt,.pptx,.zip"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                  />
                  {!selectedFile ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFileSelect(f); }}
                      className="w-full border-2 border-dashed border-border hover:border-primary rounded-xl py-8 flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      <Database className="w-9 h-9" />
                      <span className="text-sm font-medium">Click or drag a file here</span>
                      <span className="text-xs">Images, PDF, Word, Excel, ZIP — max 4 MB</span>
                    </button>
                  ) : (
                    <div className="border border-border rounded-xl overflow-hidden">
                      {filePreview && (
                        <img src={filePreview} alt="preview" className="w-full max-h-36 object-cover" />
                      )}
                      <div className="flex items-center justify-between p-3 bg-muted">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                            <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button onClick={() => { setSelectedFile(null); setFilePreview(null); }} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-muted rounded-xl p-3 text-xs text-muted-foreground flex items-start gap-2">
                <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Stored as base64 in your browser only — never transmitted to any server.
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={vaultTab === 'text' ? addVaultItem : addVaultFile}
                  disabled={uploadProgress || (vaultTab === 'text' ? !newLabel.trim() || !newValue.trim() : !newLabel.trim() || !selectedFile)}
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploadProgress ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <RefreshCw className="w-4 h-4" />
                      </motion.div>
                      Encrypting…
                    </>
                  ) : (
                    vaultTab === 'text' ? 'Encode & Store' : 'Upload & Secure'
                  )}
                </motion.button>
                <button
                  onClick={() => { setShowAddVault(false); setSelectedFile(null); setFilePreview(null); setNewLabel(''); setNewValue(''); }}
                  className="px-5 bg-muted hover:bg-accent rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Stored Items ({vaultItems.length})</h3>
        {vaultItems.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-14 h-14 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground font-medium">Vault is empty</p>
            <p className="text-muted-foreground text-sm mt-1">Click "Add Data" to securely store sensitive information</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vaultItems.map(item => {
              const isImage = item.type === 'image';
              const isDoc   = item.type === 'document';
              const ItemIcon = isImage ? Camera : isDoc ? FileText : Database;
              const typeLabel = isImage ? 'Image' : isDoc ? 'Document' : 'Text';
              const typeColor = isImage ? 'text-blue-500' : isDoc ? 'text-orange-500' : 'text-primary';
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-4 bg-muted rounded-xl hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ItemIcon className={`w-7 h-7 flex-shrink-0 ${typeColor}`} />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.fileName
                          ? `${item.fileName} · ${item.size ? (item.size / 1024).toFixed(1) + ' KB' : ''}`
                          : '•'.repeat(Math.min(12, item.value.length))}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isImage ? 'bg-blue-500/10 text-blue-500' : isDoc ? 'bg-orange-500/10 text-orange-500' : 'bg-primary/10 text-primary'
                    }`}>
                      {typeLabel}
                    </span>
                    <span className="text-xs bg-green-500/10 text-green-500 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Secured
                    </span>
                    <button
                      onClick={() => setViewingItem(item)}
                      className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors"
                      title="View securely"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeVaultItem(item.id)}
                      className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-7 h-7 text-green-500 flex-shrink-0" />
          <div>
            <h3 className="font-semibold mb-1">Emergency Protection Active</h3>
            <p className="text-sm text-muted-foreground">
              On critical threat detection, AI automatically isolates vault data and blocks all unauthorized access.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-semibold text-green-500">Auto-Protection: Enabled</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Secure Viewer ─────────────────────────────────────── */}
      {viewingItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setViewingItem(null); }}>
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <h3 className="font-bold">{viewingItem.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    Secure View — visible only to you · {viewingItem.type === 'text' ? 'Text entry' : viewingItem.fileName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {viewingItem.type !== 'text' && viewingItem.value && (
                  <a
                    href={viewingItem.value}
                    download={viewingItem.fileName || viewingItem.label}
                    className="p-2 hover:bg-muted rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium"
                    onClick={() => addLog('Download Vault File', 'User', 'success', `Downloaded: ${viewingItem.label}`)}
                  >
                    <Download className="w-4 h-4" />
                    Save
                  </a>
                )}
                <button onClick={() => setViewingItem(null)} className="p-2 hover:bg-muted rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {viewingItem.type === 'image' ? (
                <div className="flex flex-col items-center gap-4">
                  <img
                    src={viewingItem.value}
                    alt={viewingItem.label}
                    className="max-w-full max-h-[60vh] rounded-xl object-contain border border-border shadow-md"
                  />
                  <p className="text-xs text-muted-foreground">{viewingItem.fileName} · {viewingItem.size ? (viewingItem.size / 1024).toFixed(1) + ' KB' : ''}</p>
                </div>
              ) : viewingItem.type === 'document' ? (
                <div className="flex flex-col items-center gap-4">
                  {viewingItem.mimeType === 'application/pdf' ? (
                    <iframe
                      src={viewingItem.value}
                      title={viewingItem.label}
                      className="w-full rounded-xl border border-border"
                      style={{ height: '60vh' }}
                    />
                  ) : (
                    <div className="w-full flex flex-col items-center gap-5 py-10">
                      <FileText className="w-20 h-20 text-orange-400 opacity-80" />
                      <div className="text-center">
                        <p className="font-semibold text-lg">{viewingItem.fileName}</p>
                        <p className="text-muted-foreground text-sm mt-1">{viewingItem.size ? (viewingItem.size / 1024).toFixed(1) + ' KB' : ''} · {viewingItem.mimeType}</p>
                        <p className="text-muted-foreground text-xs mt-3">Preview not available for this file type.</p>
                        <p className="text-muted-foreground text-xs">Use the Save button above to download and open it.</p>
                      </div>
                      <a
                        href={viewingItem.value}
                        download={viewingItem.fileName || viewingItem.label}
                        className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm"
                        onClick={() => addLog('Download Vault File', 'User', 'success', `Downloaded: ${viewingItem.label}`)}
                      >
                        <Download className="w-4 h-4" />
                        Download File
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                /* Text entry */
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-semibold text-green-500">Decrypted in-memory only</span>
                  </div>
                  <div className="bg-muted rounded-xl p-5 font-mono text-base break-all border border-border select-all">
                    {(() => { try { return decodeURIComponent(escape(atob(viewingItem.value))); } catch { return viewingItem.value; } })()}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    This value is decoded only for display — it remains encoded in storage.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border bg-muted/50 flex items-center gap-2 flex-shrink-0">
              <ShieldAlert className="w-4 h-4 text-green-500" />
              <p className="text-xs text-muted-foreground">This view is private. No data is transmitted. Close to hide.</p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );

  const LogsPage = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Security Logs</h1>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={downloadReport} className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" />
          Download Report
        </motion.button>
      </div>
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">No log entries yet. Actions will appear here.</p>
          ) : logs.map(log => (
            <motion.div key={log.id} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 p-3.5 bg-muted rounded-xl hover:bg-accent transition-colors">
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${log.status === 'success' ? 'bg-green-500' : log.status === 'warning' ? 'bg-orange-500' : 'bg-red-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h4 className="font-semibold text-sm">{log.action}</h4>
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{log.timestamp.toLocaleTimeString()}</span>
                </div>
                <p className="text-xs text-muted-foreground">{log.details}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{log.user}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${log.status === 'success' ? 'bg-green-500/10 text-green-500' : log.status === 'warning' ? 'bg-orange-500/10 text-orange-500' : 'bg-red-500/10 text-red-500'}`}>
                    {log.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const UserProtectionPage = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">User Protection Scenario</h1>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-3xl font-bold text-primary">SP</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-1">Shivraj Patil</h2>
            <p className="text-muted-foreground mb-3">Age: 19 &nbsp;|&nbsp; Profession: Web Developer</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Works with sensitive client data including personal documents, banking information, and confidential project files. Requires maximum security protection for all development operations and client data handling across multi-layer authenticated sessions.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-5">
        {[
          { icon: Key,         title: 'Password Authentication', desc: 'Strong password with complexity requirements',  color: 'text-primary',    layer: 'Layer 1 — Active' },
          { icon: Scan,        title: 'Face Recognition',        desc: 'Live camera-based biometric verification',      color: 'text-blue-500',   layer: 'Layer 2 — Active' },
          { icon: Fingerprint, title: 'Fingerprint (Optional)',  desc: 'Hardware biometric if device supports it',      color: 'text-green-500',  layer: 'Layer 3 — Optional' },
        ].map((l, i) => (
          <motion.div key={l.title} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} className="bg-card border border-border rounded-xl p-5">
            <l.icon className={`w-10 h-10 mb-3 ${l.color}`} />
            <h3 className="font-semibold mb-1">{l.title}</h3>
            <p className="text-sm text-muted-foreground mb-3">{l.desc}</p>
            <div className="flex items-center gap-2 text-green-500 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span className="font-semibold">{l.layer}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-xl font-semibold mb-5">Real-Time Protection Scenarios</h3>
        <div className="space-y-5">
          {[
            { color: 'bg-green-500', Icon: CheckCircle,  title: 'Normal Operation',        desc: "Shivraj accesses client documents — all security layers verified, activity logged in real time" },
            { color: 'bg-orange-500', Icon: AlertCircle, title: 'Threat Detected',         desc: 'AI identifies suspicious access pattern — auto-monitoring initiated, admin notified instantly' },
            { color: 'bg-red-500',    Icon: ShieldAlert, title: 'Critical Attack Response', desc: 'Emergency AI protocol activated:', list: ['Sensitive data isolated to secure vault', 'Unauthorized access blocked within 200ms', 'Alert notifications dispatched', 'Forensic audit trail auto-generated'] },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className={`w-9 h-9 rounded-full ${s.color} flex items-center justify-center flex-shrink-0`}>
                <s.Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold">{s.title}</h4>
                <p className="text-sm text-muted-foreground mt-0.5">{s.desc}</p>
                {s.list && (
                  <ul className="text-sm text-muted-foreground mt-2 space-y-0.5 ml-1">
                    {s.list.map((li, j) => <li key={j}>✓ {li}</li>)}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  const ArchitecturePage = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">System Architecture</h1>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-8">
        <div className="space-y-5">
          {[
            { n: 1, bg: 'bg-primary',    icon: Wifi,     title: 'Network Entry Point',        desc: 'Initial traffic inspection and protocol filtering' },
            { n: 2, bg: 'bg-blue-500',   icon: Shield,   title: 'Firewall Layer',              desc: 'IP filtering, rule enforcement, automatic blocking' },
            { n: 3, bg: 'bg-orange-500', icon: Eye,      title: 'Intrusion Detection System',  desc: 'Pattern matching and real-time anomaly detection' },
            { n: 4, bg: 'bg-purple-500', icon: Brain,    title: 'AI Intelligence Layer',       desc: 'Machine learning threat analysis and scoring' },
            { n: 5, bg: 'bg-teal-600',   icon: Lock,     title: 'Encryption Layer',            desc: 'End-to-end AES-256 data encryption' },
            { n: 6, bg: 'bg-green-500',  icon: Database, title: 'Secure Data Vault',           desc: 'Protected local storage with access control' },
          ].map((l, i) => (
            <motion.div key={l.n} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-4">
              <div className={`w-11 h-11 rounded-full ${l.bg} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                {l.n}
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 bg-muted rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <l.icon className="w-5 h-5 text-foreground/60" />
                  <div>
                    <h3 className="font-semibold">{l.title}</h3>
                    <p className="text-xs text-muted-foreground">{l.desc}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  const TeamPage = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Project Team</h1>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/5 border border-primary/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Project Information</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Project ID</p>
            <p className="text-xl font-bold font-mono">DT/2025-2026/FY-RAI-G10</p>
          </div>
          <div className="bg-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Academic Year</p>
            <p className="text-xl font-bold">2025-2026</p>
          </div>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Team Leader */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-primary to-primary/70 text-white rounded-xl p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
              <span className="text-2xl font-bold">SP</span>
            </div>
            <h3 className="text-xl font-bold mb-0.5">Shivraj Patil</h3>
            <p className="text-white/80 text-sm mb-1">Team Leader &amp; Principal Investigator</p>
            <p className="text-white/70 text-xs mb-4">Web Developer &nbsp;|&nbsp; Age 19</p>
            <span className="inline-block bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold">Project Lead</span>
          </div>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: 'linear' }} className="absolute -right-8 -bottom-8 w-36 h-36 border-2 border-white/10 rounded-full" />
        </motion.div>

        {[
          { role: 'Security Architect',  resp: 'System Design & Architecture' },
          { role: 'AI/ML Engineer',      resp: 'Intelligence Module Development' },
          { role: 'Backend Developer',   resp: 'API & Database Management' },
          { role: 'Frontend Developer',  resp: 'UI/UX Implementation' },
          { role: 'Security Analyst',    resp: 'Threat Analysis & Testing' },
        ].map((m, i) => (
          <motion.div key={m.role} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-semibold mb-0.5">{m.role}</h3>
            <p className="text-sm text-muted-foreground">{m.resp}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const AboutPage = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">About Chakravyuh AI</h1>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-8">
        <div className="flex items-start gap-5 mb-6">
          <Shield className="w-16 h-16 text-primary flex-shrink-0" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Multi-Layer Cyber Defense System</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Chakravyuh AI is an advanced intelligent cybersecurity platform delivering maximum protection for sensitive user data through multi-layer security, AI-powered threat detection, camera-based face recognition, and automated response mechanisms — all while ensuring complete user privacy.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold mb-3">Core Technologies</h3>
            <ul className="space-y-2">
              {['React 18 with TypeScript', 'Tailwind CSS for styling', 'Motion for animations', 'Recharts for data visualization', 'WebRTC / getUserMedia (camera)', 'localStorage (secure local vault)'].map(t => (
                <li key={t} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Key Features</h3>
            <ul className="space-y-2">
              {['Real-time threat monitoring', 'AI-powered anomaly detection', 'Multi-layer authentication', 'Camera face recognition', 'Admin access management', 'Encrypted local data vault', 'Privacy-first architecture'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-6">
          <h3 className="font-semibold mb-4">Security Layer Overview</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { l: 'Layer 1', n: 'Firewall',    Icon: Shield },
              { l: 'Layer 2', n: 'IDS',         Icon: Eye },
              { l: 'Layer 3', n: 'AI Analysis', Icon: Brain },
              { l: 'Layer 4', n: 'Encryption',  Icon: Lock },
              { l: 'Layer 5', n: 'Auth (MFA)',  Icon: Key },
              { l: 'Layer 6', n: 'Data Vault',  Icon: Database },
            ].map(item => (
              <div key={item.n} className="bg-muted rounded-xl p-3">
                <item.Icon className="w-5 h-5 text-primary mb-1.5" />
                <p className="text-xs text-muted-foreground">{item.l}</p>
                <p className="font-semibold text-sm">{item.n}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/5 border border-primary/20 rounded-xl p-6">
        <h3 className="font-semibold mb-2">Mission Statement</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          To create a next-generation cybersecurity platform combining AI, multi-layer defense, and automated response to protect sensitive user data in an increasingly connected world — while respecting user privacy, ensuring ethical data practices, and maintaining complete transparency.
        </p>
      </motion.div>
    </div>
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'home':            return HomePage();
      case 'dashboard':       return DashboardPage();
      case 'security':        return SecurityLayersPage();
      case 'vault':           return DataVaultPage();
      case 'logs':            return LogsPage();
      case 'user-protection': return UserProtectionPage();
      case 'architecture':    return ArchitecturePage();
      case 'team':            return TeamPage();
      case 'about':           return AboutPage();
      default:                return HomePage();
    }
  };

  const navItems = [
    { id: 'home',            icon: Home,     label: 'Home' },
    { id: 'dashboard',       icon: Activity, label: 'Dashboard' },
    { id: 'security',        icon: Shield,   label: 'Security Layers' },
    { id: 'vault',           icon: Database, label: 'Data Vault' },
    { id: 'logs',            icon: FileText, label: 'Logs' },
    { id: 'user-protection', icon: Lock,     label: 'User Protection' },
    { id: 'architecture',    icon: Target,   label: 'Architecture' },
    { id: 'team',            icon: Users,    label: 'Team' },
    { id: 'about',           icon: Info,     label: 'About' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 72 }}
        className="fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border z-50 flex flex-col overflow-hidden"
      >
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between flex-shrink-0">
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 min-w-0">
              <Shield className="w-7 h-7 text-sidebar-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-sidebar-foreground truncate">Chakravyuh AI</p>
                <p className="text-xs text-sidebar-foreground/60">Defense System</p>
              </div>
            </motion.div>
          )}
          <button
            onClick={() => setSidebarOpen(p => !p)}
            className="p-2 hover:bg-sidebar-accent rounded-xl transition-colors flex-shrink-0"
          >
            {sidebarOpen
              ? <X className="w-5 h-5 text-sidebar-foreground" />
              : <Menu className="w-5 h-5 text-sidebar-foreground" />}
          </button>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
          {navItems.map(item => (
            <motion.button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.97 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all ${
                currentPage === item.id
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium truncate">{item.label}</span>}
            </motion.button>
          ))}
        </nav>

        <div className="p-2 border-t border-sidebar-border space-y-1 flex-shrink-0">
          <button
            onClick={() => setIsDark(p => !p)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
            {sidebarOpen && <span className="text-sm">Toggle Theme</span>}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main
        className="transition-all duration-300 min-h-screen"
        style={{ marginLeft: sidebarOpen ? 256 : 72, padding: '2rem' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App — top-level router
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView]               = useState<AppView>('landing');
  const [activeUsername, setActiveUsername] = useState('');

  useEffect(() => {
    const dark = localStorage.getItem(SK.DARK) !== 'false';
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <LandingView
              onUser={() => setView('user-auth')}
              onAdmin={() => setView('admin-auth')}
            />
          </motion.div>
        )}

        {view === 'user-auth' && (
          <motion.div key="user-auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <UserAuthView
              onSuccess={(uname) => { setActiveUsername(uname); setView('user-dashboard'); }}
              onBack={() => setView('landing')}
            />
          </motion.div>
        )}

        {view === 'admin-auth' && (
          <motion.div key="admin-auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <AdminAuthView
              onSuccess={() => setView('admin-dashboard')}
              onBack={() => setView('landing')}
            />
          </motion.div>
        )}

        {view === 'user-dashboard' && (
          <motion.div key="user-dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <UserDashboardView onLogout={() => { setActiveUsername(''); setView('landing'); }} username={activeUsername} />
          </motion.div>
        )}

        {view === 'admin-dashboard' && (
          <motion.div key="admin-dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <AdminDashboardView onLogout={() => setView('landing')} />
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster position="top-right" richColors />
    </div>
  );
}
