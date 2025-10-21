import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  CELL,
  MAP_LAYOUT,
  LEGEND,
  TILE_TYPES,
  BURN_DURATIONS,
  FIRE_START,
  TRUCK_COUNT,
  TRUCK_RANGE,
  PLANE_CAPACITY,
  PLANE_COOLDOWN,
} from "./constants.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x151822);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(10, 18, 14);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.target.set(MAP_LAYOUT[0].length / 2, 0, MAP_LAYOUT.length / 2);
controls.maxPolarAngle = Math.PI / 2.2;
controls.minDistance = 10;
controls.maxDistance = 40;

const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xfff4d6, 0.9);
dir.position.set(10, 20, 0);
scene.add(dir);

const boardGroup = new THREE.Group();
scene.add(boardGroup);

const clock = new THREE.Clock();

const materials = {
  [TILE_TYPES.FOREST]: new THREE.MeshStandardMaterial({ color: 0x2e8b57 }),
  [TILE_TYPES.FIELD]: new THREE.MeshStandardMaterial({ color: 0xc9c92f }),
  [TILE_TYPES.RIVER]: new THREE.MeshStandardMaterial({ color: 0x3c6dc5, emissive: 0x0c223f, emissiveIntensity: 0.4 }),
  [TILE_TYPES.ROAD]: new THREE.MeshStandardMaterial({ color: 0x5b5f68 }),
  [TILE_TYPES.TOWN]: new THREE.MeshStandardMaterial({ color: 0xffb37c }),
  [TILE_TYPES.EMPTY]: new THREE.MeshStandardMaterial({ color: 0x8aa18a }),
  burnt: new THREE.MeshStandardMaterial({ color: 0x2a2b35 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xff532f }),
  truck: new THREE.MeshStandardMaterial({ color: 0xff5f6d, metalness: 0.3, roughness: 0.5 }),
  plane: new THREE.MeshStandardMaterial({ color: 0xb8d7ff, emissive: 0x5da0ff }),
};

class Tile {
  constructor(x, y, type) {
    this.gridX = x;
    this.gridY = y;
    this.type = type;
    this.status = "normal"; // normal, burning, burned, saved
    this.fireProgress = 0;
    this.extinguishProgress = 0;
    this.extinguishingTrucks = new Set();

    const height = this.type === TILE_TYPES.RIVER ? 0.2 : 0.6;
    const geometry = new THREE.BoxGeometry(CELL * 0.92, height, CELL * 0.92);
    const material = materials[this.type] || materials[TILE_TYPES.EMPTY];
    this.mesh = new THREE.Mesh(geometry, material.clone());
    this.mesh.position.set(x + CELL / 2, height / 2, y + CELL / 2);
    this.mesh.userData.tile = this;

    const detailHeight = this.type === TILE_TYPES.TOWN ? 1.4 : this.type === TILE_TYPES.FOREST ? 1.1 : 0.7;
    if (this.type !== TILE_TYPES.RIVER && this.type !== TILE_TYPES.ROAD) {
      const detailGeo = new THREE.BoxGeometry(CELL * 0.6, detailHeight, CELL * 0.6);
      const detailMesh = new THREE.Mesh(detailGeo, material.clone());
      detailMesh.position.y = height / 2 + detailHeight / 2;
      const assignTile = (obj) => {
        obj.userData.tile = this;
        obj.children.forEach(assignTile);
      };
      assignTile(detailMesh);
      this.mesh.add(detailMesh);
    }

    this.fireSprite = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 5), materials.glow);
    this.fireSprite.rotation.x = Math.PI;
    this.fireSprite.visible = false;
    this.fireSprite.position.y = 1.2;
    this.fireSprite.userData.tile = this;
    this.mesh.add(this.fireSprite);

    boardGroup.add(this.mesh);
  }

  isBurnable() {
    return this.type === TILE_TYPES.FOREST || this.type === TILE_TYPES.FIELD || this.type === TILE_TYPES.TOWN;
  }

  ignite() {
    if (!this.isBurnable() || this.status === "burning" || this.status === "burned" || this.status === "saved") return;
    this.status = "burning";
    this.fireProgress = 0;
    this.fireSprite.visible = true;
  }

  update(dt) {
    if (this.status === "burning") {
      const duration = BURN_DURATIONS[this.type] || 0;
      if (duration > 0) {
        this.fireProgress += dt;
        if (this.extinguishingTrucks.size > 0) {
          const extinguishRate = dt * this.extinguishingTrucks.size;
          this.extinguishProgress += extinguishRate;
          this.fireProgress = Math.max(0, this.fireProgress - extinguishRate);
          if (this.extinguishProgress >= duration) {
            this.quench();
            return "quenched";
          }
        } else if (this.extinguishProgress > 0) {
          this.extinguishProgress = Math.max(0, this.extinguishProgress - dt * 0.5);
        }
        if (this.fireProgress >= duration) {
          this.status = "burned";
          this.fireSprite.visible = false;
          this.mesh.material.color.set(materials.burnt.color);
          if (this.mesh.material.emissive) {
            this.mesh.material.emissive.setHex(0x0);
          }
          return "burned";
        }
      }
    }
    return null;
  }

  quench() {
    this.status = "saved";
    this.fireProgress = 0;
    this.extinguishProgress = 0;
    this.fireSprite.visible = false;
    this.mesh.material.color.offsetHSL(0.02, 0, 0.1);
    if (this.mesh.material.emissive) {
      this.mesh.material.emissive.setHex(0x144024);
    }
  }
}

