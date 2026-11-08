# Velocity City — Procedural Driving & Parking Simulator

A mobile-first, browser-based single-player driving sandbox built with **Three.js**, **cannon-es**, and **Vite**. Cars, rims, city assets, signs, road textures, particles, and sounds are generated at runtime. The game does not download external 3D models, photos, textures, or audio tracks.

## Requirements

- Node.js **22.12.0 or newer**
- npm
- A modern desktop or mobile browser with WebGL 2 support

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build:

```bash
npm run build
npm run preview
```

The generated static site is written to `dist/`.

## Deploy to Vercel

1. Extract this project and push the `velocity-city` folder to a Git repository.
2. In Vercel, choose **Add New → Project** and import that repository.
3. Use the following project settings (Vercel can also detect Vite automatically):
   - Framework preset: **Vite**
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy. The included `vercel.json` configures the Vite framework and SPA fallback rewrite.

No environment variables or external asset hosting are required.

## Controls

### Touchscreen (landscape recommended)

- **Left thumb:** drag the steering wheel to steer; release to recenter.
- **Right thumb:** hold the accelerator or brake; use the handbrake independently.
- **Gear selector:** choose P, R, N, or D. Use M− / M+ to enable manual shifting.
- **Camera:** switch between chase, cockpit, hood, and wheel views; drag the view to orbit.
- **Indicators / hazards / headlights / horn:** use the left-side buttons.
- **Quick settings:** drivetrain, traction control, ABS, stability assist, drift mode, engine start/stop, and respawn.
- **Garage:** buy cars, install engine swaps and parts, set gearbox ratios, adjust suspension and camber, move the center of gravity, and customize exterior finishes.

The steering, pedals, camera, and walk joystick track each touch's individual `Touch.identifier`, so controls can be used simultaneously. The page disables browser gesture handling over the game surface to prevent accidental scrolling and pinch zoom.

### Keyboard fallback

- `W` / `↑`: throttle
- `S` / `↓`: brake / reverse input
- `A` / `←`, `D` / `→`: steer
- `Space`: handbrake
- `[` / `]`: manual gear down / up
- `C`: change camera
- `G`: open garage
- `F`: enter / exit walk mode
- `E`: interact with a nearby service zone or mission
- `R`: respawn
- `H`: headlights

## Game systems

- Six procedural vehicle designs, showroom display, owned-car progression, and a starting balance of **$500,000**.
- Engine swaps, bolt-on upgrades, calculated power/torque, gearbox ratios and presets, suspension/camber/offset adjustments, and draggable COG tuning.
- Procedurally constructed downtown grid, four-lane highway loop, barriers, street furniture, buildings, drift plaza, parking bays, service station, dealership, bridge, ramp, toll gantries, and speed traps.
- Ten parking challenges, drift scoring, highway speed-trap rewards, refuelling, repair, and car-wash interactions.
- Raycast-wheel suspension and drivetrain forces, gear ratios, braking, tire grip, steering, traction/stability assists, skid marks, smoke, exhaust effects, and synthesized Web Audio engine/tire/horn effects.
- Local progress saved in browser `localStorage`.

## Scope and implementation notes

This is a **single-player browser simulator**, not an online multiplayer service. It does not include accounts, matchmaking, a shared authoritative server, voice chat, cloud saves, or cross-device progression. The driving model is a custom `cannon-es` raycast-vehicle implementation with game-oriented tire and assist approximations; it is not a validated real-world vehicle dynamics package and is not an exact reproduction of another game's proprietary physics. Mobile devices vary considerably in WebGL performance, so shadow quality and renderer pixel ratio are capped for performance.

All visible vehicles and world props are generated from Three.js geometry and CanvasTextures. Audio is synthesized with the Web Audio API after the player first interacts with the page. Progress is local to the current browser profile.
