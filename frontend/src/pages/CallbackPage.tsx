import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const CallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      checkUser().then(() => {
        navigate('/dashboard');
      });
    } else {
      navigate('/login?error=no_token');
    }
  }, [searchParams, checkUser, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0b0d] text-slate-100">
      <div className="flex flex-col items-center gap-4 glass p-8 rounded-2xl max-w-sm w-full text-center">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
        <h2 className="text-xl font-semibold tracking-wide font-sans text-indigo-400">Authenticating with Google</h2>
        <p className="text-sm text-slate-400">Securing your session. Please wait...</p>
      </div>
    </div>
  );
};
export default CallbackPage;
