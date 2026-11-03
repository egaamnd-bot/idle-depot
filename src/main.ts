import Phaser from 'phaser';
import { composeApp } from './app/compose';
import { createWebPlatform } from './platform/web';
import { BootScene } from './render/BootScene';

// Foundation only. The playable depot is Phase 1 proper and starts after the rules and art gates in docs/PHASE_1_PLAN.md.
async function main(): Promise<void> {
  const app = await composeApp(createWebPlatform());
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0e1621',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [],
  });
  game.scene.add('BootScene', BootScene, true, { app });
}

void main();
