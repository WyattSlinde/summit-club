/** Original vector lettering: the two M peaks echo the trail's granite ridgeline. */
export function SummitWordmark({ className = '' }: { className?: string }) {
  return <svg className={`summit-wordmark ${className}`} viewBox="0 0 612 124" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M85 0H20L0 20V54L20 73H58V99H0V124H66L87 103V67L67 48H29V25H85Z"/>
    <path d="M104 0H132V91Q132 100 145 100Q158 100 158 91V0H186V95Q186 124 145 124Q104 124 104 95Z"/>
    <path d="M205 124V25L230 0L255 49L280 0L305 25V124H277V53L255 91L233 53V124Z"/>
    <path d="M324 124V25L349 0L374 49L399 0L424 25V124H396V53L374 91L352 53V124Z"/>
    <path d="M445 0H474V124H445Z"/>
    <path d="M493 0H612V26H567V124H538V26H493Z"/>
  </svg>;
}

export function SummitMark({ className = '' }: { className?: string }) {
  return <svg className={`summit-mark ${className}`} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    <circle cx="46" cy="15" r="6" fill="currentColor"/>
    <path d="M4 48 25 13 40 37 47 27 60 48H4Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
    <path d="m19 24 6 6 5-8M30 57l10-11-13-6 8-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
