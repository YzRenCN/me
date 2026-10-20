
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- 配置常量 ---
const CONFIG = {
    WALL_HEIGHT: 4,
    CELL_SIZE: 4,
    MAP_SIZE: 20, // 20x20 网格
    MOVE_SPEED: 5.0,
    RUN_SPEED: 9.0,
    SANITY_DRAIN_RATE: 0.5, // 每秒下降值
    COLORS: {
        WALL: 0xd4c47c, // 经典黄壁纸
        FLOOR: 0xc2b280, // 潮湿地毯
        CEILING: 0xaaaaaa,
        LIGHT: 0xffffee
    }
};

// --- 全局状态 ---
let scene, camera, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, canJump = false, isRunning = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let mapData = []; // 0: empty, 1: wall
let walls = [];
let sanity = 100;
let audioCtx, humOscillator, humGain;
let isGameActive = false;

// --- 初始化 ---
function init() {
    const container = document.getElementById('game-container');

    // 场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    scene.fog = new THREE.FogExp2(0x111111, 0.15); // 浓雾营造压抑感

    // 相机
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 1.7; // 玩家身高

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: false }); // 关闭抗锯齿以增强复古感
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // 控制器
    controls = new PointerLockControls(camera, document.body);
    
    // 事件监听
    setupEventListeners();
    
    // 生成地图
    generateLevel();
    
    // 灯光
    setupLighting();

    // 循环
    animate();
}

// --- 地图生成 (简单的递归回溯或随机生长) ---
function generateLevel() {
    // 初始化全墙
    for (let x = 0; x < CONFIG.MAP_SIZE; x++) {
        mapData[x] = [];
        for (let z = 0; z < CONFIG.MAP_SIZE; z++) {
            mapData[x][z] = 1; 
        }
    }

    // 简单的随机挖掘算法生成走廊
    let currentX = Math.floor(CONFIG.MAP_SIZE / 2);
    let currentZ = Math.floor(CONFIG.MAP_SIZE / 2);
    mapData[currentX][currentZ] = 0;
    
    // 玩家出生点
    camera.position.x = currentX * CONFIG.CELL_SIZE;
    camera.position.z = currentZ * CONFIG.CELL_SIZE;

    const steps = 150; // 挖掘步数
    for (let i = 0; i < steps; i++) {
        const dir = Math.floor(Math.random() * 4);
        if (dir === 0) currentX++;
        else if (dir === 1) currentX--;
        else if (dir === 2) currentZ++;
        else if (dir === 3) currentZ--;

        // 边界检查
        if (currentX > 0 && currentX < CONFIG.MAP_SIZE - 1 && currentZ > 0 && currentZ < CONFIG.MAP_SIZE - 1) {
            mapData[currentX][currentZ] = 0;
        }
    }

    // 构建3D网格
    const wallGeo = new THREE.BoxGeometry(CONFIG.CELL_SIZE, CONFIG.WALL_HEIGHT, CONFIG.CELL_SIZE);
    const floorGeo = new THREE.PlaneGeometry(CONFIG.CELL_SIZE, CONFIG.CELL_SIZE);
    const ceilGeo = new THREE.PlaneGeometry(CONFIG.CELL_SIZE, CONFIG.CELL_SIZE);

    // 材质 (使用程序化纹理模拟)
    const wallMat = createWallMaterial();
    const floorMat = createCarpetMaterial();
    const ceilMat = new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.CEILING });

    for (let x = 0; x < CONFIG.MAP_SIZE; x++) {
        for (let z = 0; z < CONFIG.MAP_SIZE; z++) {
            const posX = x * CONFIG.CELL_SIZE;
            const posZ = z * CONFIG.CELL_SIZE;

            // 地板
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(posX, 0, posZ);
            scene.add(floor);

            // 天花板
            const ceil = new THREE.Mesh(ceilGeo, ceilMat);
            ceil.rotation.x = Math.PI / 2;
            ceil.position.set(posX, CONFIG.WALL_HEIGHT, posZ);
            scene.add(ceil);

            // 墙壁
            if (mapData[x][z] === 1) {
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set(posX, CONFIG.WALL_HEIGHT / 2, posZ);
                scene.add(wall);
                walls.push(wall); // 用于碰撞检测简化版
            } else {
                // 在空地随机放置荧光灯
                if (Math.random() > 0.7) {
                    addFluorescentLight(posX, posZ);
                }
            }
        }
    }
}

// --- 程序化纹理生成 ---
function createWallMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // 底色
    ctx.fillStyle = '#d4c47c';
    ctx.fillRect(0, 0, 512, 512);
    
    // 污渍
    for(let i=0; i<50; i++) {
        ctx.fillStyle = `rgba(100, 80, 40, ${Math.random() * 0.1})`;
        ctx.beginPath();
        ctx.arc(Math.random()*512, Math.random()*512, Math.random()*50, 0, Math.PI*2);
        ctx.fill();
    }
    
    // 壁纸接缝
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(256, 0); ctx.lineTo(256, 512);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
}

function createCarpetMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#bba36d';
    ctx.fillRect(0, 0, 512, 512);
    
    // 噪点模拟地毯纤维
    for(let i=0; i<5000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#a3905e' : '#c9b67e';
        ctx.fillRect(Math.random()*512, Math.random()*512, 2, 2);
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
}

