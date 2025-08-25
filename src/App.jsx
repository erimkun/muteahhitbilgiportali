import CesiumViewer from './components/CesiumViewer';
import CardContainer from './components/ui/CardContainer';
import Card from './components/ui/Card';
import KentasLogoWhite from '/KentasLogoWhite.png';

function LogoIcon({ className = '' }) {
  return (
    <img src={KentasLogoWhite} alt="Kentaş Logo" className={className} />
  );
}

export default function App() {
  return (
    <div className="w-full h-screen bg-gray-900 dark overflow-hidden relative">
      {/* Glass header overlay */}
      <header className="pointer-events-none fixed top-3 inset-x-3 z-30">
        <div className="pointer-events-auto mx-auto w-[min(92vw,1120px)] rounded-2xl border border-slate-800/70 bg-black/30 backdrop-blur-md ring-1 ring-inset ring-white/10 shadow-xl px-5 py-3">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4">
            <LogoIcon className="h-8 w-8 sm:h-10 sm:w-10" />
            <div className="text-center">
              <h1 className="text-sm sm:text-lg md:text-xl font-light tracking-wide text-white/90">
                Kentaş
              </h1>
            </div>
            <div className="text-xs sm:text-sm font-medium text-slate-200">Erden Erim Aydoğdu</div>
          </div>
        </div>
      </header>
      <main className="relative w-full h-full">
        <CesiumViewer />
        <CardContainer />
      </main>
    </div>
  );
}
