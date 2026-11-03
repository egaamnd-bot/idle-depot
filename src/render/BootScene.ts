import Phaser from 'phaser';
import { ASSETS, AUDIO, type AssetEntry, type AssetGroup } from '../assets/manifest';
import { assetUrl } from '../assets/urls';

/**
 * Foundation scene: loads every registered asset through Phaser and shows them as a gallery.
 * This is an asset-integration check, not gameplay. The playable depot is Phase 1.
 */
export class BootScene extends Phaser.Scene {
  private failed: string[] = [];

  constructor() {
    super('BootScene');
  }

  preload(): void {
    const status = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Loading assets…', { color: '#ffffff', fontSize: '20px' })
      .setOrigin(0.5);
    this.load.on('progress', (p: number) => status.setText(`Loading assets… ${Math.round(p * 100)}%`));
    this.load.on('loaderror', (file: Phaser.Loader.File) => this.failed.push(String(file.key)));

    // Rasterise SVGs at device pixel ratio so they stay sharp on high-density phones.
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    for (const asset of ASSETS) {
      const url = assetUrl(asset);
      if (asset.kind === 'svg') this.load.svg(asset.id, url, { scale });
      else this.load.audio(asset.id, url);
    }
  }

  create(): void {
    this.children.removeAll();
    this.cameras.main.setBackgroundColor('#cfe3f0');

    const groups: AssetGroup[] = ['container', 'vehicle', 'building', 'worker', 'environment', 'tile', 'ui-icon'];
    const thumb = 52;
    let y = 36;
    this.add.text(12, 8, 'IDLE DEPOT — asset gallery', { color: '#14243a', fontSize: '16px' });

    for (const group of groups) {
      const items = ASSETS.filter((a) => a.group === group && a.kind === 'svg');
      let x = 12;
      for (const item of items) {
        if (x + thumb > this.scale.width) {
          x = 12;
          y += thumb + 6;
        }
        this.addThumb(item, x, y, thumb);
        x += thumb + 6;
      }
      y += thumb + 10;
    }

    const loadedSvg = ASSETS.filter((a) => a.kind === 'svg' && this.textures.exists(a.id)).length;
    const totalSvg = ASSETS.filter((a) => a.kind === 'svg').length;
    const loadedAudio = ASSETS.filter((a) => a.kind === 'audio' && this.cache.audio.exists(a.id)).length;
    const totalAudio = ASSETS.filter((a) => a.kind === 'audio').length;
    const summary = `svg ${loadedSvg}/${totalSvg} · audio ${loadedAudio}/${totalAudio} · failed ${this.failed.length}`;
    this.add.text(12, y, `${summary}\nTap anywhere to play a click sound.`, { color: '#14243a', fontSize: '14px' });

    // Machine-readable result for automated browser checks.
    document.body.dataset.assetsSvg = `${loadedSvg}/${totalSvg}`;
    document.body.dataset.assetsAudio = `${loadedAudio}/${totalAudio}`;
    document.body.dataset.assetsFailed = this.failed.join(',');

    this.input.on('pointerdown', () => {
      this.sound.play(AUDIO.sfx.click, { volume: 0.5 });
    });
  }

  private addThumb(item: AssetEntry, x: number, y: number, size: number): void {
    if (!this.textures.exists(item.id)) {
      this.add.rectangle(x + size / 2, y + size / 2, size, size, 0xff0000, 0.4);
      return;
    }
    const img = this.add.image(x + size / 2, y + size / 2, item.id);
    const s = Math.min(size / img.width, size / img.height);
    img.setScale(s);
  }
}