const tiles = [];
const tileMap = new Map();

MAP_LAYOUT.forEach((row, y) => {
  [...row].forEach((symbol, x) => {
    const type = LEGEND[symbol] || TILE_TYPES.EMPTY;
    const tile = new Tile(x, y, type);
    tiles.push(tile);
    tileMap.set(`${x},${y}`, tile);
  });
});

const tileMeshes = tiles.map((tile) => tile.mesh);

const boardBaseGeo = new THREE.BoxGeometry(MAP_LAYOUT[0].length + 0.6, 0.5, MAP_LAYOUT.length + 0.6);
const boardBase = new THREE.Mesh(boardBaseGeo, new THREE.MeshStandardMaterial({ color: 0x1a1f30 }));
boardBase.position.set(MAP_LAYOUT[0].length / 2, -0.4, MAP_LAYOUT.length / 2);
boardBase.castShadow = false;
boardBase.receiveShadow = true;
scene.add(boardBase);

const burningTiles = new Set();

function neighbors(tile) {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const out = [];
  for (const [dx, dy] of dirs) {
    const nx = tile.gridX + dx;
    const ny = tile.gridY + dy;
    const next = tileMap.get(`${nx},${ny}`);
    if (next) out.push(next);
  }
  return out;
}

function ignite(tile) {
  if (!tile || !tile.isBurnable()) return;
  tile.ignite();
  burningTiles.add(tile);
}

ignite(tileMap.get(`${FIRE_START.x},${FIRE_START.y}`));

const roadTiles = tiles.filter((t) => t.type === TILE_TYPES.ROAD);
const roadSet = new Set(roadTiles.map((t) => `${t.gridX},${t.gridY}`));

let truckSpawnPoints = roadTiles
  .filter((tile) => tile.gridY >= MAP_LAYOUT.length - 6 && tile.gridX <= 5)
  .slice(0, TRUCK_COUNT)
  .map((tile) => ({ x: tile.gridX, y: tile.gridY }));
if (truckSpawnPoints.length < TRUCK_COUNT) {
  truckSpawnPoints = roadTiles.slice(0, TRUCK_COUNT).map((tile) => ({ x: tile.gridX, y: tile.gridY }));
}

class Truck {
  constructor(index, spawn) {
    this.index = index;
    this.gridPos = { ...spawn };
    this.position = new THREE.Vector3(spawn.x + 0.5, 1.2, spawn.y + 0.5);
    this.speed = 2.4; // tiles per second
    this.path = [];
    this.pathIndex = 0;
    this.state = "idle";
    this.target = null;

    const bodyGeo = new THREE.BoxGeometry(0.6, 0.4, 1.1);
    this.mesh = new THREE.Mesh(bodyGeo, materials.truck.clone());
    this.mesh.position.copy(this.position);
    this.mesh.geometry.translate(0, 0.2, 0);

    const cabGeo = new THREE.BoxGeometry(0.6, 0.4, 0.5);
    const cab = new THREE.Mesh(cabGeo, materials.truck.clone());
    cab.position.set(0, 0.35, 0.25);
    this.mesh.add(cab);

    const light = new THREE.PointLight(0xffc12f, 0.8, 4);
    light.position.y = 0.7;
    this.mesh.add(light);

    const assignUserData = (object) => {
      object.userData.truck = this;
      object.children.forEach(assignUserData);
    };
    assignUserData(this.mesh);

    boardGroup.add(this.mesh);
  }

