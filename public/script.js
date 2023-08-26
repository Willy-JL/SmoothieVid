// Module import URLs
const ffmpeg_main = "/@ffmpeg/ffmpeg@0.12.5/dist/esm/index.js"; // Needs to be same domain, otherwise gets a DOMException for Worker()
const ffmpeg_util = "https://unpkg.com/@ffmpeg/util@0.12.0/dist/esm/index.js";
let ffmpeg_core = "https://unpkg.com/@willyjl/ffmpeg.wasm-core-vidstab-mt@0.12.2/dist/esm";

// Show warning and change core if multithreaded is not supported
if (typeof SharedArrayBuffer === "undefined") {
    ffmpeg_core = ffmpeg_core.replace("-mt@", "@");
    const warning = document.getElementById("singlethread");
    warning.innerHTML = 'WARNING: Your browser <a href="https://caniuse.com/sharedarraybuffer" target="_blank">doesn\'t support multithreaded FFmpeg</a>,\
                         so processing will be slower, it might freeze the webpage or it might not work at all.'
    warning.style.display = "block";
};

// Page element references
const options = document.getElementById("options");
const error = document.getElementById("error");
const in_preview_vid = document.getElementById("in_preview_vid");
const in_preview_img = document.getElementById("in_preview_img");
let in_preview = in_preview_vid;
const out_preview = document.getElementById("out_preview");
const out_preview_container = out_preview.parentElement;
const download = document.getElementById("download");
in_preview.volume = 0;
out_preview.volume = 0;
options.input.value = null;

// Preview helpers
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
    out_preview_container.style.removeProperty("display");
    refresh_out_preview();
    download.style.visibility = "hidden";
    download.removeAttribute("src");
};
function set_in_preview(src) {
    in_preview.src = src;
    in_preview.style.backgroundColor = "transparent";
    refresh_in_preview();
};
function set_out_preview(src) {
    out_preview.src = src;
    out_preview.style.backgroundColor = "transparent";
    out_preview_container.style.display = "grid";
    refresh_out_preview();
    download.href = src;
    download.style.visibility = "visible";
    setTimeout(function () {
        out_preview.scrollIntoView();
    }, 100);
};

// State management
let ffmpeg = null;
let step_name = "";
let running = false;
let last_input = null;
let last_analysis = null;
let last_transform = null;

// Utility helpers
function stop_ffmpeg() {
    last_input = null;
    last_analysis = null;
    last_transform = null;
    options.submit.style.setProperty("--hover-text", "'Stabilize!'");
    options.submit.style.setProperty("--hover-color", "var(--blue)");
    options.submit.style.setProperty("--hover-light-color", "var(--light-blue)");
    ffmpeg.terminate();
};
function assert_ffmpeg(res) {
    if (res !== 0 && res !== true) {
        throw new Error(`FFmpeg returned status: ${res}. Check console for more info.`);
    };
};
function show_error(exc, msg) {
    options.submit.style.setProperty("--text", "'Failed!'");
    options.submit.style.setProperty("--color", "var(--pink)");
    options.submit.style.setProperty("--light-color", "var(--light-pink)");
    if (exc.toString && exc.toString() === "[object Object]") {
        exc = exc.toString() + ": " + JSON.stringify(exc);
    };
    if (msg) {
        exc = msg + ":\n<br>\n" + exc;
    };
    error.innerHTML = exc;
    error.style.display = "block";
    setTimeout(function () {
        error.scrollIntoView();
    }, 100);
};

// Options callbacks
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

