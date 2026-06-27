import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        <AnimatePresence mode="wait">
          {isLogin ? (
            <LoginForm key="login" onSwitch={() => setIsLogin(false)} />
          ) : (
            <RegisterForm key="register" onSwitch={() => setIsLogin(true)} />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
