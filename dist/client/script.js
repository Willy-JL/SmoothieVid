let running = false;
	
			const options = document.getElementById("options");
			const status = document.getElementById("status");
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
	
			let progress = "";
			const { createFFmpeg, fetchFile } = FFmpeg;
			const ffmpeg = createFFmpeg({
				log: true,
				corePath: "https://unpkg.com/@willyjl/ffmpeg.wasm-core-vidstab/dist/ffmpeg-core.js",
				progress: ({ ratio }) => {
					status.innerHTML = `${progress}: ${(ratio * 100.0).toFixed(1)}%`;
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
				status.innerHTML = "Starting...";
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
						status.innerHTML = "Loading FFmpeg...";
						await ffmpeg.load();
					};
	
					status.innerHTML = "Reading file...";
					ffmpeg.FS("writeFile", input.name, await fetchFile(input));
	
					progress = "Scaling (1/3)";
					await ffmpeg.run("-i", input.name, "-vf", "scale=trunc((iw*1.15)/2)*2:trunc(ow/a/2)*2", "-pix_fmt", "yuv420p", "scaled.mp4");
	
					progress = "Analyzing (2/3)";
					await ffmpeg.run("-i", "scaled.mp4", "-vf", `vidstabdetect=shakiness=${shake}:accuracy=${accuracy}:stepsize=${step}:mincontrast=${contrast}:show=0`, "-f", "null", "-");
	
					progress = "Transforming (3/3)"
					await ffmpeg.run("-i", "scaled.mp4", "-vf", `vidstabtransform=smoothing=${smooth}:crop=black:zoom=${zoom}:optzoom=${crop}:interpol=linear,unsharp=5:5:0.8:3:3:0.4`, "output.mp4");
	
					status.innerHTML = "Loading preview...";
					const data = ffmpeg.FS("readFile", "output.mp4");
					out_preview.src = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
					in_preview.load();
					status.innerHTML = "Ready!";
	
				} catch (e) {
					status.innerHTML = "Failed!";
					error.innerHTML = e;
				} finally {
					running = false;
					options.submit.value = "Stabilize!";
				}
			}
	
			status.innerHTML = "Ready!";