// Main stabilize callback
async function stabilize() {
    if (ffmpeg === null) {
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
        const smooth = options.smooth.value;
        const zoom = options.zoom.value;
        const shake = options.shake.value;
        const accuracy = options.accuracy.value;
        const step = options.step.value;
        const contrast = options.contrast.value;

        const last_out_src = out_preview.src;
        reset_out_preview();

        if (!ffmpeg.loaded) {
            options.submit.style.setProperty("--text", "'Loading...'");
            try {
                await ffmpeg.load({
                    coreURL: await ffmpeg.toBlobURL(`${ffmpeg_core}/ffmpeg-core.js`, "text/javascript"),
                    wasmURL: await ffmpeg.toBlobURL(`${ffmpeg_core}/ffmpeg-core.wasm`, "application/wasm"),
                    workerURL: await ffmpeg.toBlobURL(`${ffmpeg_core}/ffmpeg-core.worker.js`, "text/javascript"),
                });
            } catch (exc) {
                show_error(exc, "Failed to load ffmpeg.wasm");
            };
        };

        if (input !== last_input) {
            last_input = null;
            last_analysis = null;
            last_transform = null;
            options.submit.style.setProperty("--text", "'Reading...'");
            const input_data = await ffmpeg.fetchFile(input);
            if (zoom < 0 || input.name.toLowerCase().endsWith(".gif")) {
                await ffmpeg.writeFile("input.mp4", input_data);
                step_name = "Scale";
                assert_ffmpeg(await ffmpeg.exec(["-i", "input.mp4", "-vf", `scale=trunc((iw*${Math.max(1 - 0.01 * zoom, 1)})/2)*2:trunc(ow/a/2)*2`, "-pix_fmt", "yuv420p", "scaled.mp4"]));
                await ffmpeg.deleteFile("input.mp4");
                reset_in_preview();
                set_in_preview_vid();
                const scaled_1 = new Blob([(await ffmpeg.readFile("scaled.mp4")).buffer], { type: "video/mp4" });
                set_in_preview(URL.createObjectURL(scaled_1));
            } else {
                await ffmpeg.writeFile("scaled.mp4", input_data);
            };
        };
        last_input = input;

        const analysis = `${shake}|${accuracy}|${step}|${contrast}`;
        if (analysis !== last_analysis) {
            last_analysis = null;
            last_transform = null;
            step_name = "Analyze";
            assert_ffmpeg(await ffmpeg.exec(["-i", "scaled.mp4", "-vf", `vidstabdetect=shakiness=${shake}:accuracy=${accuracy}:stepsize=${step}:mincontrast=${contrast}:show=0`, "-f", "null", "-"]));
        };
        last_analysis = analysis;

        const transform = `${smooth}|${zoom}|${borders}`;
        if (transform !== last_transform) {
            last_transform = null;
            step_name = "Transform";
            assert_ffmpeg(await ffmpeg.exec(["-i", "scaled.mp4", "-vf", `vidstabtransform=smoothing=${smooth}:crop=black:zoom=${zoom}:optzoom=${borders}:interpol=linear,unsharp=5:5:0.8:3:3:0.4`, "output.mp4"]));
            options.submit.style.setProperty("--text", "'Previewing...'");
            const output = new Blob([(await ffmpeg.readFile("output.mp4")).buffer], { type: "video/mp4" });
            await ffmpeg.deleteFile("output.mp4");
            set_out_preview(URL.createObjectURL(output));
        } else {
            set_out_preview(last_out_src);
        };
        refresh_in_preview();
        last_transform = transform;

        options.submit.style.setProperty("--text", "'Stabilize!'");
        options.submit.style.setProperty("--color", "var(--blue)");
        options.submit.style.setProperty("--light-color", "var(--light-blue)");

    } catch (exc) {
        show_error(exc, "Error while processing");
    } finally {
        running = false;
        options.submit.style.setProperty("--hover-text", "'Stabilize!'");
        options.submit.style.setProperty("--hover-color", "var(--blue)");
        options.submit.style.setProperty("--hover-light-color", "var(--light-blue)");
    };
};

// Load ffmpeg
(async function() {
    const { FFmpeg } = await import(ffmpeg_main);
    const { fetchFile, toBlobURL } = await import(ffmpeg_util);

    const _ffmpeg = new FFmpeg();
    _ffmpeg.fetchFile = fetchFile;
    _ffmpeg.toBlobURL = toBlobURL;

    _ffmpeg.on("log", function ({ message }) {
        console.log(message);
    })
    _ffmpeg.on("progress", function ({ progress, time }) {
        options.submit.style.setProperty("--text", `'${step_name}: ${(progress * 100.0).toFixed(1)}%'`);
    });

    options.submit.style.setProperty("--text", "'Stabilize!'");
    options.submit.style.setProperty("--color", "var(--blue)");
    options.submit.style.setProperty("--light-color", "var(--light-blue)");
    options.submit.style.setProperty("--hover-text", "'Stabilize!'");
    options.submit.style.setProperty("--hover-color", "var(--blue)");
    options.submit.style.setProperty("--hover-light-color", "var(--light-blue)");
    ffmpeg = _ffmpeg;
})().catch(function (exc) {
    show_error(exc, "Failed to initialize ffmpeg.wasm");
});
