import { render } from 'preact';
import { MapCanvas } from '../common/MapCanvas';
import '../style.css';

function MapApp() {
	return (
		<div class="w-screen h-dvh">
			<MapCanvas />
		</div>
	);
}

render(<MapApp />, document.getElementById('app')!);
