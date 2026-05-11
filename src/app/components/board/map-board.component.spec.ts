import { TestBed } from "@angular/core/testing";

import { MapBoardComponent } from "./map-board.component";

describe("MapBoardComponent", () => {
  it("should create", async () => {
    await TestBed.configureTestingModule({ imports: [MapBoardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(MapBoardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
