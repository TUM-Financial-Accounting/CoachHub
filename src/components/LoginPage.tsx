import { useState, useEffect, useRef } from 'react';
import { Trophy, Mail, Lock, AlertCircle, User, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// UI Components
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { AuthService, AuthResponse } from '../services';
import { bootPrefetch } from '../lib/bootPrefetch';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); // Name field for Registration
  const [isRegister, setIsRegister] = useState(false);
  
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const hasVerified = useRef(false);

  // Detect Tokens on Mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const verifyToken = params.get('verify_token');

    if (token) {
      setResetToken(token);
      setIsResetPassword(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (verifyToken && !hasVerified.current) {
      hasVerified.current = true;
      setLoading(true);
      AuthService.verifyEmail(verifyToken)
        .then(res => {
          toast.success(res.message);
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(err => {
          setError(err.message || 'Verification failed');
          toast.error(err.message || 'Verification failed');
        })
        .finally(() => setLoading(false));
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
    if (isRegister) {
      if (!fullName) {
        setError('Please enter your full name');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
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
        toast.success('Account created! Please check your email to verify your account before signing in.');
        console.log("[LoginPage] Switching to Login view...");
        setIsRegister(false); // Redirect to Login view
        setFullName('');
        setPassword('');
        setConfirmPassword('');
      } else {
        const response = data as AuthResponse;
        console.log(`[LoginPage] Welcome back, ${response.user.full_name || 'Coach'}!`);
        toast.success(`Welcome back, ${response.user.full_name || 'Coach'}!`);

        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('user', JSON.stringify(response.user));

        // Keep the Sign In button in its loading state until the data the
        // dashboard needs has been fetched. Avoids dropping the user into
        // a half-loaded dashboard with empty cards.
        await bootPrefetch.primeAfterLogin();

        console.log("[LoginPage] Calling onLogin()...");
        onLogin();
      }

    } catch (err: any) {
      console.error(`[LoginPage] Error during ${isRegister ? 'Register' : 'Login'}:`, err);
      // Fallback message if err.message is empty or weird
      const msg = err.message || 'Connection failed. Please check if the backend is online.';
      setError(msg);
      toast.error(msg);
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
    if (!newPassword || !confirmNewPassword) {
      setError('Please fill in all fields');
      toast.error('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await AuthService.resetPassword({ token: resetToken, new_password: newPassword });
      toast.success(res.message);
      setIsResetPassword(false);
      setResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-background relative overflow-hidden">

      {/* Background Blobs */}
      <div className="fixed top-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* LEFT: Branding / Hero Panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800">
        {/* Decorative pitch lines */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white rounded-full" />
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full text-white">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3"
          >
            <div className="bg-white/15 backdrop-blur-sm p-3 rounded-2xl border border-white/20">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">CoachHub</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-xl"
          >
            <h1 className="text-5xl xl:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              The complete platform for football coaches.
            </h1>
            <p className="text-lg xl:text-xl text-white/80 leading-relaxed">
              Plan training, manage your squad, run match-day, and turn data into decisions — all in one place.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-8 text-sm text-white/60"
          >
            <span>Players · Sessions · Matches · Tactics</span>
          </motion.div>
        </div>
      </div>

      {/* RIGHT: Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-10 relative z-10">
        <Card animate delay={0.1} className="w-full max-w-md p-6 sm:p-8 border-border bg-surface">

        {/* Logo & Header (mobile only — hero handles desktop) */}
        <div className="flex flex-col items-center mb-8 lg:hidden">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-xl shadow-blue-500/20 mb-6"
          >
            <Trophy className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">CoachHub</h1>
        </div>

        {/* Subtitle */}
        <div className="mb-6 hidden lg:block">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            {isResetPassword
              ? 'Set new password'
              : isForgotPassword
                ? 'Reset password'
                : isRegister
                  ? 'Create your account'
                  : 'Welcome back'}
          </h2>
          <p className="text-muted mt-2 font-medium">
            {isResetPassword
              ? 'Choose a strong password you haven\'t used before.'
              : isForgotPassword
                ? 'We\'ll email you a link to reset your password.'
                : isRegister
                  ? 'Start your coaching journey today.'
                  : 'Sign in to your CoachHub account.'}
          </p>
        </div>
        <div className="text-center mb-8 lg:hidden">
          <p className="text-muted font-medium">
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
             <Input
                label="New Password"
                type="password"
                icon={<Lock size={16} />}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); if (error) setError(''); }}
              />
              <Input
                label="Confirm New Password"
                type="password"
                icon={<Lock size={16} />}
                placeholder="••••••••"
                value={confirmNewPassword}
                onChange={(e) => { setConfirmNewPassword(e.target.value); if (error) setError(''); }}
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
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on" noValidate>

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
                  <div className="pb-4">
                    <Input
                      label="Full Name"
                      type="text"
                      icon={<User size={16} />}
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
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
                autoComplete="new-password"
                className={error ? "border-red-500/50" : ""}
              />
              {isRegister && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-4"
                >
                  <Input
                    label="Confirm Password"
                    type="password"
                    icon={<Lock size={16} />}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className={error ? "border-red-500/50" : ""}
                  />
                </motion.div>
              )}
              {!isRegister && (
                <div className="flex justify-end pt-1">
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
          <div className="mt-5 text-center border-t border-border pt-4">
            <p className="text-muted text-sm mb-2">
              {isRegister ? "Already have an account?" : "Don't have an account?"}
            </p>
            <Button
              variant="ghost"
              onClick={() => { 
                setIsRegister(!isRegister); 
                setError(''); 
                setFullName(''); 
                setConfirmPassword('');
                setPassword('');
              }}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 w-full"
            >
              {isRegister ? 'Sign in instead' : "Create an account"}
            </Button>
          </div>
        )}

        </Card>
      </div>
    </div>
  );
}