// Copyright (c) 2025  Ke Li
// SPDX-License-Identifier: MIT

import * as THREE from "three";
import { SparkControls, SplatMesh, dyno } from "@sparkjsdev/spark";
import GUI from "lil-gui";
import { createShaderEffects } from "./shaderEffects.js";
import { AudioAnalyzer } from "./audio.js";


// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Load model
const splatMesh = new SplatMesh({ url: "./resources/spz/subway_overgrown_with_flowers.spz" });
splatMesh.quaternion.set(1, 0, 0, 0);
splatMesh.position.set(0, 0, -1.5);
splatMesh.scale.set(0.5, 0.5, 0.5);
scene.add(splatMesh);

// Controls
const controls = new SparkControls({ canvas: renderer.domElement });

// GUI parameters
const effectParams = { effect: "Perlin Wave", intensity: 0.8, scaleBlend : 0.01, waveFrequency: 1, waveAmplitute: 0.1, waveSpeed: 0.5 };
const gui = new GUI({ title: "Shader Effects" });
gui.add(effectParams, "effect", ["Electronic", "Deep Meditation", "Waves", "Disintegrate", "Flare",  "Wind",  "Magic", "Perlin Wave"])
  .name("Effect Type")
  .onChange(() => {
    if(effectParams.effect == "Magic"){
      resetTime();
    }
    splatMesh.updateGenerator()
  });
// gui.add(effectParams, "intensity", 0, 1, 0.01)
//   .name("Intensity")
//   .onChange(() => splatMesh.updateGenerator());

effectParams.scaleBlend = 0.001; 
effectParams.waveAmplitute = 0.1; 
effectParams.waveSpeed= 0.5;
effectParams.waveFrequency = 1; 

gui.add(effectParams, "scaleBlend", 0, 1, 0.01)
  .name("Scale Blend")
  .onChange(() => splatMesh.updateGenerator());

gui.add(effectParams, "waveFrequency", 0.2, 6, 0.1)
  .name("Wave Frequency")
  .onChange(() => splatMesh.updateGenerator());

gui.add(effectParams, "waveAmplitute", -0.2, 0.2, 0.01)
  .name("Wave Amplitute")
  .onChange(() => splatMesh.updateGenerator());

gui.add(effectParams, "waveSpeed", 0, 2, 0.01)
  .name("Wave Speed")
  .onChange(() => splatMesh.updateGenerator());



const audioAnalyzer = new AudioAnalyzer();
gui.add({ playMusic: () => audioAnalyzer.setupAudio("./Resources/music/Sundrenched_Underwater_Dreamcore.mp3") }, "playMusic").name("Play Music");


// Shader setup
const animateT = dyno.dynoFloat(0);
createShaderEffects(splatMesh, effectParams, animateT);

let baseTime = 0; 
let reloadAnim = false; 
// Animation controls
const guiControls = {
  resetTime: () => {
    baseTime = 0;
    animateT.value = 0;
    reloadAnim = true; 
  }
};

function resetTime(){
    baseTime = 0;
    animateT.value = 0;
    reloadAnim = true; 
}
gui.add(guiControls, 'resetTime').name('Reset Time');

// Animation loop
renderer.setAnimationLoop((time) => {
  
  if(reloadAnim){
    baseTime = 0; 
    animateT.value = 0;
    reloadAnim = false; 
  }else{
    baseTime += 1/60;
    animateT.value = baseTime;

  }
  // Audio-reactive intensity
  const avgAmplitude = audioAnalyzer.getAverageAmplitude();
  effectParams.intensity = 0.1 + avgAmplitude * 1.5;

  splatMesh.updateGenerator();
  controls.update(camera);
  renderer.render(scene, camera);
});
