import { render } from 'preact';
import './fonts';
import './ui/styles.css';
import { App } from './ui/App';
import { initCloudSave } from './game/cloud';
import { migrate } from './game/state';
import { getState, replaceState } from './game/store';

// In the claude.ai viewer, keep the running game across page updates.
const hot = (window as any).claude?.hot;
try {
  hot?.snapshot?.(() => ({ save: getState() }));
} catch {
  /* no hot-reload hook here */
}

function start(data: { save?: unknown } = {}) {
  if (data?.save && typeof data.save === 'object') replaceState(migrate(data.save));
  render(<App />, document.getElementById('app')!);
  void initCloudSave();
}

if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
