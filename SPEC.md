# Flapping Bird Game - Specification

## 1. Project Overview

- **Project Name**: Flapping Bird
- **Type**: Browser-based arcade game (single HTML file)
- **Core Functionality**: A side-scrolling game where the player controls a bird that must navigate through gaps in pipes by flapping its wings
- **Target Users**: Casual gamers looking for quick, addictive gameplay

## 2. UI/UX Specification

### Layout Structure

- **Canvas**: 400px width × 600px height, centered on screen
- **Game Area**: Full canvas for gameplay
- **UI Overlay**: Score display at top-center, start/restart prompts centered

### Visual Design

#### Color Palette
- **Sky Gradient**: 
  - Top: `#1a1a2e` (deep night blue)
  - Bottom: `#16213e` (midnight blue)
- **Bird**: 
  - Body: `#ffd93d` (golden yellow)
  - Wing: `#ff6b35` (vibrant orange)
  - Eye: `#ffffff` with `#1a1a2e` pupil
  - Beak: `#ff6b35`
- **Pipes**:
  - Outer: `#2d3436` (dark charcoal)
  - Inner highlight: `#636e72` (lighter gray)
  - Cap: `#2d3436` with `#636e72` highlight
- **Ground**: `#2d3436` with grass texture pattern using `#00b894` (mint green)
- **Score Text**: `#ffffff` with `#000000` shadow
- **UI Text**: `#ffffff`

#### Typography
- **Font Family**: `"Press Start 2P"` (Google Font - pixel style)
- **Score**: 32px, positioned top-center
- **Game Over Text**: 24px
- **Instructions**: 14px

#### Visual Effects
- **Bird Animation**: Subtle wing flap (CSS transform)
- **Parallax Background**: Moving clouds/stars
- **Pipe Glow**: Subtle shadow on pipes
- **Screen Shake**: On collision

### Components

#### Bird
- Size: 40px × 30px
- Position: Starts at x=80, y=center
- Rotation: Tilts up when flapping, down when falling
- States: Flying, Collision (rotation), Game Over (falls)

#### Pipes
- Width: 70px
- Gap: 160px (vertical space between top/bottom pipes)
- Spacing: 200px horizontal distance between pipe pairs
- Speed: 3px per frame

#### Ground
- Height: 80px
- Animated scrolling texture

#### Score Display
- Shows current score during gameplay
- Shows high score on game over

#### Start Screen
- "Press SPACE or TAP to Start" text
- Bird preview with idle animation

#### Game Over Screen
- "GAME OVER" text
- Final score display
- High score display
- "Press SPACE or TAP to Restart" text

## 3. Functionality Specification

### Core Features

1. **Bird Physics**
   - Gravity: 0.5px/frame acceleration
   - Flap force: -8px velocity change on input
   - Max fall speed: 10px/frame
   - Rotation based on velocity (-30° to 90°)

2. **Pipe Generation**
   - Random gap vertical position (150px to 400px from top)
   - Continuous spawning when pipe exits left side
   - Remove pipes when fully off-screen

3. **Collision Detection**
   - Bird vs pipes (rectangle collision)
   - Bird vs ground (y position > canvas height - ground)
   - Bird vs ceiling (y position < 0)

4. **Scoring**
   - +1 point when bird passes pipe center
   - Track high score in localStorage

5. **Game States**
   - Start: Waiting for input
   - Playing: Active gameplay
   - Game Over: Collision occurred, waiting for restart

### User Interactions
- **Space key**: Flap / Start / Restart
- **Click/Tap**: Flap / Start / Restart
- **Any key during game over**: Restart

### Edge Cases
- Prevent multiple rapid flaps (cooldown: 100ms)
- Handle window blur (pause game)
- Handle window focus (resume)

## 4. Acceptance Criteria

1. ✅ Game loads and displays start screen
2. ✅ Pressing space/click starts the game
3. ✅ Bird responds to input with upward movement
4. ✅ Bird falls with gravity when not flapping
5. ✅ Pipes scroll from right to left continuously
6. ✅ Score increments when passing pipes
7. ✅ Collision with pipes ends the game
8. ✅ Collision with ground ends the game
9. ✅ Game over screen shows score and high score
10. ✅ Game can be restarted after game over
11. ✅ High score persists across sessions
12. ✅ Visual design matches spec (colors, fonts, animations)