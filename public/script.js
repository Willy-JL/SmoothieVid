const options = document.getElementById("options");
const error = document.getElementById("error");
const in_preview_vid = document.getElementById("in_preview_vid");
const in_preview_img = document.getElementById("in_preview_img");
let in_preview = in_preview_vid;
const out_preview = document.getElementById("out_preview");

let step_name = "";
let loaded = false;
let running = false;
let core = "https://unpkg.com/@willyjl/ffmpeg.wasm-core-vidstab/dist/ffmpeg-core.js";
let singleThread = undefined;
if (typeof SharedArrayBuffer === "undefined") {
	core = "https://unpkg.com/@willyjl/ffmpeg.wasm-core-vidstab-st/dist/ffmpeg-core.js";
	singleThread = "main";
	document.getElementById("singlethread").style.display = "block";
};

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
function refresh_in_preview() {
	in_preview_vid.load();
	const src = in_preview_img.src;
	in_preview_img.src = "";
	in_preview_img.src = src;
};
function refresh_out_preview() {
	out_preview.load();
};
function reset_in_preview() {
	in_preview_vid.removeAttribute("src");
	in_preview_img.removeAttribute("src");
	in_preview_vid.style.removeProperty("background-color");
	in_preview_img.style.removeProperty("background-color");
	refresh_in_preview();
};
function reset_out_preview() {
	out_preview.removeAttribute("src");
	out_preview.style.removeProperty("background-color");
	refresh_out_preview();
};
function set_in_preview(src) {
	in_preview.src = src;
	in_preview.style.backgroundColor = "transparent";
	refresh_in_preview();
};
function set_out_preview(src) {
	out_preview.src = src;
	out_preview.style.backgroundColor = "transparent";
	refresh_out_preview();
};
function stop_ffmpeg() {
	options.submit.style.setProperty("--hover-text", "'Stabilize!'");
	options.submit.style.setProperty("--hover-color", "var(--blue)");
	options.submit.style.setProperty("--hover-light-color", "var(--light-blue)");
	try {
		ffmpeg.exit();
	} catch {};
};
function show_error(exc) {
	options.submit.style.setProperty("--text", "'Failed!'");
	options.submit.style.setProperty("--color", "var(--pink)");
	options.submit.style.setProperty("--light-color", "var(--light-pink)");
	if (exc + "" === "[object Object]") {
		exc = JSON.stringify(exc);
	};
	error.innerHTML = exc;
	error.style.display = "block";
};

in_preview.volume = 0;
out_preview.volume = 0;
options.input.value = null;
options.input.addEventListener("change", function (e) {
	if (running) {
		stop_ffmpeg();
	};
	const file = options.input.files[0];
	if (file && file.name.toLowerCase().endsWith(".gif")) {
		set_in_preview_img();
	} else {
		set_in_preview_vid();
	};
	set_in_preview(URL.createObjectURL(file));
	reset_out_preview();
});
options.addEventListener("reset", function (e) {
	if (running) {
		stop_ffmpeg();
	};
	set_in_preview_vid();
	reset_in_preview();
	reset_out_preview();
});

