# Vector Rally

A turn-based pixel racing game for **1–4 players**, with optional AI opponents. Pick your next landing square, build momentum, and brake before the next corner.

Race through seven worlds on generated circuits, discover hidden routes, dodge traps and repair your car. Watch the replay or export a **60 fps video at 4× speed** to share your race.

## Play locally

You need **Node.js 22 or later**. No package installation or build step is needed.

```sh
git clone https://github.com/D3FCR3W/vector-rally.git
cd vector-rally
npm start
```

Open **[localhost:4173](http://localhost:4173)** and keep the terminal running. Choose a world, a circuit and your drivers, then select **Let's race**.

## How to play

- **Click a highlighted square** to choose where your car lands.
- **The center square keeps your momentum.** Choose against your direction of travel to brake.
- **Green** means a clear move, **amber** warns of a hazard, and **red** warns of a crash or fatal damage.
- Complete one clockwise lap, passing all three checkpoints. Use the repair lane before a car part reaches zero.

Drag to look around, scroll to zoom, and press **F** to follow your car. The **?** button opens the rules.

Play is local on a shared screen. Settings are remembered, but refreshing the page resets the current race.

## Learn more

- [Controls, circuits and racing rules](docs/how-to-play.md)
- [Replays and video export](docs/replays-and-video.md)
- [Development, tests and project structure](docs/development.md)
