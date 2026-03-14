import { render } from 'preact';
import { MapCanvas } from '../common/MapCanvas';
import '../style.css';

function PickerApp() {
	return (
		<div class="w-screen h-dvh">
			<MapCanvas />
		</div>
	);
}

render(<PickerApp />, document.getElementById('app')!);
