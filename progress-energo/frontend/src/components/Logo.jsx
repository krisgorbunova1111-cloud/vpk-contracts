// Логотип ООО ВПК «Прогресс Энерго» (перерисован в SVG по фирменному logo.png):
// белый «гранёный» треугольник + ВПК + тонкая надпись ПРОГРЕСС ЭНЕРГО.
import { useId } from 'react'

export function LogoMark({ size = 40, color = '#fff' }) {
  const id = 'vpk-cut' + useId().replace(/:/g, '')
  return (
    <svg width={size * 0.92} height={size} viewBox="0 0 215 235" aria-hidden="true">
      <mask id={id}>
        <polygon points="0,0 122,0 215,235 0,235" fill="#fff" />
        <g stroke="#000" strokeWidth="9">
          <line x1="20" y1="-4" x2="168" y2="110" />
          <line x1="72" y1="-4" x2="-4" y2="118" />
          <line x1="-4" y1="196" x2="190" y2="164" />
        </g>
      </mask>
      <rect width="215" height="235" fill={color} mask={`url(#${id})`} />
    </svg>
  )
}

export default function Logo({ compact = false }) {
  return (
    <div className="logo">
      <LogoMark size={compact ? 30 : 38} />
      {!compact && (
        <>
          <div className="logo-vpk">ВПК</div>
          <div className="logo-name">ПРОГРЕСС<br />ЭНЕРГО</div>
        </>
      )}
    </div>
  )
}

export const APP_NAME = 'ВПК Платформа'
