export default function Logo({ size = 37, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.25 }}>
      <img src="/atomic_logo.png" alt="leaduj" width={size} height={size} style={{ display: 'block', borderRadius: size * 0.2 }} />
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


