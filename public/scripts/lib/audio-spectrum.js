const binSize = 200;
const fftSize = 256;
const initBin = 6;

const api = function (view, opts) {
    const self = this;
    const AudioContext = window.AudioContext || window.webkitAudioContext; //Cross browser variant. 
    let stopAnim = true;
    let audioContext;
    let options = opts;
    let canvas = view;
    let timer = undefined;
    let ctx, streamSourceNode, analyser;
    let movingVolMax = 1;
    let always_run = false;

    self.running = false;
    if (window.___audiocontext) {
        audioContext = window.___audiocontext;
    } else {
        audioContext = new AudioContext();
        window.___audiocontext = audioContext;
    }

    if (canvas) {
        ctx = canvas.getContext("2d");
        canvas.style.color
        ctx.scale(ctx.canvas.width / 1600, ctx.canvas.height / 400);
        ctx.strokeStyle = options && options.strokeStyle ? options.strokeStyle : '#888888';
        ctx.lineWidth = 2;
    }

    const heatMapColorforValue = value => {
        var h = (1.0 - value) * 240
        return "hsl(" + h + ", 100%, 70%)";
    };

    const get_spectra = () => {
        let dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        let step = 1; //Math.round(180 / 60);
        let volumes = [];
        let maxvol = 0;
        let sum = 0;
        for (let i = 0; i < binSize; i++) {
            sum = 0;
            for (let j = 0; j < step; j++) {
                //sum += dataArray[i * step + j] * dataArray[i * step + j];
                sum += dataArray[i * step + j] * dataArray[i * step + j] * (i + j + initBin);
            }
            let vol = Math.sqrt(sum) / step;
            if (vol > maxvol) {
                maxvol = vol;
            }
            volumes.push(vol);
        }
        if (maxvol > movingVolMax) {
            movingVolMax = maxvol;
        } else if (maxvol / movingVolMax < 0.2) {
            if (movingVolMax > 100) {
                movingVolMax = movingVolMax / 1.03;
            }
        }
        sum = 0;
        for (let i = 0; i < binSize; i++) {
            volumes[i] = volumes[i] / movingVolMax;
            sum += volumes[i];
        }
        return {
            avg: sum / binSize,
            volumes: volumes
        };
    };

    const render = () => {
        if (stopAnim || !ctx) {
            return;
        }
        if (!always_run && (window.__is_on_battery || window.__no_audio_spectra)) {
            self.stop();
            return;
        }
        ctx.clearRect(0, 0, 20 * binSize, 400);
        let spec = get_spectra();
        for (let i = 0; i < spec.volumes.length; i++) {
            let volume = Math.round(0.9 * 200 * spec.volumes[i]);
            for (let j = 0; j < volume; j += 10) {
                ctx.strokeStyle = heatMapColorforValue(Math.min(1, j / 200 / 0.6));
                ctx.beginPath();
                ctx.moveTo(20 * i + 2, 200 + j);
                ctx.lineTo(20 * (i + 1) - 2, 200 + j);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(20 * i + 2, 200 - j);
                ctx.lineTo(20 * (i + 1) - 2, 200 - j);
                ctx.stroke();
            }
        }
        ctx.beginPath();
        ctx.moveTo(0, 200);
        ctx.lineTo(20 * binSize, 200);
        ctx.stroke();
        window.requestAnimationFrame(render);
    };

    self.start_animate = (stream, always) => {
        if (self.running || !always && (window.__is_on_battery || window.__no_audio_spectra)) {
            return;
        }
        always_run = always;
        analyser = audioContext.createAnalyser();
        analyser.fftSize = fftSize;
        streamSourceNode = audioContext.createMediaStreamSource(stream);
        streamSourceNode.connect(analyser);
        stopAnim = false;
        window.requestAnimationFrame(render);
    };

    self.start_monitor = (stream, opts, callback) => {
        if (self.running || (!opts || !opts.always) && (window.__is_on_battery || window.__no_audio_spectra)) {
            return;
        }
        if (typeof opts === 'function') {
            callback = opts;
            opts = undefined;
        }
        if (!callback || typeof callback !== 'function') {
            return;
        }
        always_run = opts && opts.always;
        analyser = audioContext.createAnalyser();
        analyser.fftSize = fftSize;
        streamSourceNode = audioContext.createMediaStreamSource(stream);
        streamSourceNode.connect(analyser);
        stopAnim = false;
        self.running = true;
        timer = setInterval(() => {
            if (stopAnim && timer) {
                clearInterval(timer);
                timer = undefined;
                self.running = false;
                return;
            }
            callback(get_spectra());
        }, opts && opts.samplingRate ? opts.samplingRate : 300);
    };

    self.stop_animate = () => {
        self.stop();
    };

    self.stop = () => {
        if (stopAnim || !self.running)
            return;
        stopAnim = true;
        analyser.disconnect();
        streamSourceNode.disconnect();
        if (timer) {
            clearInterval(timer);
            timer = undefined;
        }
        self.running = false;
    };
};

export default api;