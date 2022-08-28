const options = document.getElementById("options");
const message = document.getElementById("message");
const error = document.getElementById("error");
const in_preview_vid = document.getElementById("in_preview_vid");
const in_preview_img = document.getElementById("in_preview_img");
let in_preview = in_preview_vid;
const out_preview = document.getElementById("out_preview");

in_preview.volume = 0;
out_preview.volume = 0;
options.input.value = null;
options.input.addEventListener("change", function (e) {
	if (running) {
		stop_ffmpeg();
	};
	const file = options.input.files[0];
	if (file.name.toLowerCase().endsWith(".gif")) {
		set_in_preview_img();
	} else {
		set_in_preview_vid();
	};
	in_preview.src = URL.createObjectURL(file);
	refresh_in_preview();
	reset_out_preview();
	refresh_out_preview();
});
options.addEventListener("reset", function (e) {
	if (running) {
		stop_ffmpeg();
	};
	set_in_preview_vid();
	reset_in_preview();
	reset_out_preview();
	refresh_in_preview();
	refresh_out_preview();
});
function set_in_preview_vid() {
	in_preview_img.style.display = "none";
	in_preview_vid.style.display = "block";
	in_preview = in_preview_vid;
};
function set_in_preview_img() {
	in_preview_img.style.display = "block";
	in_preview_vid.style.display = "none";
	in_preview = in_preview_img;
};
function reset_in_preview() {
	in_preview_vid.removeAttribute("src");
	in_preview_img.removeAttribute("src");
};
function reset_out_preview() {
	out_preview.removeAttribute("src");
};
function refresh_in_preview() {
	in_preview_vid.load();
	const src = in_preview_img.src;
	in_preview_img.src = "";
	in_preview_img.src = src;
};
function refresh_out_preview() {
	out_preview.load();
};

let step_name = "";
let running = false;
let core = "https://unpkg.com/@willyjl/ffmpeg.wasm-core-vidstab/dist/ffmpeg-core.js";
if (typeof SharedArrayBuffer === "undefined") {
	core = "https://unpkg.com/@willyjl/ffmpeg.wasm-core-vidstab-st/dist/ffmpeg-core.js";
	document.getElementById("no_multithread").style.display = "block";
};
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({
	log: true,
	mainName: "main",
	corePath: core,
	progress: ({ ratio }) => {
		message.innerHTML = `${step_name}: ${(ratio * 100.0).toFixed(1)}%`;
	},
});
function stop_ffmpeg() {
	options.submit.value = "Stabilize!";
	ffmpeg.exit();
};

async function stabilize() {
	if (running) {
		stop_ffmpeg();
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

		reset_out_preview();
		refresh_out_preview();
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
		};

		step_name = `Analyzing (${current_step += 1}/${total_steps})`;
		await ffmpeg.run("-i", scaled_file, "-vf", `vidstabdetect=shakiness=${shake}:accuracy=${accuracy}:stepsize=${step}:mincontrast=${contrast}:show=0`, "-f", "null", "-");

		step_name = `Transforming (${current_step += 1}/${total_steps})`;
		await ffmpeg.run("-i", scaled_file, "-vf", `vidstabtransform=smoothing=${smooth}:crop=black:zoom=${zoom}:optzoom=${crop}:interpol=linear,unsharp=5:5:0.8:3:3:0.4`, "output.mp4");

		message.innerHTML = "Loading preview...";
		const data = ffmpeg.FS("readFile", "output.mp4");
		out_preview.src = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
		refresh_in_preview();
		message.innerHTML = "Ready!";

	} catch (e) {
		message.innerHTML = "Failed!";
		error.innerHTML = e;
	} finally {
		running = false;
		options.submit.value = "Stabilize!";
	};
};

message.innerHTML = "Ready!";
