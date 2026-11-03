import Phaser from 'phaser';
import { BootScene } from './render/BootScene';

// Foundation stub only. The playable depot is Phase 1 and starts after architecture review.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0e1621',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: [BootScene],
});
