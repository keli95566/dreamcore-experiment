// Copyright (c) 2025  Ke Li
// SPDX-License-Identifier: MIT
export class AudioAnalyzer {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.dataArray = null;
    this.bufferLength = 0;
    this.audioReady = false;
  }

  async setupAudio(mp3URL) {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const response = await fetch(mp3URL);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

    const audioSource = this.audioCtx.createBufferSource();
    audioSource.buffer = audioBuffer;

    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);

    audioSource.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
    audioSource.start();

    this.audioReady = true;
  }

  getAverageAmplitude() {
    if (!this.audioReady) return 0;
    this.analyser.getByteFrequencyData(this.dataArray);
    const avg = this.dataArray.reduce((a, b) => a + b, 0) / this.dataArray.length;
    return avg / 255;
  }
}
