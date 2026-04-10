import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      localStorage.setItem('auth_token', token);
      navigate('/', { replace: true });
    } else {
      navigate(`/login?error=${error || 'unknown'}`, { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400 text-sm">登入中...</div>
    </div>
  );
}
