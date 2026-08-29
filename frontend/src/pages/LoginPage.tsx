import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, devLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For local testing, any email/password triggers the mock developer login bypass!
    devLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Login Card */}
      <div className="w-full max-w-md bg-white p-10 rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        
        {/* Title */}
        <h1 className="text-3xl font-bold text-slate-800 text-center tracking-tight mb-8">
          Login
        </h1>

        {/* Google OAuth Login Button */}
        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-2 bg-[#e8f5e9] hover:bg-[#c8e6c9] text-[#2e7d32] font-semibold py-3 px-4 rounded-xl border border-[#c8e6c9] transition-all duration-150 active:scale-[0.98]"
        >
          {/* Google Icon SVG */}
          <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <path d="M21.35,11.1H12v2.7h5.38C16.88,16.63,14.77,18,12,18c-3.31,0-6-2.69-6-6s2.69-6,6-6c1.47,0,2.81,0.53,3.85,1.41l2.02-2.02C16.14,3.77,14.18,3,12,3C7.03,3,3,7.03,3,12s4.03,9,9,9c4.78,0,8.65-3.48,8.65-9C20.65,11.66,20.52,11.37,21.35,11.1z" fill="#4285F4"/>
            <path d="M3.18,7.74L5.68,9.7C6.35,7.96,8.03,6.75,10,6.75c1.47,0,2.81,0.53,3.85,1.41l2.02-2.02C14.14,4.42,12.18,3.65,10,3.65C7.03,3.65,4.42,5.29,3.18,7.74z" fill="#EA4335"/>
            <path d="M12,20.35c3.31,0,6-2.69,6-6c0-0.47-0.06-0.92-0.16-1.36h-5.84v2.72h3.18C14.5,17.25,12.82,18,10.92,18C8.96,18,7.28,16.79,6.61,15.05l-2.5,1.96C5.35,19.38,8.42,20.35,12,20.35z" fill="#34A853"/>
            <path d="M5.68,14.3l-2.5,1.96C2.2,14.73,1.65,12.92,1.65,11s0.55-3.73,1.53-5.26l2.5,1.96C5.01,9.04,4.65,10,4.65,11S5.01,12.96,5.68,14.3z" fill="#FBBC05"/>
          </svg>
          Login with Google
        </button>

        {/* Separator */}
        <div className="flex items-center my-6 w-full">
          <hr className="flex-grow border-slate-200" />
          <span className="px-3 text-xs text-slate-400 font-medium">or sign up through email</span>
          <hr className="flex-grow border-slate-200" />
        </div>

        {/* Email Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              required
              placeholder="Email ID"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#f4f6f8] border border-transparent rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-slate-100 focus:border-slate-300 transition-all"
            />
          </div>

          <div>
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#f4f6f8] border border-transparent rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-slate-100 focus:border-slate-300 transition-all"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#00a854] hover:bg-[#008f47] text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-all duration-150 active:scale-[0.98] mt-6"
          >
            Login
          </button>
        </form>

        {/* Developer Bypass Tip */}
        <div className="mt-8 text-center text-[10px] text-slate-400 font-semibold tracking-wide uppercase">
          Dev Mock Bypass Enabled: Any credentials will log in
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
