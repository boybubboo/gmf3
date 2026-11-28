import { AppPasswordGate } from './components/shared/AppPasswordGate';
import { EditorShell } from './components/shared/EditorShell';
import { ProjectBrowser } from './components/shared/ProjectBrowser';
import { useMakerStore } from './store/useMakerStore';
import { HudSvgFilters } from './utils/hudMaterials';

export default function App() {
  const store = useMakerStore();

  return (
    <AppPasswordGate>
      <HudSvgFilters />
      {store.currentProject ? (
        <EditorShell store={store} />
      ) : (
        <ProjectBrowser store={store} />
      )}
    </AppPasswordGate>
  );
}

