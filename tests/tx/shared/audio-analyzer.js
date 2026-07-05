// shared/audio-analyzer.js — 8频段RMS音频分析 + 指数平滑
// 从 Mineradio mineradio-terrain.js 提取, 独立可复用
// 用于 tests/tl/ 下所有特效页面

class AudioAnalyzer {
  constructor(fftSize = 2048) {
    this.fftSize = fftSize;
    this.ac = null;
    this.analyser = null;
    this.source = null;
    this.freqData = null;
    this._stream = null;        // MediaStream from getUserMedia
    this._audioEl = null;       // <audio> element for file playback
    this.smoothing = 0.12;
    this.activeSmoothing = 0.04;
    this._activity = 0;
    this.onActivityChange = null;

    // 分析结果（平滑后）
    this.subBass = 0;
    this.bass = 0;
    this.lowMid = 0;
    this.mid = 0;
    this.highMid = 0;
    this.presence = 0;
    this.brilliance = 0;
    this.air = 0;
    this.energy = 0;
  }

  /**
   * 计算指定频段的 RMS 值
   * @param {Uint8Array} data - 频域数据 (0-255)
   * @param {number} len - 数据长度
   * @param {number} sampleRate - 采样率
   * @param {number} hz0 - 起始频率
   * @param {number} hz1 - 结束频率
   * @returns {number} RMS 值 (0-1)
   */
  _bandRms(data, len, sampleRate, hz0, hz1) {
    const binHz = sampleRate / (len * 2);
    const a = Math.max(0, Math.floor(hz0 / binHz));
    const b = Math.min(len - 1, Math.ceil(hz1 / binHz));
    let sum = 0, count = 0;
    for (let i = a; i <= b; i++) {
      const v = data[i] / 255;
      sum += v * v;
      count++;
    }
    return count ? Math.sqrt(sum / count) : 0;
  }

  /**
   * 从麦克风初始化音频分析
   * @returns {Promise<AudioAnalyzer>}
   */
  async initFromMic() {
    this.dispose(); // 先清理旧资源

    this.ac = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this._stream = stream;
    this.source = this.ac.createMediaStreamSource(stream);
    this.analyser = this.ac.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.source.connect(this.analyser);
    // 注意: 麦克风不连 destination, 避免回声
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    return this;
  }

  /**
   * 从 <audio> 元素初始化音频分析
   * @param {HTMLAudioElement} audioEl
   * @returns {AudioAnalyzer}
   */
  initFromElement(audioEl) {
    this.dispose(); // 先清理旧资源

    this._audioEl = audioEl;
    this.ac = new (window.AudioContext || window.webkitAudioContext)();

    // 如果 audioEl 已经被其他 context 连接过, 重新创建元素
    let sourceEl = audioEl;
    try {
      this.source = this.ac.createMediaElementSource(audioEl);
    } catch (e) {
      // MediaElement already connected — create a fresh Audio element
      const newAudio = new Audio(audioEl.src);
      newAudio.volume = audioEl.volume;
      newAudio.currentTime = audioEl.currentTime;
      if (!audioEl.paused) newAudio.play();
      this._audioEl = newAudio;
      sourceEl = newAudio;
      this.source = this.ac.createMediaElementSource(newAudio);
    }

    this.analyser = this.ac.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.source.connect(this.analyser);
    this.source.connect(this.ac.destination); // 文件播放需要连输出
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    return this;
  }

  /**
   * 获取当前音频分析结果
   * @returns {{ subBass:number, bass:number, lowMid:number, mid:number,
   *             highMid:number, presence:number, brilliance:number,
   *             air:number, energy:number }}
   */
  getAnalysis() {
    const empty = {
      subBass: 0, bass: 0, lowMid: 0, mid: 0,
      highMid: 0, presence: 0, brilliance: 0, air: 0, energy: 0
    };

    if (!this.analyser || !this.freqData) return empty;

    const rate = this.ac ? this.ac.sampleRate : 44100;
    const target = { ...empty };

    try {
      this.analyser.getByteFrequencyData(this.freqData);
    } catch (e) {
      return empty;
    }

    const len = this.freqData.length;
    target.subBass    = this._bandRms(this.freqData, len, rate, 20, 60);
    target.bass       = this._bandRms(this.freqData, len, rate, 60, 150);
    target.lowMid     = this._bandRms(this.freqData, len, rate, 150, 300);
    target.mid        = this._bandRms(this.freqData, len, rate, 300, 1200);
    target.highMid    = this._bandRms(this.freqData, len, rate, 1200, 3000);
    target.presence   = this._bandRms(this.freqData, len, rate, 3000, 6000);
    target.brilliance = this._bandRms(this.freqData, len, rate, 6000, 12000);
    target.air        = this._bandRms(this.freqData, len, rate, 12000, 20000);

    // 总能量
    let energySum = 0;
    for (let i = 0; i < len; i++) energySum += this.freqData[i] / 255;
    target.energy = energySum / len;

    // 指数平滑
    const smooth = target.energy > 0.001 ? this.smoothing : this.smoothing * 0.5;
    for (const k of Object.keys(target)) {
      this[k] += (target[k] - this[k]) * smooth;
    }

    // Audio activity tracking
    const rawActive = this.energy > 0.005 ? 1 : 0;
    const prev = this._activity;
    this._activity += (rawActive - this._activity) * this.activeSmoothing;
    if (this.onActivityChange && Math.abs(this._activity - prev) > 0.05) {
      this.onActivityChange(this._activity);
    }

    return {
      subBass: this.subBass, bass: this.bass, lowMid: this.lowMid,
      mid: this.mid, highMid: this.highMid, presence: this.presence,
      brilliance: this.brilliance, air: this.air, energy: this.energy
    };
  }

  /**
   * 返回分析器是否活跃（已初始化且未关闭）
   * @returns {boolean}
   */
  isActive() {
    return !!(this.ac && this.analyser);
  }

  /**
   * 获取音频活动值 (0-1, 平滑后)
   * @returns {number}
   */
  getActivity() {
    return this._activity;
  }

  /**
   * 释放所有资源
   */
  dispose() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    if (this.ac && this.ac.state !== 'closed') {
      this.ac.close().catch(() => {});
    }
    this.ac = null;
    this.analyser = null;
    this.source = null;
    this.freqData = null;
    this._audioEl = null;
    this._activity = 0;
  }
}

// 支持 CommonJS 和浏览器全局
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioAnalyzer;
}
if (typeof window !== 'undefined') {
  window.AudioAnalyzer = AudioAnalyzer;
}
