'use client'

import React, { useState } from 'react'
import { Cross, Eye, EyeOff, LogIn, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface LoginPageProps {
  onLogin: (user: { id: string; name: string; email: string | null; role: string }) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [capsLock, setCapsLock] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email/username and password')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        onLogin(data.user)
        toast.success(`Welcome, ${data.user.name}!`)
      } else {
        setError(data.error || 'Login failed')
        if (res.status === 401) {
          toast.error('Invalid credentials')
        } else if (res.status === 403) {
          toast.error('Account deactivated')
        }
      }
    } catch {
      setError('Network error. Please try again.')
      toast.error('Connection failed')
    } finally {
      setLoading(false)
    }
  }

  const checkCapsLock = (e: React.KeyboardEvent) => {
    setCapsLock(e.getModifierState('CapsLock'))
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: '#002040' }}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.03) 40px, rgba(255,255,255,0.03) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.03) 40px, rgba(255,255,255,0.03) 41px)',
      }} />

      {/* Login Card */}
      <div className="relative w-full max-w-md mx-4">
        {/* Logo Section */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#0055AA] mb-4 shadow-lg shadow-blue-900/30">
            <Cross className="h-12 w-12 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">PharmaCare ERP</h1>
          <p className="text-sm text-blue-200/70 mt-1">Pharmacy Management System</p>
          <div className="text-[10px] text-blue-300/40 mt-0.5">Powered by MARG ERP 9+ Technology</div>
        </div>

        {/* Login Form */}
        <div className="rounded-xl border border-[#1A5276] bg-[#003060] shadow-2xl shadow-black/30 overflow-hidden">
          {/* Header bar */}
          <div className="px-6 py-3 bg-[#004080] border-b border-[#1A5276]">
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-blue-200" />
              <span className="text-sm font-semibold text-white">Staff Login</span>
            </div>
            <p className="text-[10px] text-blue-200/60 mt-0.5">Enter your credentials to access the system</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <span className="text-xs text-red-300">{error}</span>
              </div>
            )}

            {/* Email/Username */}
            <div>
              <label className="block text-[10px] font-semibold text-blue-200/80 uppercase tracking-wider mb-1.5">
                Email or Username
              </label>
              <input
                type="text"
                className="w-full px-3 py-2.5 rounded-lg bg-[#002040] border border-[#1A5276] text-sm text-white placeholder-blue-300/30 focus:outline-none focus:border-[#3399FF] focus:ring-1 focus:ring-[#3399FF]/30 transition-colors"
                placeholder="Enter email or staff name"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                onKeyDown={checkCapsLock}
                autoComplete="username"
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-semibold text-blue-200/80 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[#002040] border border-[#1A5276] text-sm text-white placeholder-blue-300/30 focus:outline-none focus:border-[#3399FF] focus:ring-1 focus:ring-[#3399FF]/30 transition-colors"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  onKeyDown={checkCapsLock}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-300/50 hover:text-blue-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {capsLock && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3 text-amber-400" />
                  <span className="text-[10px] text-amber-400">Caps Lock is ON</span>
                </div>
              )}
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0077EE] active:bg-[#0055AA] text-sm font-semibold text-white shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              )}
            </button>

            {/* Hint */}
            <div className="text-center pt-2">
              <p className="text-[10px] text-blue-300/40">
                First time? Add staff members in Settings then login
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="text-[10px] text-blue-300/30">
            PharmaCare Store Management v9.14.2
          </p>
        </div>
      </div>
    </div>
  )
}
