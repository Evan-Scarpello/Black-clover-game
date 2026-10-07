// Visual test page for the character art system (gallery.html).
//   /gallery.html                    all ids, full + portrait, plus flip rows
//   /gallery.html?id=asta&size=400   zoom on one (or several: ?id=asta,yuno)
//   /gallery.html?ids=asta,yuno&size=220&portrait=1
import { render } from 'preact';
import { CharacterArt, ART_IDS, ART_AURA } from './CharacterArt';

const q = new URLSearchParams(location.search);
const only = (q.get('id') || q.get('ids') || '').split(',').filter(Boolean);
const size = Number(q.get('size') || 0);
const light = q.get('bg') === 'light';

const card = (bg: string): any => ({
  background: bg,
  borderRadius: '12px',
  padding: '6px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
});

function Cell({ id }: { id: string }) {
  return (
    <div style={card(light ? '#efeaf6' : '#2a2244')}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
        <div style={{ width: '140px', height: '168px' }}>
          <CharacterArt id={id} mode="full" />
        </div>
        <div style={{ width: '90px', height: '90px', borderRadius: '10px', overflow: 'hidden', background: `radial-gradient(circle at 50% 40%, ${ART_AURA[id]}55, #1a1430)`, border: `2px solid ${ART_AURA[id]}` }}>
          <CharacterArt id={id} mode="portrait" />
        </div>
      </div>
      <div style={{ color: light ? '#222' : '#e8e0ff', font: '600 13px system-ui' }}>{id}</div>
    </div>
  );
}

function Zoom({ ids, px }: { ids: string[]; px: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px', background: light ? '#f4f0fa' : '#1b1530' }}>
      {ids.map((id) => (
        <div key={id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ width: `${px}px`, height: `${px * 1.2}px`, background: light ? '#fff' : '#2a2244', borderRadius: '12px' }}>
            <CharacterArt id={id} mode="full" />
          </div>
          {q.get('portrait') !== '0' && (
            <div style={{ width: `${px * 0.6}px`, height: `${px * 0.6}px`, background: '#2a2244', borderRadius: '12px', overflow: 'hidden' }}>
              <CharacterArt id={id} mode="portrait" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Gallery() {
  if (only.length) return <Zoom ids={only} px={size || 360} />;
  const flipIds = ['asta', 'yuno', 'noelle', 'yami', 'bandit', 'magic_beast', 'imp', 'lucifero', 'not_a_real_id'];
  return (
    <div style={{ padding: '12px', fontFamily: 'system-ui' }}>
      <h2 style={{ color: '#fff', margin: '4px 0 10px' }}>Character art ({ART_IDS.length})</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
        {ART_IDS.map((id) => <Cell key={id} id={id} />)}
      </div>
      <h3 style={{ color: '#fff', margin: '18px 0 8px' }}>flip = true (dark / light)</h3>
      {['#120e1e', '#f3eefa'].map((bg) => (
        <div key={bg} style={{ display: 'flex', gap: '6px', background: bg, padding: '8px', borderRadius: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
          {flipIds.map((id) => (
            <div key={id} style={{ width: '120px', height: '144px' }}>
              <CharacterArt id={id} mode="full" flip />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

render(<Gallery />, document.getElementById('gallery')!);
