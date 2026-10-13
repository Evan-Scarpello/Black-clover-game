import { useEffect, useState } from 'preact/hooks';
import { cloudStatus, onCloudStatus, type CloudStatus } from '../../game/cloud';
import { resetGame, updateSettings, useGame } from '../../game/store';
import { Modal, useModalClose } from '../components/common';
import { haptic } from '../haptics';
import { motionPref, onPrefsChange, setMotionPref, setVibrationEnabled, vibrationEnabled } from '../prefs';
import { sfx } from '../sfx';
import './settings.css';

const CLOUD_TEXT: Record<CloudStatus, string> = {
  off: 'This device only',
  connecting: 'Connecting…',
  synced: 'Saved to your Claude account',
  saving: 'Saving…',
  error: 'This device only (cloud save unavailable)',
};

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div class="spread set-row">
      <div class="set-label">
        <b>{label}</b>
        {hint && <div class="small-text muted">{hint}</div>}
      </div>
      <button
        class={`toggle set-switch ${on ? 'on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => {
          onChange(!on);
          sfx.click();
        }}
      >
        <span class="set-knob" aria-hidden="true" />
        <span class="set-txt">{on ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );
}

function SettingsBody() {
  const s = useGame();
  const close = useModalClose();
  const [confirm, setConfirm] = useState(false);
  const [cloud, setCloud] = useState(cloudStatus());
  const [, bump] = useState(0);
  useEffect(() => {
    const off = onCloudStatus(() => setCloud(cloudStatus()));
    const offPrefs = onPrefsChange(() => bump((n) => n + 1));
    return () => {
      off();
      offPrefs();
    };
  }, []);
  const synced = cloud === 'synced' || cloud === 'saving';
  return (
    <>
      <h2 class="panel-title">Settings</h2>
      <div class="set-group">
        <Toggle label="Sound effects" on={s.settings.sound} onChange={(v) => updateSettings({ sound: v })} />
        <Toggle
          label="Vibration"
          hint="Buzz on big moments (on supported phones)"
          on={vibrationEnabled()}
          onChange={(v) => {
            setVibrationEnabled(v);
            if (v) haptic('medium');
          }}
        />
        <Toggle label="Reduce motion" hint="Fewer animations and transitions" on={motionPref() === 'reduce'} onChange={(v) => setMotionPref(v ? 'reduce' : 'system')} />
      </div>
      <div class="set-group">
        <Toggle label="Auto ultimates" on={s.settings.autoUlt} onChange={(v) => updateSettings({ autoUlt: v })} />
        <Toggle label="Auto-advance stages" on={s.settings.autoAdvance} onChange={(v) => updateSettings({ autoAdvance: v })} />
      </div>
      <div class="spread set-row">
        <b>Progress</b>
        <span class={`small-text set-cloud ${synced ? 'ok' : ''}`}>
          {synced ? '☁ ' : ''}
          {CLOUD_TEXT[cloud] ?? CLOUD_TEXT.off}
        </span>
      </div>
      <div class="small-text muted" style={{ margin: '8px 0 12px' }}>
        Battles won: {s.stats.wins} · Summons: {s.stats.pulls} · Ultimates: {s.stats.ults}
      </div>
      {confirm ? (
        <div class="row set-confirm">
          <button class="btn dark small" onClick={() => setConfirm(false)}>
            Cancel
          </button>
          <button
            class="btn red small"
            style={{ flex: 1 }}
            onClick={() => {
              resetGame();
              haptic('heavy');
              close();
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
    </>
  );
}

export function Settings({ onClose }: { onClose: () => void }) {
  return (
    <Modal center onClose={onClose} label="Settings">
      <SettingsBody />
    </Modal>
  );
}
