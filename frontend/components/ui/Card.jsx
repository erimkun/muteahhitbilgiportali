import React from 'react';

const colorClasses = {
  rose: 'bg-rose-400/10 ring-rose-300/15 border-rose-300/20 hover:bg-rose-400/15',
  sky: 'bg-sky-400/10 ring-sky-300/15 border-sky-300/20 hover:bg-sky-400/15',
  emerald: 'bg-emerald-400/10 ring-emerald-300/15 border-emerald-300/20 hover:bg-emerald-400/15',
  violet: 'bg-violet-400/10 ring-violet-300/15 border-violet-300/20 hover:bg-violet-400/15',
  slate: 'bg-white/10 ring-white/10 border-slate-800/70 hover:bg-white/15',
  amber: 'bg-amber-400/10 ring-amber-300/15 border-amber-300/20 hover:bg-amber-400/15',
  indigo: 'bg-indigo-400/10 ring-indigo-300/15 border-indigo-300/20 hover:bg-indigo-400/15',
  cyan: 'bg-cyan-400/10 ring-cyan-300/15 border-cyan-300/20 hover:bg-cyan-400/15',
  fuchsia: 'bg-fuchsia-400/10 ring-fuchsia-300/15 border-fuchsia-300/20 hover:bg-fuchsia-400/15',
  lime: 'bg-lime-400/10 ring-lime-300/15 border-lime-300/20 hover:bg-lime-400/15',
};

export default function Card({ title, subtitle, icon: Icon, actions = [], color = 'slate' }) {
  return (
    <div className={`snap-center min-w-full sm:min-w-[320px] lg:min-w-[360px] rounded-xl border ring-1 ring-inset backdrop-blur-xl p-4 flex flex-col gap-3 hover:-translate-y-0.5 transition-all duration-300 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg tracking-tight font-semibold text-white">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-300/90">{subtitle}</p>}
        </div>
  {Icon ? <Icon className="h-[18px] w-[18px] text-slate-200" /> : null}
      </div>
      <div className="flex items-center gap-2">
        {actions.map((a, idx) => (
          <a
            key={idx}
            href={a.href || '#'}
            download={a.download}
            onClick={(e) => {
              if (a.onClick) return a.onClick(e);
              if (a.disabled || (!a.href && !a.onClick)) {
                e.preventDefault();
              }
            }}
            className={`group inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border backdrop-blur-md shadow-sm shadow-black/5 active:scale-[0.98] transition ${a.primary ? 'bg-white/10 text-white border-white/15 hover:bg-white/15 hover:border-white/20 ring-1 ring-inset ring-white/10' : 'bg-white/5 text-white border-white/10 hover:bg-white/10 ring-1 ring-inset ring-white/5'} ${(a.disabled || (!a.href && !a.onClick)) ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30`}
          >
            {a.icon ? <a.icon className="h-[18px] w-[18px] text-white" /> : null}
            <span className="text-sm font-medium text-white">{a.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