async function stabilize() {
	if (!loaded) {
		return;
	};
	if (running) {
		stop_ffmpeg();
		return;
	};
	running = true;
	options.submit.style.setProperty("--text", "'Starting...'");
	options.submit.style.setProperty("--color", "var(--pink)");
	options.submit.style.setProperty("--light-color", "var(--light-pink)");
	options.submit.style.setProperty("--hover-text", "'Stop!'");
	options.submit.style.setProperty("--hover-color", "var(--pink)");
	options.submit.style.setProperty("--hover-light-color", "var(--light-pink)");
	error.innerHTML = "";
	error.style.display = "none";
	try {

		const input = options.input.files[0];
		const borders = options.borders.value;
		const shake = options.shake.value;
		const accuracy = options.accuracy.value;
		const step = options.step.value;
		const smooth = options.smooth.value;
		const contrast = options.contrast.value;
		const zoom = options.zoom.value;
		reset_out_preview();

		if (!ffmpeg.isLoaded()) {
			options.submit.style.setProperty("--text", "'Loading...'");
			await ffmpeg.load();
		};

		options.submit.style.setProperty("--text", "'Reading...'");
		ffmpeg.FS("writeFile", input.name, await fetchFile(input));

		let scaled_file = input.name;
		if (zoom < 0 || input.name.toLowerCase().endsWith(".gif")) {
			scaled_file = "scaled.mp4";
			step_name = "Scale";
			await ffmpeg.run("-i", input.name, "-vf", `scale=trunc((iw*${Math.max(1 - 0.01 * zoom, 1)})/2)*2:trunc(ow/a/2)*2`, "-pix_fmt", "yuv420p", scaled_file);
			set_in_preview_vid();
			set_in_preview(URL.createObjectURL(ffmpeg.FS("readFile", scaled_file)))
			if (singleThread) {
				const scaled = ffmpeg.FS("readFile", scaled_file);
				ffmpeg.exit();
				await ffmpeg.load();
				ffmpeg.FS("writeFile", scaled_file, scaled);
			};
		};

		step_name = "Analyze";
		await ffmpeg.run("-i", scaled_file, "-vf", `vidstabdetect=shakiness=${shake}:accuracy=${accuracy}:stepsize=${step}:mincontrast=${contrast}:show=0`, "-f", "null", "-");
		if (singleThread) {
			const scaled = ffmpeg.FS("readFile", scaled_file);
			const transforms = ffmpeg.FS("readFile", "transforms.rtf");
			ffmpeg.exit();
			await ffmpeg.load();
			ffmpeg.FS("writeFile", scaled_file, scaled);
			ffmpeg.FS("writeFile", "transforms.rtf", transforms);
		};

		step_name = "Transform";
		await ffmpeg.run("-i", scaled_file, "-vf", `vidstabtransform=smoothing=${smooth}:crop=black:zoom=${zoom}:optzoom=${borders}:interpol=linear,unsharp=5:5:0.8:3:3:0.4`, "output.mp4");

		options.submit.style.setProperty("--text", "'Previewing...'");
		const data = ffmpeg.FS("readFile", "output.mp4");
		if (singleThread) {
			ffmpeg.exit();
		};
		set_out_preview(URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" })));
		refresh_in_preview();
		options.submit.style.setProperty("--text", "'Stabilize!'");
		options.submit.style.setProperty("--color", "var(--blue)");
		options.submit.style.setProperty("--light-color", "var(--light-blue)");

	} catch (exc) {
		show_error(exc);
	} finally {
		running = false;
		options.submit.style.setProperty("--hover-text", "'Stabilize!'");
		options.submit.style.setProperty("--hover-color", "var(--blue)");
		options.submit.style.setProperty("--hover-light-color", "var(--light-blue)");
	};
};

let createFFmpeg, fetchFile, ffmpeg;
(async function () {
	createFFmpeg = FFmpeg.createFFmpeg;
	fetchFile = FFmpeg.fetchFile;
	ffmpeg = createFFmpeg({
		log: true,
		mainName: singleThread,
		corePath: core,
		progress: ({ ratio }) => {
			options.submit.style.setProperty("--text", `'${step_name}: ${(ratio * 100.0).toFixed(1)}%'`);
		},
	});
	await ffmpeg.load();
	options.submit.style.setProperty("--text", "'Stabilize!'");
	options.submit.style.setProperty("--color", "var(--blue)");
	options.submit.style.setProperty("--light-color", "var(--light-blue)");
})().catch(function (exc) {
	show_error(exc);
}).finally(function () {
	options.submit.style.setProperty("--hover-text", "'Stabilize!'");
	options.submit.style.setProperty("--hover-color", "var(--blue)");
	options.submit.style.setProperty("--hover-light-color", "var(--light-blue)");
	loaded = true;
});
