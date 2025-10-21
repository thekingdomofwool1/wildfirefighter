# Wildfire Fighter

Wildfire Fighter is a small browser-based strategy toy where you command six fire trucks and an air tanker to protect a cozy voxel village from an encroaching blaze.

## Features

- Charming faux-voxel presentation built with Three.js and WebGL.
- Dynamic wildfire simulation with different burn rates for forests, fields, and town homes.
- Click-to-command fire trucks that must stick to the road network but can hose down flames within five tiles.
- Deployable water bomber plane that douses up to four burning tiles at a time with a short cooldown.
- Win condition when every flame on the map is extinguished.

## Getting started

You do not need any build tooling—everything runs directly in the browser.

1. Ensure you have a simple static file server available. Any of the following commands (pick one) will work from the project root:
   - `python -m http.server 8000`
   - `npx http-server -p 8000`
   - `npx serve .`
2. Open your browser to `http://localhost:8000/`.
3. You should see the Wildfire Fighter board. Use the in-game UI to learn the controls and start saving the town!

If you prefer to use a different port, adjust the URL accordingly.

## Controls recap

- **Select Truck** → click the button, pick a truck in the scene, then click any road tile to dispatch it. Trucks automatically fight flames within a five tile radius of their parking spot.
- **Deploy Plane** → click the button and then any burning tile to douse up to four fires at once. The button will display a cooldown timer while the tanker refills.

## Tech stack

- [Three.js](https://threejs.org/) via CDN for rendering.
- Vanilla JavaScript modules—no bundler required.
- Lightweight HTML/CSS UI overlay for controls and instructions.

## Development tips

- The code lives in `src/`. Start at `src/main.js` for the game loop and interaction logic.
- The map layout, tile legend, and simulation constants are centralized in `src/constants.js`.
- Hot reloading is as simple as refreshing your browser tab.