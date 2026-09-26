# PlanetXplorer

An interactive 3D solar system explorer that runs in the browser. Drag to rotate, scroll to zoom, and click any planet to fly to it.

## Features

- **Realistic motion** – Uses NASA/JPL rotation and orbital periods. Time runs from 1× real time up to 10 million times speed.
- **Interactive 3D scene** – Drag to rotate, scroll or pinch to zoom, click a planet to focus. Arrow keys orbit, +/− zoom.
- **Planet data panel** – Diameter, mass, gravity, temperature, orbital period, axial tilt, and a fun fact for each object.
- **Compare view** – Side-by-side size and stat comparison of any two worlds.
- **Quiz** – 8-question solar system quiz with scoring and best-score tracking.
- **Saved state** – Favourites, explored objects, and quiz scores persist in localStorage.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure, canvas, controls, and modals |
| `style.css` | Dark glass-morphism UI and responsive layout |
| `script.js` | 3D scene, planet data, simulation logic, and all interactions |

## Running

No build step needed. Just open `index.html` in a modern browser with an internet connection (Three.js is loaded from a CDN).

## Controls

- **Drag / arrow keys** – rotate the camera
- **Scroll / pinch / + −** – zoom
- **Click a planet** – fly to it
- **Time slider** – speed up or slow down the simulation (1× = real time)
- **1× / Reset time** – jump to real-time speed or reset the simulation clock
- **Orbits / Labels / Axes** – toggle visual aids
- **Distance scale** – switch between teaching and wider (closer to real) spacing
- **Reset view** – return to the overview

## Notes

Sizes and distances are visually simplified so every world fits on screen. Rotation and orbital rates are accurate, but spin axes all lean the same way, and the Moon's orbital inclination is not modelled.

## Credits

Built with [Three.js](https://threejs.org/) (r128). Planet data based on NASA/JPL Planetary Fact Sheets.
