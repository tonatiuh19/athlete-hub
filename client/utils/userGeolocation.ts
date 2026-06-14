export type UserGeolocationFailure =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unknown";

export type UserGeolocationResult = {
  lat: number;
  lng: number;
};

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12_000,
  maximumAge: 300_000,
};

function mapGeolocationError(code: number): UserGeolocationFailure {
  switch (code) {
    case 1:
      return "denied";
    case 2:
      return "unavailable";
    case 3:
      return "timeout";
    default:
      return "unknown";
  }
}

export function requestUserPosition(
  options?: PositionOptions,
): Promise<UserGeolocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unsupported" satisfies UserGeolocationFailure));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(mapGeolocationError(error.code)));
      },
      { ...DEFAULT_OPTIONS, ...options },
    );
  });
}
