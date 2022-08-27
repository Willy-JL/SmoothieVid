let running = false;

const options = document.getElementById("options");
const message = document.getElementById("message");
const error = document.getElementById("error");
const in_preview = document.getElementById("in_preview");
const out_preview = document.getElementById("out_preview");

in_preview.volume = 0;
out_preview.volume = 0;
options.input.value = null;
options.input.addEventListener("change", function (e) {
	if (running) {
		options.submit.value = "Stabilize!";
		ffmpeg.exit();
	};
	in_preview.src = URL.createObjectURL(options.input.files[0]);
	out_preview.removeAttribute("src");
	out_preview.load();
});
options.addEventListener("reset", function (e) {
	if (running) {
		options.submit.value = "Stabilize!";
		ffmpeg.exit();
	};
	in_preview.removeAttribute("src");
	in_preview.load();
	out_preview.removeAttribute("src");
	out_preview.load();
});

let step_name = "";
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({
	log: true,
	corePath: "https://unpkg.com/@willyjl/ffmpeg.wasm-core-vidstab/dist/ffmpeg-core.js",
	progress: ({ ratio }) => {
		message.innerHTML = `${step_name}: ${(ratio * 100.0).toFixed(1)}%`;
	},
});

async function stabilize() {
	if (running) {
		options.submit.value = "Stabilize!";
		ffmpeg.exit();
		return;
	};
	running = true;
	options.submit.value = "Stop!";
	message.innerHTML = "Starting...";
	error.innerHTML = "";
	try {

		const input = options.input.files[0];
		const crop = options.crop.value;
		const shake = options.shake.value;
		const accuracy = options.accuracy.value;
		const step = options.step.value;
		const smooth = options.smooth.value;
		const contrast = options.contrast.value;
		const zoom = options.zoom.value;

		out_preview.removeAttribute("src");
		out_preview.load();
		if (!ffmpeg.isLoaded()) {
			message.innerHTML = "Loading FFmpeg...";
			await ffmpeg.load();
		};

		message.innerHTML = "Reading file...";
		ffmpeg.FS("writeFile", input.name, await fetchFile(input));

		let current_step = 0;
		let total_steps = 2;
		let scaled_file = input.name;
		if (zoom < 0 || input.name.toLowerCase().endsWith(".gif")) {
			total_steps = 3;
			scaled_file = "scaled.mp4";
			step_name = `Scaling (${current_step += 1}/${total_steps})`;
			await ffmpeg.run("-i", input.name, "-vf", `scale=trunc((iw*${Math.max(1 - 0.01 * zoom, 1)})/2)*2:trunc(ow/a/2)*2`, "-pix_fmt", "yuv420p", scaled_file);
		}

		step_name = `Analyzing (${current_step += 1}/${total_steps})`;
		await ffmpeg.run("-i", scaled_file, "-vf", `vidstabdetect=shakiness=${shake}:accuracy=${accuracy}:stepsize=${step}:mincontrast=${contrast}:show=0`, "-f", "null", "-");

		step_name = `Transforming (${current_step += 1}/${total_steps})`;
		await ffmpeg.run("-i", scaled_file, "-vf", `vidstabtransform=smoothing=${smooth}:crop=black:zoom=${zoom}:optzoom=${crop}:interpol=linear,unsharp=5:5:0.8:3:3:0.4`, "output.mp4");

		message.innerHTML = "Loading preview...";
		const data = ffmpeg.FS("readFile", "output.mp4");
		out_preview.src = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
		in_preview.load();
		message.innerHTML = "Ready!";

	} catch (e) {
		message.innerHTML = "Failed!";
		error.innerHTML = e;
	} finally {
		running = false;
		options.submit.value = "Stabilize!";
	}
}

message.innerHTML = "Ready!";
