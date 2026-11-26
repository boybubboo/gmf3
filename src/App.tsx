import { EditorShell } from './components/shared/EditorShell';
import { ProjectBrowser } from './components/shared/ProjectBrowser';
import { useMakerStore } from './store/useMakerStore';

export default function App() {
  const store = useMakerStore();

  if (store.currentProject) {
    return <EditorShell store={store} />;
  }

  return <ProjectBrowser store={store} />;
}
