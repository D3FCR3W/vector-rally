# How to play

[Back to the game overview](../README.md)

## Momentum

Your car moves on a grid. Each turn, you can change its horizontal and vertical velocity by −1, 0 or +1. The nine highlighted squares show the resulting landing positions.

For example, moving right at two cells per turn gives you landing columns one, two or three cells ahead. Choosing the middle column keeps your horizontal speed. Choosing the left column brakes; it does not immediately turn the car left.

To reverse, brake to a stop, then accelerate in the other direction. Turning also retains your momentum on the other axis, so plan ahead for corners.

| Control | Action |
| --- | --- |
| Click a highlighted square | Choose that landing position |
| Q W E / A S D / Z X C | Choose the corresponding square in the 3×3 grid |
| S or Space | Keep your current momentum |
| Arrow keys | Choose the top, left, right or bottom square |
| Mouse wheel or + / − | Zoom |
| Drag the track | Pan the view |
| F or Follow | Return to your car |
| Track or the mini-map | View the whole circuit |

The landing grid is hidden while cars move, during AI turns, while paused and during replay. Green indicates a clear move, amber a road hazard, and red a crash or fatal damage.

## Choose your circuit

Before starting, choose the circuit's length, corner style and road width. Shuffle the seed for another layout, or reuse the same seed and settings to race the same track.

The start can face up, right, down or left. Every driver starts level on a horizontal or vertical line with a clear launch area. Follow the direction your car faces, then the painted arrows clockwise.

Hidden shortcuts offer narrower routes around bends. Look for worn tracks, gaps in the verge and dark mountain entrances. Open trails stay visible; tunnel roofs fade as the drivers you are viewing enter, revealing the interior. Turning shortcuts off removes tunnels but keeps decorative mountains.

Shortcuts follow the same movement and collision rules as the road. They earn progress along the section they bypass; you still need all three checkpoints and a legal forward crossing of the finish line.

## Crashes, traps and repairs

Crossing the road boundary or another car causes a crash. The car travels to the impact and settles on its last safe road cell. A surviving crash normally limits both velocity components to one for the next three personal turns. Those turns remain playable, including diagonals.

Each car has **Tires**, **Engine** and **Body** condition bars. If any reaches zero, the car is out for the rest of the race. The other drivers continue; if everyone is out, nobody wins.

| Hazard | Effect |
| --- | --- |
| Pothole | Damages tires and body without stopping the car |
| Hard crash | Damages parts and can spill oil |
| Oil | Locks momentum and spins the car for three personal turns; only the center move is allowed |
| Police spikes | Deploy from round 2, damage tires and allow only braking for three personal turns |

With punctured tires, brake toward zero without reversing or accelerating. Once stopped, wait using the center square. Oil takes priority over punctures; both take priority over the ordinary crash speed cap.

Follow the cyan **PIT** detour and cross its white service marker to restore all parts and clear every penalty. You do not need to stop, but the lane is only one cell wide. Reach it before a part fails.

Ramps launch a car only in the ramp's direction with enough momentum. A jump skips one cell and needs a clear landing on the track. Airborne travel avoids road hazards, but cannot cross the circuit boundary.

## Living worlds

Choose Forest, Desert, Futuristic, Jungle, Sky, Sea or Space. Each has its own scenery, creatures and visual effects; the driving rules stay the same.

| World | Hidden-route effects |
| --- | --- |
| Forest | Grass tracks and dirt |
| Desert | Sand ruts |
| Futuristic | Green, purple, yellow or mixed neon trails |
| Jungle | Mud and leaves |
| Sky | Vapor trails |
| Sea | Foamy wakes and bubbles |
| Space | Violet plasma trails |

With **Living scenery** enabled, grounded wildlife blocks the square where you land. Passing through its square is safe; flying creatures do not block you. An animal walking onto a parked car never causes a crash. Switching living scenery off also removes these wildlife collisions.

Help, the menu, hidden tabs and reduced-motion preferences pause wildlife animation. Theme and scenery choices are remembered when you start a race.

## AI opponents and camera

Consecutive AI drivers move in one shared animation, ending before the next human's turn. Their moves still resolve in seat order and follow the same damage and collision rules. AI tries to keep a safe braking route; if another car blocks every escape, a crash can still happen.

The camera stays with a human during AI turns. Use **Frame** to choose:

- **Active human** — follow the human driver.
- **Nearby rivals** — include the racer immediately ahead and behind by race progress.
- **All drivers** — keep everyone in view.
- **Choose drivers** — select any nonempty group of human or AI cars.

An all-AI race defaults to showing everyone. Group framing also works during replay. Camera choices reset when a new race starts.
