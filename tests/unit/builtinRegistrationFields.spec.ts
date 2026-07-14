import { describe, expect, it } from "vitest";
import {
  builtinOverlapSeverity,
  matchBuiltinRegistrationField,
  normalizeFieldLabel,
} from "../../client/utils/builtinRegistrationFields";

describe("normalizeFieldLabel", () => {
  it("strips accents and punctuation", () => {
    expect(normalizeFieldLabel("  Género!!! ")).toBe("genero");
    expect(normalizeFieldLabel("Fecha de nacimiento")).toBe("fecha de nacimiento");
  });
});

describe("matchBuiltinRegistrationField", () => {
  it("matches exact EN/ES identity labels", () => {
    expect(matchBuiltinRegistrationField("Nombre")).toBe("first_name");
    expect(matchBuiltinRegistrationField("Apellidos")).toBe("last_name");
    expect(matchBuiltinRegistrationField("Correo")).toBe("email");
    expect(matchBuiltinRegistrationField("Date of birth")).toBe("date_of_birth");
    expect(matchBuiltinRegistrationField("Edad")).toBe("age");
    expect(matchBuiltinRegistrationField("Género")).toBe("gender");
  });

  it("matches longer phrase aliases", () => {
    expect(matchBuiltinRegistrationField("Fecha de nacimiento")).toBe("date_of_birth");
    expect(matchBuiltinRegistrationField("Contacto de emergencia")).toBe("emergency");
    expect(matchBuiltinRegistrationField("Talla de playera")).toBe("shirt_size");
  });

  it("does not flag race-specific labels that only contain a word fragment", () => {
    expect(matchBuiltinRegistrationField("Nombre del club")).toBeNull();
    expect(matchBuiltinRegistrationField("Estado de nacimiento")).toBeNull();
    expect(matchBuiltinRegistrationField("Edad de la categoría")).toBeNull();
  });
});

describe("builtinOverlapSeverity", () => {
  it("marks always-collected and guardian as duplicate", () => {
    expect(builtinOverlapSeverity("email")).toBe("duplicate");
    expect(builtinOverlapSeverity("guardian")).toBe("duplicate");
  });

  it("marks age as derived", () => {
    expect(builtinOverlapSeverity("age")).toBe("derived");
  });

  it("marks profile optionals as soft warnings", () => {
    expect(builtinOverlapSeverity("phone")).toBe("profile_optional");
    expect(builtinOverlapSeverity("shirt_size")).toBe("profile_optional");
  });
});