  setPath(path) {
    this.path = path;
    this.pathIndex = 0;
    this.state = path.length > 0 ? "moving" : "idle";
  }

  update(dt) {
    if (this.state === "moving" && this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex];
      const targetVec = new THREE.Vector3(target.x + 0.5, 1.2, target.y + 0.5);
      const dir = targetVec.clone().sub(this.position);
      const dist = dir.length();
      const step = this.speed * dt;
      if (dist <= step) {
        this.position.copy(targetVec);
        this.gridPos = { x: target.x, y: target.y };
        this.pathIndex += 1;
        if (this.pathIndex >= this.path.length) {
          this.state = "holding";
        }
      } else {
        dir.normalize();
        this.position.addScaledVector(dir, step);
      }
      this.mesh.position.copy(this.position);
      if (dir.length() > 0) {
        this.mesh.lookAt(targetVec.x, 1.2, targetVec.z);
      }
    }
  }

  resetExtinguish() {
    tiles.forEach((tile) => tile.extinguishingTrucks.delete(this));
  }
}

const trucks = truckSpawnPoints.slice(0, TRUCK_COUNT).map((pos, idx) => new Truck(idx, pos));

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const uiState = {
  mode: null,
  selectedTruck: null,
  planeReadyAt: 0,
  flashMessage: null,
  flashUntil: 0,
};

const statusEl = document.getElementById("status");
const truckBtn = document.getElementById("selectTruck");
const planeBtn = document.getElementById("deployPlane");

function setFlashMessage(message, duration = 2500) {
  uiState.flashMessage = message;
  uiState.flashUntil = performance.now() + duration;
}

truckBtn.addEventListener("click", () => {
  uiState.mode = "truck";
  uiState.selectedTruck = null;
  setFlashMessage("Click a truck to dispatch.");
});

planeBtn.addEventListener("click", () => {
  const now = performance.now();
  if (now < uiState.planeReadyAt) {
    const remain = Math.ceil((uiState.planeReadyAt - now) / 1000);
    setFlashMessage(`Plane refilling: ${remain}s`);
    return;
  }
  uiState.mode = "plane";
  setFlashMessage("Click a burning area to drop water.");
});

function updatePlaneButton() {
  const now = performance.now();
  if (now < uiState.planeReadyAt) {
    const remain = Math.max(1, Math.ceil((uiState.planeReadyAt - now) / 1000));
    planeBtn.textContent = `Deploy Plane (${remain}s)`;
    planeBtn.disabled = true;
  } else {
    planeBtn.textContent = "Deploy Plane";
    planeBtn.disabled = false;
  }
}

function screenToTile(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(tileMeshes, true);
  if (intersects.length > 0) {
    let object = intersects[0].object;
    while (object && !object.userData.tile) {
      object = object.parent;
    }
    if (object && object.userData.tile) {
      const tile = object.userData.tile;
      return { x: tile.gridX, y: tile.gridY };
    }
  }
  return null;
}

