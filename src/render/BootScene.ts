import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'IDLE DEPOT\nFoundation build', {
        align: 'center',
        color: '#ffffff',
        fontSize: '28px',
      })
      .setOrigin(0.5);
  }
}
