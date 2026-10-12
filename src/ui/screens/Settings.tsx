import { useEffect, useState } from 'preact/hooks';
import { cloudStatus, onCloudStatus, type CloudStatus } from '../../game/cloud';
import { resetGame, updateSettings, useGame } from '../../game/store';

const CLOUD_TEXT: Record<CloudStatus, string> = {
  off: 'This device only',
  connecting: 'Connecting…',
  synced: 'Saved to your Claude account',
  saving: 'Saving…',
  error: 'This device only (cloud save unavailable)',
};
import { Modal } from '../components/common';

export function Settings({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [confirm, setConfirm] = useState(false);
  const [cloud, setCloud] = useState(cloudStatus());
  useEffect(() => {
    const off = onCloudStatus(() => setCloud(cloudStatus()));
    return () => {
      off();
    };
  }, []);
  return (
    <Modal center onClose={onClose}>
      <h2 class="panel-title">Settings</h2>
      <div class="spread" style={{ padding: '6px 0' }}>
        <b>Sound effects</b>
        <button class={`toggle ${s.settings.sound ? 'on' : ''}`} onClick={() => updateSettings({ sound: !s.settings.sound })}>
          {s.settings.sound ? 'ON' : 'OFF'}
        </button>
      </div>
      <div class="spread" style={{ padding: '6px 0' }}>
        <b>Auto ultimates</b>
        <button class={`toggle ${s.settings.autoUlt ? 'on' : ''}`} onClick={() => updateSettings({ autoUlt: !s.settings.autoUlt })}>
          {s.settings.autoUlt ? 'ON' : 'OFF'}
        </button>
      </div>
      <div class="spread" style={{ padding: '6px 0' }}>
        <b>Auto-advance stages</b>
        <button class={`toggle ${s.settings.autoAdvance ? 'on' : ''}`} onClick={() => updateSettings({ autoAdvance: !s.settings.autoAdvance })}>
          {s.settings.autoAdvance ? 'ON' : 'OFF'}
        </button>
      </div>
      <div class="spread" style={{ padding: '6px 0' }}>
        <b>Progress</b>
        <span class="small-text" style={{ color: cloud === 'synced' || cloud === 'saving' ? 'var(--green)' : 'var(--muted)' }}>
          {cloud === 'synced' || cloud === 'saving' ? '☁ ' : ''}
          {CLOUD_TEXT[cloud]}
        </span>
      </div>
      <div class="small-text muted" style={{ margin: '8px 0 12px' }}>
        Battles won: {s.stats.wins} · Summons: {s.stats.pulls} · Ultimates: {s.stats.ults}
      </div>
      {confirm ? (
        <div class="row">
          <button class="btn dark small" onClick={() => setConfirm(false)}>
            Cancel
          </button>
          <button
            class="btn red small"
            style={{ flex: 1 }}
            onClick={() => {
              resetGame();
              onClose();
            }}
          >
            Yes, erase everything
          </button>
        </div>
      ) : (
        <button class="btn red small block" onClick={() => setConfirm(true)}>
          Reset progress
        </button>
      )}
      <p class="disclaimer" style={{ marginTop: 14 }}>
        Grimoire Squads is an unofficial fan-made game. Black Clover and its characters belong to Yūki Tabata / Shueisha. Not affiliated with or endorsed by the rights holders.
      </p>
    </Modal>
  );
}
