/**
 * Built-in athlete / registration identity fields collected by Triboo
 * without custom `event_registration_fields`. Used to warn organizers
 * when custom field labels look like duplicates.
 */

export type BuiltinRegistrationFieldKind =
  | "email"
  | "first_name"
  | "last_name"
  | "date_of_birth"
  | "age"
  | "gender"
  | "guardian"
  | "phone"
  | "shirt_size"
  | "emergency"
  | "city";

/** Aliases in EN/ES (and common variants) — matched after normalize. */
const BUILTIN_ALIASES: Record<BuiltinRegistrationFieldKind, string[]> = {
  email: ["email", "correo", "correo electronico", "e-mail", "mail"],
  first_name: ["first name", "nombre", "nombres", "given name"],
  last_name: [
    "last name",
    "apellido",
    "apellidos",
    "apellido paterno",
    "apellido materno",
    "surname",
    "family name",
  ],
  date_of_birth: [
    "date of birth",
    "dob",
    "birth date",
    "birthday",
    "fecha de nacimiento",
    "fecha nacimiento",
  ],
  age: ["age", "edad"],
  gender: ["gender", "sexo", "genero", "género"],
  guardian: [
    "guardian",
    "tutor",
    "parent",
    "relationship",
    "parentesco",
    "relacion",
    "relación",
    "guardian relationship",
  ],
  phone: ["phone", "telefono", "teléfono", "celular", "mobile", "whatsapp"],
  shirt_size: [
    "shirt size",
    "t-shirt size",
    "tshirt size",
    "talla",
    "talla de playera",
    "talla playera",
    "playera",
  ],
  emergency: [
    "emergency",
    "emergency contact",
    "emergency phone",
    "emergency number",
    "contacto de emergencia",
    "numero de emergencia",
    "número de emergencia",
    "telefono de emergencia",
    "teléfono de emergencia",
  ],
  city: ["city", "ciudad"],
};

/** Always collected during registration (self, account, or guest). */
export const BUILTIN_ALWAYS_KINDS: BuiltinRegistrationFieldKind[] = [
  "email",
  "first_name",
  "last_name",
  "date_of_birth",
  "gender",
];

/** Derived / redundant with DOB. */
export const BUILTIN_DERIVED_KINDS: BuiltinRegistrationFieldKind[] = ["age"];

/** Collected for guest minors in multi-person orders. */
export const BUILTIN_GROUP_KINDS: BuiltinRegistrationFieldKind[] = ["guardian"];

/** On athlete profile but NOT required by the default wizard. */
export const BUILTIN_PROFILE_OPTIONAL_KINDS: BuiltinRegistrationFieldKind[] = [
  "phone",
  "shirt_size",
  "emergency",
  "city",
];

export function normalizeFieldLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match organizer custom-field labels to built-in identity/profile fields.
 * Prefer exact matches; use phrase containment for longer aliases; whole-word
 * for short tokens so "Nombre del club" is not flagged as first name.
 */
export function matchBuiltinRegistrationField(
  label: string,
): BuiltinRegistrationFieldKind | null {
  const normalized = normalizeFieldLabel(label);
  if (!normalized) return null;

  const entries = Object.entries(BUILTIN_ALIASES) as Array<
    [BuiltinRegistrationFieldKind, string[]]
  >;

  for (const [kind, aliases] of entries) {
    for (const alias of aliases) {
      if (normalized === alias) return kind;
    }
  }

  for (const [kind, aliases] of entries) {
    for (const alias of aliases) {
      if (alias.includes(" ") || alias.length >= 10) {
        if (normalized.includes(alias)) return kind;
        continue;
      }
      const word = new RegExp(`(?:^|\\s)${escapeRegExp(alias)}(?:\\s|$)`);
      // Single generic identity words only match when the whole label is that word
      // (already handled) or the label is ONLY that + noise we already normalized away.
      if (normalized === alias || word.test(normalized)) {
        // Avoid "nombre del club" / "edad categoria" style labels.
        if (normalized.split(" ").length > 1 && alias.length <= 8) {
          continue;
        }
        return kind;
      }
    }
  }
  return null;
}

export type BuiltinOverlapSeverity = "duplicate" | "profile_optional" | "derived";

export function builtinOverlapSeverity(
  kind: BuiltinRegistrationFieldKind,
): BuiltinOverlapSeverity {
  if (BUILTIN_ALWAYS_KINDS.includes(kind) || BUILTIN_GROUP_KINDS.includes(kind)) {
    return "duplicate";
  }
  if (BUILTIN_DERIVED_KINDS.includes(kind)) {
    return "derived";
  }
  return "profile_optional";
}
