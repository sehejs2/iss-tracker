import { useISSData } from './hooks/useISSData';
import { ISSMap } from './components/ISSMap';
import { PassPrediction } from './components/PassPrediction';

export default function App() {
  const { position, trail, connected } = useISSData();

  return (
    <div className="app">
      <header className="app-header">
        <h1>ISS Tracker</h1>
        {position && (
          <span className="coords">
            {position.latitude.toFixed(3)}°, {position.longitude.toFixed(3)}°
          </span>
        )}
      </header>
      <main className="app-body">
        <ISSMap position={position} trail={trail} connected={connected} />
        <aside className="sidebar">
          <PassPrediction />
        </aside>
      </main>
    </div>
  );
}
