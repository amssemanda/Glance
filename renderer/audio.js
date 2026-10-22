// Records mic (+ optional system audio) in fixed-length segments and hands each
// non-silent segment to onSegment(arrayBuffer, mime).
(function () {
  const SEGMENT_MS = 6000;
  const SILENCE_RMS = 0.01;
  const MIME = 'audio/webm;codecs=opus';

  class Listener {
    constructor({ onSegment, onError }) {
      this.onSegment = onSegment;
      this.onError = onError;
      this.active = false;
      this.streams = [];
    }

    async start({ systemAudio = false } = {}) {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      this.streams = [mic];

      if (systemAudio) {
        try {
          const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          this.streams.push(display);
          if (!display.getAudioTracks().length) this.onError?.(new Error('System audio is not available on this OS; using mic only.'));
        } catch (err) {
          this.onError?.(new Error(`System audio unavailable: ${err.message}`));
        }
      }

      this.ctx = new AudioContext();
      const dest = this.ctx.createMediaStreamDestination();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      for (const stream of this.streams) {
        if (!stream.getAudioTracks().length) continue;
        const src = this.ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
        src.connect(dest);
        src.connect(this.analyser);
      }
      this.mixed = dest.stream;
      this.active = true;
      this.monitor();
      this.recordSegment();
    }

    monitor() {
      const buf = new Float32Array(this.analyser.fftSize);
      const tick = () => {
        if (!this.active) return;
        this.analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        this.peak = Math.max(this.peak || 0, Math.sqrt(sum / buf.length));
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    }

    recordSegment() {
      if (!this.active) return;
      const chunks = [];
      const recorder = new MediaRecorder(this.mixed, { mimeType: MIME });
      this.recorder = recorder;
      this.peak = 0;
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = async () => {
        const peak = this.peak;
        this.recordSegment();
        if (peak < SILENCE_RMS || !chunks.length) return;
        const blob = new Blob(chunks, { type: 'audio/webm' });
        this.onSegment(await blob.arrayBuffer(), 'audio/webm');
      };
      recorder.start();
      this.timer = setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), SEGMENT_MS);
    }

    stop() {
      this.active = false;
      clearTimeout(this.timer);
      cancelAnimationFrame(this.raf);
      if (this.recorder?.state === 'recording') this.recorder.stop();
      this.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      this.ctx?.close();
      this.streams = [];
    }
  }

  window.Listener = Listener;
})();
