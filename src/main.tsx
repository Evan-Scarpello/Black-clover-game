import { render } from 'preact';
import '@fontsource/bangers/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './ui/styles.css';
import { App } from './ui/App';

render(<App />, document.getElementById('app')!);