function addFluorescentLight(x, z) {
    // 灯管模型
    const geo = new THREE.BoxGeometry(2, 0.1, 0.2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lightMesh = new THREE.Mesh(geo, mat);
    lightMesh.position.set(x, CONFIG.WALL_HEIGHT - 0.1, z);
    scene.add(lightMesh);

    // 实际光源
    const light = new THREE.PointLight(CONFIG.COLORS.LIGHT, 1, 15);
    light.position.set(x, CONFIG.WALL_HEIGHT - 0.5, z);
    // 随机闪烁逻辑
    light.userData = { originalIntensity: 1, flickerSpeed: Math.random() * 0.1 };
    scene.add(light);
    
    // 添加一个环境光辅助
    const ambient = new THREE.AmbientLight(0x404040, 0.2);
    scene.add(ambient);
}

function setupLighting() {
    // 基础微弱环境光
    const ambient = new THREE.AmbientLight(0x404040); 
    scene.add(ambient);
}

// --- 音频系统 (Web Audio API) ---
function initAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    
    // 创建荧光灯嗡嗡声
    humOscillator = audioCtx.createOscillator();
    humGain = audioCtx.createGain();
    
    humOscillator.type = 'sawtooth';
    humOscillator.frequency.value = 50; // 50Hz 电流声
    
    // 低通滤波器使声音沉闷
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120;
    
    humOscillator.connect(filter);
    filter.connect(humGain);
    humGain.connect(audioCtx.destination);
    
    humGain.gain.value = 0.05; // 初始音量
    humOscillator.start();
}

function updateAudio(dt) {
    if (!audioCtx) return;
    // 模拟电流不稳
    if (Math.random() < 0.01) {
        humGain.gain.setTargetAtTime(0.02, audioCtx.currentTime, 0.1);
        setTimeout(() => humGain.gain.setTargetAtTime(0.05, audioCtx.currentTime, 0.1), 100);
    }
}

// --- 交互与逻辑 ---
function setupEventListeners() {
    const startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', () => {
        document.getElementById('start-screen').style.opacity = 0;
        setTimeout(() => document.getElementById('start-screen').style.display = 'none', 1000);
        document.getElementById('hud').style.display = 'block';
        controls.lock();
        initAudio();
        isGameActive = true;
        logMessage("你进入了 Level 0。这里只有黄色壁纸和潮湿的地毯。");
    });

    controls.addEventListener('unlock', () => {
        document.getElementById('pause-menu').classList.remove('hidden');
        isGameActive = false;
    });
    
    document.getElementById('resume-btn').addEventListener('click', () => {
        controls.lock();
        document.getElementById('pause-menu').classList.add('hidden');
        isGameActive = true;
    });

    const onKeyDown = function (event) {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': moveForward = true; break;
            case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
            case 'ArrowDown': case 'KeyS': moveBackward = true; break;
            case 'ArrowRight': case 'KeyD': moveRight = true; break;
            case 'ShiftLeft': isRunning = true; break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': moveForward = false; break;
            case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
            case 'ArrowDown': case 'KeyS': moveBackward = false; break;
            case 'ArrowRight': case 'KeyD': moveRight = false; break;
            case 'ShiftLeft': isRunning = false; break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function logMessage(text) {
    const log = document.getElementById('message-log');
    const item = document.createElement('div');
    item.className = 'msg-item';
    item.innerText = `> ${text}`;
    log.appendChild(item);
    if (log.children.length > 4) log.removeChild(log.firstChild);
}

// --- 碰撞检测 (简易网格版) ---
function checkCollision(newPos) {
    const gridX = Math.round(newPos.x / CONFIG.CELL_SIZE);
    const gridZ = Math.round(newPos.z / CONFIG.CELL_SIZE);
    
    // 检查周围格子是否是墙
    if (gridX >= 0 && gridX < CONFIG.MAP_SIZE && gridZ >= 0 && gridZ < CONFIG.MAP_SIZE) {
        if (mapData[gridX][gridZ] === 1) {
            // 简单的距离判断，防止穿墙
            const wallCenterX = gridX * CONFIG.CELL_SIZE;
            const wallCenterZ = gridZ * CONFIG.CELL_SIZE;
            const dist = Math.sqrt(Math.pow(newPos.x - wallCenterX, 2) + Math.pow(newPos.z - wallCenterZ, 2));
            if (dist < CONFIG.CELL_SIZE / 2 + 0.3) return true; // 0.3 是玩家半径
        }
    }
    return false;
}

// --- 主循环 ---
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked && isGameActive) {
        // 移动逻辑
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const speed = isRunning ? CONFIG.RUN_SPEED : CONFIG.MOVE_SPEED;

        if (moveForward || moveBackward) velocity.z -= direction.z * 40.0 * delta * speed;
        if (moveLeft || moveRight) velocity.x -= direction.x * 40.0 * delta * speed;

        // 预测下一帧位置进行碰撞检测
        const oldPos = camera.position.clone();
        
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        
        if (checkCollision(camera.position)) {
            camera.position.copy(oldPos); // 撞墙回退
            velocity.set(0,0,0);
        }

        // 理智值系统
        sanity -= CONFIG.SANITY_DRAIN_RATE * delta;
        if (sanity <= 0) {
            sanity = 0;
            logMessage("你的理智已耗尽... 它们来了。");
            // 这里可以添加 Game Over 逻辑
        }
        
        // 更新UI
        document.getElementById('sanity-bar').style.width = `${sanity}%`;
        if (sanity < 30) document.getElementById('sanity-bar').style.backgroundColor = '#ff0000';
        
        // 灯光闪烁效果
        scene.traverse((object) => {
            if (object.isPointLight && object.userData.flickerSpeed) {
                if (Math.random() < 0.05) {
                    object.intensity = Math.random() * 2;
                } else {
                    object.intensity = object.userData.originalIntensity;
                }
            }
        });
        
        updateAudio(delta);
    }

    prevTime = time;
    renderer.render(scene, camera);
}

init();
