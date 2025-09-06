export default function Logo({ size = 32, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.25 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <defs>
          <linearGradient id="leadujGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect 
          x="2" 
          y="2" 
          width="28" 
          height="28" 
          rx="12" 
          fill="url(#leadujGrad)" 
          filter="url(#glow)"
          style={{
            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)'
          }}
        />
        <path 
          d="M10 8v16a2 2 0 0 0 2 2h8" 
          stroke="white" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        <circle cx="22" cy="24" r="2" fill="white" />
      </svg>
      {showText && (
        <span style={{ 
          fontWeight: 800, 
          letterSpacing: -0.02,
          fontSize: size * 0.5,
          color: 'inherit',
          fontFamily: 'Inter, sans-serif',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
        }}>
          leaduj
        </span>
      )}
    </div>
  )
}


