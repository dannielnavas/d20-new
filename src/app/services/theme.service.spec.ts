import { DOCUMENT } from "@angular/common";
import { TestBed } from "@angular/core/testing";

import { ThemeService } from "./theme.service";

describe("ThemeService", () => {
  it("aplica tema y persiste en localStorage", () => {
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: document }],
    });

    const service = TestBed.inject(ThemeService);
    service.setTheme("light");

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("d20.theme")).toBe("light");

    service.toggle();
    expect(service.theme()).toBe("dark");
  });
});
