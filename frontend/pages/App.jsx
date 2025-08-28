import { useParams } from 'react-router-dom';
import { CesiumProvider } from '../context/CesiumContext';
import CesiumViewer from '../components/CesiumViewer';
import CardContainer from '../components/ui/CardContainer';
import Card from '../components/ui/Card';
import KentasLogoWhite from '/KentasLogoWhite.png';
import './App.css';

function LogoIcon({ className = '' }) {
  return (
    <img src={KentasLogoWhite} alt="Kentaş Logo" className={className} />
  );
}

export default function App() {
  const { projectId } = useParams();
  return (
    <CesiumProvider projectId={Number(projectId) || 1}>
      <div className="w-full h-screen bg-gray-900 dark overflow-hidden relative">
        <header className="pointer-events-none fixed top-3 inset-x-3 z-30">
          <div className="pointer-events-auto mx-auto w-[min(92vw,1120px)] rounded-2xl border border-slate-800/70 bg-black/30 backdrop-blur-md ring-1 ring-inset ring-white/10 shadow-xl px-5 py-3">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4">
              <LogoIcon className="h-10 w-auto object-contain" />
              <div />
              <div className="text-xs sm:text-sm font-medium text-slate-200">Erden Erim Aydoğdu</div>
            </div>
          </div>
        </header>
        <main className="relative w-full h-full">
          <CesiumViewer projectId={Number(projectId) || 1} />
          <CardContainer projectId={Number(projectId) || 1} />
        </main>
      </div>
    </CesiumProvider>
  );
}
