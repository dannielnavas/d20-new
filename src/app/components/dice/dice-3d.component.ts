import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-dice-3d',
  standalone: true,
  template: `
    <div
      #shell
      [style.width]="fullscreen ? 'min(72vw, 72vh, 34rem)' : '9rem'"
      [style.height]="fullscreen ? 'min(72vw, 72vh, 34rem)' : '9rem'"
      style="position:relative;display:inline-block"
    >
      <canvas
        #canvas
        width="144"
        height="144"
        style="width:100%;height:100%;display:block;z-index:1"
      ></canvas>
      <div
        #floatRef
        [style.fontSize]="fullscreen ? 'clamp(2rem, 7vmin, 4.5rem)' : '32px'"
        style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;pointer-events:none;opacity:0;transform:scale(0.6);transition:opacity .35s,transform .35s;z-index:50"
      >
        <span
          #floatSpan
          style="display:inline-block;padding:8px 12px;border-radius:12px;color:#ffffff;background:rgba(0,0,0,0.55);backdrop-filter:none;text-shadow:0 6px 18px rgba(0,0,0,0.6);font-family:var(--font-display, system-ui);letter-spacing:0.02em"
        ></span>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dice3dComponent implements AfterViewInit, OnDestroy {
  @ViewChild('shell', { static: true }) private readonly shellRef!: ElementRef<HTMLDivElement>;
  @ViewChild('canvas', { static: true }) private readonly canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('floatRef', { static: true }) private readonly floatRef!: ElementRef<HTMLDivElement>;
  @ViewChild('floatSpan', { static: true })
  private readonly floatSpan!: ElementRef<HTMLSpanElement>;
  @Input() fullscreen = false;

  private _value?: number;
  @Input()
  set value(v: number | undefined) {
    this._value = v;
    if (this._initialized) this.playRoll(v);
  }
  get value(): number | undefined {
    return this._value;
  }
  @Input() dieType?: string;

  private _initialized = false;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private dice!: THREE.Mesh;
  private frameId = 0;
  private frame = 0;
  private edgeMat!: THREE.LineBasicMaterial;
  private glowMat!: THREE.MeshBasicMaterial;
  private resizeObserver?: ResizeObserver;

  private phase: 'idle' | 'rolling' | 'landing' | 'settled' = 'idle';
  private rollStart = 0;
  private rollDuration = 900; // ms
  private motionStartX = 0;
  private motionStartY = 0;
  private motionEndX = 0;
  private motionEndY = 0;
  private motionArc = 0;
  private motionScale = 1;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 0, 4.5);

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.syncRendererSize();

    const geo = new THREE.IcosahedronGeometry(1.35, 0);
    const posAttr = geo.attributes['position'] as THREE.BufferAttribute | undefined;
    const posArr = (posAttr?.array as Float32Array) || new Float32Array();
    const colors = new Float32Array(posArr.length);
    const basePalette = [
      [0.12, 0.06, 0.28],
      [0.14, 0.07, 0.32],
      [0.1, 0.05, 0.24],
      [0.16, 0.08, 0.35],
      [0.09, 0.04, 0.22],
      [0.13, 0.065, 0.3],
    ];
    const faceCount = Math.max(1, posArr.length / 9);
    for (let f = 0; f < faceCount; f++) {
      const c = basePalette[f % basePalette.length];
      for (let v = 0; v < 3; v++) {
        colors[(f * 3 + v) * 3 + 0] = c[0];
        colors[(f * 3 + v) * 3 + 1] = c[1];
        colors[(f * 3 + v) * 3 + 2] = c[2];
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const edgeGeo = new THREE.EdgesGeometry(geo);
    this.edgeMat = new THREE.LineBasicMaterial({
      color: 0x9060e8,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.9,
    });
    const edges = new THREE.LineSegments(edgeGeo, this.edgeMat);

    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0x6020c0,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });

    const mat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 80,
      specular: new THREE.Color(0.4, 0.2, 0.9),
    });
    this.dice = new THREE.Mesh(geo, mat);
    this.dice.add(edges);
    this.scene.add(this.dice);

    const glowGeo = new THREE.SphereGeometry(1.1, 16, 16);
    const glow = new THREE.Mesh(glowGeo, this.glowMat);
    this.scene.add(glow);

    const ambient = new THREE.AmbientLight(0x3010a0, 0.6);
    this.scene.add(ambient);
    const pLight = new THREE.PointLight(0xc080ff, 2.2, 10);
    pLight.position.set(2, 2, 3);
    this.scene.add(pLight);

    this._initialized = true;
    if (this._value !== undefined) this.playRoll(this._value);
    this.resizeObserver = new ResizeObserver(() => this.syncRendererSize());
    this.resizeObserver.observe(this.shellRef.nativeElement);
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    try {
      this.renderer?.dispose();
    } catch {}
  }

  private animate(): void {
    this.frameId = requestAnimationFrame(() => this.animate());
    this.frame++;

    const now = performance.now();
    if (this.phase === 'idle') {
      this.dice.rotation.y += 0.008;
      this.dice.rotation.x = Math.sin(this.frame * 0.01) * 0.18;
      this.glowMat.opacity = 0.06 + Math.sin(this.frame * 0.05) * 0.02;
      this.applyShellMotion(0, 0, 1);
    } else if (this.phase === 'rolling') {
      // spin quickly
      this.dice.rotation.x += 0.6 + Math.sin(this.frame * 0.6) * 0.1;
      this.dice.rotation.y += 0.9 + Math.cos(this.frame * 0.55) * 0.12;
      this.dice.rotation.z += 0.45 + Math.sin(this.frame * 0.4) * 0.08;
      this.glowMat.opacity = 0.18 + Math.sin(this.frame * 0.18) * 0.06;
      this.updateRollingMotion(now);
      if (now - this.rollStart > this.rollDuration) {
        this.phase = 'landing';
      }
    } else if (this.phase === 'landing') {
      // settle with small wobble
      this.dice.rotation.x += Math.sin(this.frame * 0.3) * 0.02;
      this.dice.rotation.z *= 0.9;
      this.glowMat.opacity *= 0.9;
      this.edgeMat.opacity = 0.95;
      this.applyShellMotion(this.motionEndX * 0.12, this.motionEndY * 0.12, 1.02);
      // show float result and move to settled
      this.showFloatResult();
      this.phase = 'settled';
    } else if (this.phase === 'settled') {
      this.dice.rotation.y += 0.003;
      this.glowMat.opacity = 0.05 + Math.sin(this.frame * 0.04) * 0.02;
      this.edgeMat.opacity = 0.9;
      this.applyShellMotion(0, 0, 1);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private showFloatResult(): void {
    const v = this._value;
    if (v === undefined) return;
    const el = this.floatRef.nativeElement;
    const span = this.floatSpan.nativeElement;
    let label = String(v);
    if (v === 20) {
      label = 'Nat 20';
    } else if (v === 1) {
      label = 'Nat 1';
    }
    span.textContent = label;
    if (v === 20) {
      span.style.background = 'linear-gradient(160deg,#fff4cc,#ffe090)';
      span.style.color = '#2b1a00';
      this.edgeMat.color.setHex(0xf0c040);
    } else if (v === 1) {
      span.style.background = 'linear-gradient(160deg,#ff9b9b,#ff8080)';
      span.style.color = '#2b0b0b';
      this.edgeMat.color.setHex(0xe05050);
    } else {
      span.style.background = 'rgba(0,0,0,0.55)';
      span.style.color = '#ffffff';
      this.edgeMat.color.setHex(0x9060e8);
    }
    el.style.opacity = '1';
    el.style.transform = 'scale(1)';
    // hide after 2.2s
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.6)';
    }, 2200);
  }

  private playRoll(v?: number): void {
    if (!this._initialized) return;
    this.phase = 'rolling';
    this.rollStart = performance.now();
    this.rollDuration = 1200 + Math.random() * 500;
    this._value = v;
    this.prepareThrowPath();
    const el = this.floatRef?.nativeElement;
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.6)';
    }
    // set edge color for rolling state
    this.edgeMat.color.setHex(0x9060e8);
  }

  private syncRendererSize(): void {
    const shell = this.shellRef.nativeElement;
    const size = Math.max(144, Math.floor(Math.min(shell.clientWidth, shell.clientHeight)));
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(size, size, false);
  }

  private prepareThrowPath(): void {
    if (!this.fullscreen) return;
    const horizontalDirection = Math.random() > 0.5 ? 1 : -1;
    const verticalDirection = Math.random() > 0.5 ? 1 : -1;
    this.motionStartX = horizontalDirection * (window.innerWidth * (0.24 + Math.random() * 0.18));
    this.motionStartY = verticalDirection * (window.innerHeight * (0.1 + Math.random() * 0.1));
    this.motionEndX = -horizontalDirection * (window.innerWidth * (0.06 + Math.random() * 0.08));
    this.motionEndY = window.innerHeight * (0.04 + Math.random() * 0.05);
    this.motionArc = window.innerHeight * (0.16 + Math.random() * 0.12);
    this.motionScale = 0.86 + Math.random() * 0.1;
    this.applyShellMotion(this.motionStartX, this.motionStartY, this.motionScale);
  }

  private updateRollingMotion(now: number): void {
    if (!this.fullscreen) return;
    const elapsed = Math.min(1, (now - this.rollStart) / this.rollDuration);
    const eased = 1 - Math.pow(1 - elapsed, 3);
    const x = this.motionStartX + (this.motionEndX - this.motionStartX) * eased;
    const baseY = this.motionStartY + (this.motionEndY - this.motionStartY) * eased;
    const arc = -4 * this.motionArc * elapsed * (1 - elapsed);
    const wobble = Math.sin(elapsed * Math.PI * 6) * 18 * (1 - elapsed);
    const scale = this.motionScale + (1 - this.motionScale) * eased;
    this.applyShellMotion(x, baseY + arc + wobble, scale);
  }

  private applyShellMotion(x: number, y: number, scale: number): void {
    if (!this.fullscreen) {
      this.shellRef.nativeElement.style.transform = '';
      return;
    }

    this.shellRef.nativeElement.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }
}