renderer.domElement.addEventListener("click", (event) => {
  const tilePos = screenToTile(event);
  if (uiState.mode === "truck") {
    const intersects = raycaster.intersectObjects(trucks.map((t) => t.mesh), true);
    if (intersects.length > 0) {
      let object = intersects[0].object;
      while (object && !object.userData.truck) {
        object = object.parent;
      }
      const truck = object?.userData.truck;
      if (truck) {
        uiState.selectedTruck = truck;
        setFlashMessage("Now click a road tile to send the truck.");
        return;
      }
    }
    if (tilePos && uiState.selectedTruck) {
      const tile = tileMap.get(`${tilePos.x},${tilePos.y}`);
      if (tile && tile.type === TILE_TYPES.ROAD) {
        const path = findPath(uiState.selectedTruck.gridPos, tilePos);
        if (path.length > 0) {
          uiState.selectedTruck.resetExtinguish();
          uiState.selectedTruck.setPath(path.slice(1));
          setFlashMessage(`Truck ${uiState.selectedTruck.index + 1} en route.`);
        } else {
          setFlashMessage("No road path found.");
        }
      }
    }
  } else if (uiState.mode === "plane") {
    if (!tilePos) return;
    const dropTiles = findBurningTilesAround(tilePos, PLANE_CAPACITY);
    if (dropTiles.length === 0) {
      setFlashMessage("No active fire there.");
      return;
    }
    dropTiles.forEach((tile) => {
      tile.quench();
      burningTiles.delete(tile);
    });
    uiState.planeReadyAt = performance.now() + PLANE_COOLDOWN;
    setFlashMessage("Plane deployed!");
    uiState.mode = null;
    updatePlaneButton();
  }
});

function findBurningTilesAround(pos, limit) {
  const results = [];
  const visited = new Set();
  const queue = [{ ...pos, dist: 0 }];
  while (queue.length && results.length < limit) {
    const current = queue.shift();
    const key = `${current.x},${current.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const tile = tileMap.get(key);
    if (tile && tile.status === "burning") {
      results.push(tile);
    }
    if (results.length >= limit) break;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx >= 0 && ny >= 0 && nx < MAP_LAYOUT[0].length && ny < MAP_LAYOUT.length) {
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return results;
}

function findPath(start, goal) {
  if (start.x === goal.x && start.y === goal.y) return [start];
  const queue = [start];
  const cameFrom = new Map();
  const key = (pos) => `${pos.x},${pos.y}`;
  const visited = new Set([key(start)]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.x === goal.x && current.y === goal.y) {
      const path = [goal];
      let cKey = key(current);
      while (cameFrom.has(cKey)) {
        const prev = cameFrom.get(cKey);
        path.unshift(prev);
        cKey = key(prev);
      }
      return path;
    }
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nextKey = `${nx},${ny}`;
      if (!roadSet.has(nextKey) || visited.has(nextKey)) continue;
      visited.add(nextKey);
      queue.push({ x: nx, y: ny });
      cameFrom.set(nextKey, current);
    }
  }
  return [];
}

function trucksExtinguishUpdate() {
  for (const truck of trucks) {
    for (const tile of tiles) {
      tile.extinguishingTrucks.delete(truck);
    }
    const relevantTiles = Array.from(burningTiles).filter((tile) => {
      const dx = Math.abs(tile.gridX - truck.gridPos.x);
      const dy = Math.abs(tile.gridY - truck.gridPos.y);
      return dx + dy <= TRUCK_RANGE;
    });
    for (const tile of relevantTiles) {
      tile.extinguishingTrucks.add(truck);
    }
  }
}

function updateFire(dt) {
  const newlyFinished = [];
  for (const tile of Array.from(burningTiles)) {
    const result = tile.update(dt * 1000);
    if (result === "burned") {
      burningTiles.delete(tile);
      newlyFinished.push(...neighbors(tile));
    } else if (result === "quenched") {
      burningTiles.delete(tile);
    }
  }
  for (const tile of newlyFinished) {
    ignite(tile);
  }
}

function updateStatus() {
  const burning = Array.from(burningTiles).length;
  const saved = tiles.filter((tile) => tile.status === "saved").length;
  const now = performance.now();
  const baseMessage = burning === 0 ? `All fires out! Saved tiles: ${saved}` : `${burning} fires active.`;
  if (uiState.flashMessage && now < uiState.flashUntil) {
    statusEl.textContent = uiState.flashMessage;
  } else {
    statusEl.textContent = baseMessage;
    if (uiState.flashMessage && now >= uiState.flashUntil) {
      uiState.flashMessage = null;
    }
  }
  if (burning === 0) {
    uiState.mode = null;
  }
  updatePlaneButton();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  controls.update();

  trucks.forEach((truck) => truck.update(dt));
  trucksExtinguishUpdate();
  updateFire(dt);
  updateStatus();

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setFlashMessage("Select a truck or deploy the plane to protect the town!", 4000);
updateStatus();
animate();
