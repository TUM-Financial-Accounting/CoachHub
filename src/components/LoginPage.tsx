import { useState, useEffect } from 'react';
import { Trophy, Mail, Lock, AlertCircle, User, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// UI Components
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { AuthService, AuthResponse } from '../services';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); // Name field for Registration
  const [isRegister, setIsRegister] = useState(false);
  
  // New States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Detect Reset Token on Mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setIsResetPassword(true);
      // Clean up URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; 

    console.log(`[LoginPage] Form submitted. Mode: ${isRegister ? 'Register' : 'Login'}`);
    setError('');
    setLoading(true);

    // 1. Basic Validation
    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }
    if (isRegister && !fullName) {
      setError('Please enter your full name');
      setLoading(false);
      return;
    }

    try {
      const payload = isRegister
        ? { email, password, full_name: fullName }
        : { email, password };

      console.log(`[LoginPage] Calling AuthService.${isRegister ? 'register' : 'login'}...`);
      const data = isRegister
        ? await AuthService.register(payload)
        : await AuthService.login(payload);

      console.log(`[LoginPage] ${isRegister ? 'Register' : 'Login'} Success:`, data);

      // Success Action
      if (isRegister) {
        toast.success('Account created! Please sign in.');
        console.log("[LoginPage] Switching to Login view...");
        setIsRegister(false); // Redirect to Login view
        setFullName('');
        setPassword('');
      } else {
        const response = data as AuthResponse;
        console.log(`[LoginPage] Welcome back, ${response.user.full_name || 'Coach'}!`);
        toast.success(`Welcome back, ${response.user.full_name || 'Coach'}!`);

        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify(response.user));

        console.log("[LoginPage] Calling onLogin()...");
        onLogin();
      }

    } catch (err: any) {
      console.error(`[LoginPage] Error during ${isRegister ? 'Register' : 'Login'}:`, err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      console.log("[LoginPage] Finally: Setting loading to false.");
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await AuthService.forgotPassword(email);
      toast.success(res.message);
      setIsForgotPassword(false);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setError('Please enter a new password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await AuthService.resetPassword({ token: resetToken, new_password: newPassword });
      toast.success(res.message);
      setIsResetPassword(false);
      setResetToken('');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#0b0f19]">

      {/* Background Blobs */}
      <div className="fixed top-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Glass Card Container */}
      <Card animate delay={0.1} className="w-full max-w-md p-8 sm:p-10 z-10 border-white/10 bg-slate-900/60">

        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-xl shadow-blue-500/20 mb-6"
          >
            <Trophy className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight">CoachHub</h1>
          <p className="text-slate-400 mt-2 text-center font-medium">
            {isResetPassword 
              ? 'Set your new password' 
              : isForgotPassword 
                ? 'Reset your password' 
                : isRegister 
                  ? 'Start your coaching journey' 
                  : 'Welcome back to the pitch'}
          </p>
        </div>

        {isResetPassword ? (
          <form onSubmit={handleResetPassword} className="space-y-6">
             <Input
                label="New Password"
                type="password"
                icon={<Lock size={16} />}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button type="submit" className="w-full shadow-lg shadow-blue-600/20" isLoading={loading}>
                Reset Password
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setIsResetPassword(false)} 
                className="w-full text-slate-500"
              >
                Back to login
              </Button>
          </form>
        ) : isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-6">
             <Input
                label="Email Address"
                type="email"
                icon={<Mail size={16} />}
                placeholder="coach@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" className="w-full shadow-lg shadow-blue-600/20" isLoading={loading}>
                Send Reset Link
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setIsForgotPassword(false)} 
                className="w-full text-slate-500"
                icon={<ArrowLeft size={16} />}
              >
                Back to login
              </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Error Message Animation */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 text-red-400 overflow-hidden"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Full Name Field (Only for Registration) */}
            <AnimatePresence>
              {isRegister && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <Input
                    label="Full Name"
                    type="text"
                    icon={<User size={16} />}
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mb-6"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <Input
              label="Email Address"
              type="email"
              icon={<Mail size={16} />}
              placeholder="coach@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={error ? "border-red-500/50" : ""}
            />

            <div className="space-y-1">
              <Input
                label="Password"
                type="password"
                icon={<Lock size={16} />}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={error ? "border-red-500/50" : ""}
              />
              {!isRegister && (
                <div className="flex justify-end">
                  <button 
                    type="button" 
                    onClick={() => { setIsForgotPassword(true); setError(''); }}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full shadow-lg shadow-blue-600/20" isLoading={loading}>
              {isRegister ? 'Create Account' : 'Sign In'}
            </Button>

          </form>
        )}

        {/* Toggle Register/Login */}
        {!isForgotPassword && !isResetPassword && (
          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <p className="text-slate-500 text-sm mb-3">
              {isRegister ? "Already have an account?" : "Don't have an account?"}
            </p>
            <Button
              variant="ghost"
              onClick={() => { setIsRegister(!isRegister); setError(''); setFullName(''); }}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 w-full"
            >
              {isRegister ? 'Sign in instead' : "Create an account"}
            </Button>
          </div>
        )}

      </Card>
    </div>
  );
}