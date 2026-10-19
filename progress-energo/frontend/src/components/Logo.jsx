// Фирменный знак: шестигранник (инженерия, «гайка») + молния-стрелка вверх (энергия и прогресс).
export function LogoMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="pe-bolt" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#F26B1D" />
          <stop offset="1" stopColor="#FFB020" />
        </linearGradient>
      </defs>
      <path d="M24 2.5 42.6 13.25v21.5L24 45.5 5.4 34.75v-21.5Z" fill="var(--brand)" />
      <path d="M24 7.2 38.5 15.6v16.8L24 40.8 9.5 32.4V15.6Z" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.2" />
      <path d="M27.5 9.5 15.5 26.5h7.2l-2.4 12 12.2-17h-7.3l2.3-12Z" fill="url(#pe-bolt)" />
    </svg>
  )
}

export default function Logo({ compact = false }) {
  return (
    <div className="logo">
      <LogoMark size={compact ? 34 : 42} />
      {!compact && (
        <div className="logo-text">
          <div className="logo-name">ПРОГРЕСС<span>ЭНЕРГО</span></div>
          <div className="logo-sub">ВПК · Конвейер ИД</div>
        </div>
      )}
    </div>
  )
}
