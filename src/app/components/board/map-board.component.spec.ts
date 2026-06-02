import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapBoardComponent } from './map-board.component';

describe('MapBoardComponent', () => {
  let fixture: ComponentFixture<MapBoardComponent>;
  let component: MapBoardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MapBoardComponent] }).compileComponents();

    fixture = TestBed.createComponent(MapBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should zoom in by 10%', () => {
    component.zoomIn();

    expect(component.zoom()).toBe(1.1);
  });

  it('should zoom out by 10%', () => {
    component.zoomOut();

    expect(component.zoom()).toBe(0.9);
  });

  it('should clamp zoom in at max 3', () => {
    component.zoom.set(2.95);

    component.zoomIn();
    component.zoomIn();

    expect(component.zoom()).toBe(3);
  });

  it('should clamp zoom out at min 0.2', () => {
    component.zoom.set(0.25);

    component.zoomOut();
    component.zoomOut();

    expect(component.zoom()).toBe(0.2);
  });

  it('should reset zoom and pan', () => {
    component.zoom.set(1.8);
    component.panX.set(120);
    component.panY.set(-30);

    component.resetZoom();

    expect(component.zoom()).toBe(1);
    expect(component.panX()).toBe(0);
    expect(component.panY()).toBe(0);
  });

  it('should reflect zoom in board transform style', () => {
    component.zoomIn();
    fixture.detectChanges();

    const boardWrapper = fixture.nativeElement.querySelector('.origin-top-left') as HTMLElement;
    expect(boardWrapper.style.transform).toContain('scale(1.1)');
  });
});
