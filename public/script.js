let stabilize;
window.addEventListener("load", function () {
    const options = document.getElementById("options");
    const error = document.getElementById("error");
    const in_preview_vid = document.getElementById("in_preview_vid");
    const in_preview_img = document.getElementById("in_preview_img");
    let in_preview = in_preview_vid;
    const out_preview = document.getElementById("out_preview");
    const out_preview_container = out_preview.parentElement;
    const download = document.getElementById("download");

    let step_name = "";
    let loaded = false;
    let running = false;
    let last_analysis = null;
    let last_input = null;
    let last_transform = null;
    let core = "https://unpkg.com/@willyjl/ffmpeg.wasm-core-vidstab/dist/ffmpeg-core.js";
    let isSingleThread = undefined;
    if (typeof SharedArrayBuffer === "undefined") {
        core = "https://unpkg.com/@willyjl/ffmpeg.wasm-core-vidstab-st/dist/ffmpeg-core.js";
        isSingleThread = "main";
        const warning = document.getElementById("singlethread");
        warning.innerHTML = 'WARNING: Your browser <a href="https://caniuse.com/sharedarraybuffer" target="_blank">doesn\'t support multithreaded FFmpeg</a>,\
                             so processing will be slower, it might freeze the webpage or it might not work at all.'
        warning.style.display = "block";
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
    function stop_ffmpeg() {
        last_analysis = null;
        last_input = null;
        last_transform = null;
        options.submit.style.setProperty("--hover-text", "'Stabilize!'");
        options.submit.style.setProperty("--hover-color", "var(--blue)");
        options.submit.style.setProperty("--hover-light-color", "var(--light-blue)");
        ffmpeg.exit();
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

    stabilize = async function () {
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

            options.submit.style.setProperty("--text", "'Starting...'");
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

            if (!ffmpeg.isLoaded()) {
                options.submit.style.setProperty("--text", "'Loading...'");
                await ffmpeg.load();
            };

            if (input !== last_input) {
                last_input = null;
                last_analysis = null;
                last_transform = null;
                options.submit.style.setProperty("--text", "'Reading...'");
                const input_data = await ffmpeg.fetchFile(input);
                if (zoom < 0 || input.name.toLowerCase().endsWith(".gif")) {
                    ffmpeg.FS("writeFile", "input.mp4", input_data);
                    step_name = "Scale";
                    await ffmpeg.run("-i", "input.mp4", "-vf", `scale=trunc((iw*${Math.max(1 - 0.01 * zoom, 1)})/2)*2:trunc(ow/a/2)*2`, "-pix_fmt", "yuv420p", "scaled.mp4");
                    ffmpeg.FS("unlink", "input.mp4");
                    reset_in_preview();
                    set_in_preview_vid();
                    const scaled_1 = new Blob([ffmpeg.FS("readFile", "scaled.mp4").buffer], { type: "video/mp4" });
                    set_in_preview(URL.createObjectURL(scaled_1));
                    if (isSingleThread) {
                        const scaled_1_data = await ffmpeg.fetchFile(scaled_1);
                        ffmpeg.exit();
                        await ffmpeg.load();
                        ffmpeg.FS("writeFile", "scaled.mp4", scaled_1_data);
                    };
                } else {
                    ffmpeg.FS("writeFile", "scaled.mp4", input_data);
                };
            };
            last_input = input;

            const analysis = `${shake}|${accuracy}|${step}|${contrast}`;
            if (analysis !== last_analysis) {
                last_analysis = null;
                last_transform = null;
                step_name = "Analyze";
                await ffmpeg.run("-i", "scaled.mp4", "-vf", `vidstabdetect=shakiness=${shake}:accuracy=${accuracy}:stepsize=${step}:mincontrast=${contrast}:show=0`, "-f", "null", "-");
                if (isSingleThread) {
                    const scaled_2_data = await ffmpeg.fetchFile(new Blob([ffmpeg.FS("readFile", "scaled.mp4").buffer]));
                    const transforms_1_data = await ffmpeg.fetchFile(new Blob([ffmpeg.FS("readFile", "transforms.trf").buffer]));
                    ffmpeg.exit();
                    await ffmpeg.load();
                    ffmpeg.FS("writeFile", "scaled.mp4", scaled_2_data);
                    ffmpeg.FS("writeFile", "transforms.trf", transforms_1_data);
                };
            };
            last_analysis = analysis;

            const transform = `${smooth}|${zoom}|${borders}`;
            if (transform !== last_transform) {
                last_transform = null;
                step_name = "Transform";
                await ffmpeg.run("-i", "scaled.mp4", "-vf", `vidstabtransform=smoothing=${smooth}:crop=black:zoom=${zoom}:optzoom=${borders}:interpol=linear,unsharp=5:5:0.8:3:3:0.4`, "output.mp4");
                options.submit.style.setProperty("--text", "'Previewing...'");
                const output = new Blob([ffmpeg.FS("readFile", "output.mp4").buffer], { type: "video/mp4" });
                ffmpeg.FS("unlink", "output.mp4");
                if (isSingleThread) {
                    const scaled_3_data = await ffmpeg.fetchFile(new Blob([ffmpeg.FS("readFile", "scaled.mp4").buffer]));
                    const transforms_2_data = await ffmpeg.fetchFile(new Blob([ffmpeg.FS("readFile", "transforms.trf").buffer]));
                    ffmpeg.exit();
                    await ffmpeg.load();
                    ffmpeg.FS("writeFile", "scaled.mp4", scaled_3_data);
                    ffmpeg.FS("writeFile", "transforms.trf", transforms_2_data);
                };
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

    let ffmpeg;
    import("https://unpkg.com/@ffmpeg/ffmpeg/dist/ffmpeg.min.js").then(function () {
        ffmpeg = FFmpeg.createFFmpeg({
            log: true,
            mainName: isSingleThread,
            corePath: core,
            progress: ({ ratio }) => {
                options.submit.style.setProperty("--text", `'${step_name}: ${(ratio * 100.0).toFixed(1)}%'`);
            },
        });
        ffmpeg.fetchFile = FFmpeg.fetchFile;
        ffmpeg.load().then(function () {
            options.submit.style.setProperty("--text", "'Stabilize!'");
            options.submit.style.setProperty("--color", "var(--blue)");
            options.submit.style.setProperty("--light-color", "var(--light-blue)");
        }).catch(function (exc) {
            show_error(exc, "Failed to load ffmpeg.wasm-core");
        });
    }, function (exc) {
        show_error(exc, "Failed to import ffmpeg.wasm");
    }).catch(function (exc) {
        show_error(exc, "Failed to initialize ffmpeg.wasm");
    }).finally(function () {
        options.submit.style.setProperty("--hover-text", "'Stabilize!'");
        options.submit.style.setProperty("--hover-color", "var(--blue)");
        options.submit.style.setProperty("--hover-light-color", "var(--light-blue)");
        loaded = true;
    });
});
