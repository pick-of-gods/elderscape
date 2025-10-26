import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js';
import { GLTFExporter } from 'https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/exporters/GLTFExporter.js';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setSize(512,512);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75,1,0.1,1000);
camera.position.z = 5;
scene.add(new THREE.AmbientLight(0xffffff,1));

let currentModelId = null;

export async function loadModel(id){
  currentModelId = id;
  scene.clear();
  const res = await fetch(`https://raw.githubusercontent.com/Kbro1989/Rs3-ai-api/main/models/${id}.json`);
  if(!res.ok) throw new Error(`Model ${id} not found`);
  const d = await res.json();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(d.vertices.flat(),3));
  const mat = new THREE.MeshStandardMaterial({
    color:new THREE.Color(...d.color.map(c=>c/255)),
    transparent:d.alphamode!=='opaque'
  });
  scene.add(new THREE.Mesh(geo,mat));
  renderer.render(scene,camera);
  return d;
}

export async function exportAsset(type='png'){
  let blob;
  if(type==='gltf'){
    const exp = new GLTFExporter();
    blob = await new Promise(r=>exp.parse(scene,gltf=>r(new Blob([JSON.stringify(gltf)],{type:'model/gltf+json'})),{binary:false}));
  }else{
    blob = dataURLtoBlob(renderer.domElement.toDataURL('image/png'));
  }
  const form = new FormData();
  form.append('file',blob,`model_${currentModelId}.${type}`);
  form.append('modelId',currentModelId);
  form.append('type',type);
  const r = await fetch('/api/export',{method:'POST',body:form});
  return r.json();
}

function dataURLtoBlob(url){
  const [h,b] = url.split(',');
  const bin = atob(b);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:h.match(/:(.*?);/)[1]});
}

export async function batchExport(ids,types=['png']){
  const out=[];
  for(const id of ids){
    try{
      await loadModel(id);
      for(const t of types) out.push(await exportAsset(t));
    }catch(e){console.warn(e);}
    scene.clear();
  }
  return out;
}